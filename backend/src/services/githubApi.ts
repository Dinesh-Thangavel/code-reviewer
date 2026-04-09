import axios from 'axios';
import jwt from 'jsonwebtoken';
import { githubConfig } from '../config/github';

const PRIVATE_KEY = githubConfig.privateKey.replace(/\\n/g, '\n'); // Handle env var newlines

interface GitHubFile {
    filename: string;
    patch?: string; // Patch might be missing for large files or binary files
    status: string;
}

export interface PRFile {
    filename: string;
    patch: string;
    language: string;
}

const generateJWT = (): string => {
    const now = Math.floor(Date.now() / 1000);
    // GitHub requires JWT expiration to be within 10 minutes, but we'll use 5 minutes to be safe
    const payload = {
        iat: now - 60, // Issued 1 minute ago (clock skew tolerance)
        exp: now + (5 * 60), // Expires in 5 minutes (GitHub limit is 10 minutes)
        iss: githubConfig.appId,
    };

    return jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
};

export const getInstallationAccessToken = async (installationId: string): Promise<string> => {
    if (!githubConfig.appId || !githubConfig.privateKey) {
        throw new Error('GitHub App credentials not configured. Please set GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables.');
    }

    if (!installationId) {
        throw new Error('Installation ID is required');
    }

    let jwtToken: string;
    try {
        jwtToken = generateJWT();
    } catch (error: any) {
        console.error('[GitHub API] Error generating JWT:', error);
        throw new Error(`Failed to generate JWT: ${error.message}`);
    }

    try {
        const response = await axios.post(
            `https://api.github.com/app/installations/${installationId}/access_tokens`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );
        return response.data.token;
    } catch (error: any) {
        console.error('[GitHub API] Error fetching installation token:', {
            installationId,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
        });
        
        if (error.response?.status === 404) {
            throw new Error(`GitHub App installation ${installationId} not found. Please reinstall the GitHub App.`);
        } else if (error.response?.status === 401) {
            throw new Error('GitHub App authentication failed. Please check your GITHUB_APP_ID and GITHUB_PRIVATE_KEY.');
        } else if (error.response?.status === 403) {
            throw new Error('GitHub App does not have access to this installation.');
        }
        
        throw new Error(`Failed to get installation access token: ${error.response?.data?.message || error.message}`);
    }
};

const getExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()! : 'txt';
};

export const getPullRequestFiles = async (
    repoFullName: string,
    prNumber: number,
    installationId: string
): Promise<PRFile[]> => {
    const token = await getInstallationAccessToken(installationId);

    try {
        const response = await axios.get(
            `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        const files: GitHubFile[] = response.data;

        return files
            .filter((f) => f.patch) // Only files with patches
            .map((f) => ({
                filename: f.filename,
                patch: f.patch!,
                language: getExtension(f.filename),
            }));
    } catch (error) {
        console.error(`Error fetching PR files for ${repoFullName} #${prNumber}:`, error);
        throw new Error('Failed to fetch PR files');
    }
};
