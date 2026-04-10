/**
 * GitHub OAuth Controller
 * Handles OAuth initiation, callback, and repository management
 */

import { Request, Response } from 'express';
import {
    getOAuthUrl,
    verifyState,
    exchangeCodeForToken,
    getGitHubUser,
    encryptToken,
    decryptToken,
    getUserRepositories,
} from '../services/githubOAuth';
import prisma from '../db';
import * as crypto from 'crypto';
import { createAuditLog } from '../services/auditLog';
import { getUserIdFromToken, signToken } from '../utils/jwt';
import { getFrontendBaseUrl } from '../utils/frontendUrl';
import { oauthCallbackErrorCode } from '../utils/oauthErrorCode';

/**
 * Initiate GitHub OAuth flow
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

        // Support browser navigation without CORS: /api/auth/github?mode=signin&redirect=1
        if (redirect === '1' || redirect === 'true') {
            return res.redirect(url);
        }

        res.json({
            success: true,
            authUrl: url,
        });
    } catch (error: any) {
        console.error('Error initiating OAuth:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth flow' });
    }
};

/**
 * Handle GitHub OAuth callback
 * Supports both connecting existing account and signing in with GitHub
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
            console.error('[OAuth] State verification failed:', {
                state: state,
                valid: stateVerification.valid,
                userId: stateVerification.userId,
            });
            return res.redirect(`${getFrontendBaseUrl()}/login?error=invalid_state`);
        }
        
        console.log('[OAuth] State verified successfully:', {
            userId: stateVerification.userId,
        });

        const userIdOrSignin = stateVerification.userId;

        // Exchange code for token
        let accessToken: string;
        try {
            accessToken = await exchangeCodeForToken(code as string);
            console.log('[OAuth] Successfully exchanged code for token');
        } catch (tokenError: any) {
            console.error('[OAuth] Failed to exchange code for token:', tokenError);
            throw new Error(`Token exchange failed: ${tokenError.message}`);
        }

        // Get GitHub user info
        let githubUser: any;
        try {
            githubUser = await getGitHubUser(accessToken);
            console.log('[OAuth] Successfully fetched GitHub user:', githubUser.login);
        } catch (userError: any) {
            console.error('[OAuth] Failed to fetch GitHub user:', userError);
            throw new Error(`Failed to fetch GitHub user: ${userError.message}`);
        }

        // Check if this is sign-in mode or connect mode
        if (userIdOrSignin === 'signin') {
            // Sign-in mode: Find or create user by GitHub ID or email
            // First, try to find by GitHub ID (most reliable)
            let user = await prisma.user.findUnique({
                where: { githubId: githubUser.id.toString() },
            });

            // If not found by GitHub ID, check by email (user might have signed up with email first)
            if (!user && githubUser.email) {
                user = await prisma.user.findUnique({
                    where: { email: githubUser.email.toLowerCase() },
                });
                
                // If found by email, update to link GitHub account
                if (user) {
                    console.log(`[OAuth] Found existing user by email, linking GitHub account: ${githubUser.email}`);
                    const encryptedToken = encryptToken(accessToken);
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            githubId: githubUser.id.toString(),
                            githubUsername: githubUser.login,
                            githubToken: encryptedToken,
                            githubConnected: true,
                            avatar: githubUser.avatar_url || undefined,
                            // Update name in case it changed on GitHub
                            name: githubUser.name || user.name,
                        },
                    });
                }
            }

            // If still not found, create new user
            if (!user) {
                console.log(`[OAuth] Creating new user for GitHub account: ${githubUser.login}`);
                const encryptedToken = encryptToken(accessToken);
                try {
                    user = await prisma.user.create({
                        data: {
                            email: githubUser.email,
                            name: githubUser.name,
                            password: crypto.randomBytes(32).toString('hex'), // Random password (user won't use it)
                            githubId: githubUser.id.toString(),
                            githubUsername: githubUser.login,
                            githubToken: encryptedToken,
                            githubConnected: true,
                            avatar: githubUser.avatar_url || undefined,
                        },
                    });
                } catch (createError: any) {
                    // If creation fails due to email constraint, try to find and update
                    if (createError.code === 'P2002' && createError.meta?.target?.includes('email')) {
                        console.log(`[OAuth] Email already exists, finding and updating user: ${githubUser.email}`);
                        user = await prisma.user.findUnique({
                            where: { email: githubUser.email.toLowerCase() },
                        });
                        if (user) {
                            const encryptedToken = encryptToken(accessToken);
                            user = await prisma.user.update({
                                where: { id: user.id },
                                data: {
                                    githubId: githubUser.id.toString(),
                                    githubUsername: githubUser.login,
                                    githubToken: encryptedToken,
                                    githubConnected: true,
                                    avatar: githubUser.avatar_url || undefined,
                                    name: githubUser.name || user.name,
                                },
                            });
                        } else {
                            throw createError; // Re-throw if we can't find the user
                        }
                    } else {
                        throw createError; // Re-throw other errors
                    }
                }
            } else {
                // Update existing user's GitHub connection with new token
                // This handles the case where user signs in with same GitHub account again
                console.log(`[OAuth] Updating existing user's GitHub connection: ${user.id}`);
                const encryptedToken = encryptToken(accessToken);
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        githubToken: encryptedToken,
                        githubConnected: true,
                        githubUsername: githubUser.login,
                        avatar: githubUser.avatar_url || undefined,
                        // Update email/name in case they changed on GitHub
                        email: githubUser.email || user.email,
                        name: githubUser.name || user.name,
                    },
                });
            }

            // Generate JWT token for the user
            const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
            const token = signToken(
                { userId: user.id, email: user.email },
                JWT_EXPIRES_IN
            );

            // Create audit log for GitHub connection (sign-in mode)
            await createAuditLog({
                userId: user.id,
                action: 'github_connected',
                entityType: 'user',
                entityId: user.id,
                details: { githubUsername: githubUser.login, mode: 'signin' },
                ipAddress: req.ip || req.socket.remoteAddress || undefined,
                userAgent: req.get('user-agent') || undefined,
            });

            // Automatically fetch and connect repositories (CodeRabbit-style)
            try {
                const { getUserRepositories } = await import('../services/githubOAuth');
                const repos = await getUserRepositories(accessToken);
                
                // Connect all repositories automatically
                for (const repo of repos) {
                    // Only connect repos where user has admin or push access
                    if (repo.permissions.admin || repo.permissions.push) {
                        try {
                            const existingRepo = await prisma.repository.findFirst({
                                where: { fullName: repo.full_name },
                            });

                            if (!existingRepo) {
                                await prisma.repository.create({
                                    data: {
                                        name: repo.name,
                                        fullName: repo.full_name,
                                        userId: user.id,
                                        githubRepoId: repo.id,
                                        isActive: true,
                                        autoReview: true,
                                        isUserConnected: true,
                                    },
                                });
                                console.log(`[OAuth] Created new repository ${repo.full_name} for user ${user.id}`);
                            } else {
                                // CRITICAL: Always update userId to current user, even if repo exists
                                // This ensures repos are linked to the correct user when switching accounts
                                if (existingRepo.userId !== user.id) {
                                    console.log(`[OAuth] Updating repository ${repo.full_name} from userId ${existingRepo.userId} to ${user.id}`);
                                }
                                await prisma.repository.update({
                                    where: { id: existingRepo.id },
                                    data: {
                                        userId: user.id, // Always update to current user
                                        githubRepoId: repo.id,
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
                console.log(`[OAuth] Automatically connected ${repos.length} repositories for user ${user.id}`);
            } catch (repoError) {
                console.error('[OAuth] Error automatically fetching repositories:', repoError);
                // Don't fail the OAuth flow if repo fetching fails
            }

            // Redirect to repositories page (CodeRabbit-style: show repos immediately)
            res.redirect(`${getFrontendBaseUrl()}/auth/callback?token=${token}&github_signin=true&redirect=repositories`);
        } else {
            // Connect mode: Update existing user
            const encryptedToken = encryptToken(accessToken);

            await prisma.user.update({
                where: { id: userIdOrSignin },
                data: {
                    githubId: githubUser.id.toString(),
                    githubUsername: githubUser.login,
                    githubToken: encryptedToken,
                    githubConnected: true,
                    avatar: githubUser.avatar_url || undefined,
                },
            });

            // Create audit log for GitHub connection (connect mode)
            await createAuditLog({
                userId: userIdOrSignin,
                action: 'github_connected',
                entityType: 'user',
                entityId: userIdOrSignin,
                details: { githubUsername: githubUser.login, mode: 'connect' },
                ipAddress: req.ip || req.socket.remoteAddress || undefined,
                userAgent: req.get('user-agent') || undefined,
            });

            // Automatically fetch and connect repositories (CodeRabbit-style)
            try {
                const { getUserRepositories } = await import('../services/githubOAuth');
                const repos = await getUserRepositories(accessToken);
                
                // Connect all repositories automatically
                for (const repo of repos) {
                    // Only connect repos where user has admin or push access
                    if (repo.permissions.admin || repo.permissions.push) {
                        try {
                            // Use upsert to prevent duplicates and ensure atomic operation
                            const existingRepo = await prisma.repository.upsert({
                                where: { fullName: repo.full_name },
                                update: {
                                    // Always update userId to current user (handles account switching)
                                    userId: userIdOrSignin,
                                    githubRepoId: repo.id,
                                    isUserConnected: true,
                                    name: repo.name, // Update name in case it changed
                                },
                                create: {
                                    name: repo.name,
                                    fullName: repo.full_name,
                                    userId: userIdOrSignin,
                                    githubRepoId: repo.id,
                                    isActive: true,
                                    autoReview: true,
                                    isUserConnected: true,
                                    provider: 'GITHUB',
                                },
                            });
                            
                            if (existingRepo.userId !== userIdOrSignin) {
                                console.log(`[OAuth] Updated repository ${repo.full_name} to userId ${userIdOrSignin}`);
                            } else {
                                console.log(`[OAuth] Repository ${repo.full_name} already connected for user ${userIdOrSignin}`);
                            }
                        } catch (repoError) {
                            console.error(`Error connecting repo ${repo.full_name}:`, repoError);
                            // Continue with other repos even if one fails
                        }
                    }
                }
                console.log(`[OAuth] Automatically connected ${repos.length} repositories for user ${userIdOrSignin}`);
            } catch (repoError) {
                console.error('[OAuth] Error automatically fetching repositories:', repoError);
                // Don't fail the OAuth flow if repo fetching fails
            }

            // Redirect to repositories page with success
            res.redirect(`${getFrontendBaseUrl()}/repositories?github_connected=true`);
        }
    } catch (error: any) {
        const rawMessage: string = error?.message || String(error);

        console.error('[OAuth] Callback failed:', rawMessage);
        console.error('[OAuth] Details:', {
            message: error?.message,
            stack: error?.stack,
            code: error?.code,
            github: error?.response?.data,
        });

        const isDbOffline =
            rawMessage.includes("Can't reach database server") ||
            rawMessage.includes('PrismaClientInitializationError') ||
            rawMessage.toLowerCase().includes('connect to the database') ||
            rawMessage.toLowerCase().includes('connection refused') ||
            rawMessage.toLowerCase().includes('econnrefused');

        const errorCode = isDbOffline ? 'db_offline' : oauthCallbackErrorCode(error);

        res.redirect(`${getFrontendBaseUrl()}/login?error=${encodeURIComponent(errorCode)}`);
    }
};

/**
 * Disconnect GitHub account
 */
