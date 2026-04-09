"use strict";
/**
 * Bitbucket OAuth Service
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
exports.getUserRepositories = exports.decryptToken = exports.encryptToken = exports.getBitbucketUser = exports.exchangeCodeForToken = exports.verifyState = exports.getOAuthUrl = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const BITBUCKET_CLIENT_ID = process.env.BITBUCKET_OAUTH_CLIENT_ID || '';
const BITBUCKET_CLIENT_SECRET = process.env.BITBUCKET_OAUTH_CLIENT_SECRET || '';
const BITBUCKET_REDIRECT_URI = process.env.BITBUCKET_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/auth/bitbucket/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Log OAuth configuration on startup (without secrets)
if (!BITBUCKET_CLIENT_ID || !BITBUCKET_CLIENT_SECRET) {
    console.warn('[Bitbucket OAuth] WARNING: Bitbucket OAuth credentials not configured!');
    console.warn('[Bitbucket OAuth] Required environment variables:');
    console.warn('[Bitbucket OAuth]   - BITBUCKET_OAUTH_CLIENT_ID');
    console.warn('[Bitbucket OAuth]   - BITBUCKET_OAUTH_CLIENT_SECRET');
    console.warn('[Bitbucket OAuth]   - BITBUCKET_OAUTH_REDIRECT_URI (optional, defaults to http://localhost:5000/api/auth/bitbucket/callback)');
}
else {
    console.log('[Bitbucket OAuth] Bitbucket OAuth configured:', {
        clientId: BITBUCKET_CLIENT_ID.substring(0, 8) + '...',
        redirectUri: BITBUCKET_REDIRECT_URI,
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
        client_id: BITBUCKET_CLIENT_ID,
        redirect_uri: BITBUCKET_REDIRECT_URI,
        response_type: 'code',
        state,
    });
    const url = `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`;
    return { url, state };
};
exports.getOAuthUrl = getOAuthUrl;
/**
 * Verify OAuth state
 */
const verifyState = (state) => {
    const stored = oauthStates.get(state);
    if (!stored) {
        console.warn(`[Bitbucket OAuth] State not found in memory. Total states: ${oauthStates.size}`);
        const states = Array.from(oauthStates.keys()).slice(0, 5);
        console.warn(`[Bitbucket OAuth] Sample states in memory: ${states.join(', ')}`);
        return { valid: false };
    }
    // Clean up expired states
    if (Date.now() > stored.expiresAt) {
        console.warn(`[Bitbucket OAuth] State expired. Age: ${Date.now() - stored.expiresAt}ms`);
        oauthStates.delete(state);
        return { valid: false };
    }
    // Remove used state
    oauthStates.delete(state);
    console.log(`[Bitbucket OAuth] State verified and removed. userId: ${stored.userId}`);
    return { valid: true, userId: stored.userId };
};
exports.verifyState = verifyState;
/**
 * Exchange authorization code for access token
 */
const exchangeCodeForToken = async (code) => {
    try {
        if (!BITBUCKET_CLIENT_ID || !BITBUCKET_CLIENT_SECRET) {
            throw new Error('Bitbucket OAuth credentials not configured. Check BITBUCKET_OAUTH_CLIENT_ID and BITBUCKET_OAUTH_CLIENT_SECRET environment variables.');
        }
        const response = await axios_1.default.post('https://bitbucket.org/site/oauth2/access_token', new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: BITBUCKET_REDIRECT_URI,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            auth: {
                username: BITBUCKET_CLIENT_ID,
                password: BITBUCKET_CLIENT_SECRET,
            },
        });
        if (response.data.error) {
            console.error('[Bitbucket OAuth] Bitbucket returned error:', response.data);
            throw new Error(response.data.error_description || response.data.error);
        }
        if (!response.data.access_token) {
            throw new Error('Bitbucket did not return an access token');
        }
        return response.data.access_token;
    }
    catch (error) {
        console.error('[Bitbucket OAuth] Error exchanging code for token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        throw new Error(`Failed to exchange authorization code for token: ${error.message}`);
    }
};
exports.exchangeCodeForToken = exchangeCodeForToken;
/**
 * Get Bitbucket user info from access token
 */
const getBitbucketUser = async (token) => {
    try {
        const response = await axios_1.default.get('https://api.bitbucket.org/2.0/user', {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });
        const user = response.data;
        // Get user email (separate API call)
        let email = '';
        try {
            const emailResponse = await axios_1.default.get('https://api.bitbucket.org/2.0/user/emails', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });
            const emails = emailResponse.data.values || [];
            const primaryEmail = emails.find((e) => e.is_primary) || emails[0];
            email = primaryEmail?.email || '';
        }
        catch (emailError) {
            console.warn('[Bitbucket OAuth] Could not fetch user email:', emailError);
        }
        return {
            uuid: user.uuid,
            username: user.username,
            display_name: user.display_name || user.username,
            email: email || user.email || '',
            links: user.links || { avatar: { href: '' } },
        };
    }
    catch (error) {
        console.error('Error fetching Bitbucket user:', error);
        throw new Error('Failed to fetch Bitbucket user information');
    }
};
exports.getBitbucketUser = getBitbucketUser;
/**
 * Get encryption key (32 bytes for AES-256)
 * Reuse the same encryption functions from GitHub OAuth
 */
const getEncryptionKey = () => {
    const keyString = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32-chars!!';
    if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
        return Buffer.from(keyString, 'hex');
    }
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
 * Get user's Bitbucket repositories
 */
const getUserRepositories = async (token) => {
    try {
        const allRepos = [];
        let nextUrl = 'https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100';
        // Bitbucket uses pagination, so we need to fetch all pages
        while (nextUrl) {
            const response = await axios_1.default.get(nextUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });
            const repos = response.data.values || [];
            allRepos.push(...repos);
            // Check for next page
            nextUrl = response.data.next || null;
        }
        return allRepos.map((repo) => ({
            uuid: repo.uuid,
            name: repo.name,
            full_name: repo.full_name, // Format: workspace/repo-name
            is_private: repo.is_private,
            language: repo.language || null,
            workspace: {
                slug: repo.workspace?.slug || repo.owner?.username || '',
                name: repo.workspace?.name || repo.owner?.display_name || '',
            },
            updated_on: repo.updated_on,
            permissions: {
                admin: repo.permissions?.admin || false,
                write: repo.permissions?.write || false,
                read: repo.permissions?.read || true,
            },
        }));
    }
    catch (error) {
        console.error('Error fetching user repositories:', error);
        throw new Error('Failed to fetch Bitbucket repositories');
    }
};
exports.getUserRepositories = getUserRepositories;
