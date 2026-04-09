"use strict";
/**
 * Bitbucket Controller
 * Handles Bitbucket API operations and webhooks
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBitbucketWebhook = exports.syncBitbucketRepository = void 0;
const db_1 = __importDefault(require("../db"));
const jwt_1 = require("../utils/jwt");
const bitbucket_1 = require("../services/bitbucket");
const bitbucketOAuth_1 = require("../services/bitbucketOAuth");
const crypto_1 = __importDefault(require("crypto"));
const BITBUCKET_WEBHOOK_SECRET = process.env.BITBUCKET_WEBHOOK_SECRET || '';
/**
 * Manual sync endpoint to fetch PRs from Bitbucket
 */
const syncBitbucketRepository = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userId = (0, jwt_1.getUserIdFromToken)(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const { repoFullName } = req.body;
        if (!repoFullName) {
            return res.status(400).json({ error: 'repoFullName is required' });
        }
        // Find repository (use findUnique for unique field)
        const repo = await db_1.default.repository.findUnique({
            where: { fullName: repoFullName },
        });
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        // Ensure it belongs to the user and is Bitbucket
        if (repo.userId !== userId || repo.provider !== 'BITBUCKET') {
            return res.status(403).json({ error: 'Repository access denied' });
        }
        if (!repo.bitbucketWorkspace) {
            return res.status(400).json({ error: 'Repository workspace not found' });
        }
        // Get user's Bitbucket token
        const user = await db_1.default.user.findUnique({
            where: { id: userId },
            select: { bitbucketToken: true, bitbucketConnected: true },
        });
        if (!user || !user.bitbucketConnected || !user.bitbucketToken) {
            return res.status(400).json({ error: 'Bitbucket account not connected' });
        }
        // Decrypt token
        let accessToken;
        try {
            accessToken = (0, bitbucketOAuth_1.decryptToken)(user.bitbucketToken);
        }
        catch (decryptError) {
            console.error('Error decrypting Bitbucket token:', decryptError);
            return res.status(400).json({
                error: 'Bitbucket token invalid',
                message: 'Your Bitbucket token could not be decrypted. Please reconnect your Bitbucket account.',
            });
        }
        // Use workspace from repo record, and parse repo slug from fullName
        const workspace = repo.bitbucketWorkspace;
        const parts = repoFullName.split('/');
        if (parts.length !== 2) {
            return res.status(400).json({ error: 'Invalid repository full name format. Expected: workspace/repo-slug' });
        }
        const repoSlug = parts[1]; // Use the repo name part
        // Fetch PRs from Bitbucket
        const prs = await (0, bitbucket_1.getBitbucketPullRequests)(accessToken, workspace, repoSlug);
        // Process each PR
        const results = [];
        for (const pr of prs) {
            try {
                // Simulate webhook payload
                const webhookPayload = {
                    repository: {
                        name: repoSlug,
                        full_name: repoFullName,
                    },
                    pull_request: {
                        id: pr.id,
                        title: pr.title,
                        author: {
                            username: pr.author.username,
                        },
                        source: {
                            commit: {
                                hash: pr.source.commit.hash,
                            },
                            branch: {
                                name: pr.source.branch.name,
                            },
                        },
                        destination: {
                            branch: {
                                name: pr.destination.branch.name,
                            },
                        },
                    },
                    userId: userId,
                };
                await (0, bitbucket_1.handleBitbucketPullRequestOpened)(webhookPayload);
                results.push({ id: pr.id, title: pr.title, status: 'synced' });
            }
            catch (error) {
                results.push({ id: pr.id, title: pr.title, status: 'error', error: error.message });
            }
        }
        res.json({
            success: true,
            message: `Synced ${results.length} pull requests from Bitbucket`,
            results,
        });
    }
    catch (error) {
        console.error('Error syncing Bitbucket repository:', error);
        res.status(500).json({
            error: 'Failed to sync repository',
            message: error.message,
        });
    }
};
exports.syncBitbucketRepository = syncBitbucketRepository;
/**
 * Bitbucket webhook handler (PR opened/updated)
 */
const handleBitbucketWebhook = async (req, res) => {
    try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
        // Verify signature if secret set
        if (BITBUCKET_WEBHOOK_SECRET) {
            const sig = req.headers['x-hub-signature'];
            const expected = 'sha256=' + crypto_1.default.createHmac('sha256', BITBUCKET_WEBHOOK_SECRET).update(rawBody).digest('hex');
            if (sig !== expected) {
                return res.status(401).send('Invalid signature');
            }
        }
        let payload;
        try {
            payload = JSON.parse(rawBody.toString('utf8'));
        }
        catch (e) {
            return res.status(400).send('Invalid JSON');
        }
        const eventKey = req.headers['x-event-key'];
        if (eventKey === 'pullrequest:created' || eventKey === 'pullrequest:updated') {
            const pr = payload.pullrequest;
            const repo = payload.repository;
            const actor = payload.actor;
            // Find repository owner in DB
            const dbRepo = await db_1.default.repository.findUnique({
                where: { fullName: repo.full_name },
                select: { userId: true },
            });
            if (!dbRepo) {
                return res.status(200).json({ skipped: true, reason: 'repo_not_connected' });
            }
            if (!dbRepo.userId) {
                return res.status(200).json({ skipped: true, reason: 'repo_missing_user' });
            }
            // Process PR similar to GitHub flow
            const result = await (0, bitbucket_1.handleBitbucketPullRequestOpened)({
                repository: {
                    full_name: repo.full_name,
                    name: repo.name,
                },
                pull_request: {
                    id: pr.id,
                    title: pr.title,
                    author: {
                        username: pr.author?.username || actor?.username || 'unknown',
                    },
                    source: {
                        commit: { hash: pr.source?.commit?.hash },
                        branch: { name: pr.source?.branch?.name },
                    },
                    destination: {
                        branch: { name: pr.destination?.branch?.name },
                    },
                },
                userId: dbRepo.userId,
            });
            return res.status(200).json({ success: true, result });
        }
        return res.status(200).json({ skipped: true, reason: 'event_not_handled' });
    }
    catch (error) {
        console.error('Bitbucket webhook error:', error);
        return res.status(500).json({ error: 'Webhook handling failed' });
    }
};
exports.handleBitbucketWebhook = handleBitbucketWebhook;
