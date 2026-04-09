"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRepository = exports.getRepositoryById = exports.getRepositories = void 0;
const db_1 = __importDefault(require("../db"));
const auditLog_1 = require("../services/auditLog");
const jwt_1 = require("../utils/jwt");
const getRepositories = async (req, res) => {
    try {
        // Get user ID from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId;
        if (token) {
            const extractedUserId = (0, jwt_1.getUserIdFromToken)(token);
            if (extractedUserId) {
                userId = extractedUserId;
                console.log(`[getRepositories] Extracted userId from token: ${userId}`);
            }
            else {
                console.log('[getRepositories] Token verification failed');
                // Token invalid, but continue - will return empty array
            }
        }
        // Filter repositories by userId - only show repos belonging to the authenticated user
        const where = {};
        if (userId) {
            where.userId = userId;
            console.log(`[getRepositories] Filtering repositories for userId: ${userId}`);
        }
        else {
            // If no valid user, return empty array
            console.log('[getRepositories] No valid userId, returning empty array');
            return res.json([]);
        }
        const repos = await db_1.default.repository.findMany({
            where,
            include: {
                _count: {
                    select: { pullRequests: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        console.log(`[getRepositories] Found ${repos.length} repositories for userId: ${userId}`);
        const response = repos.map((repo) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.fullName,
            provider: repo.provider || 'GITHUB', // Default to GITHUB for backward compatibility
            isActive: repo.isActive,
            autoReview: repo.autoReview ?? true,
            strictness: repo.strictness,
            languages: repo.languages ? JSON.parse(repo.languages) : [],
            ignorePaths: repo.ignorePaths ? JSON.parse(repo.ignorePaths) : [],
            pullRequestCount: repo._count?.pullRequests ?? 0,
            createdAt: repo.createdAt,
            updatedAt: repo.updatedAt,
        }));
        res.json(response);
    }
    catch (error) {
        console.error('Error fetching repositories:', error);
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
};
exports.getRepositories = getRepositories;
const getRepositoryById = async (req, res) => {
    const id = req.params.id;
    try {
        // Get user ID from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId;
        if (token) {
            const extractedUserId = (0, jwt_1.getUserIdFromToken)(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }
        const repo = await db_1.default.repository.findUnique({
            where: { id },
            include: {
                pullRequests: {
                    include: {
                        reviews: {
                            select: {
                                id: true,
                                status: true,
                                riskLevel: true,
                                confidenceScore: true,
                                createdAt: true,
                                _count: {
                                    select: { issues: true },
                                },
                            },
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });
        if (!repo) {
            res.status(404).json({ error: 'Repository not found' });
            return;
        }
        // Verify repository belongs to the authenticated user
        if (userId && repo.userId !== userId) {
            res.status(403).json({ error: 'Not authorized to access this repository' });
            return;
        }
        res.json({
            id: repo.id,
            name: repo.name,
            fullName: repo.fullName,
            isActive: repo.isActive,
            autoReview: repo.autoReview,
            strictness: repo.strictness,
            languages: repo.languages ? JSON.parse(repo.languages) : [],
            ignorePaths: repo.ignorePaths ? JSON.parse(repo.ignorePaths) : [],
            pullRequests: repo.pullRequests.map((pr) => ({
                id: pr.id,
                number: pr.number,
                title: pr.title,
                author: pr.author,
                status: pr.status,
                riskLevel: pr.riskLevel,
                latestReview: pr.reviews[0] || null,
                createdAt: pr.createdAt,
            })),
            createdAt: repo.createdAt,
            updatedAt: repo.updatedAt,
        });
    }
    catch (error) {
        console.error(`Error fetching repository ${id}:`, error);
        res.status(500).json({ error: 'Failed to fetch repository' });
    }
};
exports.getRepositoryById = getRepositoryById;
const updateRepository = async (req, res) => {
    const id = req.params.id;
    const { isActive, autoReview, strictness, languages, ignorePaths } = req.body;
    try {
        const repo = await db_1.default.repository.findUnique({ where: { id } });
        if (!repo) {
            res.status(404).json({ error: 'Repository not found' });
            return;
        }
        // Get user ID from token if available
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId;
        if (token) {
            const extractedUserId = (0, jwt_1.getUserIdFromToken)(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }
        const updateData = {};
        if (typeof isActive === 'boolean')
            updateData.isActive = isActive;
        if (typeof autoReview === 'boolean')
            updateData.autoReview = autoReview;
        if (strictness && ['RELAXED', 'BALANCED', 'STRICT'].includes(strictness)) {
            updateData.strictness = strictness;
        }
        if (Array.isArray(languages))
            updateData.languages = JSON.stringify(languages);
        if (Array.isArray(ignorePaths))
            updateData.ignorePaths = JSON.stringify(ignorePaths);
        const updated = await db_1.default.repository.update({
            where: { id },
            data: updateData,
        });
        // Create audit log for repository update
        if (userId) {
            await (0, auditLog_1.createAuditLog)({
                userId,
                action: 'repo_updated',
                entityType: 'repository',
                entityId: id,
                repositoryId: id,
                details: updateData,
                ipAddress: req.ip || req.socket.remoteAddress || undefined,
                userAgent: req.get('user-agent') || undefined,
            });
        }
        res.json({
            id: updated.id,
            name: updated.name,
            fullName: updated.fullName,
            isActive: updated.isActive,
            autoReview: updated.autoReview,
            strictness: updated.strictness,
            languages: updated.languages ? JSON.parse(updated.languages) : [],
            ignorePaths: updated.ignorePaths ? JSON.parse(updated.ignorePaths) : [],
            message: 'Repository settings updated successfully',
        });
    }
    catch (error) {
        console.error(`Error updating repository ${id}:`, error);
        res.status(500).json({ error: 'Failed to update repository settings' });
    }
};
exports.updateRepository = updateRepository;
