"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postBitbucketStatus = exports.postBitbucketInlineComments = exports.postBitbucketReviewComment = exports.getBitbucketPRFiles = void 0;
const axios_1 = __importDefault(require("axios"));
const getExtension = (filename) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop() : 'txt';
};
/**
 * Fetch PR files with unified patch from Bitbucket Cloud.
 * Uses the PR patch endpoint and splits by file boundaries.
 */
const getBitbucketPRFiles = async (token, workspace, repoSlug, prId) => {
    try {
        const response = await axios_1.default.get(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/patch`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/plain',
            },
            responseType: 'text',
        });
        const patchText = response.data;
        const files = [];
        // Split the patch by file; Bitbucket uses the same "diff --git" markers as git.
        const parts = patchText.split(/^diff --git/m).filter((p) => p.trim().length > 0);
        for (const part of parts) {
            const normalized = part.startsWith(' a/') ? `diff --git${part}` : `diff --git ${part}`;
            const match = normalized.match(/\+\+\+ b\/([^\n\r]+)/);
            if (!match || match[1] === 'dev/null') {
                continue; // Skip deletions or unknown files
            }
            const filename = match[1].trim();
            const patch = `diff --git ${normalized}`; // include the header we split on
            files.push({
                filename,
                patch,
                language: getExtension(filename),
            });
        }
        return files;
    }
    catch (error) {
        console.error('Error fetching Bitbucket PR files:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw new Error('Failed to fetch Bitbucket PR files');
    }
};
exports.getBitbucketPRFiles = getBitbucketPRFiles;
/**
 * Post a summary review comment back to Bitbucket.
 * For now we post a single general comment (no inline) so the review is visible in the PR timeline.
 */
const postBitbucketReviewComment = async (token, workspace, repoSlug, prId, reviewResult) => {
    const issuesCount = reviewResult.issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
    }, {});
    const summaryBody = [
        '### 🤖 AI Code Review',
        '',
        `**Risk Level:** ${reviewResult.riskLevel}`,
        `**Confidence:** ${reviewResult.confidenceScore}%`,
        '',
        '**Issue Summary:**',
        `- 🔴 Critical: ${issuesCount.critical || 0}`,
        `- 🔒 Security: ${issuesCount.security || 0}`,
        `- 🚩 Performance: ${issuesCount.performance || 0}`,
        `- 🔧 Quality: ${issuesCount.quality || 0}`,
        `- ✨ Style: ${issuesCount.style || 0}`,
        '',
        reviewResult.summary || '_No summary generated._',
    ].join('\n');
    try {
        await axios_1.default.post(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`, {
            content: { raw: summaryBody },
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
    }
    catch (error) {
        console.error('Error posting Bitbucket review comment:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw new Error('Failed to post Bitbucket review comment');
    }
};
exports.postBitbucketReviewComment = postBitbucketReviewComment;
/**
 * Post inline comments for individual issues (best-effort, limited to avoid noise).
 */
const postBitbucketInlineComments = async (token, workspace, repoSlug, prId, issues, limit = 12) => {
    const subset = issues.slice(0, limit);
    for (const issue of subset) {
        if (!issue.file || !issue.line)
            continue;
        const bodyLines = [
            `**${issue.severity ?? 'Issue'}:** ${issue.title}`,
            issue.description ? issue.description : '',
        ].filter(Boolean);
        try {
            await axios_1.default.post(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`, {
                content: { raw: bodyLines.join('\n\n') },
                inline: {
                    path: issue.file,
                    to: issue.line,
                },
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
        }
        catch (error) {
            console.warn('Error posting inline Bitbucket comment:', {
                message: error.message,
                status: error.response?.status,
            });
        }
    }
};
exports.postBitbucketInlineComments = postBitbucketInlineComments;
/**
 * Create/update build status on the commit for visibility.
 */
const postBitbucketStatus = async (token, workspace, repoSlug, commitSha, state, url, description, key = 'ai-review') => {
    try {
        await axios_1.default.post(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/commit/${commitSha}/statuses/build`, {
            state,
            key,
            url,
            description,
            name: 'AI Code Review',
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
    }
    catch (error) {
        console.warn('Error posting Bitbucket status:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
    }
};
exports.postBitbucketStatus = postBitbucketStatus;
