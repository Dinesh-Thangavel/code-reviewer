import { Request, Response } from 'express';
import prisma from '../db';
import { createAuditLog } from '../services/auditLog';
import { getUserIdFromToken } from '../utils/jwt';

export const getRepositories = async (req: Request, res: Response) => {
    try {
        // Get user ID from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId) {
                userId = extractedUserId;
                console.log(`[getRepositories] Extracted userId from token: ${userId}`);
            } else {
                console.log('[getRepositories] Token verification failed');
                // Token invalid, but continue - will return empty array
            }
        }

        // Filter repositories by userId - only show repos belonging to the authenticated user
        const where: any = {};
        if (userId) {
            where.userId = userId;
            console.log(`[getRepositories] Filtering repositories for userId: ${userId}`);
        } else {
            // If no valid user, return empty array
            console.log('[getRepositories] No valid userId, returning empty array');
            return res.json([]);
        }

        const repos = await prisma.repository.findMany({
            where,
            include: {
                _count: {
                    select: { pullRequests: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        console.log(`[getRepositories] Found ${repos.length} repositories for userId: ${userId}`);
        
        const response = (repos as any[]).map((repo) => ({
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
    } catch (error) {
        console.error('Error fetching repositories:', error);
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
};

export const getRepositoryById = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        // Get user ID from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }

        const repo: any = await prisma.repository.findUnique({
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
            pullRequests: repo.pullRequests.map((pr: any) => ({
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
    } catch (error) {
        console.error(`Error fetching repository ${id}:`, error);
        res.status(500).json({ error: 'Failed to fetch repository' });
    }
};

export const updateRepository = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { isActive, autoReview, strictness, languages, ignorePaths } = req.body;

    try {
        const repo = await prisma.repository.findUnique({ where: { id } });

        if (!repo) {
            res.status(404).json({ error: 'Repository not found' });
            return;
        }

        // Get user ID from token if available
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }

        const updateData: any = {};

        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (typeof autoReview === 'boolean') updateData.autoReview = autoReview;
        if (strictness && ['RELAXED', 'BALANCED', 'STRICT'].includes(strictness)) {
            updateData.strictness = strictness;
        }
        if (Array.isArray(languages)) updateData.languages = JSON.stringify(languages);
        if (Array.isArray(ignorePaths)) updateData.ignorePaths = JSON.stringify(ignorePaths);

        const updated = await prisma.repository.update({
            where: { id },
            data: updateData,
        });

        // Create audit log for repository update
        if (userId) {
            await createAuditLog({
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
    } catch (error) {
        console.error(`Error updating repository ${id}:`, error);
        res.status(500).json({ error: 'Failed to update repository settings' });
    }
};
