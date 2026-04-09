"use strict";
/**
 * GitHub OAuth Service
 * Handles OAuth flow for user authentication and repository access
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
exports.getUserRepositories = exports.decryptToken = exports.encryptToken = exports.getGitHubUser = exports.exchangeCodeForToken = exports.verifyState = exports.getOAuthUrl = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const GITHUB_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/auth/github/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Log OAuth configuration on startup (without secrets)
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.warn('[OAuth] WARNING: GitHub OAuth credentials not configured!');
    console.warn('[OAuth] Required environment variables:');
    console.warn('[OAuth]   - GITHUB_OAUTH_CLIENT_ID');
    console.warn('[OAuth]   - GITHUB_OAUTH_CLIENT_SECRET');
    console.warn('[OAuth]   - GITHUB_OAUTH_REDIRECT_URI (optional, defaults to http://localhost:5000/api/auth/github/callback)');
}
else {
    console.log('[OAuth] GitHub OAuth configured:', {
        clientId: GITHUB_CLIENT_ID.substring(0, 8) + '...',
        redirectUri: GITHUB_REDIRECT_URI,
    });
}
// Store OAuth states temporarily (in production, use Redis)
const oauthStates = new Map();
/**
 * Generate OAuth authorization URL
 */
const getOAuthUrl = (userId) => {
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    oauthStates.set(state, { userId, expiresAt });
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_REDIRECT_URI,
        scope: 'repo read:org user:email',
        state,
        response_type: 'code',
        // Note: GitHub OAuth doesn't support 'prompt' parameter like Google OAuth
        // To use a different account, users need to:
        // 1. Log out of GitHub first, OR
        // 2. Use incognito/private browsing mode
        // We add 'allow_signup=true' to allow new account creation
        allow_signup: 'true',
    });
    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    return { url, state };
};
exports.getOAuthUrl = getOAuthUrl;
/**
 * Verify OAuth state
 */
const verifyState = (state) => {
    const stored = oauthStates.get(state);
    if (!stored) {
        console.warn(`[OAuth] State not found in memory. Total states: ${oauthStates.size}`);
        // Log all current states for debugging (without sensitive data)
        const states = Array.from(oauthStates.keys()).slice(0, 5);
        console.warn(`[OAuth] Sample states in memory: ${states.join(', ')}`);
        return { valid: false };
    }
    // Clean up expired states
    if (Date.now() > stored.expiresAt) {
        console.warn(`[OAuth] State expired. Age: ${Date.now() - stored.expiresAt}ms`);
        oauthStates.delete(state);
        return { valid: false };
    }
    // Remove used state
    oauthStates.delete(state);
    console.log(`[OAuth] State verified and removed. userId: ${stored.userId}`);
    return { valid: true, userId: stored.userId };
};
exports.verifyState = verifyState;
/**
 * Exchange authorization code for access token
 */
const exchangeCodeForToken = async (code) => {
    try {
        if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
            throw new Error('GitHub OAuth credentials not configured. Check GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET environment variables.');
        }
        const response = await axios_1.default.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: GITHUB_REDIRECT_URI,
        }, {
            headers: {
                Accept: 'application/json',
            },
        });
        if (response.data.error) {
            console.error('[OAuth] GitHub returned error:', response.data);
            throw new Error(response.data.error_description || response.data.error);
        }
        if (!response.data.access_token) {
            throw new Error('GitHub did not return an access token');
        }
        return response.data.access_token;
    }
    catch (error) {
        console.error('[OAuth] Error exchanging code for token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        throw new Error(`Failed to exchange authorization code for token: ${error.message}`);
    }
};
exports.exchangeCodeForToken = exchangeCodeForToken;
/**
 * Get GitHub user info from access token
 */
const getGitHubUser = async (token) => {
    try {
        const [userResponse, emailsResponse] = await Promise.all([
            axios_1.default.get('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }),
            axios_1.default.get('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }),
        ]);
        const user = userResponse.data;
        const emails = emailsResponse.data;
        const primaryEmail = emails.find((e) => e.primary)?.email || emails[0]?.email || user.email;
        return {
            id: user.id,
            login: user.login,
            name: user.name || user.login,
            email: primaryEmail,
            avatar_url: user.avatar_url,
        };
    }
    catch (error) {
        console.error('Error fetching GitHub user:', error);
        throw new Error('Failed to fetch GitHub user information');
    }
};
exports.getGitHubUser = getGitHubUser;
/**
 * Get encryption key (32 bytes for AES-256)
 * If ENCRYPTION_KEY is provided as hex, use it directly
 * Otherwise, hash the provided key to get 32 bytes
 */
const getEncryptionKey = () => {
    const keyString = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32-chars!!';
    // If key is hex-encoded (64 hex chars = 32 bytes), decode it
    if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
        return Buffer.from(keyString, 'hex');
    }
    // Otherwise, hash the key to get exactly 32 bytes
    return crypto.createHash('sha256').update(keyString).digest();
};
/**
 * Encrypt OAuth token for storage
 */
const encryptToken = (token) => {
    const algorithm = 'aes-256-cbc';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};
exports.encryptToken = encryptToken;
/**
 * Decrypt OAuth token from storage
 */
const decryptToken = (encryptedToken) => {
    try {
        const algorithm = 'aes-256-cbc';
        const key = getEncryptionKey();
        if (!encryptedToken || typeof encryptedToken !== 'string') {
            throw new Error('Invalid encrypted token format');
        }
        const parts = encryptedToken.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted token format: expected format "iv:encrypted"');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        if (!encrypted || !parts[0]) {
            throw new Error('Invalid encrypted token: missing IV or encrypted data');
        }
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        console.error('Decrypt token error:', error);
        throw new Error(`Failed to decrypt token: ${error.message}`);
    }
};
exports.decryptToken = decryptToken;
/**
 * Get user's GitHub repositories
 */
const getUserRepositories = async (token) => {
    try {
        const response = await axios_1.default.get('https://api.github.com/user/repos', {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
            params: {
                per_page: 100,
                sort: 'updated',
                affiliation: 'owner,collaborator,organization_member',
            },
        });
        return response.data.map((repo) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            updated_at: repo.updated_at,
            permissions: repo.permissions || { admin: false, push: false, pull: true },
        }));
    }
    catch (error) {
        console.error('Error fetching user repositories:', error);
        throw new Error('Failed to fetch GitHub repositories');
    }
};
exports.getUserRepositories = getUserRepositories;
