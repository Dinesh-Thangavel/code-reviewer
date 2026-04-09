import { Request, Response } from 'express';
import { githubConfig } from '../config/github';
import { verifyWebhookSignature } from '../github/utils';
import { getInstallationAccessToken } from '../services/githubApi';
import { getUserIdFromToken } from '../utils/jwt';
import prisma from '../db';
import axios from 'axios';

export const handleWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const id = req.headers['x-github-delivery'] as string;
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as any);

    // Parse payload from raw body to avoid mismatch
    let payload: any;
    try {
        payload = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
        console.error('GitHub webhook: failed to parse JSON body');
        return res.status(400).send('Invalid JSON');
    }

    // Verify webhook signature if secret is configured
    if (githubConfig.webhookSecret) {
        if (!verifyWebhookSignature(githubConfig.webhookSecret, rawBody.toString('utf8'), signature)) {
            console.error(`Webhook signature verification failed. ID: ${id}`);
            res.status(401).send('Invalid signature');
            return;
        }
    } else {
        console.warn('⚠️  Webhook secret not configured - skipping signature verification (not recommended for production)');
    }

    // Handle installation events (when users install/uninstall the GitHub App)
    if (event === 'installation') {
        const { action, installation, repositories } = req.body;
        const installationId = installation?.id?.toString();

        if (action === 'created' || action === 'added') {
            console.log(`[GitHub] Installation ${action}: ID ${installationId}`);
            
            // Update all repositories in this installation with the installationId
            if (repositories && Array.isArray(repositories)) {
                const prisma = (await import('../db')).default;
                for (const repo of repositories) {
                    try {
                        const existingRepo = await prisma.repository.findFirst({
                            where: { fullName: repo.full_name },
                        });

                        if (existingRepo) {
                            await prisma.repository.update({
                                where: { id: existingRepo.id },
                                data: { installationId },
                            });
                            console.log(`[GitHub] Updated ${repo.full_name} with installationId ${installationId}`);
                        } else {
                            // Create repository if it doesn't exist
                            await prisma.repository.create({
                                data: {
                                    name: repo.name,
                                    fullName: repo.full_name,
                                    installationId,
                                    isActive: true,
                                    autoReview: true,
                                },
                            });
                            console.log(`[GitHub] Created ${repo.full_name} with installationId ${installationId}`);
                        }
                    } catch (error) {
                        console.error(`[GitHub] Error updating repo ${repo.full_name}:`, error);
                    }
                }
            }
        } else if (action === 'deleted' || action === 'removed') {
            console.log(`[GitHub] Installation ${action}: ID ${installationId}`);
            // Optionally remove installationId from repositories
            // Or mark repositories as inactive
        }
    }

    if (event === 'pull_request') {
        const { action, pull_request, repository, installation } = payload;

        // Log webhook received
        console.log('--- GitHub Webhook Received ---');
        console.log(`Event: ${event}`);
        console.log(`Action: ${action}`);
        console.log(`Repo: ${repository.full_name}`);
        console.log(`PR Number: ${pull_request.number}`);
        console.log(`PR Title: ${pull_request.title}`);
        console.log(`Author: ${pull_request.user.login}`);
        console.log(`Installation ID: ${installation?.id}`);
        console.log('-------------------------------');

        // Handle PR opened or updated (synchronize = new commits pushed)
        // NOTE: We do NOT handle 'closed' or 'merged' actions to ensure fixes are NEVER auto-applied
        // All fixes require explicit manual approval via API endpoints
        if (action === 'opened' || action === 'synchronize') {
            const { handlePullRequestOpened } = await import('../services/github');
            try {
                const result = await handlePullRequestOpened(req.body);
                if (result?.success) {
                    console.log(`[GitHub] ✅ Successfully processed PR ${action} event for ${repository.full_name} #${pull_request.number}`);
                } else if (result?.skipped) {
                    console.log(`[GitHub] ⏭️  PR ${action} event skipped: ${result.reason}`);
                } else {
                    console.error(`[GitHub] ❌ Failed to process PR ${action} event:`, result?.error);
                }
            } catch (error: any) {
                console.error(`[GitHub] ❌ Error handling PR ${action}:`, error.message);
                console.error(`[GitHub] Error stack:`, error.stack);
                // Don't fail the webhook - log and continue
            }
        } else if (action === 'closed' || action === 'merged') {
            // Explicitly log that we're ignoring merge/close events to prevent auto-apply
            console.log(`[GitHub] ⏭️  Ignoring PR ${action} event for ${repository.full_name} #${pull_request.number} - fixes require manual approval`);
        }
    }

    res.status(200).send('OK');
};

