/**
 * WebSocket Service
 * Handles real-time updates via WebSocket
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '../utils/jwt';

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export const initializeWebSocket = (httpServer: HTTPServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
        },
        path: '/socket.io',
    });

    io.on('connection', (socket) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        const decoded = token ? verifyToken(token) : null;
        if (!decoded) {
            console.log(`[WebSocket] Rejecting unauthenticated socket ${socket.id}`);
            socket.emit('error', 'unauthorized');
            socket.disconnect(true);
            return;
        }

        const userId = decoded.userId;
        console.log(`[WebSocket] Client connected: ${socket.id} (user ${userId})`);
        socket.join(`user:${userId}`);

        // Join user room (for user-specific updates)
        // Prevent arbitrary room joining; ensure room matches user
        socket.on('join-user', (requestedUserId: string) => {
            if (requestedUserId === userId) {
                socket.join(`user:${requestedUserId}`);
                console.log(`[WebSocket] User ${requestedUserId} joined their room`);
            }
        });

        // Join repository room (for repo-specific updates)
        socket.on('join-repo', (repoId: string) => {
            socket.join(`repo:${repoId}`);
            console.log(`[WebSocket] Client joined repo ${repoId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

/**
 * Get WebSocket server instance
 */
export const getWebSocketServer = (): SocketIOServer | null => {
    return io;
};

/**
 * Emit event to a user
 */
export const emitToUser = (userId: string, event: string, data: any) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

/**
 * Emit event to a repository room
 */
export const emitToRepository = (repoId: string, event: string, data: any) => {
    if (io) {
        io.to(`repo:${repoId}`).emit(event, data);
    }
};

/**
 * Emit event to all connected clients
 */
export const emitToAll = (event: string, data: any) => {
    if (io) {
        io.emit(event, data);
    }
};

/**
 * Emit PR status update
 */
export const emitPRStatusUpdate = (prId: string, status: string, data?: any) => {
    if (io) {
        io.emit('pr-status-update', {
            prId,
            status,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
};

/**
 * Emit review completed notification
 */
export const emitReviewCompleted = (prId: string, reviewId: string, userId?: string) => {
    if (io) {
        const eventData = {
            prId,
            reviewId,
            timestamp: new Date().toISOString(),
        };

        if (userId) {
            emitToUser(userId, 'review-completed', eventData);
        } else {
            emitToAll('review-completed', eventData);
        }
    }
};

/**
 * Emit review progress update
 */
export const emitReviewProgress = (prId: string, progress: {
    totalFiles: number;
    completedFiles: number;
    pendingFiles: number;
    totalLines: number;
    reviewedLines: number;
    pendingLines: number;
    currentFile?: string;
    progressPercent: number;
}, userId?: string) => {
    if (io) {
        const eventData = {
            prId,
            ...progress,
            timestamp: new Date().toISOString(),
        };

        if (userId) {
            emitToUser(userId, 'review-progress', eventData);
        } else {
            emitToAll('review-progress', eventData);
        }
    }
};
