/**
 * Notifications Controller
 * Handles in-app notifications
 */

import { Request, Response } from 'express';
import {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
} from '../services/notifications';
import prisma from '../db';
import { getUserIdFromToken } from '../utils/jwt';

/**
 * Get user notifications
 */
export const getNotifications = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { unreadOnly, limit } = req.query;

        const notifications = await getUserNotifications(userId, {
            unreadOnly: unreadOnly === 'true',
            limit: limit ? parseInt(limit as string) : 50,
        });

        // Parse metadata
        const parsed = notifications.map((notif: any) => ({
            ...notif,
            metadata: notif.metadata ? JSON.parse(notif.metadata) : null,
        }));

        res.json({
            success: true,
            notifications: parsed,
        });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

/**
 * Get unread count
 */
export const getUnreadCountController = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const count = await getUnreadCount(userId);

        res.json({
            success: true,
            count,
        });
    } catch (error: any) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { id } = req.params;

        await markAsRead(id as string, userId);

        res.json({
            success: true,
            message: 'Notification marked as read',
        });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        await markAllAsRead(userId);

        res.json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
};
