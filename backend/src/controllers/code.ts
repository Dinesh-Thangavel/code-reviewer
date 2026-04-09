/**
 * Code fetching controller
 * Fetches original code from GitHub for diff view
 */

import { Request, Response } from 'express';
import { getInstallationAccessToken } from '../services/githubApi';
import axios from 'axios';
import prisma from '../db';

export const getFileContent = async (req: Request, res: Response) => {
    const repoFullName = req.query.repoFullName as string;
    const filePath = req.query.filePath as string;
    const ref = req.query.ref as string | undefined;

    if (!repoFullName || !filePath) {
        return res.status(400).json({ error: 'repoFullName and filePath are required' });
    }

    try {
        // Find repository
        const repo = await prisma.repository.findFirst({
            where: { fullName: repoFullName },
        });

        if (!repo || !repo.installationId) {
            return res.status(404).json({ error: 'Repository not found or not installed' });
        }

        // Get installation token
        const token = await getInstallationAccessToken(repo.installationId);

        // Fetch file content from GitHub
        const response = await axios.get(
            `https://api.github.com/repos/${repoFullName}/contents/${filePath}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
                params: ref ? { ref } : undefined,
            }
        );

        // Decode base64 content
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

        res.json({
            success: true,
            content,
            encoding: response.data.encoding,
            size: response.data.size,
        });
    } catch (error: any) {
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

export const getCodeContext = async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;

    try {
        const issue: any = await prisma.issue.findUnique({
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
        const token = await getInstallationAccessToken(repository.installationId);

        // Fetch file content around the issue line
        const ref = pullRequest.headSha || pullRequest.baseBranch || 'main';
        const filePath = issue.filePath;

        try {
            const response = await axios.get(
                `https://api.github.com/repos/${repository.fullName}/contents/${filePath}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                    params: { ref },
                }
            );

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
        } catch (fileError: any) {
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
    } catch (error: any) {
        console.error('Error getting code context:', error);
        res.status(500).json({
            error: 'Failed to get code context',
            message: error.message,
        });
    }
};
