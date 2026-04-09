/**
 * Notification Service
 * Handles in-app and email notifications
 */

import prisma from '../db';

export type NotificationType =
    | 'review_completed'
    | 'review_failed'
    | 'fix_applied'
    | 'fix_failed'
    | 'critical_issue'
    | 'pr_created'
    | 'bulk_fix_completed'
    | 'repo_connected'
    | 'system_alert';

export interface CreateNotificationData {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
}

/**
 * Create a notification
 */
export const createNotification = async (data: CreateNotificationData) => {
    return await prisma.notification.create({
        data: {
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
            metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
    });
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
) => {
    const where: any = { userId };
    if (options.unreadOnly) {
        where.read = false;
    }

    return await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
    });
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId: string, userId: string) => {
    return await prisma.notification.updateMany({
        where: {
            id: notificationId,
            userId, // Ensure user owns the notification
        },
        data: {
            read: true,
            readAt: new Date(),
        },
    });
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId: string) => {
    return await prisma.notification.updateMany({
        where: {
            userId,
            read: false,
        },
        data: {
            read: true,
            readAt: new Date(),
        },
    });
};

/**
 * Get unread count
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
    return await prisma.notification.count({
        where: {
            userId,
            read: false,
        },
    });
};

/**
 * Send email notification
 */
export const sendEmailNotification = async (
    userId: string,
    type: NotificationType,
    data: { title: string; message: string; link?: string }
) => {
    // Check if user has email notifications enabled
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { emailNotifications: true, email: true },
    });

    if (!user || !user.emailNotifications || !user.email) {
        return; // User has disabled email notifications or no email
    }

    try {
        const { sendEmail, generateEmailTemplate } = await import('./emailService');
        
        const html = generateEmailTemplate(
            data.title,
            data.message,
            data.link,
            'View Details'
        );

        await sendEmail({
            to: user.email,
            subject: data.title,
            html,
        });
    } catch (error: any) {
        console.error('Failed to send email notification:', error);
        // Don't throw - email failures shouldn't break the app
    }
};
