"use strict";
/**
 * Audit Log Service
 * Tracks all user actions for security and compliance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditStats = exports.getAuditLogs = exports.createAuditLog = void 0;
const db_1 = __importDefault(require("../db"));
/**
 * Create an audit log entry
 */
const createAuditLog = async (data) => {
    try {
        await db_1.default.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                details: data.details ? JSON.stringify(data.details) : null,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                repositoryId: data.repositoryId,
            },
        });
    }
    catch (error) {
        // Don't throw - audit logs shouldn't break the main flow
        console.error('Failed to create audit log:', error);
    }
};
exports.createAuditLog = createAuditLog;
/**
 * Get audit logs with filters
 */
const getAuditLogs = async (filters) => {
    const where = {};
    if (filters.userId)
        where.userId = filters.userId;
    if (filters.action)
        where.action = filters.action;
    if (filters.entityType)
        where.entityType = filters.entityType;
    if (filters.entityId)
        where.entityId = filters.entityId;
    if (filters.repositoryId)
        where.repositoryId = filters.repositoryId;
    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate)
            where.createdAt.gte = filters.startDate;
        if (filters.endDate)
            where.createdAt.lte = filters.endDate;
    }
    const logs = await db_1.default.auditLog.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            repository: {
                select: {
                    id: true,
                    name: true,
                    fullName: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
    });
    return logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
    }));
};
exports.getAuditLogs = getAuditLogs;
/**
 * Get audit log statistics
 */
const getAuditStats = async (filters) => {
    const where = {};
    if (filters.userId)
        where.userId = filters.userId;
    if (filters.repositoryId)
        where.repositoryId = filters.repositoryId;
    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate)
            where.createdAt.gte = filters.startDate;
        if (filters.endDate)
            where.createdAt.lte = filters.endDate;
    }
    const logs = await db_1.default.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
    });
    return logs.map((item) => ({
        action: item.action,
        count: item._count,
    }));
};
exports.getAuditStats = getAuditStats;
