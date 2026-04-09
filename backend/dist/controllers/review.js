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
exports.rerunReview = exports.getReviewById = void 0;
const db_1 = __importDefault(require("../db"));
const queue_1 = require("../jobs/queue");
const auditLog_1 = require("../services/auditLog");
const jwt_1 = require("../utils/jwt");
const getReviewById = async (req, res) => {
    const id = req.params.id;
    try {
        const review = await db_1.default.review.findUnique({
            where: { id },
            include: {
                pullRequest: {
                    include: { repository: true },
                },
                issues: {
                    orderBy: { lineNumber: 'asc' },
                },
            },
        });
        if (!review) {
            res.status(404).json({ error: 'Review not found' });
            return;
        }
        res.json({
            id: review.id,
            prId: review.prId,
            summary: review.summary,
            status: review.status,
            confidenceScore: review.confidenceScore,
            riskLevel: review.riskLevel,
            filesChanged: review.filesChanged,
            pullRequest: {
                id: review.pullRequest.id,
                number: review.pullRequest.number,
                title: review.pullRequest.title,
                author: review.pullRequest.author,
                repo: review.pullRequest.repository.fullName,
            },
            issues: review.issues.map((issue) => ({
                id: issue.id,
                severity: issue.severity,
                file: issue.filePath,
                line: issue.lineNumber,
                title: issue.title,
                description: issue.description,
                suggestedFix: issue.suggestedFix,
                language: issue.language,
                fixStatus: issue.fixStatus,
                appliedAt: issue.appliedAt,
                commitSha: issue.commitSha,
                fixBranch: issue.fixBranch,
            })),
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
        });
    }
    catch (error) {
        console.error(`Error fetching review ${id}:`, error);
        res.status(500).json({ error: 'Failed to fetch review' });
    }
};
exports.getReviewById = getReviewById;
const rerunReview = async (req, res) => {
    console.log('[Review] rerunReview called - NEW CODE VERSION');
    const id = req.params.id;
    const { securityOnly } = req.body || {};
    try {
        // Get user ID from token if available
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId;
        if (token) {
            const extractedUserId = (0, jwt_1.getUserIdFromToken)(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }
        const pr = await db_1.default.pullRequest.findUnique({
            where: { id },
            include: {
                repository: true,
            },
        });
        if (!pr) {
            res.status(404).json({ error: 'Pull Request not found' });
            return;
        }
        if (!pr.repository.installationId) {
            res.status(400).json({ error: 'Repository has no installation ID, cannot fetch files.' });
            return;
        }
        const commitSha = pr.lastReviewedCommitSha || pr.headSha;
        if (!commitSha) {
            res.status(400).json({ error: 'Cannot rerun: No commit SHA known (never reviewed or synced).' });
            return;
        }
        const queue = (0, queue_1.getReviewQueue)();
        console.log('[Review] getReviewQueue() returned:', queue ? 'Queue object' : 'null');
        // Skip queue entirely if Redis not configured - go straight to direct processing
        if (!queue) {
            console.log('[Review] No Redis queue available - using direct processing');
        }
        else {
            // If Redis is available, try to use queue (preferred)
            try {
                await queue.add('review-pr', {
                    repoFullName: pr.repository.fullName,
                    prNumber: pr.number,
                    installationId: parseInt(pr.repository.installationId),
                    commitSha,
                    force: true,
                    securityOnly: !!securityOnly,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                });
                res.json({
                    message: `Review queued for PR #${pr.number} (SHA: ${commitSha})`,
                    securityOnly: !!securityOnly,
                });
                return;
            }
            catch (queueError) {
                // Queue failed (Redis not actually available), fall back to direct processing
                console.warn('[Review] Queue failed, falling back to direct processing:', queueError.message);
                // Continue to fallback below
            }
        }
        // Fallback: Process review directly without Redis
        console.log('[Review] Redis unavailable - processing review directly (asynchronously)');
        // Create PENDING review immediately
        const review = await db_1.default.review.create({
            data: {
                prId: pr.id,
                summary: 'Review in progress...',
                status: 'PENDING',
                confidenceScore: 0,
                riskLevel: 'LOW',
                filesChanged: 0,
            },
        });
        // Create audit log for review rerun
        if (userId) {
            await (0, auditLog_1.createAuditLog)({
                userId,
                action: 'review_rerun',
                entityType: 'review',
                entityId: review.id,
                repositoryId: pr.repository.id,
                details: { prId: pr.id, prNumber: pr.number, securityOnly: !!securityOnly },
                ipAddress: req.ip || req.socket.remoteAddress || undefined,
                userAgent: req.get('user-agent') || undefined,
            });
        }
        // Return immediately - process in background
        res.json({
            message: `Review started for PR #${pr.number}. Processing in background...`,
            reviewId: review.id,
            status: 'PENDING',
            processedDirectly: true,
        });
        // Process review in background (don't await - let it run async)
        (async () => {
            try {
                const { getPullRequestFiles, getInstallationAccessToken } = await Promise.resolve().then(() => __importStar(require('../services/githubApi')));
                const { reviewPullRequest } = await Promise.resolve().then(() => __importStar(require('../ai/review')));
                const { createPRReview, convertIssuesToGitHubComments } = await Promise.resolve().then(() => __importStar(require('../services/githubReview')));
                console.log(`[Review] Starting background review for PR #${pr.number}...`);
                // 1. Fetch files
                const files = await getPullRequestFiles(pr.repository.fullName, pr.number, pr.repository.installationId);
                if (files.length === 0) {
                    await db_1.default.review.update({
                        where: { id: review.id },
                        data: {
                            status: 'FAILED',
                            summary: 'No files to review',
                        },
                    });
                    return;
                }
                // 2. Perform AI review (with security-only mode if requested)
                console.log(`[Review] Reviewing ${files.length} files... (securityOnly: ${!!securityOnly})`);
                // Note: Progress callback not used in manual rerun, only in worker
                const reviewResult = await reviewPullRequest(files, undefined, { securityOnly: !!securityOnly });
                // 3. Update review with results
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
                                suggestedFix: issue.suggestedFix,
                                alternativeFixes: issue.alternativeFixes ? JSON.stringify(issue.alternativeFixes) : null,
                                language: issue.language || 'plaintext',
                                fixStatus: 'PENDING',
                            })),
                        },
                    },
                });
                console.log(`[Review] Completed review ${review.id} with ${reviewResult.issues.length} issues`);
                // 4. Update PR
                await db_1.default.pullRequest.update({
                    where: { id: pr.id },
                    data: {
                        riskLevel: reviewResult.riskLevel,
                        lastReviewedCommitSha: commitSha,
                    },
                });
                // 5. Create GitHub Status Check
                try {
                    const { createReviewStatusCheck } = await Promise.resolve().then(() => __importStar(require('../services/githubStatus')));
                    await createReviewStatusCheck(pr.repository.fullName, commitSha, reviewResult, pr.repository.installationId, pr.number);
                    console.log(`[Review] Created GitHub status check for PR #${pr.number}`);
                }
                catch (statusError) {
                    console.warn(`[Review] Failed to create status check (non-critical):`, statusError.message);
                }
                // 6. Post to GitHub (optional)
                try {
                    const token = await getInstallationAccessToken(pr.repository.installationId);
                    const issuesCount = reviewResult.issues.reduce((acc, issue) => {
                        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
                        return acc;
                    }, {});
                    const commentBody = `### 🤖 AI Code Review

**Risk Level**: ${reviewResult.riskLevel}
**Confidence**: ${reviewResult.confidenceScore}%

**Issue Summary**:
- 🔴 Critical: ${issuesCount.critical || 0}
- 🔒 Security: ${issuesCount.security || 0}
- 🟠 Performance: ${issuesCount.performance || 0}
- 🔵 Quality: ${issuesCount.quality || 0}
- ✨ Style: ${issuesCount.style || 0}

${reviewResult.summary}`;
                    const comments = convertIssuesToGitHubComments(reviewResult.issues);
                    // Determine review event based on risk level and issues
                    let reviewEvent = 'COMMENT';
                    const criticalCount = issuesCount.critical || 0;
                    const securityCount = issuesCount.security || 0;
                    if (reviewResult.riskLevel === 'LOW' && reviewResult.issues.length === 0 && reviewResult.confidenceScore >= 80) {
                        reviewEvent = 'APPROVE';
                        console.log(`[Review] Auto-approving PR #${pr.number} (low risk, no issues, confidence: ${reviewResult.confidenceScore}%)`);
                    }
                    else if (reviewResult.riskLevel === 'HIGH' || criticalCount > 0 || securityCount > 0) {
                        reviewEvent = 'REQUEST_CHANGES';
                        console.log(`[Review] Requesting changes for PR #${pr.number} (risk: ${reviewResult.riskLevel}, critical: ${criticalCount}, security: ${securityCount})`);
                    }
                    else {
                        reviewEvent = 'COMMENT';
                        console.log(`[Review] Commenting on PR #${pr.number} (risk: ${reviewResult.riskLevel}, issues: ${reviewResult.issues.length})`);
                    }
                    await createPRReview({
                        repoFullName: pr.repository.fullName,
                        prNumber: pr.number,
                        body: commentBody,
                        comments,
                        token,
                        event: reviewEvent,
                    });
                    console.log(`[Review] Posted review to GitHub for PR #${pr.number} with event: ${reviewEvent}`);
                }
                catch (githubError) {
                    console.warn('[Review] Failed to post to GitHub (non-critical):', githubError.message);
                }
                // Emit WebSocket notification
                try {
                    const { emitReviewCompleted } = await Promise.resolve().then(() => __importStar(require('../services/websocket')));
                    emitReviewCompleted(pr.id, review.id);
                }
                catch (wsError) {
                    console.warn('[Review] WebSocket notification failed (non-critical):', wsError);
                }
            }
            catch (error) {
                console.error(`[Review] Background review failed for PR #${pr.number}:`, error);
                await db_1.default.review.update({
                    where: { id: review.id },
                    data: {
                        status: 'FAILED',
                        summary: `Review failed: ${error.message}`,
                    },
                });
            }
        })();
    }
    catch (error) {
        console.error(`Error rerunning review for PR ${id}:`, error);
        res.status(500).json({ error: 'Failed to rerun review' });
    }
};
exports.rerunReview = rerunReview;
