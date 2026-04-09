/**
 * Audit Log Controller
 * Provides audit log endpoints
 */

import { Request, Response } from 'express';
import { getAuditLogs, getAuditStats } from '../services/auditLog';
import prisma from '../db';

/**
 * Get audit logs with filters
 */
export const getAuditLogsController = async (req: Request, res: Response) => {
    try {
        const {
            userId,
            action,
            entityType,
            entityId,
            repositoryId,
            startDate,
            endDate,
            limit = 100,
            offset = 0,
        } = req.query;

        const logs = await getAuditLogs({
            userId: userId as string,
            action: action as any,
            entityType: entityType as string,
            entityId: entityId as string,
            repositoryId: repositoryId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
        });

        res.json({
            success: true,
            logs,
            count: logs.length,
        });
    } catch (error: any) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};

/**
 * Get audit statistics
 */
export const getAuditStatsController = async (req: Request, res: Response) => {
    try {
        const { userId, repositoryId, startDate, endDate } = req.query;

        const stats = await getAuditStats({
            userId: userId as string,
            repositoryId: repositoryId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
        });

        res.json({
            success: true,
            stats,
        });
    } catch (error: any) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ error: 'Failed to fetch audit statistics' });
    }
};
