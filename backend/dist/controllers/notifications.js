"use strict";
/**
 * Notifications Controller
 * Handles in-app notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getUnreadCountController = exports.getNotifications = void 0;
const notifications_1 = require("../services/notifications");
const jwt_1 = require("../utils/jwt");
/**
 * Get user notifications
 */
const getNotifications = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userId = (0, jwt_1.getUserIdFromToken)(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const { unreadOnly, limit } = req.query;
        const notifications = await (0, notifications_1.getUserNotifications)(userId, {
            unreadOnly: unreadOnly === 'true',
            limit: limit ? parseInt(limit) : 50,
        });
        // Parse metadata
        const parsed = notifications.map((notif) => ({
            ...notif,
            metadata: notif.metadata ? JSON.parse(notif.metadata) : null,
        }));
        res.json({
            success: true,
            notifications: parsed,
        });
    }
    catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};
exports.getNotifications = getNotifications;
/**
 * Get unread count
 */
const getUnreadCountController = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userId = (0, jwt_1.getUserIdFromToken)(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const count = await (0, notifications_1.getUnreadCount)(userId);
        res.json({
            success: true,
            count,
        });
    }
    catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};
exports.getUnreadCountController = getUnreadCountController;
/**
 * Mark notification as read
 */
const markNotificationAsRead = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userId = (0, jwt_1.getUserIdFromToken)(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const { id } = req.params;
        await (0, notifications_1.markAsRead)(id, userId);
        res.json({
            success: true,
            message: 'Notification marked as read',
        });
    }
    catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userId = (0, jwt_1.getUserIdFromToken)(token);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        await (0, notifications_1.markAllAsRead)(userId);
        res.json({
            success: true,
            message: 'All notifications marked as read',
        });
    }
    catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
};
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