export const disconnectGitHub = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Remove GitHub connection
        await prisma.user.update({
            where: { id: userId },
            data: {
                githubId: null,
                githubUsername: null,
                githubToken: null,
                githubConnected: false,
            },
        });

        // Create audit log for GitHub disconnection
        await createAuditLog({
            userId,
            action: 'github_disconnected',
            entityType: 'user',
            entityId: userId,
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
        });

        // Optionally: Remove user-connected repositories
        // await prisma.repository.deleteMany({
        //     where: { userId, isUserConnected: true },
        // });

        res.json({
            success: true,
            message: 'GitHub account disconnected',
        });
    } catch (error: any) {
        console.error('Error disconnecting GitHub:', error);
        res.status(500).json({ error: 'Failed to disconnect GitHub account' });
    }
};

/**
 * Get user's GitHub repositories
 */
export const getGitHubRepositories = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Get user with GitHub token
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { githubToken: true, githubConnected: true },
        });

        if (!user || !user.githubConnected || !user.githubToken) {
            return res.status(400).json({ error: 'GitHub account not connected' });
        }

        // Decrypt and use token
        let accessToken: string;
        try {
            accessToken = decryptToken(user.githubToken);
        } catch (decryptError: any) {
            console.error('Error decrypting GitHub token:', decryptError);
            
            // Clear the invalid token so user can reconnect
            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        githubToken: null,
                        githubConnected: false,
                    },
                });
            } catch (updateError) {
                console.error('Error clearing invalid token:', updateError);
            }
            
            return res.status(400).json({
                error: 'GitHub token invalid',
                message: 'Your GitHub token could not be decrypted. Please reconnect your GitHub account.',
                requiresReconnect: true,
            });
        }

        // Fetch repositories
        let repos;
        try {
            repos = await getUserRepositories(accessToken);
        } catch (repoError: any) {
            console.error('Error fetching repositories from GitHub:', repoError);
            // Check if it's an authentication error from GitHub
            if (repoError.response?.status === 401 || repoError.response?.status === 403) {
                return res.status(401).json({
                    error: 'GitHub token expired or invalid',
                    message: 'Your GitHub token has expired. Please reconnect your GitHub account.',
                });
            }
            throw repoError;
        }

        res.json({
            success: true,
            repositories: repos,
        });
    } catch (error: any) {
        console.error('Error fetching GitHub repositories:', error);
        res.status(500).json({
            error: 'Failed to fetch GitHub repositories',
            message: error.message,
        });
    }
};

