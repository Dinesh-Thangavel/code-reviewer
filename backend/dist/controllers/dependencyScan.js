"use strict";
/**
 * Dependency Scan Controller
 * Handles dependency vulnerability scanning
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanRepositoryDependencies = void 0;
const dependencyScanner_1 = require("../services/dependencyScanner");
const db_1 = __importDefault(require("../db"));
const githubApi_1 = require("../services/githubApi");
const axios_1 = __importDefault(require("axios"));
/**
 * Scan repository dependencies
 * POST /api/repositories/:id/scan-dependencies
 */
const scanRepositoryDependencies = async (req, res) => {
    const repoId = req.params.id;
    try {
        const repo = await db_1.default.repository.findUnique({
            where: { id: repoId },
        });
        if (!repo || !repo.installationId) {
            return res.status(404).json({ error: 'Repository not found or not installed' });
        }
        const token = await (0, githubApi_1.getInstallationAccessToken)(repo.installationId);
        // Try to fetch package.json
        let packageJson = null;
        try {
            const response = await axios_1.default.get(`https://api.github.com/repos/${repo.fullName}/contents/package.json`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            packageJson = JSON.parse(content);
        }
        catch (error) {
            // package.json not found, try requirements.txt
        }
        // Try to fetch requirements.txt
        let requirements = null;
        try {
            const response = await axios_1.default.get(`https://api.github.com/repos/${repo.fullName}/contents/requirements.txt`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3.raw',
                },
            });
            requirements = response.data;
        }
        catch (error) {
            // requirements.txt not found
        }
        const vulnerabilities = [];
        if (packageJson) {
            const npmVulns = await (0, dependencyScanner_1.scanNpmDependencies)(packageJson);
            vulnerabilities.push(...npmVulns);
        }
        if (requirements) {
            const pythonVulns = await (0, dependencyScanner_1.scanPythonDependencies)(requirements);
            vulnerabilities.push(...pythonVulns);
        }
        const report = (0, dependencyScanner_1.generateSecurityReport)(vulnerabilities);
        res.json({
            success: true,
            vulnerabilities,
            report,
            scannedFiles: {
                packageJson: !!packageJson,
                requirementsTxt: !!requirements,
            },
        });
    }
    catch (error) {
        console.error('Error scanning dependencies:', error);
        res.status(500).json({
            error: 'Failed to scan dependencies',
            details: error.message,
        });
    }
};
exports.scanRepositoryDependencies = scanRepositoryDependencies;
