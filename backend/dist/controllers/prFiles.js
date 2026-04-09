"use strict";
/**
 * PR Files controller
 * Fetches file changes for a PR
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPRFiles = void 0;
const githubApi_1 = require("../services/githubApi");
const bitbucketOAuth_1 = require("../services/bitbucketOAuth");
const bitbucketApi_1 = require("../services/bitbucketApi");
const jwt_1 = require("../utils/jwt");
const db_1 = __importDefault(require("../db"));
const getPRFiles = async (req, res) => {
    const prId = req.params.id;
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const requesterId = (0, jwt_1.getUserIdFromToken)(token);
        if (!requesterId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const pr = await db_1.default.pullRequest.findUnique({
            where: { id: prId },
            include: {
                repository: true,
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        issues: true,
                    },
                },
            },
        });
        if (!pr) {
            return res.status(404).json({ error: 'Pull Request not found' });
        }
        if (pr.repository.userId && pr.repository.userId !== requesterId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        let files;
        try {
            if (pr.repository.provider === 'BITBUCKET') {
                // Fetch from Bitbucket using user's token
                const user = await db_1.default.user.findUnique({
                    where: { id: requesterId },
                    select: { bitbucketToken: true, bitbucketConnected: true },
                });
                if (!user || !user.bitbucketConnected || !user.bitbucketToken) {
                    throw new Error('Bitbucket token not available');
                }
                const token = (0, bitbucketOAuth_1.decryptToken)(user.bitbucketToken);
                const [workspace, repoSlug] = pr.repository.fullName.split('/');
                files = await (0, bitbucketApi_1.getBitbucketPRFiles)(token, workspace, repoSlug, pr.number);
            }
            else {
                if (!pr.repository.installationId) {
                    throw new Error('Repository has no installation ID');
                }
                files = await (0, githubApi_1.getPullRequestFiles)(pr.repository.fullName, pr.number, pr.repository.installationId);
            }
        }
        catch (fetchError) {
            console.warn('File fetch failed, falling back to DB issues:', fetchError.message);
            // Fallback: derive files from latest review issues
            const latestReview = pr.reviews[0];
            if (latestReview?.issues?.length) {
                const grouped = {};
                for (const issue of latestReview.issues) {
                    const key = issue.filePath || 'unknown';
                    if (!grouped[key]) {
                        grouped[key] = { filename: key, issues: [] };
                    }
                    grouped[key].issues.push(issue);
                }
                files = Object.values(grouped).map((g) => ({
                    filename: g.filename,
                    language: g.issues[0]?.language || 'plaintext',
                    patch: '',
                    additions: 0,
                    deletions: 0,
                    changes: g.issues.length,
                    status: 'modified',
                }));
            }
            else {
                throw fetchError;
            }
        }
        // Format files with stats
        const formattedFiles = files.map((file) => {
            const patch = file.patch || '';
            const additions = (patch.match(/^\+/gm) || []).length;
            const deletions = (patch.match(/^-/gm) || []).length;
            const changes = additions + deletions;
            return {
                filename: file.filename,
                language: file.language,
                patch,
                additions,
                deletions,
                changes,
                status: 'modified', // Could be 'added', 'removed', 'modified', 'renamed'
            };
        });
        res.json({
            success: true,
            files: formattedFiles,
            totalFiles: formattedFiles.length,
            totalAdditions: formattedFiles.reduce((sum, f) => sum + f.additions, 0),
            totalDeletions: formattedFiles.reduce((sum, f) => sum + f.deletions, 0),
            totalChanges: formattedFiles.reduce((sum, f) => sum + f.changes, 0),
            repoFullName: pr.repository.fullName,
        });
    }
    catch (error) {
        console.error('Error fetching PR files:', error);
        res.status(500).json({
            error: 'Failed to fetch PR files',
            message: error.message,
        });
    }
};
exports.getPRFiles = getPRFiles;
