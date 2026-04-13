"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeReview = void 0;
const db_1 = __importDefault(require("../db"));
const githubApi_1 = require("./githubApi");
const bitbucketApi_1 = require("./bitbucketApi");
const bitbucketOAuth_1 = require("./bitbucketOAuth");
const review_1 = require("../ai/review");
const githubApi_2 = require("./githubApi");
const githubStatus_1 = require("./githubStatus");
const githubReview_1 = require("./githubReview");
/**
 * Shared review execution used by the BullMQ worker and webhook fallbacks.
 * Runs the AI review, persists results, and posts back to GitHub/Bitbucket.
 */
const executeReview = async ({ repoFullName, prNumber, provider, installationId, commitSha, securityOnly, force, userId, progressCallback, }) => {
    // 1) Fetch files (with retry similar to worker)
    let files;
    let retries = 0;
    const maxRetries = 3;
    while (retries < maxRetries) {
        try {
            if (provider === 'BITBUCKET') {
                if (!userId)
                    throw new Error('userId required for Bitbucket review');
                const repo = await db_1.default.repository.findUnique({
                    where: { fullName: repoFullName },
                    select: { bitbucketWorkspace: true },
                });
                if (!repo)
                    throw new Error(`Repository ${repoFullName} not found in DB`);
                const user = await db_1.default.user.findUnique({
                    where: { id: userId },
                    select: { bitbucketToken: true, bitbucketConnected: true },
                });
                if (!user || !user.bitbucketConnected || !user.bitbucketToken) {
                    throw new Error('Bitbucket account not connected for this user');
                }
                const token = (0, bitbucketOAuth_1.decryptToken)(user.bitbucketToken);
                const [workspace, repoSlug] = repoFullName.split('/');
                const workspaceSlug = repo.bitbucketWorkspace || workspace;
                files = await (0, bitbucketApi_1.getBitbucketPRFiles)(token, workspaceSlug, repoSlug, prNumber);
            }
            else {
                if (!installationId)
                    throw new Error('installationId required for GitHub review');
                files = await (0, githubApi_1.getPullRequestFiles)(repoFullName, prNumber, installationId.toString());
            }
            break;
        }
        catch (error) {
            retries++;
            if (retries >= maxRetries) {
                throw new Error(`Failed to fetch files after ${maxRetries} attempts: ${error.message}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        }
    }
    if (!files || files.length === 0) {
        return { status: 'skipped', reason: 'no_files' };
    }
    // 2) Find PR record
    const pr = await db_1.default.pullRequest.findFirst({
        where: {
            number: prNumber,
            repository: { fullName: repoFullName },
        },
    });
    if (!pr) {
        throw new Error(`Pull Request not found in DB: ${repoFullName} #${prNumber}`);
    }
    // Skip if already reviewed same commit
    if (pr.lastReviewedCommitSha === commitSha && !force) {
        return { status: 'skipped', reason: 'already_reviewed' };
    }
    // 3) Create PENDING review
    const review = await db_1.default.review.create({
        data: {
            prId: pr.id,
            summary: 'Review in progress...',
            status: 'PENDING',
            confidenceScore: 0,
            riskLevel: 'LOW',
            filesChanged: files.length,
        },
    });
    try {
        // 4) Run AI review
        const wrappedProgress = progressCallback
            ? (progress) => progressCallback(progress, pr.id)
            : undefined;
        const reviewResult = await (0, review_1.reviewPullRequest)(files, wrappedProgress, {
            securityOnly: !!securityOnly,
        });
        // 5) Update review + issues
        await db_1.default.review.update({
            where: { id: review.id },
            data: {
                summary: reviewResult.summary,
                confidenceScore: reviewResult.confidenceScore,
                riskLevel: reviewResult.riskLevel,
                status: 'COMPLETED',
                filesChanged: files.length,
                issues: {
                    create: reviewResult.issues.map((issue) => ({
                        severity: issue.severity,
                        filePath: issue.file,
                        lineNumber: issue.line,
                        title: issue.title,
                        description: issue.description,
                        suggestedFix: issue.suggestedFix && issue.suggestedFix.trim() !== ''
                            ? issue.suggestedFix
                            : `// TODO: Review and fix the issue: ${issue.title}\n// ${issue.description}\n// Please provide a fix for this issue.`,
                        language: issue.language || 'plaintext',
                        fixStatus: 'PENDING',
                    })),
                },
            },
        });
        // 6) Update PR
        await db_1.default.pullRequest.update({
            where: { id: pr.id },
            data: {
                riskLevel: reviewResult.riskLevel,
                lastReviewedCommitSha: commitSha || pr.headSha,
                headSha: commitSha || pr.headSha,
            },
        });
        const resolvedCommitSha = commitSha || pr.headSha;
        // 7) Post results back to provider
        if (provider === 'BITBUCKET') {
            if (!userId)
                throw new Error('userId required to post Bitbucket results');
            const user = await db_1.default.user.findUnique({
                where: { id: userId },
                select: { bitbucketToken: true, bitbucketConnected: true },
            });
            if (user && user.bitbucketConnected && user.bitbucketToken) {
                const token = (0, bitbucketOAuth_1.decryptToken)(user.bitbucketToken);
                const [workspace, repoSlug] = repoFullName.split('/');
                await (0, bitbucketApi_1.postBitbucketReviewComment)(token, workspace, repoSlug, prNumber, reviewResult);
                await (0, bitbucketApi_1.postBitbucketInlineComments)(token, workspace, repoSlug, prNumber, reviewResult.issues);
                if (!resolvedCommitSha) {
                    throw new Error('Missing commit SHA for Bitbucket status update');
                }
                await (0, bitbucketApi_1.postBitbucketStatus)(token, workspace, repoSlug, resolvedCommitSha, 'SUCCESSFUL', `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pull-requests/${pr.id}`, 'AI review completed');
            }
        }
        else {
            if (!installationId)
                throw new Error('installationId required to post GitHub results');
            const token = await (0, githubApi_2.getInstallationAccessToken)(installationId.toString());
            const issuesCount = reviewResult.issues.reduce((acc, issue) => {
                acc[issue.severity] = (acc[issue.severity] || 0) + 1;
                return acc;
            }, {});
            const commentBody = `### 🤖 AI Code Review\n\n**Risk Level**: ${reviewResult.riskLevel}\n**Confidence**: ${reviewResult.confidenceScore}%\n\n**Issue Summary**:\n- 🔴 Critical: ${issuesCount.critical || 0}\n- 🔒 Security: ${issuesCount.security || 0}\n- 🚩 Performance: ${issuesCount.performance || 0}\n- 🔧 Quality: ${issuesCount.quality || 0}\n- ✨ Style: ${issuesCount.style || 0}\n\n${reviewResult.summary}`;
            const comments = (0, githubReview_1.convertIssuesToGitHubComments)(reviewResult.issues);
            let reviewEvent = 'COMMENT';
            const criticalCount = issuesCount.critical || 0;
            const securityCount = issuesCount.security || 0;
            if (reviewResult.riskLevel === 'LOW' && reviewResult.issues.length === 0 && reviewResult.confidenceScore >= 80) {
                reviewEvent = 'APPROVE';
            }
            else if (reviewResult.riskLevel === 'HIGH' || criticalCount > 0 || securityCount > 0) {
                reviewEvent = 'REQUEST_CHANGES';
            }
            if (!resolvedCommitSha) {
                throw new Error('Missing commit SHA for GitHub status check');
            }
            await (0, githubStatus_1.createReviewStatusCheck)(repoFullName, resolvedCommitSha, reviewResult, installationId.toString(), prNumber);
            await (0, githubReview_1.createPRReview)({
                repoFullName,
                prNumber,
                body: commentBody,
                comments,
                token,
                event: reviewEvent,
            });
        }
        // 8) Emit WebSocket notification if available
        try {
            const { emitReviewCompleted } = await Promise.resolve().then(() => __importStar(require('./websocket')));
            emitReviewCompleted(pr.id, review.id);
        }
        catch {
            // non-critical
        }
        return { status: 'completed', reviewId: review.id, prId: pr.id };
    }
    catch (error) {
        await db_1.default.review.update({
            where: { id: review.id },
            data: {
                status: 'FAILED',
                summary: `Review failed: ${error.message}`,
            },
        });
        return { status: 'failed', reason: error.message };
    }
};
exports.executeReview = executeReview;
