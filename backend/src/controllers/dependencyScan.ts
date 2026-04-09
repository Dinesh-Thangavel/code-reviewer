/**
 * Dependency Scan Controller
 * Handles dependency vulnerability scanning
 */

import { Request, Response } from 'express';
import { scanNpmDependencies, scanPythonDependencies, generateSecurityReport } from '../services/dependencyScanner';
import prisma from '../db';
import { getInstallationAccessToken } from '../services/githubApi';
import axios from 'axios';

/**
 * Scan repository dependencies
 * POST /api/repositories/:id/scan-dependencies
 */
export const scanRepositoryDependencies = async (req: Request, res: Response) => {
    const repoId = req.params.id as string;

    try {
        const repo: any = await prisma.repository.findUnique({
            where: { id: repoId },
        });

        if (!repo || !repo.installationId) {
            return res.status(404).json({ error: 'Repository not found or not installed' });
        }

        const token = await getInstallationAccessToken(repo.installationId);

        // Try to fetch package.json
        let packageJson: any = null;
        try {
            const response = await axios.get(
                `https://api.github.com/repos/${repo.fullName}/contents/package.json`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            packageJson = JSON.parse(content);
        } catch (error) {
            // package.json not found, try requirements.txt
        }

        // Try to fetch requirements.txt
        let requirements: string | null = null;
        try {
            const response = await axios.get(
                `https://api.github.com/repos/${repo.fullName}/contents/requirements.txt`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/vnd.github.v3.raw',
                    },
                }
            );
            requirements = response.data;
        } catch (error) {
            // requirements.txt not found
        }

        const vulnerabilities: any[] = [];

        if (packageJson) {
            const npmVulns = await scanNpmDependencies(packageJson);
            vulnerabilities.push(...npmVulns);
        }

        if (requirements) {
            const pythonVulns = await scanPythonDependencies(requirements);
            vulnerabilities.push(...pythonVulns);
        }

        const report = generateSecurityReport(vulnerabilities);

        res.json({
            success: true,
            vulnerabilities,
            report,
            scannedFiles: {
                packageJson: !!packageJson,
                requirementsTxt: !!requirements,
            },
        });
    } catch (error: any) {
        console.error('Error scanning dependencies:', error);
        res.status(500).json({
            error: 'Failed to scan dependencies',
            details: error.message,
        });
    }
};
