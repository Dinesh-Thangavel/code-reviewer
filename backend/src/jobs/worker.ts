import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { executeReview } from '../services/reviewExecutor';

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
                const { emitReviewProgress } = await import('../services/websocket');
                const progressCallback = (progress: any, prId?: string) => {
                    emitReviewProgress(Number(prId) || prNumber, progress);
                    console.log(
                        `[Worker] 📈 Progress: ${progress.completedFiles}/${progress.totalFiles} files (${progress.progressPercent}%), ${progress.reviewedLines}/${progress.totalLines} lines`,
                    );
                };

                const result = await executeReview({
                    repoFullName,
                    prNumber,
                    provider: provider || 'GITHUB',
                    installationId,
                    commitSha,
                    securityOnly,
                    force,
                    userId,
                    progressCallback,
                });

                const reviewDuration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(
                    `[Worker] ✅ Review status: ${result.status} in ${reviewDuration}s (reviewId: ${
                        result.reviewId ?? 'n/a'
                    }, prId: ${result.prId ?? 'n/a'})`,
                );

                if (result.status !== 'completed') {
                    throw new Error(result.reason || 'review failed');
                }
                return result;
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
