/**
 * Audit Log Service
 * Tracks all user actions for security and compliance
 */

import prisma from '../db';

export type AuditAction =
    | 'fix_applied'
    | 'fix_rejected'
    | 'fix_modified'
    | 'fix_rollback'
    | 'review_rerun'
    | 'review_created'
    | 'repo_connected'
    | 'repo_disconnected'
    | 'repo_updated'
    | 'user_login'
    | 'user_logout'
    | 'github_connected'
    | 'github_disconnected'
    | 'bitbucket_connected'
    | 'bitbucket_disconnected'
    | 'settings_updated'
    | 'bulk_fix_applied'
    | 'fix_pr_created'
    | 'fix_pr_merged';

export interface AuditLogData {
    userId?: string;
    action: AuditAction;
    entityType: 'issue' | 'review' | 'repository' | 'user' | 'fix';
    entityId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    repositoryId?: string;
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (data: AuditLogData): Promise<void> => {
    try {
        await prisma.auditLog.create({
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
    } catch (error) {
        // Don't throw - audit logs shouldn't break the main flow
        console.error('Failed to create audit log:', error);
    }
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (filters: {
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    repositoryId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}) => {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.repositoryId) where.repositoryId = filters.repositoryId;
    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const logs = await prisma.auditLog.findMany({
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

    return logs.map((log: any) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
    }));
};

/**
 * Get audit log statistics
 */
export const getAuditStats = async (filters: {
    userId?: string;
    repositoryId?: string;
    startDate?: Date;
    endDate?: Date;
}) => {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.repositoryId) where.repositoryId = filters.repositoryId;
    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const logs = await prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
    });

    return logs.map((item) => ({
        action: item.action,
        count: item._count,
    }));
};