/**
 * Connect a GitHub repository to the app
 */
export const connectRepository = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { repoFullName, githubRepoId, autoReview = true } = req.body;

        if (!repoFullName || !githubRepoId) {
            return res.status(400).json({ error: 'repoFullName and githubRepoId are required' });
        }

        // Check if repository already exists
        // Use upsert to prevent duplicates
        const [owner, name] = repoFullName.split('/');
        const repository = await prisma.repository.upsert({
            where: { fullName: repoFullName },
            update: {
                // Update to link to user if not already linked
                userId: userId,
                githubRepoId: githubRepoId,
                isUserConnected: true,
                autoReview: autoReview,
                name: name, // Update name in case it changed
            },
            create: {
                name,
                fullName: repoFullName,
                userId,
                githubRepoId,
                isUserConnected: true,
                isActive: true,
                autoReview,
                provider: 'GITHUB',
            },
        });

        // Create audit log for repository connection
        await createAuditLog({
            userId,
            action: 'repo_connected',
            entityType: 'repository',
            entityId: repository.id,
            repositoryId: repository.id,
            details: { repoFullName, githubRepoId, autoReview },
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
        });

        res.json({
            success: true,
            repository,
            message: 'Repository connected successfully',
        });
    } catch (error: any) {
        console.error('Error connecting repository:', error);
        res.status(500).json({
            error: 'Failed to connect repository',
            message: error.message,
        });
    }
};

/**
 * Disconnect a repository
 */
export const disconnectRepository = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { repoId } = req.params;

        // Verify repository belongs to user
        const repo = await prisma.repository.findUnique({
            where: { id: repoId as string },
        });

        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        if (repo.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to disconnect this repository' });
        }

        // Create audit log before deleting
        await createAuditLog({
            userId,
            action: 'repo_disconnected',
            entityType: 'repository',
            entityId: repoId as string,
            repositoryId: repoId as string,
            details: { repoFullName: repo.fullName, repoName: repo.name },
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
        });

        // Delete repository (or just mark as inactive)
        await prisma.repository.delete({
            where: { id: repoId as string },
        });

        res.json({
            success: true,
            message: 'Repository disconnected',
        });
    } catch (error: any) {
        console.error('Error disconnecting repository:', error);
        res.status(500).json({
            error: 'Failed to disconnect repository',
            message: error.message,
        });
    }
};
