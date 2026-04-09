"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertIssuesToGitHubComments = exports.createPRReview = exports.createReviewComment = void 0;
const axios_1 = __importDefault(require("axios"));
const createReviewComment = async (repoFullName, prNumber, body, token) => {
    try {
        const response = await axios_1.default.post(`https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`, { body }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        return response.data;
    }
    catch (error) {
        console.error(`Error creating comment on ${repoFullName} #${prNumber}:`, error);
        throw new Error('Failed to create review comment');
    }
};
exports.createReviewComment = createReviewComment;
const createPRReview = async ({ repoFullName, prNumber, body, comments = [], token, event = 'COMMENT', // Default to just a comment, can be APPROVE or REQUEST_CHANGES
 }) => {
    try {
        const response = await axios_1.default.post(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/reviews`, {
            body,
            event,
            comments: comments.map(c => ({
                path: c.path,
                line: c.line,
                body: c.body,
            })),
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        return response.data;
    }
    catch (error) {
        console.error(`Error creating review on ${repoFullName} #${prNumber}:`, error);
        // Log detailed error from GitHub if available
        if (axios_1.default.isAxiosError(error) && error.response) {
            console.error('GitHub API Error:', error.response.data);
        }
        throw new Error('Failed to create PR review');
    }
};
exports.createPRReview = createPRReview;
const convertIssuesToGitHubComments = (issues) => {
    return issues.map((issue) => {
        // Map severity to icon and color (CodeRabbit style)
        let severityIcon = 'ℹ️';
        let severityBadge = '';
        if (issue.severity === 'critical') {
            severityIcon = '🔴';
            severityBadge = '<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">CRITICAL</span>';
        }
        else if (issue.severity === 'security') {
            severityIcon = '🔒';
            severityBadge = '<span style="background-color: #fed7aa; color: #9a3412; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">SECURITY</span>';
        }
        else if (issue.severity === 'performance') {
            severityIcon = '⚡';
            severityBadge = '<span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">PERFORMANCE</span>';
        }
        else if (issue.severity === 'quality') {
            severityIcon = '💡';
            severityBadge = '<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">QUALITY</span>';
        }
        else if (issue.severity === 'style') {
            severityIcon = '✨';
            severityBadge = '<span style="background-color: #f3e8ff; color: #6b21a8; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">STYLE</span>';
        }
        // CodeRabbit-style formatted comment
        const body = `
${severityIcon} **${issue.title}** ${severityBadge}

> ${issue.description}

${issue.suggestedFix ? `**💡 Suggested Fix:**

\`\`\`${issue.language}
${issue.suggestedFix}
\`\`\`

_You can apply this fix directly from the review dashboard._` : ''}
`.trim();
        return {
            path: issue.file,
            line: issue.line,
            body,
        };
    });
};
exports.convertIssuesToGitHubComments = convertIssuesToGitHubComments;
