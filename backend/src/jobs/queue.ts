import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let _connection: IORedis | null = null;
let _queue: Queue | null = null;
let _connectionFailed = false;

function getConnection(): IORedis | null {
    if (_connectionFailed) return null;
    if (_connection) return _connection;

    try {
        _connection = new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
            retryStrategy(times: number) {
                if (times > 3) {
                    _connectionFailed = true;
                    console.warn('⚠️  Redis connection failed after 3 retries. Queue features disabled.');
                    return null; // stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });

        _connection.on('error', (err) => {
            if (!_connectionFailed) {
                _connectionFailed = true;
                console.warn('⚠️  Redis unavailable – queue features disabled:', err.message);
            }
        });

        return _connection;
    } catch {
        _connectionFailed = true;
        return null;
    }
}

/**
 * Returns the BullMQ review queue, or null if Redis is unavailable.
 * Consumers must check for null before adding jobs.
 */
export function getReviewQueue(): Queue | null {
    // If Redis connection already failed, don't try again
    if (_connectionFailed) return null;
    
    // If Redis is not configured at all, return null immediately
    const redisHost = process.env.REDIS_HOST;
    const redisUrl = process.env.REDIS_URL;
    
    // Check if Redis config is commented out or empty
    if ((!redisHost || redisHost.trim() === '' || redisHost.startsWith('#')) && 
        (!redisUrl || redisUrl.trim() === '' || redisUrl.startsWith('#'))) {
        return null;
    }

    // If queue already exists, return it (even if connection might fail later)
    if (_queue) return _queue;

    const conn = getConnection();
    if (!conn) return null;

    _queue = new Queue('review-queue', { connection: conn });
    return _queue;
}

// Legacy export for backward compat — may be null
export const reviewQueue: Queue | null = null;
