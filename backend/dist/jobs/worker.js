"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const reviewExecutor_1 = require("../services/reviewExecutor");
// Guard: only connect if Redis is configured
const redisHost = process.env.REDIS_HOST;
const redisUrl = process.env.REDIS_URL;
if (!redisHost && !redisUrl) {
    console.warn('⚠️  Worker: Redis not configured — skipping worker initialisation.');
    // Export nothing; the dynamic import in server.ts will resolve cleanly.
}
else {
    const connection = new ioredis_1.default({
        host: redisHost || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: null,
        retryStrategy(times) {
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
    const worker = new bullmq_1.Worker('review-queue', async (job) => {
        const startTime = Date.now();
        console.log(`[Worker] 🚀 Processing job ${job.name} with id ${job.id}`);
        console.log(`[Worker] Job data:`, JSON.stringify(job.data, null, 2));
        const { repoFullName, prNumber, installationId, commitSha, force, securityOnly, provider, userId } = job.data;
        try {
            const { emitReviewProgress } = await Promise.resolve().then(() => __importStar(require('../services/websocket')));
            const progressCallback = (progress, prId) => {
                emitReviewProgress(Number(prId) || prNumber, progress);
                console.log(`[Worker] 📈 Progress: ${progress.completedFiles}/${progress.totalFiles} files (${progress.progressPercent}%), ${progress.reviewedLines}/${progress.totalLines} lines`);
            };
            const result = await (0, reviewExecutor_1.executeReview)({
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
            console.log(`[Worker] ✅ Review status: ${result.status} in ${reviewDuration}s (reviewId: ${result.reviewId ?? 'n/a'}, prId: ${result.prId ?? 'n/a'})`);
            if (result.status !== 'completed') {
                throw new Error(result.reason || 'review failed');
            }
            return result;
        }
        catch (error) {
            console.error(`[Worker] Job failed for ${repoFullName} #${prNumber}:`, error);
            throw error;
        }
    }, {
        connection,
        limiter: {
            max: 5,
            duration: 1000,
        },
    });
    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} has completed!`);
    });
    worker.on('failed', (job, err) => {
        console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
    });
}