// Diagnostic endpoint to test GitHub connection
export const testGitHubConnection = async (_req: Request, res: Response) => {
    const diagnostics: any = {
        config: {
            hasAppId: !!githubConfig.appId,
            hasPrivateKey: !!githubConfig.privateKey,
            hasWebhookSecret: !!githubConfig.webhookSecret,
            appId: githubConfig.appId || 'NOT SET',
        },
        errors: [] as string[],
        success: false,
    };

    if (!githubConfig.appId) {
        diagnostics.errors.push('GITHUB_APP_ID is not set');
    }

    if (!githubConfig.privateKey) {
        diagnostics.errors.push('GITHUB_PRIVATE_KEY is not set');
    }

    if (!githubConfig.webhookSecret) {
        diagnostics.errors.push('GITHUB_WEBHOOK_SECRET is not set (optional for testing)');
    }

    // Test JWT generation if credentials are available
    if (githubConfig.appId && githubConfig.privateKey) {
        try {
            const jwt = require('jsonwebtoken');
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                iat: now - 60,
                exp: now + (10 * 60),
                iss: githubConfig.appId,
            };
            const PRIVATE_KEY = githubConfig.privateKey.replace(/\\n/g, '\n');
            const token = jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
            diagnostics.jwtGenerated = !!token;
        } catch (error: any) {
            diagnostics.errors.push(`JWT generation failed: ${error.message}`);
        }
    }

    diagnostics.success = diagnostics.errors.length === 0;

    res.json(diagnostics);
};

/**
 * Get GitHub App installation URL
 * GET /api/github/install-url
 */
export const getInstallationUrl = async (_req: Request, res: Response) => {
    try {
        if (!githubConfig.appId) {
            return res.status(400).json({ error: 'GitHub App not configured' });
        }

        // GitHub App installation URL format: https://github.com/apps/{app-slug}/installations/new
        // Since we only have App ID, we'll use the App ID in the URL
        // Alternatively, you can get the app slug from GitHub API
        const appId = githubConfig.appId;
        
        // Try to get app info to get the slug
        try {
            const jwt = require('jsonwebtoken');
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                iat: now - 60,
                exp: now + (10 * 60),
                iss: appId,
            };
            const PRIVATE_KEY = githubConfig.privateKey.replace(/\\n/g, '\n');
            const jwtToken = jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });

            const response = await axios.get('https://api.github.com/app', {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });

            const appSlug = response.data.slug;
            const installUrl = `https://github.com/apps/${appSlug}/installations/new`;

            res.json({
                success: true,
                installUrl,
                appId,
                appName: response.data.name,
            });
        } catch (error: any) {
            // Fallback: Try alternative URL format
            console.warn('[OAuth] Could not fetch app slug from GitHub API:', error.message);
            console.warn('[OAuth] This usually means GITHUB_APP_ID or GITHUB_PRIVATE_KEY is incorrect');
            
            // Alternative: Use the app settings page (user can navigate to installation from there)
            // Format: https://github.com/settings/apps/{app-name}/installations/new
            // But we don't have app name, so we'll use a generic URL
            const fallbackUrl = `https://github.com/settings/apps`;
            
            res.json({
                success: false,
                installUrl: fallbackUrl,
                appId,
                error: 'Could not fetch app slug. Please verify GITHUB_APP_ID and GITHUB_PRIVATE_KEY are correct.',
                note: 'You can manually navigate to your GitHub App settings and click "Install App"',
            });
        }
    } catch (error: any) {
        console.error('Error getting installation URL:', error);
        res.status(500).json({ error: 'Failed to get installation URL' });
    }
};

