"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergePullRequest = exports.createFixPullRequest = exports.applyFixToFile = exports.updateFileContent = exports.createBranch = exports.getRefSha = exports.getFileContent = void 0;
const axios_1 = __importDefault(require("axios"));
const githubApi_1 = require("./githubApi");
/**
 * Get file content from a GitHub repository
 */
const getFileContent = async (repoFullName, filePath, ref, installationId) => {
    const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
    try {
        const response = await axios_1.default.get(`https://api.github.com/repos/${repoFullName}/contents/${filePath}`, {
            params: { ref },
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return { content, sha: response.data.sha };
    }
    catch (error) {
        console.error(`Error fetching file ${filePath} from ${repoFullName}:`, error);
        throw new Error(`Failed to fetch file content: ${filePath}`);
    }
};
exports.getFileContent = getFileContent;
/**
 * Get a reference (branch) SHA
 */
const getRefSha = async (repoFullName, ref, installationId) => {
    const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
    try {
        const response = await axios_1.default.get(`https://api.github.com/repos/${repoFullName}/git/ref/heads/${ref}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        return response.data.object.sha;
    }
    catch (error) {
        console.error(`Error getting ref ${ref} for ${repoFullName}:`, error);
        throw new Error(`Failed to get branch ref: ${ref}`);
    }
};
exports.getRefSha = getRefSha;
/**
 * Create a new branch from a base branch
 */
const createBranch = async (repoFullName, branchName, baseSha, installationId) => {
    const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
    try {
        await axios_1.default.post(`https://api.github.com/repos/${repoFullName}/git/refs`, {
            ref: `refs/heads/${branchName}`,
            sha: baseSha,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        console.log(`[GitHub] Created branch ${branchName} on ${repoFullName}`);
    }
    catch (error) {
        // Branch already exists - that's ok for bulk operations
        if (error?.response?.status === 422) {
            console.log(`[GitHub] Branch ${branchName} already exists on ${repoFullName}`);
            return;
        }
        console.error(`Error creating branch ${branchName}:`, error);
        throw new Error(`Failed to create branch: ${branchName}`);
    }
};
exports.createBranch = createBranch;
/**
 * Update a file on a specific branch with the suggested fix
 */
const updateFileContent = async (repoFullName, filePath, branch, newContent, fileSha, commitMessage, installationId) => {
    const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
    try {
        const response = await axios_1.default.put(`https://api.github.com/repos/${repoFullName}/contents/${filePath}`, {
            message: commitMessage,
            content: Buffer.from(newContent).toString('base64'),
            sha: fileSha,
            branch,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        console.log(`[GitHub] Updated ${filePath} on branch ${branch}`);
        return { commitSha: response.data.commit.sha };
    }
    catch (error) {
        console.error(`Error updating file ${filePath}:`, error);
        throw new Error(`Failed to update file: ${filePath}`);
    }
};
exports.updateFileContent = updateFileContent;
/**
 * Apply a code fix to a specific file at a specific line
 * This replaces the problematic line(s) with the suggested fix
 */
const applyFixToFile = (originalContent, lineNumber, suggestedFix) => {
    const lines = originalContent.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) {
        throw new Error(`Line number ${lineNumber} is out of range (file has ${lines.length} lines)`);
    }
    // Get the indentation of the original line
    const originalLine = lines[lineNumber - 1];
    const indentMatch = originalLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    // Apply the fix - replace the line with the suggested fix
    // If suggestedFix is multi-line, apply indentation to each line
    const fixLines = suggestedFix.split('\n').map((line, index) => {
        // Don't add indent to empty lines
        if (line.trim() === '')
            return '';
        // First line might already have proper indentation in the fix
        return index === 0 ? indent + line.trimStart() : indent + line.trimStart();
    });
    // Replace the target line with the fix lines
    lines.splice(lineNumber - 1, 1, ...fixLines);
    return lines.join('\n');
};
exports.applyFixToFile = applyFixToFile;
/**
 * Create a Pull Request with the applied fixes
 */
const createFixPullRequest = async (repoFullName, title, body, headBranch, baseBranch, installationId) => {
    const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
    try {
        const response = await axios_1.default.post(`https://api.github.com/repos/${repoFullName}/pulls`, {
            title,
            body,
            head: headBranch,
            base: baseBranch,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        console.log(`[GitHub] Created fix PR #${response.data.number} on ${repoFullName}`);
        return {
            prNumber: response.data.number,
            prUrl: response.data.html_url,
        };
    }
    catch (error) {
        console.error(`Error creating fix PR on ${repoFullName}:`, error);
        throw new Error('Failed to create fix pull request');
    }
};
exports.createFixPullRequest = createFixPullRequest;
/**
 * Merge a Pull Request
 */
const mergePullRequest = async (repoFullName, prNumber, installationId, mergeMethod = 'merge', commitTitle, commitMessage) => {
    const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
    try {
        const response = await axios_1.default.put(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/merge`, {
            merge_method: mergeMethod,
            commit_title: commitTitle,
            commit_message: commitMessage,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        console.log(`[GitHub] Merged PR #${prNumber} on ${repoFullName}`);
        return {
            merged: response.data.merged,
            sha: response.data.sha,
            message: response.data.message,
        };
    }
    catch (error) {
        console.error(`Error merging PR #${prNumber} on ${repoFullName}:`, error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error('Failed to merge pull request');
    }
};
exports.mergePullRequest = mergePullRequest;
