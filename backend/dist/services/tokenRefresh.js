"use strict";
/**
 * Token Refresh Service
 * Handles OAuth token refresh for GitHub
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRefreshToken = exports.ensureValidToken = exports.refreshGitHubToken = void 0;
const db_1 = __importDefault(require("../db"));
/**
 * Refresh GitHub OAuth token if expired or expiring soon
 */
const refreshGitHubToken = async (userId) => {
    try {
        const user = await db_1.default.user.findUnique({
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
        await db_1.default.user.update({
            where: { id: userId },
            data: {
                githubTokenExpiresAt: new Date(Date.now() - 1000), // Mark as expired
            },
        });
        return false; // Token needs re-authentication
    }
    catch (error) {
        console.error('Error refreshing token:', error);
        return false;
    }
};
exports.refreshGitHubToken = refreshGitHubToken;
/**
 * Check and refresh token if needed (middleware helper)
 */
const ensureValidToken = async (userId) => {
    return await (0, exports.refreshGitHubToken)(userId);
};
exports.ensureValidToken = ensureValidToken;
/**
 * Auto-refresh token before expiration (should be called periodically)
 */
const autoRefreshToken = async (userId) => {
    try {
        const user = await db_1.default.user.findUnique({
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
            await (0, exports.refreshGitHubToken)(userId);
        }
    }
    catch (error) {
        console.error('Error in auto-refresh:', error);
    }
};
exports.autoRefreshToken = autoRefreshToken;
