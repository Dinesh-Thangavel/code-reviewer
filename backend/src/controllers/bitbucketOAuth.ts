/**
 * Bitbucket OAuth Controller
 * Handles OAuth initiation, callback, and repository management
 */

import { Request, Response } from 'express';
import {
    getOAuthUrl,
    verifyState,
    exchangeCodeForToken,
    getBitbucketUser,
    encryptToken,
    decryptToken,
    getUserRepositories,
} from '../services/bitbucketOAuth';
import prisma from '../db';
import * as crypto from 'crypto';
import { createAuditLog } from '../services/auditLog';
import { getUserIdFromToken, signToken } from '../utils/jwt';
import { getFrontendBaseUrl } from '../utils/frontendUrl';

/**
 * Initiate Bitbucket OAuth flow
 * Supports both authenticated users (connecting account) and unauthenticated (sign in)
 */
export const initiateOAuth = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const { mode = 'connect', redirect } = req.query; // 'connect' or 'signin'

        let userId: string | null = null;

        // If authenticated, get user ID
        if (token && mode === 'connect') {
            const extractedUserId = getUserIdFromToken(token);
            if (!extractedUserId) {
                return res.status(401).json({ error: 'Invalid token' });
            }
            userId = extractedUserId;
        }

        // For sign-in mode, userId is null (will be set in callback)
        const { url } = getOAuthUrl(userId || 'signin');

        // Support browser navigation without CORS: /api/auth/bitbucket?mode=signin&redirect=1
        if (redirect === '1' || redirect === 'true') {
            return res.redirect(url);
        }

        res.json({
            success: true,
            authUrl: url,
        });
    } catch (error: any) {
        console.error('Error initiating Bitbucket OAuth:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth flow' });
    }
};

/**
 * Handle Bitbucket OAuth callback
 * Supports both connecting existing account and signing in with Bitbucket
 */
