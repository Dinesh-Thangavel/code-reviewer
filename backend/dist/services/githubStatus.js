"use strict";
/**
 * GitHub Status Checks Service
 * Creates status checks for pull requests based on review results
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewStatusCheck = exports.createStatusCheck = void 0;
const axios_1 = __importDefault(require("axios"));
const githubApi_1 = require("./githubApi");
/**
 * Create or update a GitHub status check
 * POST /repos/:owner/:repo/statuses/:sha
 */
const createStatusCheck = async (options) => {
    const { repoFullName, sha, state, description, context = 'ai-code-review', targetUrl, installationId, } = options;
    try {
        const token = await (0, githubApi_1.getInstallationAccessToken)(installationId);
        const response = await axios_1.default.post(`https://api.github.com/repos/${repoFullName}/statuses/${sha}`, {
            state,
            target_url: targetUrl,
            description: description.substring(0, 140), // GitHub limit is 140 chars
            context,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        console.log(`[GitHub Status] Created status check for ${repoFullName} @${sha.substring(0, 7)}: ${state} - ${description}`);
        return response.data;
    }
    catch (error) {
        console.error(`[GitHub Status] Error creating status check for ${repoFullName} @${sha}:`, error.message);
        if (axios_1.default.isAxiosError(error) && error.response) {
            console.error('[GitHub Status] API Error:', error.response.data);
        }
        // Don't throw - status checks are non-critical
        throw new Error(`Failed to create status check: ${error.message}`);
    }
};
exports.createStatusCheck = createStatusCheck;
/**
 * Create status check based on review results
 */
const createReviewStatusCheck = async (repoFullName, sha, reviewResult, installationId, prNumber) => {
    const issuesCount = reviewResult.issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
    }, {});
    const criticalCount = issuesCount.critical || 0;
    const securityCount = issuesCount.security || 0;
    const totalIssues = reviewResult.issues.length;
    let state = 'success';
    let description = '';
    // Determine status based on review results
    if (reviewResult.riskLevel === 'HIGH' || criticalCount > 0 || securityCount > 0) {
        state = 'failure';
        description = `❌ Review failed: ${criticalCount} critical, ${securityCount} security issues found`;
    }
    else if (reviewResult.riskLevel === 'MEDIUM' && totalIssues > 0) {
        state = 'failure';
        description = `⚠️ Review found ${totalIssues} issue(s) that need attention`;
    }
    else if (reviewResult.riskLevel === 'LOW' && totalIssues === 0) {
        state = 'success';
        description = `✅ Review passed: No issues found (confidence: ${reviewResult.confidenceScore}%)`;
    }
    else if (totalIssues > 0) {
        state = 'success'; // Low risk issues are warnings, not blockers
        description = `✅ Review passed: ${totalIssues} minor issue(s) found`;
    }
    else {
        state = 'success';
        description = `✅ Review completed successfully`;
    }
    const targetUrl = prNumber
        ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pull-requests/${prNumber}`
        : undefined;
    await (0, exports.createStatusCheck)({
        repoFullName,
        sha,
        state,
        description,
        context: 'ai-code-review',
        targetUrl,
        installationId,
    });
};
exports.createReviewStatusCheck = createReviewStatusCheck;
