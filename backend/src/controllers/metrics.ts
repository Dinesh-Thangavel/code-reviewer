/**
 * Metrics Controller
 * Provides review velocity and team performance metrics
 */

import { Request, Response } from 'express';
import { getReviewVelocity, getTeamMetrics, getAccuracyMetrics } from '../services/metrics';

/**
 * Get review velocity
 */
export const getReviewVelocityController = async (req: Request, res: Response) => {
    try {
        const { repositoryId, startDate, endDate, period = 'day' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const velocity = await getReviewVelocity({
            repositoryId: repositoryId as string,
            startDate: new Date(startDate as string),
            endDate: new Date(endDate as string),
            period: period as 'day' | 'week' | 'month',
        });

        res.json({
            success: true,
            velocity,
        });
    } catch (error: any) {
        console.error('Error getting review velocity:', error);
        res.status(500).json({ error: 'Failed to get review velocity' });
    }
};

/**
 * Get team performance metrics
 */
export const getTeamMetricsController = async (req: Request, res: Response) => {
    try {
        const { repositoryId, startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const metrics = await getTeamMetrics({
            repositoryId: repositoryId as string,
            startDate: new Date(startDate as string),
            endDate: new Date(endDate as string),
        });

        res.json({
            success: true,
            metrics,
        });
    } catch (error: any) {
        console.error('Error getting team metrics:', error);
        res.status(500).json({ error: 'Failed to get team metrics' });
    }
};

/**
 * Get accuracy metrics for automatic reviews
 */
export const getAccuracyMetricsController = async (req: Request, res: Response) => {
    try {
        const { repositoryId, startDate, endDate } = req.query;

        const metrics = await getAccuracyMetrics({
            repositoryId: repositoryId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
        });

        res.json({
            success: true,
            metrics,
        });
    } catch (error: any) {
        console.error('Error getting accuracy metrics:', error);
        res.status(500).json({ error: 'Failed to get accuracy metrics' });
    }
};
