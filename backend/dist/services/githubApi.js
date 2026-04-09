"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPullRequestFiles = exports.getInstallationAccessToken = void 0;
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const github_1 = require("../config/github");
const PRIVATE_KEY = github_1.githubConfig.privateKey.replace(/\\n/g, '\n'); // Handle env var newlines
const generateJWT = () => {
    const now = Math.floor(Date.now() / 1000);
    // GitHub requires JWT expiration to be within 10 minutes, but we'll use 5 minutes to be safe
    const payload = {
        iat: now - 60, // Issued 1 minute ago (clock skew tolerance)
        exp: now + (5 * 60), // Expires in 5 minutes (GitHub limit is 10 minutes)
        iss: github_1.githubConfig.appId,
    };
    return jsonwebtoken_1.default.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
};
const getInstallationAccessToken = async (installationId) => {
    if (!github_1.githubConfig.appId || !github_1.githubConfig.privateKey) {
        throw new Error('GitHub App credentials not configured. Please set GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables.');
    }
    if (!installationId) {
        throw new Error('Installation ID is required');
    }
    let jwtToken;
    try {
        jwtToken = generateJWT();
    }
    catch (error) {
        console.error('[GitHub API] Error generating JWT:', error);
        throw new Error(`Failed to generate JWT: ${error.message}`);
    }
    try {
        const response = await axios_1.default.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        return response.data.token;
    }
    catch (error) {
        console.error('[GitHub API] Error fetching installation token:', {
            installationId,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
        });
        if (error.response?.status === 404) {
            throw new Error(`GitHub App installation ${installationId} not found. Please reinstall the GitHub App.`);
        }
        else if (error.response?.status === 401) {
            throw new Error('GitHub App authentication failed. Please check your GITHUB_APP_ID and GITHUB_PRIVATE_KEY.');
        }
        else if (error.response?.status === 403) {
            throw new Error('GitHub App does not have access to this installation.');
        }
        throw new Error(`Failed to get installation access token: ${error.response?.data?.message || error.message}`);
    }
};
exports.getInstallationAccessToken = getInstallationAccessToken;
const getExtension = (filename) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop() : 'txt';
};
const getPullRequestFiles = async (repoFullName, prNumber, installationId) => {
    const token = await (0, exports.getInstallationAccessToken)(installationId);
    try {
        const response = await axios_1.default.get(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        const files = response.data;
        return files
            .filter((f) => f.patch) // Only files with patches
            .map((f) => ({
            filename: f.filename,
            patch: f.patch,
            language: getExtension(f.filename),
        }));
    }
    catch (error) {
        console.error(`Error fetching PR files for ${repoFullName} #${prNumber}:`, error);
        throw new Error('Failed to fetch PR files');
    }
};
exports.getPullRequestFiles = getPullRequestFiles;
