"use strict";
/**
 * Notification Service
 * Handles in-app and email notifications
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailNotification = exports.getUnreadCount = exports.markAllAsRead = exports.markAsRead = exports.getUserNotifications = exports.createNotification = void 0;
const db_1 = __importDefault(require("../db"));
/**
 * Create a notification
 */
const createNotification = async (data) => {
    return await db_1.default.notification.create({
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
exports.createNotification = createNotification;
/**
 * Get user notifications
 */
const getUserNotifications = async (userId, options = {}) => {
    const where = { userId };
    if (options.unreadOnly) {
        where.read = false;
    }
    return await db_1.default.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
    });
};
exports.getUserNotifications = getUserNotifications;
/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
    return await db_1.default.notification.updateMany({
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
exports.markAsRead = markAsRead;
/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
    return await db_1.default.notification.updateMany({
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
exports.markAllAsRead = markAllAsRead;
/**
 * Get unread count
 */
const getUnreadCount = async (userId) => {
    return await db_1.default.notification.count({
        where: {
            userId,
            read: false,
        },
    });
};
exports.getUnreadCount = getUnreadCount;
/**
 * Send email notification
 */
const sendEmailNotification = async (userId, type, data) => {
    // Check if user has email notifications enabled
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: { emailNotifications: true, email: true },
    });
    if (!user || !user.emailNotifications || !user.email) {
        return; // User has disabled email notifications or no email
    }
    try {
        const { sendEmail, generateEmailTemplate } = await Promise.resolve().then(() => __importStar(require('./emailService')));
        const html = generateEmailTemplate(data.title, data.message, data.link, 'View Details');
        await sendEmail({
            to: user.email,
            subject: data.title,
            html,
        });
    }
    catch (error) {
        console.error('Failed to send email notification:', error);
        // Don't throw - email failures shouldn't break the app
    }
};
exports.sendEmailNotification = sendEmailNotification;
