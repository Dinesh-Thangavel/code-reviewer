"use strict";
/**
 * Metrics Controller
 * Provides review velocity and team performance metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccuracyMetricsController = exports.getTeamMetricsController = exports.getReviewVelocityController = void 0;
const metrics_1 = require("../services/metrics");
/**
 * Get review velocity
 */
const getReviewVelocityController = async (req, res) => {
    try {
        const { repositoryId, startDate, endDate, period = 'day' } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const velocity = await (0, metrics_1.getReviewVelocity)({
            repositoryId: repositoryId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            period: period,
        });
        res.json({
            success: true,
            velocity,
        });
    }
    catch (error) {
        console.error('Error getting review velocity:', error);
        res.status(500).json({ error: 'Failed to get review velocity' });
    }
};
exports.getReviewVelocityController = getReviewVelocityController;
/**
 * Get team performance metrics
 */
const getTeamMetricsController = async (req, res) => {
    try {
        const { repositoryId, startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const metrics = await (0, metrics_1.getTeamMetrics)({
            repositoryId: repositoryId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        });
        res.json({
            success: true,
            metrics,
        });
    }
    catch (error) {
        console.error('Error getting team metrics:', error);
        res.status(500).json({ error: 'Failed to get team metrics' });
    }
};
exports.getTeamMetricsController = getTeamMetricsController;
/**
 * Get accuracy metrics for automatic reviews
 */
const getAccuracyMetricsController = async (req, res) => {
    try {
        const { repositoryId, startDate, endDate } = req.query;
        const metrics = await (0, metrics_1.getAccuracyMetrics)({
            repositoryId: repositoryId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        res.json({
            success: true,
            metrics,
        });
    }
    catch (error) {
        console.error('Error getting accuracy metrics:', error);
        res.status(500).json({ error: 'Failed to get accuracy metrics' });
    }
};
exports.getAccuracyMetricsController = getAccuracyMetricsController;
