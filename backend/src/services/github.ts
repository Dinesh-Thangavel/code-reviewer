import prisma from '../db';
import { getReviewQueue } from '../jobs/queue';

interface PROpenedPayload {
    repository: {
        name: string;
        full_name: string;
    };
    pull_request: {
        number: number;
        title: string;
        draft?: boolean; // GitHub PR draft status
        state?: 'open' | 'closed';
        user: {
            login: string;
        };
        head: {
            sha: string;
            ref: string;
        };
        base: {
            ref: string;
        };
    };
    installation?: {
        id: number;
    };
}

export const handlePullRequestOpened = async (payload: PROpenedPayload) => {
    const { repository, pull_request } = payload;

    try {
        console.log(`[GitHub] Processing PR opened event: ${repository.full_name} #${pull_request.number}`);

        // 1. Upsert Repository (use upsert to prevent duplicates)
        const repo = await prisma.repository.upsert({
            where: { fullName: repository.full_name },
            update: {
                name: repository.name, // Update name in case it changed
                installationId: payload.installation?.id.toString() || undefined,
            },
            create: {
                name: repository.name,
                fullName: repository.full_name,
                isActive: true,
                autoReview: true,
                installationId: payload.installation?.id.toString(),
                provider: 'GITHUB',
            },
        });
        console.log(`[GitHub] Repository ${repository.full_name} ready (ID: ${repo.id})`);

        // Skip draft PRs - don't review until PR is marked as ready
        if (pull_request.draft) {
            console.log(`[GitHub] ⏭️  Skipping draft PR ${repository.full_name} #${pull_request.number} (waiting for ready-for-review)`);
            return { success: true, skipped: true, reason: 'draft-pr' };
        }

        // Check if auto-review is enabled
        if (!repo.isActive || !repo.autoReview) {
            console.log(`[GitHub] Skipping review for ${repository.full_name} (auto-review disabled)`);
            return { success: true, skipped: true, reason: 'auto-review-disabled' };
        }

        // 2. Upsert Pull Request (use compound unique key to prevent duplicates)
        const pr = await prisma.pullRequest.upsert({
            where: {
                repoId_number: {
                    repoId: repo.id,
                    number: pull_request.number,
                },
            },
            update: {
                // Update fields that might change
                headSha: pull_request.head.sha,
                title: pull_request.title,
                status: pull_request.state === 'open' ? 'OPEN' : pull_request.state === 'closed' ? 'CLOSED' : 'MERGED',
            },
            create: {
                repoId: repo.id,
                number: pull_request.number,
                title: pull_request.title,
                author: pull_request.user.login,
                status: 'OPEN',
                riskLevel: 'LOW',
                headSha: pull_request.head.sha,
                baseBranch: pull_request.base.ref,
            },
        });
        console.log(`[GitHub] ✅ Upserted PR #${pull_request.number} for ${repository.full_name} (PR ID: ${pr.id})`);

        // 3. Enqueue Review Job with retry logic
        const queue = getReviewQueue();
        if (queue) {
            // Check repository config for security-only mode (can be added later via YAML config)
            // For now, default to false (full review)
            const securityOnly = false; // Can be read from repo config in future
            
            const job = await queue.add('review-pr', {
                repoFullName: repository.full_name,
                prNumber: pull_request.number,
                installationId: payload.installation?.id,
                commitSha: pull_request.head.sha,
                securityOnly: securityOnly,
            }, {
                attempts: 5, // Increased from 3 to 5
                backoff: {
                    type: 'exponential',
                    delay: 2000, // Start with 2 seconds
                },
                removeOnComplete: {
                    age: 3600, // Keep completed jobs for 1 hour
                },
                removeOnFail: {
                    age: 86400, // Keep failed jobs for 24 hours for debugging
                },
            });
            console.log(`[GitHub] ✅ Enqueued review-pr for ${repository.full_name} #${pull_request.number} (Job ID: ${job.id})`);
            return { success: true, jobId: job.id, prId: pr.id };
        } else {
            console.error(`[GitHub] ❌ Redis unavailable – cannot enqueue review for ${repository.full_name} #${pull_request.number}`);
            // Fallback: try to trigger review directly (synchronous, but better than nothing)
            console.log(`[GitHub] Attempting direct review trigger as fallback...`);
            try {
                const { reviewPullRequest } = await import('../ai/review');
                const { getPullRequestFiles } = await import('./githubApi');
                const { getInstallationAccessToken } = await import('./githubApi');
                
                if (payload.installation?.id) {
                    const token = await getInstallationAccessToken(payload.installation.id.toString());
                    const files = await getPullRequestFiles(repository.full_name, pull_request.number, payload.installation.id.toString());
                    
                    if (files.length > 0) {
                        // Default to full review (securityOnly can be configured per repo later)
                        const reviewResult = await reviewPullRequest(files, undefined, { securityOnly: false });
                        // Create review record
                        await prisma.review.create({
                            data: {
                                prId: pr.id,
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
                                        suggestedFix: issue.suggestedFix || '',
                                        language: issue.language || 'plaintext',
                                    })),
                                },
                            },
                        });
                        console.log(`[GitHub] ✅ Direct review completed for ${repository.full_name} #${pull_request.number}`);
                        return { success: true, directReview: true, prId: pr.id };
                    }
                }
            } catch (fallbackError: any) {
                console.error(`[GitHub] ❌ Direct review fallback also failed:`, fallbackError.message);
            }
            return { success: false, error: 'Redis unavailable and direct review failed' };
        }
    } catch (error: any) {
        console.error(`[GitHub] ❌ Error handling PR opened for ${repository.full_name} #${pull_request.number}:`, error);
        console.error(`[GitHub] Error stack:`, error.stack);
        // Don't throw - log and return error so webhook doesn't fail
        return { success: false, error: error.message };
    }
};
