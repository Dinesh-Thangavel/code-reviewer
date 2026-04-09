/**
 * WebSocket Hook
 * Manages WebSocket connection for real-time updates
 */

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useWebSocket = (userId?: string, onMessage?: (event: string, data: any) => void) => {
    const socketRef = useRef<Socket | null>(null);
    const onMessageRef = useRef(onMessage);

    // Keep onMessage ref updated without causing reconnections
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        // Connect to WebSocket server
        const socket = io(WS_URL, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            timeout: 20000,
            autoConnect: true,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[WebSocket] Connected');
            
            // Join user room if userId provided
            if (userId) {
                socket.emit('join-user', userId);
            }
        });

        socket.on('disconnect', (reason) => {
            // Only log if it's not a normal disconnect
            if (reason !== 'io client disconnect') {
                console.log('[WebSocket] Disconnected:', reason);
            }
        });

        socket.on('connect_error', (error) => {
            // Suppress connection errors in development - they're usually harmless
            if (import.meta.env.PROD) {
                console.error('[WebSocket] Connection error:', error.message);
            }
        });

        // Listen for messages using ref to avoid re-subscribing
        const handlePRUpdate = (data: any) => onMessageRef.current?.('pr-status-update', data);
        const handleReviewCompleted = (data: any) => onMessageRef.current?.('review-completed', data);
        const handleReviewProgress = (data: any) => onMessageRef.current?.('review-progress', data);
        const handleFixApplied = (data: any) => onMessageRef.current?.('fix-applied', data);
        const handleNotification = (data: any) => onMessageRef.current?.('notification', data);

        socket.on('pr-status-update', handlePRUpdate);
        socket.on('review-completed', handleReviewCompleted);
        socket.on('review-progress', handleReviewProgress);
        socket.on('fix-applied', handleFixApplied);
        socket.on('notification', handleNotification);

        return () => {
            // Only disconnect if socket is connected
            if (socket.connected) {
                socket.disconnect();
            }
            // Clean up listeners
            socket.off('pr-status-update', handlePRUpdate);
            socket.off('review-completed', handleReviewCompleted);
            socket.off('review-progress', handleReviewProgress);
            socket.off('fix-applied', handleFixApplied);
            socket.off('notification', handleNotification);
        };
    }, [userId]); // Removed onMessage from dependencies to prevent reconnections

    const joinRepository = (repoId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('join-repo', repoId);
        }
    };

    return {
        socket: socketRef.current,
        joinRepository,
        isConnected: socketRef.current?.connected || false,
    };
};
