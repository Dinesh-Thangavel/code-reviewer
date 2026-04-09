import { Request, Response } from 'express';
import prisma from '../db';
import {
    getFileContent,
    getRefSha,
    createBranch,
    updateFileContent,
    applyFixToFile,
    createFixPullRequest,
    mergePullRequest,
} from '../services/githubFix';
import { createAuditLog } from '../services/auditLog';
import { createNotification } from '../services/notifications';
import { getUserIdFromToken } from '../utils/jwt';

/**
 * Apply a single fix to a specific issue
 * POST /api/issues/:issueId/apply-fix
 * 
 * IMPORTANT: This endpoint requires MANUAL user approval.
 * Fixes are NEVER applied automatically - they must be explicitly requested via this API endpoint.
 */
export const applySingleFix = async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;
    const { customFix } = req.body; // Allow custom fix to be passed

    try {
        // 1. Get issue with review and PR info
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

        if (issue.fixStatus === 'APPLIED') {
            res.status(400).json({ error: 'Fix already applied', commitSha: issue.commitSha });
            return;
        }

        // Use custom fix if provided, otherwise use suggested fix
        const fixToApply = customFix || issue.suggestedFix;
        if (!fixToApply) {
            res.status(400).json({ error: 'No suggested fix available for this issue' });
            return;
        }

        const pr = issue.review.pullRequest;
        const repo = pr.repository;

        if (!repo.installationId) {
            res.status(400).json({ error: 'Repository has no GitHub installation ID' });
            return;
        }

        const baseBranch = pr.baseBranch || 'main';
        const fixBranch = `fix/ai-review-${pr.number}-${issue.id.slice(0, 8)}`;

        // 2. Get base branch SHA
        const baseSha = await getRefSha(repo.fullName, baseBranch, repo.installationId);

        // 3. Create fix branch
        await createBranch(repo.fullName, fixBranch, baseSha, repo.installationId);

        // 4. Get original file content
        const { content: originalContent, sha: fileSha } = await getFileContent(
            repo.fullName,
            issue.filePath,
            fixBranch,
            repo.installationId
        );

        // 5. Apply fix to file content (use custom fix if provided)
        const fixedContent = applyFixToFile(originalContent, issue.lineNumber, fixToApply);

        // 6. Commit the fix
        const commitMessage = `fix: ${issue.title}\n\nAI-suggested fix for ${issue.severity} issue at ${issue.filePath}:${issue.lineNumber}\n\n${issue.description}`;

        const { commitSha } = await updateFileContent(
            repo.fullName,
            issue.filePath,
            fixBranch,
            fixedContent,
            fileSha,
            commitMessage,
            repo.installationId
        );

        // 7. Update issue status in database
        await prisma.issue.update({
            where: { id: issueId },
            data: {
                fixStatus: 'APPLIED',
                appliedAt: new Date(),
                commitSha,
                fixBranch,
                userFeedback: customFix ? 'modified' : 'accepted',
            },
        });

        // Record feedback for learning system
        try {
            const { recordFeedback } = await import('../services/learningSystem');
            await recordFeedback({
                issueId,
                userFeedback: customFix ? 'modified' : 'accepted',
                originalFix: issue.suggestedFix || '',
                appliedFix: fixToApply,
            });
        } catch (error) {
            console.error('Error recording feedback:', error);
            // Don't fail the request if learning system fails
        }

        // Get user ID for notifications
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }

        // Create audit log
        if (userId) {
            await createAuditLog({
                userId,
                action: 'fix_applied',
                entityType: 'issue',
                entityId: issueId,
                repositoryId: repo.id,
                details: {
                    commitSha,
                    branch: fixBranch,
                    customFix: !!customFix,
                },
            });

            // Create notification
            await createNotification({
                userId,
                type: 'fix_applied',
                title: 'Fix Applied',
                message: `Fix for "${issue.title}" has been applied successfully.`,
                link: `/pull-requests/${pr.id}`,
            });

            // Send email notification
            const { sendEmailNotification } = await import('../services/notifications');
            await sendEmailNotification(userId, 'fix_applied', {
                title: 'Fix Applied Successfully',
                message: `The fix for "${issue.title}" has been applied to ${repo.fullName}.`,
                link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pull-requests/${pr.id}`,
            });
        }

        // Emit WebSocket update
        try {
            const { emitPRStatusUpdate } = await import('../services/websocket');
            emitPRStatusUpdate(pr.id, 'fix_applied', {
                issueId,
                commitSha,
            });
        } catch (wsError) {
            console.warn('[Fix] WebSocket update failed (non-critical):', wsError);
        }

        res.json({
            success: true,
            issueId,
            commitSha,
            branch: fixBranch,
            message: `Fix applied successfully for: ${issue.title}`,
        });
    } catch (error: any) {
        console.error(`Error applying fix for issue ${issueId}:`, error);

        // Mark as failed
        try {
            await prisma.issue.update({
                where: { id: issueId },
                data: { fixStatus: 'FAILED' },
            });
        } catch (_) { /* ignore update error */ }

        res.status(500).json({
            error: 'Failed to apply fix',
            details: error.message,
        });
    }
};

/**
 * Reject a fix (mark as not needed)
 * POST /api/issues/:issueId/reject-fix
 */
export const rejectFix = async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;
    const { feedbackNote } = req.body;

    try {
        // Get user ID
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }

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

        await prisma.issue.update({
            where: { id: issueId },
            data: {
                fixStatus: 'REJECTED',
                userFeedback: 'rejected',
                feedbackNote: feedbackNote || null,
            },
        });

        // Create audit log
        await createAuditLog({
            userId,
            action: 'fix_rejected',
            entityType: 'issue',
            entityId: issueId,
            details: {
                filePath: issue.filePath,
                lineNumber: issue.lineNumber,
                severity: issue.severity,
                feedbackNote,
            },
            repositoryId: issue.review.pullRequest.repository.id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({ success: true, issueId, message: 'Fix rejected' });
    } catch (error: any) {
        console.error(`Error rejecting fix for issue ${issueId}:`, error);
        res.status(500).json({ error: 'Failed to reject fix' });
    }
};

/**
 * Apply multiple fixes in bulk for a review
 * POST /api/reviews/:reviewId/apply-bulk
 * Body: { issueIds: string[] }
 * 
 * IMPORTANT: This endpoint requires MANUAL user approval.
 * Fixes are NEVER applied automatically - they must be explicitly requested via this API endpoint.
 */
export const applyBulkFixes = async (req: Request, res: Response) => {
    const reviewId = req.params.reviewId as string;
    const { issueIds } = req.body;

    if (!issueIds || !Array.isArray(issueIds) || issueIds.length === 0) {
        res.status(400).json({ error: 'issueIds array is required' });
        return;
    }

    try {
        // Get the review with PR and repo info
        const review: any = await prisma.review.findUnique({
            where: { id: reviewId },
            include: {
                pullRequest: {
                    include: { repository: true },
                },
                issues: {
                    where: {
                        id: { in: issueIds },
                        fixStatus: 'PENDING',
                        suggestedFix: { not: null },
                    },
                },
            },
        });

        if (!review) {
            res.status(404).json({ error: 'Review not found' });
            return;
        }

        const pr = review.pullRequest;
        const repo = pr.repository;

        if (!repo.installationId) {
            res.status(400).json({ error: 'Repository has no GitHub installation ID' });
            return;
        }

        if (review.issues.length === 0) {
            res.status(400).json({ error: 'No applicable issues found for the given IDs' });
            return;
        }

        const baseBranch = pr.baseBranch || 'main';
        const fixBranch = `fix/ai-review-bulk-${pr.number}-${Date.now()}`;

        // Create fix branch
        const baseSha = await getRefSha(repo.fullName, baseBranch, repo.installationId);
        await createBranch(repo.fullName, fixBranch, baseSha, repo.installationId);

        const results: Array<{ issueId: string; success: boolean; error?: string; commitSha?: string }> = [];

        // Group issues by file to avoid conflicts
        const issuesByFile = new Map<string, any[]>();
        for (const issue of review.issues) {
            const existing = issuesByFile.get(issue.filePath) || [];
            existing.push(issue);
            issuesByFile.set(issue.filePath, existing);
        }

        // Apply fixes file by file
        for (const [filePath, fileIssues] of issuesByFile) {
            try {
                const { content: originalContent, sha: fileSha } = await getFileContent(
                    repo.fullName,
                    filePath,
                    fixBranch,
                    repo.installationId
                );

                // Sort issues by line number descending to avoid line number shifts
                const sortedIssues = [...fileIssues].sort((a: any, b: any) => b.lineNumber - a.lineNumber);

                let currentContent = originalContent;
                for (const issue of sortedIssues) {
                    if (issue.suggestedFix) {
                        try {
                            currentContent = applyFixToFile(currentContent, issue.lineNumber, issue.suggestedFix);
                        } catch (e: any) {
                            results.push({ issueId: issue.id, success: false, error: e.message });
                            continue;
                        }
                    }
                }

                // Commit all changes for this file
                const commitMessage = `fix: Apply ${sortedIssues.length} AI-suggested fixes to ${filePath}`;
                const { commitSha } = await updateFileContent(
                    repo.fullName,
                    filePath,
                    fixBranch,
                    currentContent,
                    fileSha,
                    commitMessage,
                    repo.installationId
                );

                // Update all issues for this file
                for (const issue of sortedIssues) {
                    await prisma.issue.update({
                        where: { id: issue.id },
                        data: {
                            fixStatus: 'APPLIED',
                            appliedAt: new Date(),
                            commitSha,
                            fixBranch,
                        },
                    });
                    results.push({ issueId: issue.id, success: true, commitSha });
                }
            } catch (error: any) {
                for (const issue of fileIssues) {
                    await prisma.issue.update({
                        where: { id: issue.id },
                        data: { fixStatus: 'FAILED' },
                    });
                    results.push({ issueId: issue.id, success: false, error: error.message });
                }
            }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        res.json({
            success: true,
            branch: fixBranch,
            totalApplied: successCount,
            totalFailed: failCount,
            results,
            message: `Applied ${successCount}/${results.length} fixes on branch ${fixBranch}`,
        });
    } catch (error: any) {
        console.error(`Error applying bulk fixes for review ${reviewId}:`, error);
        res.status(500).json({ error: 'Failed to apply bulk fixes', details: error.message });
    }
};

/**
 * Create a PR with all applied fixes from a review
 * POST /api/reviews/:reviewId/create-fix-pr
 */
export const createFixPR = async (req: Request, res: Response) => {
    const reviewId = req.params.reviewId as string;

    try {
        const review: any = await prisma.review.findUnique({
            where: { id: reviewId },
            include: {
                pullRequest: {
                    include: { repository: true },
                },
                issues: {
                    where: { fixStatus: 'APPLIED' },
                },
            },
        });

        if (!review) {
            res.status(404).json({ error: 'Review not found' });
            return;
        }

        if (review.issues.length === 0) {
            res.status(400).json({ error: 'No applied fixes found for this review' });
            return;
        }

        const pr = review.pullRequest;
        const repo = pr.repository;

        if (!repo.installationId) {
            res.status(400).json({ error: 'Repository has no GitHub installation ID' });
            return;
        }

        // Find the fix branch from applied issues
        const fixBranch = review.issues[0].fixBranch;
        if (!fixBranch) {
            res.status(400).json({ error: 'No fix branch found' });
            return;
        }

        const baseBranch = pr.baseBranch || 'main';

        // Build PR body
        const issueList = review.issues
            .map((i: any) => `- **[${i.severity.toUpperCase()}]** ${i.title} (\`${i.filePath}:${i.lineNumber}\`)`)
            .join('\n');

        const body = `## 🤖 AI Code Review - Automated Fixes

This PR contains ${review.issues.length} automated fix(es) suggested by AI code review for PR #${pr.number}.

### Applied Fixes:
${issueList}

### Review Details:
- **Original PR:** #${pr.number} - ${pr.title}
- **Confidence Score:** ${review.confidenceScore}%
- **Risk Level:** ${review.riskLevel}

---
*Generated by AI Code Review Dashboard*`;

        const title = `fix: AI review fixes for PR #${pr.number} - ${pr.title}`;

        const { prNumber, prUrl } = await createFixPullRequest(
            repo.fullName,
            title,
            body,
            fixBranch,
            baseBranch,
            repo.installationId
        );

        res.json({
            success: true,
            prNumber,
            prUrl,
            fixesApplied: review.issues.length,
            message: `Created fix PR #${prNumber}`,
        });
    } catch (error: any) {
        console.error(`Error creating fix PR for review ${reviewId}:`, error);
        res.status(500).json({ error: 'Failed to create fix PR', details: error.message });
    }
};

/**
 * Get fix status for all issues in a review
 * GET /api/reviews/:reviewId/fix-status
 */
export const getFixStatus = async (req: Request, res: Response) => {
    const reviewId = req.params.reviewId as string;

    try {
        const issues = await prisma.issue.findMany({
            where: { reviewId },
            select: {
                id: true,
                fixStatus: true,
                appliedAt: true,
                commitSha: true,
                fixBranch: true,
            },
        });

        const summary = {
            total: issues.length,
            pending: issues.filter((i) => i.fixStatus === 'PENDING').length,
            applied: issues.filter((i) => i.fixStatus === 'APPLIED').length,
            rejected: issues.filter((i) => i.fixStatus === 'REJECTED').length,
            failed: issues.filter((i) => i.fixStatus === 'FAILED').length,
        };

        res.json({ issues, summary });
    } catch (error: any) {
        console.error(`Error getting fix status for review ${reviewId}:`, error);
        res.status(500).json({ error: 'Failed to get fix status' });
    }
};

/**
 * Merge a fix Pull Request
 * POST /api/pull-requests/:prNumber/merge
 */
export const mergeFixPR = async (req: Request, res: Response) => {
    const prNumberParam = Array.isArray(req.params.prNumber) 
        ? req.params.prNumber[0] 
        : req.params.prNumber;
    const prNumber = parseInt(prNumberParam);
    const { mergeMethod = 'merge', commitTitle, commitMessage } = req.body;

    if (isNaN(prNumber)) {
        res.status(400).json({ error: 'Invalid PR number' });
        return;
    }

    try {
        // Get user ID
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;
        if (token) {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }

        // Find the PR in database
        const pr: any = await prisma.pullRequest.findFirst({
            where: { number: prNumber },
            include: {
                repository: true,
            },
        });

        if (!pr) {
            res.status(404).json({ error: 'Pull request not found' });
            return;
        }

        const repo = pr.repository;

        if (!repo.installationId) {
            res.status(400).json({ error: 'Repository has no GitHub installation ID' });
            return;
        }

        // Merge the PR
        const result = await mergePullRequest(
            repo.fullName,
            prNumber,
            repo.installationId,
            mergeMethod,
            commitTitle,
            commitMessage
        );

        if (!result.merged) {
            res.status(400).json({ 
                error: 'Failed to merge PR',
                message: result.message || 'PR could not be merged',
            });
            return;
        }

        // Create audit log
        await createAuditLog({
            userId,
            action: 'fix_pr_merged',
            entityType: 'review',
            entityId: pr.id,
            details: {
                prNumber,
                mergeMethod,
                commitSha: result.sha,
            },
            repositoryId: repo.id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            merged: true,
            prNumber,
            sha: result.sha,
            message: result.message,
        });
    } catch (error: any) {
        console.error(`Error merging PR #${prNumber}:`, error);
        res.status(500).json({ 
            error: 'Failed to merge PR',
            details: error.message,
        });
    }
};
