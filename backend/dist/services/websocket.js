"use strict";
/**
 * WebSocket Service
 * Handles real-time updates via WebSocket
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitReviewProgress = exports.emitReviewCompleted = exports.emitPRStatusUpdate = exports.emitToAll = exports.emitToRepository = exports.emitToUser = exports.getWebSocketServer = exports.initializeWebSocket = void 0;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../utils/jwt");
let io = null;
/**
 * Initialize WebSocket server
 */
const initializeWebSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
        },
        path: '/socket.io',
    });
    io.on('connection', (socket) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        const decoded = token ? (0, jwt_1.verifyToken)(token) : null;
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
        socket.on('join-user', (requestedUserId) => {
            if (requestedUserId === userId) {
                socket.join(`user:${requestedUserId}`);
                console.log(`[WebSocket] User ${requestedUserId} joined their room`);
            }
        });
        // Join repository room (for repo-specific updates)
        socket.on('join-repo', (repoId) => {
            socket.join(`repo:${repoId}`);
            console.log(`[WebSocket] Client joined repo ${repoId}`);
        });
        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initializeWebSocket = initializeWebSocket;
/**
 * Get WebSocket server instance
 */
const getWebSocketServer = () => {
    return io;
};
exports.getWebSocketServer = getWebSocketServer;
/**
 * Emit event to a user
 */
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};
exports.emitToUser = emitToUser;
/**
 * Emit event to a repository room
 */
const emitToRepository = (repoId, event, data) => {
    if (io) {
        io.to(`repo:${repoId}`).emit(event, data);
    }
};
exports.emitToRepository = emitToRepository;
/**
 * Emit event to all connected clients
 */
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};
exports.emitToAll = emitToAll;
/**
 * Emit PR status update
 */
const emitPRStatusUpdate = (prId, status, data) => {
    if (io) {
        io.emit('pr-status-update', {
            prId,
            status,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.emitPRStatusUpdate = emitPRStatusUpdate;
/**
 * Emit review completed notification
 */
const emitReviewCompleted = (prId, reviewId, userId) => {
    if (io) {
        const eventData = {
            prId,
            reviewId,
            timestamp: new Date().toISOString(),
        };
        if (userId) {
            (0, exports.emitToUser)(userId, 'review-completed', eventData);
        }
        else {
            (0, exports.emitToAll)('review-completed', eventData);
        }
    }
};
exports.emitReviewCompleted = emitReviewCompleted;
/**
 * Emit review progress update
 */
const emitReviewProgress = (prId, progress, userId) => {
    if (io) {
        const eventData = {
            prId,
            ...progress,
            timestamp: new Date().toISOString(),
        };
        if (userId) {
            (0, exports.emitToUser)(userId, 'review-progress', eventData);
        }
        else {
            (0, exports.emitToAll)('review-progress', eventData);
        }
    }
};
exports.emitReviewProgress = emitReviewProgress;
