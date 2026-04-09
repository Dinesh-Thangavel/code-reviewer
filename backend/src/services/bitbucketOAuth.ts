/**
 * Bitbucket OAuth Service
 * Handles OAuth flow for user authentication and repository access
 */

import axios from 'axios';
import * as crypto from 'crypto';

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
} else {
    console.log('[Bitbucket OAuth] Bitbucket OAuth configured:', {
        clientId: BITBUCKET_CLIENT_ID.substring(0, 8) + '...',
        redirectUri: BITBUCKET_REDIRECT_URI,
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
        client_id: BITBUCKET_CLIENT_ID,
        redirect_uri: BITBUCKET_REDIRECT_URI,
        response_type: 'code',
        state,
    });

    const url = `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`;

    return { url, state };
};

/**
 * Verify OAuth state
 */
export const verifyState = (state: string): { valid: boolean; userId?: string | 'signin' } => {
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

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code: string): Promise<string> => {
    try {
        if (!BITBUCKET_CLIENT_ID || !BITBUCKET_CLIENT_SECRET) {
            throw new Error('Bitbucket OAuth credentials not configured. Check BITBUCKET_OAUTH_CLIENT_ID and BITBUCKET_OAUTH_CLIENT_SECRET environment variables.');
        }

        const response = await axios.post(
            'https://bitbucket.org/site/oauth2/access_token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: BITBUCKET_REDIRECT_URI,
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: BITBUCKET_CLIENT_ID,
                    password: BITBUCKET_CLIENT_SECRET,
                },
            }
        );

        if (response.data.error) {
            console.error('[Bitbucket OAuth] Bitbucket returned error:', response.data);
            throw new Error(response.data.error_description || response.data.error);
        }

        if (!response.data.access_token) {
            throw new Error('Bitbucket did not return an access token');
        }

        return response.data.access_token;
    } catch (error: any) {
        console.error('[Bitbucket OAuth] Error exchanging code for token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        throw new Error(`Failed to exchange authorization code for token: ${error.message}`);
    }
};

/**
 * Get Bitbucket user info from access token
 */
export const getBitbucketUser = async (token: string): Promise<{
    uuid: string;
    username: string;
    display_name: string;
    email: string;
    links: {
        avatar: {
            href: string;
        };
    };
}> => {
    try {
        const response = await axios.get('https://api.bitbucket.org/2.0/user', {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });

        const user = response.data;

        // Get user email (separate API call)
        let email = '';
        try {
            const emailResponse = await axios.get('https://api.bitbucket.org/2.0/user/emails', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });
            const emails = emailResponse.data.values || [];
            const primaryEmail = emails.find((e: any) => e.is_primary) || emails[0];
            email = primaryEmail?.email || '';
        } catch (emailError) {
            console.warn('[Bitbucket OAuth] Could not fetch user email:', emailError);
        }

        return {
            uuid: user.uuid,
            username: user.username,
            display_name: user.display_name || user.username,
            email: email || user.email || '',
            links: user.links || { avatar: { href: '' } },
        };
    } catch (error: any) {
        console.error('Error fetching Bitbucket user:', error);
        throw new Error('Failed to fetch Bitbucket user information');
    }
};

/**
 * Get encryption key (32 bytes for AES-256)
 * Reuse the same encryption functions from GitHub OAuth
 */
const getEncryptionKey = (): Buffer => {
    const keyString = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32-chars!!';
    
    if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
        return Buffer.from(keyString, 'hex');
    }
    
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
 * Get user's Bitbucket repositories
 */
export const getUserRepositories = async (token: string): Promise<Array<{
    uuid: string;
    name: string;
    full_name: string;
    is_private: boolean;
    language: string | null;
    workspace: {
        slug: string;
        name: string;
    };
    updated_on: string;
    permissions: {
        admin: boolean;
        write: boolean;
        read: boolean;
    };
}>> => {
    try {
        const allRepos: any[] = [];
        let nextUrl = 'https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100';

        // Bitbucket uses pagination, so we need to fetch all pages
        while (nextUrl) {
            const response = await axios.get(nextUrl, {
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

        return allRepos.map((repo: any) => ({
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
    } catch (error: any) {
        console.error('Error fetching user repositories:', error);
        throw new Error('Failed to fetch Bitbucket repositories');
    }
};