export const handleOAuthCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.redirect(`${getFrontendBaseUrl()}/login?error=missing_params`);
        }

        // Verify state
        const stateVerification = verifyState(state as string);
        if (!stateVerification.valid || !stateVerification.userId) {
            console.error('[Bitbucket OAuth] State verification failed:', {
                state: state,
                valid: stateVerification.valid,
                userId: stateVerification.userId,
            });
            return res.redirect(`${getFrontendBaseUrl()}/login?error=invalid_state`);
        }
        
        console.log('[Bitbucket OAuth] State verified successfully:', {
            userId: stateVerification.userId,
        });

        const userIdOrSignin = stateVerification.userId;

        // Exchange code for token
        let accessToken: string;
        try {
            accessToken = await exchangeCodeForToken(code as string);
            console.log('[Bitbucket OAuth] Successfully exchanged code for token');
        } catch (tokenError: any) {
            console.error('[Bitbucket OAuth] Failed to exchange code for token:', tokenError);
            throw new Error(`Token exchange failed: ${tokenError.message}`);
        }

        // Get Bitbucket user info
        let bitbucketUser: any;
        try {
            bitbucketUser = await getBitbucketUser(accessToken);
            console.log('[Bitbucket OAuth] Successfully fetched Bitbucket user:', bitbucketUser.username);
        } catch (userError: any) {
            console.error('[Bitbucket OAuth] Failed to fetch Bitbucket user:', userError);
            throw new Error(`Failed to fetch Bitbucket user: ${userError.message}`);
        }

        // Check if this is sign-in mode or connect mode
        if (userIdOrSignin === 'signin') {
            // Sign-in mode: Find or create user by Bitbucket UUID or email
            let user = await prisma.user.findUnique({
                where: { bitbucketId: bitbucketUser.uuid },
            });

            // If not found by Bitbucket UUID, check by email
            if (!user && bitbucketUser.email) {
                user = await prisma.user.findUnique({
                    where: { email: bitbucketUser.email.toLowerCase() },
                });
                
                // If found by email, update to link Bitbucket account
                if (user) {
                    console.log(`[Bitbucket OAuth] Found existing user by email, linking Bitbucket account: ${bitbucketUser.email}`);
                    const encryptedToken = encryptToken(accessToken);
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            bitbucketId: bitbucketUser.uuid,
                            bitbucketUsername: bitbucketUser.username,
                            bitbucketToken: encryptedToken,
                            bitbucketConnected: true,
                            avatar: bitbucketUser.links?.avatar?.href || undefined,
                            name: bitbucketUser.display_name || user.name,
                        },
                    });
                }
            }

            // If still not found, create new user
            if (!user) {
                console.log(`[Bitbucket OAuth] Creating new user for Bitbucket account: ${bitbucketUser.username}`);
                const encryptedToken = encryptToken(accessToken);
                try {
                    user = await prisma.user.create({
                        data: {
                            email: bitbucketUser.email || `${bitbucketUser.username}@bitbucket.local`,
                            name: bitbucketUser.display_name || bitbucketUser.username,
                            password: crypto.randomBytes(32).toString('hex'), // Random password (user won't use it)
                            bitbucketId: bitbucketUser.uuid,
                            bitbucketUsername: bitbucketUser.username,
                            bitbucketToken: encryptedToken,
                            bitbucketConnected: true,
                            avatar: bitbucketUser.links?.avatar?.href || undefined,
                        },
                    });
                } catch (createError: any) {
                    // If creation fails due to email constraint, try to find and update
                    if (createError.code === 'P2002' && createError.meta?.target?.includes('email')) {
                        console.log(`[Bitbucket OAuth] Email already exists, finding and updating user: ${bitbucketUser.email}`);
                        user = await prisma.user.findUnique({
                            where: { email: bitbucketUser.email.toLowerCase() },
                        });
                        if (user) {
                            const encryptedToken = encryptToken(accessToken);
                            user = await prisma.user.update({
                                where: { id: user.id },
                                data: {
                                    bitbucketId: bitbucketUser.uuid,
                                    bitbucketUsername: bitbucketUser.username,
                                    bitbucketToken: encryptedToken,
                                    bitbucketConnected: true,
                                    avatar: bitbucketUser.links?.avatar?.href || undefined,
                                    name: bitbucketUser.display_name || user.name,
                                },
                            });
                        } else {
                            throw createError;
                        }
                    } else {
                        throw createError;
                    }
                }
            } else {
                // Update existing user's Bitbucket connection with new token
                console.log(`[Bitbucket OAuth] Updating existing user's Bitbucket connection: ${user.id}`);
                const encryptedToken = encryptToken(accessToken);
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        bitbucketToken: encryptedToken,
                        bitbucketConnected: true,
                        bitbucketUsername: bitbucketUser.username,
                        avatar: bitbucketUser.links?.avatar?.href || undefined,
                        email: bitbucketUser.email || user.email,
                        name: bitbucketUser.display_name || user.name,
                    },
                });
            }

            // Generate JWT token for the user
            const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
            const token = signToken(
                { userId: user.id, email: user.email },
                JWT_EXPIRES_IN
            );

            // Create audit log for Bitbucket connection (sign-in mode)
            await createAuditLog({
                userId: user.id,
                action: 'bitbucket_connected',
                entityType: 'user',
                entityId: user.id,
                details: { bitbucketUsername: bitbucketUser.username, mode: 'signin' },
                ipAddress: req.ip || req.socket.remoteAddress || undefined,
                userAgent: req.get('user-agent') || undefined,
            });

            // Automatically fetch and connect repositories (CodeRabbit-style)
            try {
                const repos = await getUserRepositories(accessToken);
                
                // Connect all repositories automatically
                for (const repo of repos) {
                    // Only connect repos where user has admin or write access
                    if (repo.permissions.admin || repo.permissions.write) {
                        try {
                            const existingRepo = await prisma.repository.findFirst({
                                where: { fullName: repo.full_name },
                            });

                            if (!existingRepo) {
                                await prisma.repository.create({
                                    data: {
                                        name: repo.name,
                                        fullName: repo.full_name,
                                        provider: 'BITBUCKET',
                                        userId: user.id,
                                        bitbucketRepoUuid: repo.uuid,
                                        bitbucketWorkspace: repo.workspace.slug,
                                        isActive: true,
                                        autoReview: true,
                                        isUserConnected: true,
                                    },
                                });
                                console.log(`[Bitbucket OAuth] Created new repository ${repo.full_name} for user ${user.id}`);
                            } else {
                                // CRITICAL: Always update userId to current user, even if repo exists
                                if (existingRepo.userId !== user.id) {
                                    console.log(`[Bitbucket OAuth] Updating repository ${repo.full_name} from userId ${existingRepo.userId} to ${user.id}`);
                                }
                                await prisma.repository.update({
                                    where: { id: existingRepo.id },
                                    data: {
                                        userId: user.id, // Always update to current user
                                        bitbucketRepoUuid: repo.uuid,
                                        bitbucketWorkspace: repo.workspace.slug,
                                        provider: 'BITBUCKET',
                                        isUserConnected: true,
                                    },
                                });
                            }
                        } catch (repoError) {
                            console.error(`Error connecting repo ${repo.full_name}:`, repoError);
                            // Continue with other repos even if one fails
                        }
                    }
                }
                console.log(`[Bitbucket OAuth] Automatically connected ${repos.length} repositories for user ${user.id}`);
            } catch (repoError) {
                console.error('[Bitbucket OAuth] Error automatically fetching repositories:', repoError);
                // Don't fail the OAuth flow if repo fetching fails
            }

            // Redirect to repositories page (CodeRabbit-style: show repos immediately)
            res.redirect(`${getFrontendBaseUrl()}/auth/callback?token=${token}&bitbucket_signin=true&redirect=repositories`);
        } else {
            // Connect mode: Update existing user
            const encryptedToken = encryptToken(accessToken);

            await prisma.user.update({
                where: { id: userIdOrSignin },
                data: {
                    bitbucketId: bitbucketUser.uuid,
                    bitbucketUsername: bitbucketUser.username,
                    bitbucketToken: encryptedToken,
                    bitbucketConnected: true,
                    avatar: bitbucketUser.links?.avatar?.href || undefined,
                },
            });

            // Create audit log for Bitbucket connection (connect mode)
            await createAuditLog({
                userId: userIdOrSignin,
                action: 'bitbucket_connected',
                entityType: 'user',
                entityId: userIdOrSignin,
                details: { bitbucketUsername: bitbucketUser.username, mode: 'connect' },
                ipAddress: req.ip || req.socket.remoteAddress || undefined,
                userAgent: req.get('user-agent') || undefined,
            });

            // Automatically fetch and connect repositories (CodeRabbit-style)
            try {
                const repos = await getUserRepositories(accessToken);
                
                // Connect all repositories automatically
                for (const repo of repos) {
                    // Only connect repos where user has admin or write access
                    if (repo.permissions.admin || repo.permissions.write) {
                        try {
                            // Use upsert to prevent duplicates and ensure atomic operation
                            const existingRepo = await prisma.repository.upsert({
                                where: { fullName: repo.full_name },
                                update: {
                                    // Always update userId to current user (handles account switching)
                                    userId: userIdOrSignin,
                                    bitbucketRepoUuid: repo.uuid,
                                    bitbucketWorkspace: repo.workspace.slug,
                                    provider: 'BITBUCKET',
                                    isUserConnected: true,
                                    name: repo.name, // Update name in case it changed
                                },
                                create: {
                                    name: repo.name,
                                    fullName: repo.full_name,
                                    provider: 'BITBUCKET',
                                    userId: userIdOrSignin,
                                    bitbucketRepoUuid: repo.uuid,
                                    bitbucketWorkspace: repo.workspace.slug,
                                    isActive: true,
                                    autoReview: true,
                                    isUserConnected: true,
                                },
                            });
                            
                            if (existingRepo.userId !== userIdOrSignin) {
                                console.log(`[Bitbucket OAuth] Updated repository ${repo.full_name} to userId ${userIdOrSignin}`);
                            } else {
                                console.log(`[Bitbucket OAuth] Repository ${repo.full_name} already connected for user ${userIdOrSignin}`);
                            }
                        } catch (repoError) {
                            console.error(`Error connecting repo ${repo.full_name}:`, repoError);
                            // Continue with other repos even if one fails
                        }
                    }
                }
                console.log(`[Bitbucket OAuth] Automatically connected ${repos.length} repositories for user ${userIdOrSignin}`);
            } catch (repoError) {
                console.error('[Bitbucket OAuth] Error automatically fetching repositories:', repoError);
                // Don't fail the OAuth flow if repo fetching fails
            }

            // Redirect to repositories page with success
            res.redirect(`${getFrontendBaseUrl()}/repositories?bitbucket_connected=true`);
        }
    } catch (error: any) {
        console.error('Error handling Bitbucket OAuth callback:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response?.data,
        });
        const errorMessage = error.message || 'oauth_failed';
        res.redirect(`${getFrontendBaseUrl()}/login?error=${encodeURIComponent(errorMessage)}`);
    }
};

/**
 * Disconnect Bitbucket account
 */
export const disconnectBitbucket = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Remove Bitbucket connection
        await prisma.user.update({
            where: { id: userId },
            data: {
                bitbucketId: null,
                bitbucketUsername: null,
                bitbucketToken: null,
                bitbucketConnected: false,
            },
        });

        // Create audit log for Bitbucket disconnection
        await createAuditLog({
            userId,
            action: 'bitbucket_disconnected',
            entityType: 'user',
            entityId: userId,
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
        });

        res.json({
            success: true,
            message: 'Bitbucket account disconnected',
        });
    } catch (error: any) {
        console.error('Error disconnecting Bitbucket:', error);
        res.status(500).json({ error: 'Failed to disconnect Bitbucket account' });
    }
};
