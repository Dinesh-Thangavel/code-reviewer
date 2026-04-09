/**
 * Rollback Controller
 * Handles rollback of applied fixes
 */

import { Request, Response } from 'express';
import prisma from '../db';
import { getInstallationAccessToken } from '../services/githubApi';
import axios from 'axios';
import { createAuditLog } from '../services/auditLog';
import { createNotification, sendEmailNotification } from '../services/notifications';
import { getUserIdFromToken } from '../utils/jwt';

/**
 * Rollback an applied fix
 * POST /api/issues/:issueId/rollback
 */
export const rollbackFix = async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;

    try {
        // Get user ID
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (!extractedUserId) {
                return res.status(401).json({ error: 'Invalid token' });
            }
            userId = extractedUserId;
        }

        // Get issue with commit info
        const issue: any = await prisma.issue.findUnique({
            where: { id: issueId },
            include: {
                review: {
                    include: {
                        pullRequest: {
                            include: {
                                repository: true,
                            },
                        },
                    },
                },
            },
        });

        if (!issue) {
            res.status(404).json({ error: 'Issue not found' });
            return;
        }

        if (issue.fixStatus !== 'APPLIED' || !issue.commitSha) {
            res.status(400).json({ error: 'Fix has not been applied or has no commit SHA' });
            return;
        }

        const repo = issue.review.pullRequest.repository;
        if (!repo.installationId) {
            res.status(400).json({ error: 'Repository has no GitHub installation ID' });
            return;
        }

        // Get GitHub token
        const githubToken = await getInstallationAccessToken(repo.installationId);

        // Revert the commit
        const revertMessage = `revert: ${issue.title}\n\nReverted AI fix commit ${issue.commitSha.slice(0, 7)}`;

        // Create revert commit
        const revertResponse = await axios.post(
            `https://api.github.com/repos/${repo.fullName}/git/commits/${issue.commitSha}/revert`,
            {
                message: revertMessage,
            },
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        const revertCommitSha = revertResponse.data.sha;

        // Update issue status
        await prisma.issue.update({
            where: { id: issueId },
            data: {
                fixStatus: 'REJECTED',
                commitSha: null,
                fixBranch: null,
                appliedAt: null,
            },
        });

        // Create audit log
        if (userId) {
            await createAuditLog({
                userId,
                action: 'fix_rollback',
                entityType: 'issue',
                entityId: issueId,
                repositoryId: repo.id,
                details: {
                    originalCommitSha: issue.commitSha,
                    revertCommitSha,
                },
            });
        }

        // Create notification
        if (userId) {
            await createNotification({
                userId,
                type: 'fix_failed',
                title: 'Fix Rolled Back',
                message: `Fix for "${issue.title}" has been rolled back.`,
                link: `/pull-requests/${issue.review.pullRequest.id}`,
            });

            await sendEmailNotification(userId, 'fix_failed', {
                title: 'Fix Rolled Back',
                message: `The fix for "${issue.title}" has been rolled back.`,
                link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pull-requests/${issue.review.pullRequest.id}`,
            });
        }

        res.json({
            success: true,
            message: 'Fix rolled back successfully',
            revertCommitSha,
        });
    } catch (error: any) {
        console.error(`Error rolling back fix for issue ${issueId}:`, error);
        res.status(500).json({
            error: 'Failed to rollback fix',
            details: error.message,
        });
    }
};
