"use strict";
/**
 * Code fetching controller
 * Fetches original code from GitHub for diff view
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCodeContext = exports.getFileContent = void 0;
const githubApi_1 = require("../services/githubApi");
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("../db"));
const getFileContent = async (req, res) => {
    const repoFullName = req.query.repoFullName;
    const filePath = req.query.filePath;
    const ref = req.query.ref;
    if (!repoFullName || !filePath) {
        return res.status(400).json({ error: 'repoFullName and filePath are required' });
    }
    try {
        // Find repository
        const repo = await db_1.default.repository.findFirst({
            where: { fullName: repoFullName },
        });
        if (!repo || !repo.installationId) {
            return res.status(404).json({ error: 'Repository not found or not installed' });
        }
        // Get installation token
        const token = await (0, githubApi_1.getInstallationAccessToken)(repo.installationId);
        // Fetch file content from GitHub
        const response = await axios_1.default.get(`https://api.github.com/repos/${repoFullName}/contents/${filePath}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
            params: ref ? { ref } : undefined,
        });
        // Decode base64 content
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        res.json({
            success: true,
            content,
            encoding: response.data.encoding,
            size: response.data.size,
        });
    }
    catch (error) {
        console.error('Error fetching file content:', error);
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.status(500).json({
            error: 'Failed to fetch file content',
            message: error.message,
        });
    }
};
exports.getFileContent = getFileContent;
const getCodeContext = async (req, res) => {
    const issueId = req.params.issueId;
    try {
        const issue = await db_1.default.issue.findUnique({
            where: { id: issueId },
            include: {
                review: {
                    include: {
                        pullRequest: {
                            include: {
                                repository: true,
                            },
                        },
                    },
                },
            },
        });
        if (!issue || !issue.review) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        const { pullRequest, repository } = issue.review;
        if (!repository.installationId) {
            return res.status(400).json({ error: 'Repository has no installation ID' });
        }
        // Get installation token
        const token = await (0, githubApi_1.getInstallationAccessToken)(repository.installationId);
        // Fetch file content around the issue line
        const ref = pullRequest.headSha || pullRequest.baseBranch || 'main';
        const filePath = issue.filePath;
        try {
            const response = await axios_1.default.get(`https://api.github.com/repos/${repository.fullName}/contents/${filePath}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
                params: { ref },
            });
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            const lines = content.split('\n');
            // Get context around the issue (5 lines before and after)
            const startLine = Math.max(0, issue.lineNumber - 6);
            const endLine = Math.min(lines.length, issue.lineNumber + 5);
            const contextLines = lines.slice(startLine, endLine);
            const originalCode = contextLines.join('\n');
            res.json({
                success: true,
                originalCode,
                fullContent: content,
                lineNumber: issue.lineNumber,
                startLine: startLine + 1,
                endLine: endLine,
            });
        }
        catch (fileError) {
            // If file fetch fails, return empty context
            console.warn(`Failed to fetch file ${filePath}:`, fileError.message);
            res.json({
                success: true,
                originalCode: '// Original code not available',
                fullContent: '',
                lineNumber: issue.lineNumber,
                startLine: issue.lineNumber,
                endLine: issue.lineNumber,
            });
        }
    }
    catch (error) {
        console.error('Error getting code context:', error);
        res.status(500).json({
            error: 'Failed to get code context',
            message: error.message,
        });
    }
};
exports.getCodeContext = getCodeContext;
