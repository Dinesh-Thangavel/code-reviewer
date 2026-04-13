import prisma from '../db';
import { getPullRequestFiles } from './githubApi';
import { getBitbucketPRFiles, postBitbucketInlineComments, postBitbucketReviewComment, postBitbucketStatus } from './bitbucketApi';
import { decryptToken } from './bitbucketOAuth';
import { reviewPullRequest } from '../ai/review';
import { getInstallationAccessToken } from './githubApi';
import { createReviewStatusCheck } from './githubStatus';
import { createPRReview, convertIssuesToGitHubComments } from './githubReview';
import { ReviewResult } from '../ai/review';

type Provider = 'GITHUB' | 'BITBUCKET';

interface ExecuteReviewOptions {
    repoFullName: string;
    prNumber: number;
    provider: Provider;
    installationId?: string | number;
    commitSha?: string;
    securityOnly?: boolean;
    force?: boolean;
    userId?: string | number; // required for Bitbucket
    progressCallback?: (progress: any) => void;
}

/**
 * Shared review execution used by the BullMQ worker and webhook fallbacks.
 * Runs the AI review, persists results, and posts back to GitHub/Bitbucket.
 */
export const executeReview = async ({
    repoFullName,
    prNumber,
    provider,
    installationId,
    commitSha,
    securityOnly,
    force,
    userId,
    progressCallback,
}: ExecuteReviewOptions): Promise<{ status: 'completed' | 'skipped' | 'failed'; reason?: string; reviewId?: number }> => {
    // 1) Fetch files (with retry similar to worker)
    let files;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
        try {
            if (provider === 'BITBUCKET') {
                if (!userId) throw new Error('userId required for Bitbucket review');
                const repo = await prisma.repository.findUnique({
                    where: { fullName: repoFullName },
                    select: { bitbucketWorkspace: true },
                });
                if (!repo) throw new Error(`Repository ${repoFullName} not found in DB`);

                const user = await prisma.user.findUnique({
                    where: { id: userId as any },
                    select: { bitbucketToken: true, bitbucketConnected: true },
                });
                if (!user || !user.bitbucketConnected || !user.bitbucketToken) {
                    throw new Error('Bitbucket account not connected for this user');
                }
                const token = decryptToken(user.bitbucketToken);
                const [workspace, repoSlug] = repoFullName.split('/');
                const workspaceSlug = repo.bitbucketWorkspace || workspace;
                files = await getBitbucketPRFiles(token, workspaceSlug, repoSlug, prNumber);
            } else {
                if (!installationId) throw new Error('installationId required for GitHub review');
                files = await getPullRequestFiles(repoFullName, prNumber, installationId.toString());
            }
            break;
        } catch (error: any) {
            retries++;
            if (retries >= maxRetries) {
                throw new Error(`Failed to fetch files after ${maxRetries} attempts: ${error.message}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        }
    }

    if (!files || files.length === 0) {
        return { status: 'skipped', reason: 'no_files' };
    }

    // 2) Find PR record
    const pr = await prisma.pullRequest.findFirst({
        where: {
            number: prNumber,
            repository: { fullName: repoFullName },
        },
    });

    if (!pr) {
        throw new Error(`Pull Request not found in DB: ${repoFullName} #${prNumber}`);
    }

    // Skip if already reviewed same commit
    if (pr.lastReviewedCommitSha === commitSha && !force) {
        return { status: 'skipped', reason: 'already_reviewed' };
    }

    // 3) Create PENDING review
    const review = await prisma.review.create({
        data: {
            prId: pr.id,
            summary: 'Review in progress...',
            status: 'PENDING',
            confidenceScore: 0,
            riskLevel: 'LOW',
            filesChanged: files.length,
        },
    });

    try {
        // 4) Run AI review
        const reviewResult: ReviewResult = await reviewPullRequest(files, progressCallback, {
            securityOnly: !!securityOnly,
        });

        // 5) Update review + issues
        await prisma.review.update({
            where: { id: review.id },
            data: {
                summary: reviewResult.summary,
                confidenceScore: reviewResult.confidenceScore,
                riskLevel: reviewResult.riskLevel,
                status: 'COMPLETED',
                filesChanged: files.length,
                issues: {
                    create: reviewResult.issues.map((issue: any) => ({
                        severity: issue.severity,
                        filePath: issue.file,
                        lineNumber: issue.line,
                        title: issue.title,
                        description: issue.description,
                        suggestedFix:
                            issue.suggestedFix && issue.suggestedFix.trim() !== ''
                                ? issue.suggestedFix
                                : `// TODO: Review and fix the issue: ${issue.title}\n// ${issue.description}\n// Please provide a fix for this issue.`,
                        language: issue.language || 'plaintext',
                        fixStatus: 'PENDING',
                    })),
                },
            },
        });

        // 6) Update PR
        await prisma.pullRequest.update({
            where: { id: pr.id },
            data: {
                riskLevel: reviewResult.riskLevel,
                lastReviewedCommitSha: commitSha || pr.headSha,
                headSha: commitSha || pr.headSha,
            },
        });

        // 7) Post results back to provider
        if (provider === 'BITBUCKET') {
            if (!userId) throw new Error('userId required to post Bitbucket results');
            const user = await prisma.user.findUnique({
                where: { id: userId as any },
                select: { bitbucketToken: true, bitbucketConnected: true },
            });
            if (user && user.bitbucketConnected && user.bitbucketToken) {
                const token = decryptToken(user.bitbucketToken);
                const [workspace, repoSlug] = repoFullName.split('/');
                await postBitbucketReviewComment(token, workspace, repoSlug, prNumber, reviewResult);
                await postBitbucketInlineComments(token, workspace, repoSlug, prNumber, reviewResult.issues);
                await postBitbucketStatus(
                    token,
                    workspace,
                    repoSlug,
                    commitSha || pr.headSha,
                    'SUCCESSFUL',
                    `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pull-requests/${pr.id}`,
                    'AI review completed'
                );
            }
        } else {
            if (!installationId) throw new Error('installationId required to post GitHub results');
            const token = await getInstallationAccessToken(installationId.toString());

            const issuesCount = reviewResult.issues.reduce((acc: any, issue: any) => {
                acc[issue.severity] = (acc[issue.severity] || 0) + 1;
                return acc;
            }, {});

            const commentBody = `### 🤖 AI Code Review\n\n**Risk Level**: ${reviewResult.riskLevel}\n**Confidence**: ${reviewResult.confidenceScore}%\n\n**Issue Summary**:\n- 🔴 Critical: ${issuesCount.critical || 0}\n- 🔒 Security: ${issuesCount.security || 0}\n- 🚩 Performance: ${issuesCount.performance || 0}\n- 🔧 Quality: ${issuesCount.quality || 0}\n- ✨ Style: ${issuesCount.style || 0}\n\n${reviewResult.summary}`;

            const comments = convertIssuesToGitHubComments(reviewResult.issues);

            let reviewEvent: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT';
            const criticalCount = issuesCount.critical || 0;
            const securityCount = issuesCount.security || 0;

            if (reviewResult.riskLevel === 'LOW' && reviewResult.issues.length === 0 && reviewResult.confidenceScore >= 80) {
                reviewEvent = 'APPROVE';
            } else if (reviewResult.riskLevel === 'HIGH' || criticalCount > 0 || securityCount > 0) {
                reviewEvent = 'REQUEST_CHANGES';
            }

            await createReviewStatusCheck(
                repoFullName,
                commitSha || pr.headSha,
                reviewResult,
                installationId.toString(),
                prNumber,
            );

            await createPRReview({
                repoFullName,
                prNumber,
                body: commentBody,
                comments,
                token,
                event: reviewEvent,
            });
        }

        // 8) Emit WebSocket notification if available
        try {
            const { emitReviewCompleted } = await import('./websocket');
            emitReviewCompleted(pr.id, review.id);
        } catch {
            // non-critical
        }

        return { status: 'completed', reviewId: review.id };
    } catch (error: any) {
        await prisma.review.update({
            where: { id: review.id },
            data: {
                status: 'FAILED',
                summary: `Review failed: ${error.message}`,
            },
        });
        return { status: 'failed', reason: error.message };
    }
};
