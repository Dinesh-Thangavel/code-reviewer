"use strict";
/**
 * Audit Log Controller
 * Provides audit log endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditStatsController = exports.getAuditLogsController = void 0;
const auditLog_1 = require("../services/auditLog");
/**
 * Get audit logs with filters
 */
const getAuditLogsController = async (req, res) => {
    try {
        const { userId, action, entityType, entityId, repositoryId, startDate, endDate, limit = 100, offset = 0, } = req.query;
        const logs = await (0, auditLog_1.getAuditLogs)({
            userId: userId,
            action: action,
            entityType: entityType,
            entityId: entityId,
            repositoryId: repositoryId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
        res.json({
            success: true,
            logs,
            count: logs.length,
        });
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};
exports.getAuditLogsController = getAuditLogsController;
/**
 * Get audit statistics
 */
const getAuditStatsController = async (req, res) => {
    try {
        const { userId, repositoryId, startDate, endDate } = req.query;
        const stats = await (0, auditLog_1.getAuditStats)({
            userId: userId,
            repositoryId: repositoryId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        res.json({
            success: true,
            stats,
        });
    }
    catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ error: 'Failed to fetch audit statistics' });
    }
};
exports.getAuditStatsController = getAuditStatsController;
