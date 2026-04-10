/**
 * GitHub OAuth Service
 * Handles OAuth flow for user authentication and repository access
 */

import axios from 'axios';
import * as crypto from 'crypto';

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
} else {
    console.log('[OAuth] GitHub OAuth configured:', {
        clientId: GITHUB_CLIENT_ID.substring(0, 8) + '...',
        redirectUri: GITHUB_REDIRECT_URI,
    });
}

// Store OAuth states temporarily (in production, use Redis)
const oauthStates = new Map<string, { userId: string | 'signin'; expiresAt: number }>();

/**
 * Generate OAuth authorization URL
 */
export const getOAuthUrl = (userId: string | 'signin'): { url: string; state: string } => {
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

/**
 * Verify OAuth state
 */
export const verifyState = (state: string): { valid: boolean; userId?: string | 'signin' } => {
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

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code: string): Promise<string> => {
    try {
        if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
            throw new Error('GitHub OAuth credentials not configured. Check GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET environment variables.');
        }

        const response = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: GITHUB_REDIRECT_URI,
            },
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        if (response.data.error) {
            console.error('[OAuth] GitHub returned error:', response.data);
            throw new Error(response.data.error_description || response.data.error);
        }

        if (!response.data.access_token) {
            throw new Error('GitHub did not return an access token');
        }

        return response.data.access_token;
    } catch (error: any) {
        console.error('[OAuth] Error exchanging code for token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        throw new Error(`Failed to exchange authorization code for token: ${error.message}`);
    }
};

/**
 * Get GitHub user info from access token
 */
export const getGitHubUser = async (token: string): Promise<{
    id: number;
    login: string;
    name: string;
    email: string;
    avatar_url: string;
}> => {
    try {
        const [userResponse, emailsResponse] = await Promise.all([
            axios.get('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }),
            axios.get('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }),
        ]);

        const user = userResponse.data;
        const emails = emailsResponse.data;
        const primaryEmail =
            emails.find((e: any) => e.primary)?.email || emails[0]?.email || user.email;
        // Prisma requires email; GitHub may return none if email is private and scopes/emails empty
        const email =
            primaryEmail || `${user.id}+${user.login}@users.noreply.github.com`;

        return {
            id: user.id,
            login: user.login,
            name: user.name || user.login,
            email,
            avatar_url: user.avatar_url,
        };
    } catch (error: any) {
        console.error('Error fetching GitHub user:', error);
        throw new Error('Failed to fetch GitHub user information');
    }
};

/**
 * Get encryption key (32 bytes for AES-256)
 * If ENCRYPTION_KEY is provided as hex, use it directly
 * Otherwise, hash the provided key to get 32 bytes
 */
const getEncryptionKey = (): Buffer => {
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
export const encryptToken = (token: string): string => {
    const algorithm = 'aes-256-cbc';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt OAuth token from storage
 */
export const decryptToken = (encryptedToken: string): string => {
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
    } catch (error: any) {
        console.error('Decrypt token error:', error);
        throw new Error(`Failed to decrypt token: ${error.message}`);
    }
};

/**
 * Get user's GitHub repositories
 */
export const getUserRepositories = async (token: string): Promise<Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    language: string | null;
    stargazers_count: number;
    updated_at: string;
    permissions: {
        admin: boolean;
        push: boolean;
        pull: boolean;
    };
}>> => {
    try {
        const response = await axios.get('https://api.github.com/user/repos', {
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

        return response.data.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            updated_at: repo.updated_at,
            permissions: repo.permissions || { admin: false, push: false, pull: true },
        }));
    } catch (error: any) {
        console.error('Error fetching user repositories:', error);
        throw new Error('Failed to fetch GitHub repositories');
    }
};