// Manual sync endpoint to fetch PRs from GitHub
export const syncRepository = async (req: Request, res: Response) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        if (!authToken) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(authToken);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { repoFullName } = req.body;

        if (!repoFullName) {
            return res.status(400).json({ error: 'repoFullName is required' });
        }

        // Find repository and get installationId (use findUnique for unique field)
        const repo = await prisma.repository.findUnique({
            where: { fullName: repoFullName },
        });

        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        // Ensure it belongs to the user and is GitHub
        if (repo.userId !== userId || repo.provider !== 'GITHUB') {
            return res.status(403).json({ error: 'Repository access denied' });
        }

        // If installationId is missing, try to find it from GitHub API
        let installationId = repo.installationId;
        
        if (!installationId) {
            console.log(`[GitHub Sync] Repository ${repoFullName} missing installationId, attempting to find it...`);
            
            if (!githubConfig.appId || !githubConfig.privateKey) {
                return res.status(400).json({ 
                    error: 'GitHub App not configured',
                    message: 'GitHub App credentials are not configured. Please set GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables.',
                });
            }
            
            try {
                // Generate JWT to access GitHub API
                const jwt = require('jsonwebtoken');
                const now = Math.floor(Date.now() / 1000);
                const payload = {
                    iat: now - 60,
                    exp: now + (10 * 60),
                    iss: githubConfig.appId,
                };
                const PRIVATE_KEY = githubConfig.privateKey.replace(/\\n/g, '\n');
                let jwtToken: string;
                try {
                    jwtToken = jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
                } catch (jwtError: any) {
                    console.error('[GitHub Sync] Error generating JWT:', jwtError);
                    return res.status(500).json({ 
                        error: 'Failed to generate JWT',
                        message: 'Could not generate authentication token. Please check your GITHUB_PRIVATE_KEY configuration.',
                    });
                }

                // Get all installations for this app
                let installationsResponse;
                try {
                    installationsResponse = await axios.get('https://api.github.com/app/installations', {
                        headers: {
                            Authorization: `Bearer ${jwtToken}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    });
                } catch (apiError: any) {
                    console.error('[GitHub Sync] Error fetching installations:', apiError);
                    return res.status(500).json({ 
                        error: 'Failed to fetch GitHub installations',
                        message: apiError.response?.data?.message || 'Could not fetch GitHub App installations. Please check your GitHub App configuration.',
                    });
                }

                const installations = installationsResponse.data;
                
                if (!installations || installations.length === 0) {
                    return res.status(400).json({ 
                        error: 'GitHub App not installed',
                        message: 'No GitHub App installations found. Please install the GitHub App on your repositories.',
                    });
                }
                
                // Find the installation that has access to this repository
                for (const installation of installations) {
                    try {
                        const installToken = await getInstallationAccessToken(installation.id.toString());
                        
                        // Check if this installation has access to the repository
                        const [owner, repoName] = repoFullName.split('/');
                        const repoResponse = await axios.get(
                            `https://api.github.com/repos/${owner}/${repoName}`,
                            {
                                headers: {
                                    Authorization: `Bearer ${installToken}`,
                                    Accept: 'application/vnd.github.v3+json',
                                },
                            }
                        );

                        // If we can access the repo, this is the right installation
                        if (repoResponse.data) {
                            installationId = installation.id.toString();
                            console.log(`[GitHub Sync] Found installationId ${installationId} for ${repoFullName}`);
                            
                            // Update repository with installationId
                            await prisma.repository.update({
                                where: { id: repo.id },
                                data: { installationId },
                            });
                            console.log(`[GitHub Sync] Updated repository ${repoFullName} with installationId ${installationId}`);
                            break;
                        }
                    } catch (error) {
                        // This installation doesn't have access, try next one
                        continue;
                    }
                }

                if (!installationId) {
                    return res.status(400).json({ 
                        error: 'GitHub App not installed',
                        message: 'Please install the GitHub App on this repository to enable automatic PR syncing.',
                    });
                }
            } catch (error: any) {
                console.error('[GitHub Sync] Error finding installation ID:', error);
                return res.status(500).json({ 
                    error: 'Failed to find installation',
                    message: error.message || 'Could not find GitHub App installation for this repository. Please ensure the GitHub App is installed.',
                });
            }
        }

        // Verify GitHub App is configured
        if (!githubConfig.appId || !githubConfig.privateKey) {
            return res.status(400).json({ 
                error: 'GitHub credentials not configured',
                message: 'GitHub App credentials are not configured. Please set GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables.',
            });
        }

        // Verify installationId exists
        if (!installationId) {
            return res.status(400).json({ 
                error: 'GitHub App not installed',
                message: 'Please install the GitHub App on this repository to enable automatic PR syncing.',
            });
        }

        // Get installation access token
        let token: string;
        try {
            token = await getInstallationAccessToken(installationId);
        } catch (tokenError: any) {
            console.error(`[GitHub Sync] Error getting installation token for ${repoFullName}:`, tokenError);
            return res.status(500).json({
                error: 'Failed to get installation token',
                message: tokenError.message || 'Could not authenticate with GitHub App.',
            });
        }
        
        // Fetch open PRs
        let prs: any[];
        try {
            const response = await axios.get(
                `https://api.github.com/repos/${repoFullName}/pulls?state=open`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );
            prs = response.data || [];
        } catch (prError: any) {
            const status = prError.response?.status;
            const ghMessage = prError.response?.data?.message;
            console.error(`[GitHub Sync] Error fetching PRs for ${repoFullName}:`, {
                status,
                message: prError.message,
                ghMessage,
                data: prError.response?.data,
            });
            const safeMessage =
                ghMessage ||
                prError.message ||
                'Could not fetch pull requests from GitHub. Ensure the GitHub App is installed on this repository and has Pull Request read permission.';
            const code = status && status !== 200 ? status : 500;
            return res.status(code).json({
                error: 'Failed to fetch pull requests',
                status,
                message: safeMessage,
                details: prError.response?.data,
            });
        }

        const results = [];
        for (const pr of prs) {
            try {
                        // Upsert PR directly (simpler and more reliable)
                await prisma.pullRequest.upsert({
                    where: {
                        repoId_number: {
                            repoId: repo.id,
                            number: pr.number,
                        },
                    },
                    update: {
                        title: pr.title,
                        headSha: pr.head?.sha || undefined,
                        status: pr.state === 'open' ? 'OPEN' : pr.state === 'closed' ? 'CLOSED' : 'MERGED',
                    },
                    create: {
                        repoId: repo.id,
                        number: pr.number,
                        title: pr.title,
                        author: pr.user?.login || 'unknown',
                        status: pr.state === 'open' ? 'OPEN' : pr.state === 'closed' ? 'CLOSED' : 'MERGED',
                        riskLevel: 'LOW',
                        headSha: pr.head?.sha || '',
                        baseBranch: pr.base?.ref || 'main',
                    },
                });
                console.log(`[GitHub Sync] Synced PR #${pr.number} for ${repoFullName}`);

                results.push({ number: pr.number, title: pr.title, status: 'synced' });
            } catch (error: any) {
                console.error(`[GitHub Sync] Error processing PR #${pr.number}:`, error);
                console.error(`[GitHub Sync] PR Error details:`, {
                    message: error.message,
                    stack: error.stack,
                });
                results.push({ number: pr.number, title: pr.title, status: 'error', error: error.message });
            }
        }

        res.json({
            success: true,
            message: `Synced ${results.length} pull requests`,
            results,
        });
    } catch (error: any) {
        console.error('[GitHub Sync] Error syncing repository:', error);
        console.error('[GitHub Sync] Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status,
        });
        res.status(500).json({
            error: 'Failed to sync repository',
            message: error.message || 'An unexpected error occurred',
            details: error.response?.data || undefined,
        });
    }
};
