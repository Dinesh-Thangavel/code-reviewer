/**
 * PR Files controller
 * Fetches file changes for a PR
 */

import { Request, Response } from 'express';
import { getPullRequestFiles } from '../services/githubApi';
import { decryptToken } from '../services/bitbucketOAuth';
import { getBitbucketPRFiles } from '../services/bitbucketApi';
import { getUserIdFromToken } from '../utils/jwt';
import prisma from '../db';

export const getPRFiles = async (req: Request, res: Response) => {
    const prId = req.params.id as string;

    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const requesterId = getUserIdFromToken(token);
        if (!requesterId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const pr: any = await prisma.pullRequest.findUnique({
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
                const user = await prisma.user.findUnique({
                    where: { id: requesterId },
                    select: { bitbucketToken: true, bitbucketConnected: true },
                });
                if (!user || !user.bitbucketConnected || !user.bitbucketToken) {
                    throw new Error('Bitbucket token not available');
                }
                const token = decryptToken(user.bitbucketToken);
                const [workspace, repoSlug] = pr.repository.fullName.split('/');
                files = await getBitbucketPRFiles(token, workspace, repoSlug, pr.number);
            } else {
                if (!pr.repository.installationId) {
                    throw new Error('Repository has no installation ID');
                }
                files = await getPullRequestFiles(
                    pr.repository.fullName,
                    pr.number,
                    pr.repository.installationId
                );
            }
        } catch (fetchError: any) {
            console.warn('File fetch failed, falling back to DB issues:', fetchError.message);
            // Fallback: derive files from latest review issues
            const latestReview = pr.reviews[0];
            if (latestReview?.issues?.length) {
                const grouped: Record<string, { filename: string; issues: typeof latestReview.issues }> = {};
                for (const issue of latestReview.issues) {
                    const key = issue.filePath || 'unknown';
                    if (!grouped[key]) {
                        grouped[key] = { filename: key, issues: [] as any[] };
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
            } else {
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
    } catch (error: any) {
        console.error('Error fetching PR files:', error);
        res.status(500).json({
            error: 'Failed to fetch PR files',
            message: error.message,
        });
    }
};
