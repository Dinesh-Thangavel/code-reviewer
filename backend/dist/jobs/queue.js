"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewQueue = void 0;
exports.getReviewQueue = getReviewQueue;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
let _connection = null;
let _queue = null;
let _connectionFailed = false;
function getConnection() {
    if (_connectionFailed)
        return null;
    if (_connection)
        return _connection;
    try {
        _connection = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
            retryStrategy(times) {
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
    }
    catch {
        _connectionFailed = true;
        return null;
    }
}
/**
 * Returns the BullMQ review queue, or null if Redis is unavailable.
 * Consumers must check for null before adding jobs.
 */
function getReviewQueue() {
    // If Redis connection already failed, don't try again
    if (_connectionFailed)
        return null;
    // If Redis is not configured at all, return null immediately
    const redisHost = process.env.REDIS_HOST;
    const redisUrl = process.env.REDIS_URL;
    // Check if Redis config is commented out or empty
    if ((!redisHost || redisHost.trim() === '' || redisHost.startsWith('#')) &&
        (!redisUrl || redisUrl.trim() === '' || redisUrl.startsWith('#'))) {
        return null;
    }
    // If queue already exists, return it (even if connection might fail later)
    if (_queue)
        return _queue;
    const conn = getConnection();
    if (!conn)
        return null;
    _queue = new bullmq_1.Queue('review-queue', { connection: conn });
    return _queue;
}
// Legacy export for backward compat — may be null
exports.reviewQueue = null;
