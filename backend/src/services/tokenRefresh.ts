/**
 * Token Refresh Service
 * Handles OAuth token refresh for GitHub
 */

import prisma from '../db';
import { exchangeCodeForToken, getGitHubUser, encryptToken } from './githubOAuth';

/**
 * Refresh GitHub OAuth token if expired or expiring soon
 */
export const refreshGitHubToken = async (userId: string): Promise<boolean> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                githubToken: true,
                githubTokenExpiresAt: true,
                githubId: true,
            },
        });

        if (!user || !user.githubToken || !user.githubTokenExpiresAt) {
            return false; // No token to refresh
        }

        // Check if token expires in less than 1 hour
        const expiresAt = new Date(user.githubTokenExpiresAt);
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

        if (expiresAt > oneHourFromNow) {
            return true; // Token still valid
        }

        // Token is expired or expiring soon - need to refresh
        // Note: GitHub OAuth tokens don't have refresh tokens
        // User needs to re-authenticate
        // For GitHub Apps, we use installation tokens which auto-refresh

        console.log(`[Token Refresh] Token for user ${userId} expires soon or is expired`);
        
        // Mark token as expired
        await prisma.user.update({
            where: { id: userId },
            data: {
                githubTokenExpiresAt: new Date(Date.now() - 1000), // Mark as expired
            },
        });

        return false; // Token needs re-authentication
    } catch (error: any) {
        console.error('Error refreshing token:', error);
        return false;
    }
};

/**
 * Check and refresh token if needed (middleware helper)
 */
export const ensureValidToken = async (userId: string): Promise<boolean> => {
    return await refreshGitHubToken(userId);
};

/**
 * Auto-refresh token before expiration (should be called periodically)
 */
export const autoRefreshToken = async (userId: string): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                githubToken: true,
                githubTokenExpiresAt: true,
            },
        });

        if (!user || !user.githubToken || !user.githubTokenExpiresAt) {
            return;
        }

        // Refresh if expires in less than 2 hours
        const expiresAt = new Date(user.githubTokenExpiresAt);
        const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

        if (expiresAt <= twoHoursFromNow) {
            console.log(`[Token Refresh] Auto-refreshing token for user ${userId}`);
            await refreshGitHubToken(userId);
        }
    } catch (error: any) {
        console.error('Error in auto-refresh:', error);
    }
};