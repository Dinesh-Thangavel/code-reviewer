import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../db';
import { getPullRequestFiles, getInstallationAccessToken } from '../services/githubApi';
import { getBitbucketPRFiles, postBitbucketReviewComment, postBitbucketInlineComments, postBitbucketStatus } from '../services/bitbucketApi';
import { decryptToken } from '../services/bitbucketOAuth';
import { reviewPullRequest } from '../ai/review';
import { createPRReview, convertIssuesToGitHubComments } from '../services/githubReview';

// Guard: only connect if Redis is configured
const redisHost = process.env.REDIS_HOST;
const redisUrl = process.env.REDIS_URL;

if (!redisHost && !redisUrl) {
    console.warn('⚠️  Worker: Redis not configured — skipping worker initialisation.');
    // Export nothing; the dynamic import in server.ts will resolve cleanly.
} else {
    const connection = new IORedis({
        host: redisHost || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: null,
        retryStrategy(times: number) {
            if (times > 3) {
                console.warn('⚠️  Worker Redis connection failed after 3 retries. Giving up.');
                return null; // stop retrying
            }
            return Math.min(times * 500, 3000);
        },
    });

    let errorLogged = false;
    connection.on('error', (err) => {
        if (!errorLogged) {
            errorLogged = true;
            console.warn('⚠️  Worker Redis error:', err.message);
        }
    });

    const worker = new Worker(
        'review-queue',
        async (job: Job) => {
            const startTime = Date.now();
            console.log(`[Worker] 🚀 Processing job ${job.name} with id ${job.id}`);
            console.log(`[Worker] Job data:`, JSON.stringify(job.data, null, 2));

            const { repoFullName, prNumber, installationId, commitSha, force, securityOnly, provider, userId } =
                job.data;

            try {
                // 1) Fetch files with retry logic
                console.log(`[Worker] 📥 Fetching files for ${repoFullName} #${prNumber}...`);
                let files;
                let retries = 0;
                const maxRetries = 3;

                while (retries < maxRetries) {
                    try {
                        if (provider === 'BITBUCKET') {
                            const repo = await prisma.repository.findUnique({
                                where: { fullName: repoFullName },
                                select: { bitbucketWorkspace: true },
                            });
                            if (!repo) {
                                throw new Error(`Repository ${repoFullName} not found in DB`);
                            }
                            if (!userId) {
                                throw new Error('userId missing in job data for Bitbucket review');
                            }
                            const user = await prisma.user.findUnique({
                                where: { id: userId },
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
                            files = await getPullRequestFiles(repoFullName, prNumber, installationId.toString());
                        }
                        break; // success
                    } catch (error: any) {
                        retries++;
                        if (retries >= maxRetries) {
                            throw new Error(`Failed to fetch files after ${maxRetries} attempts: ${error.message}`);
                        }
                        console.warn(
                            `[Worker] ⚠️  File fetch attempt ${retries} failed, retrying... (${error.message})`,
                        );
                        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
                    }
                }

                if (!files || files.length === 0) {
                    console.log(`[Worker] No files to review for ${repoFullName} #${prNumber}.`);
                    return { status: 'skipped', reason: 'no_files' };
                }

                // 2) Find PR in DB
                const pr = await prisma.pullRequest.findFirst({
                    where: {
                        number: prNumber,
                        repository: { fullName: repoFullName },
                    },
                });

                if (!pr) {
                    throw new Error(`Pull Request not found in DB: ${repoFullName} #${prNumber}`);
                }

                // Skip if already reviewed (unless forced)
                if (pr.lastReviewedCommitSha === commitSha && !force) {
                    console.log(
                        `[Worker] Skipping review for ${repoFullName} #${prNumber} (SHA ${commitSha} already reviewed)`,
                    );
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
                    // 4) AI Review with progress tracking
                    console.log(`[Worker] 🤖 Starting AI review for ${files.length} files...`);
                    const reviewStartTime = Date.now();

                    const { emitReviewProgress } = await import('../services/websocket');
                    const progressCallback = (progress: any) => {
                        emitReviewProgress(pr.id, progress);
                        console.log(
                            `[Worker] 📊 Progress: ${progress.completedFiles}/${progress.totalFiles} files (${progress.progressPercent}%), ${progress.reviewedLines}/${progress.totalLines} lines`,
                        );
                    };

                    const reviewResult = await reviewPullRequest(files, progressCallback, {
                        securityOnly: !!securityOnly,
                    });
                    const reviewDuration = ((Date.now() - reviewStartTime) / 1000).toFixed(2);
                    const mode = securityOnly ? 'SECURITY-ONLY' : 'FULL';
                    console.log(`[Worker] ✅ AI ${mode} review completed in ${reviewDuration}s`);

                    // 5) Update Review with results + create issues
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

                    console.log(`[Worker] Saved review ${review.id} with ${reviewResult.issues.length} issues.`);

                    // 6) Update PR risk level and last reviewed SHA
                    await prisma.pullRequest.update({
                        where: { id: pr.id },
                        data: {
                            riskLevel: reviewResult.riskLevel,
                            lastReviewedCommitSha: commitSha,
                            headSha: commitSha,
                        },
                    });

                    // 7) Post results back to provider
                    if (provider === 'BITBUCKET') {
                        try {
                            if (!userId) {
                                throw new Error('userId missing for Bitbucket review posting');
                            }
                            const user = await prisma.user.findUnique({
                                where: { id: userId },
                                select: { bitbucketToken: true, bitbucketConnected: true },
                            });
                            if (!user || !user.bitbucketConnected || !user.bitbucketToken) {
                                throw new Error('Bitbucket account not connected for this user');
                            }
                            const token = decryptToken(user.bitbucketToken);
                            const [workspace, repoSlug] = repoFullName.split('/');
                            await postBitbucketReviewComment(token, workspace, repoSlug, prNumber, reviewResult);
                            await postBitbucketInlineComments(token, workspace, repoSlug, prNumber, reviewResult.issues);
                            await postBitbucketStatus(
                                token,
                                workspace,
                                repoSlug,
                                commitSha,
                                'SUCCESSFUL',
                                `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pull-requests/${pr.id}`,
                                'AI review completed'
                            );
                            console.log(`[Worker] Posted review + inline comments + status to Bitbucket for ${repoFullName} #${prNumber}`);
                        } catch (bbError: any) {
                            console.warn(`[Worker] Failed to post Bitbucket review (non-critical): ${bbError.message}`);
                        }
                    } else if (installationId) {
                        try {
                            const { createReviewStatusCheck } = await import('../services/githubStatus');
                            await createReviewStatusCheck(
                                repoFullName,
                                commitSha,
                                reviewResult,
                                installationId.toString(),
                                prNumber,
                            );
                            console.log(`[Worker] Created GitHub status check for ${repoFullName} #${prNumber}`);
                        } catch (statusError: any) {
                            console.warn(`[Worker] Failed to create status check (non-critical):`, statusError.message);
                        }

                        try {
                            console.log(`[Worker] Posting review to GitHub for ${repoFullName} #${prNumber}...`);
                            const token = await getInstallationAccessToken(installationId.toString());

                            const issuesCount = reviewResult.issues.reduce((acc: any, issue: any) => {
                                acc[issue.severity] = (acc[issue.severity] || 0) + 1;
                                return acc;
                            }, {});

                            const commentBody = `### 🤖 AI Code Review

**Risk Level**: ${reviewResult.riskLevel}
**Confidence**: ${reviewResult.confidenceScore}%

**Issue Summary**:
- 🔴 Critical: ${issuesCount.critical || 0}
- 🔒 Security: ${issuesCount.security || 0}
- 🚩 Performance: ${issuesCount.performance || 0}
- 🔧 Quality: ${issuesCount.quality || 0}
- ✨ Style: ${issuesCount.style || 0}

${reviewResult.summary}`;

                            const comments = convertIssuesToGitHubComments(reviewResult.issues);

                            let reviewEvent: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT';
                            const criticalCount = issuesCount.critical || 0;
                            const securityCount = issuesCount.security || 0;

                            if (
                                reviewResult.riskLevel === 'LOW' &&
                                reviewResult.issues.length === 0 &&
                                reviewResult.confidenceScore >= 80
                            ) {
                                reviewEvent = 'APPROVE';
                            } else if (
                                reviewResult.riskLevel === 'HIGH' ||
                                criticalCount > 0 ||
                                securityCount > 0
                            ) {
                                reviewEvent = 'REQUEST_CHANGES';
                            }

                            await createPRReview({
                                repoFullName,
                                prNumber,
                                body: commentBody,
                                comments,
                                token,
                                event: reviewEvent,
                            });
                            console.log(`[Worker] Posted review to GitHub with event: ${reviewEvent}`);
                        } catch (ghPostError: any) {
                            console.warn(`[Worker] Failed to post GitHub review (non-critical): ${ghPostError.message}`);
                        }
                    }

                    // 8) Emit WebSocket notification
                    try {
                        const { emitReviewCompleted } = await import('../services/websocket');
                        emitReviewCompleted(pr.id, review.id);
                    } catch (wsError) {
                        console.warn('[Worker] WebSocket notification failed (non-critical):', wsError);
                    }

                    return { status: 'completed', reviewId: review.id };
                } catch (error: any) {
                    console.error(`[Worker] Review processing failed:`, error);

                    // Mark as FAILED
                    await prisma.review.update({
                        where: { id: review.id },
                        data: {
                            status: 'FAILED',
                            summary: `Review failed: ${error.message}`,
                        },
                    });

                    throw error; // Rethrow for BullMQ retry
                }
            } catch (error: any) {
                console.error(`[Worker] Job failed for ${repoFullName} #${prNumber}:`, error);
                throw error;
            }
        },
        {
            connection,
            limiter: {
                max: 5,
                duration: 1000,
            },
        },
    );

    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} has completed!`);
    });

    worker.on('failed', (job, err) => {
        console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
    });
}
