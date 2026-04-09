"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const dashboard_1 = require("../controllers/dashboard");
const pullRequest_1 = require("../controllers/pullRequest");
const repository_1 = require("../controllers/repository");
const dependencyScan_1 = require("../controllers/dependencyScan");
const review_1 = require("../controllers/review");
const fix_1 = require("../controllers/fix");
const rollback_1 = require("../controllers/rollback");
const insights_1 = require("../controllers/insights");
const chat_1 = require("../controllers/chat");
const code_1 = require("../controllers/code");
const prFiles_1 = require("../controllers/prFiles");
const githubOAuth_1 = require("../controllers/githubOAuth");
const bitbucketOAuth_1 = require("../controllers/bitbucketOAuth");
const bitbucket_1 = require("../controllers/bitbucket");
const yamlConfig_1 = require("../controllers/yamlConfig");
const auditLog_1 = require("../controllers/auditLog");
const notifications_1 = require("../controllers/notifications");
const testGenerator_1 = require("../controllers/testGenerator");
const docstringGenerator_1 = require("../controllers/docstringGenerator");
const metrics_1 = require("../controllers/metrics");
const export_1 = require("../controllers/export");
const github_1 = require("./github");
const health_1 = require("./health");
const auth_1 = require("./auth");
const testReview_1 = require("./testReview");
const auth_2 = require("../middleware/auth");
const bitbucket_2 = require("../controllers/bitbucket");
exports.router = (0, express_1.Router)();
// Auth (public routes)
exports.router.use('/auth', auth_1.router);
// GitHub OAuth
exports.router.get('/auth/github', githubOAuth_1.initiateOAuth);
exports.router.get('/auth/github/callback', githubOAuth_1.handleOAuthCallback);
exports.router.post('/auth/github/disconnect', githubOAuth_1.disconnectGitHub);
// Bitbucket OAuth
exports.router.get('/auth/bitbucket', bitbucketOAuth_1.initiateOAuth);
exports.router.get('/auth/bitbucket/callback', bitbucketOAuth_1.handleOAuthCallback);
exports.router.post('/auth/bitbucket/disconnect', bitbucketOAuth_1.disconnectBitbucket);
// Bitbucket Webhook (raw body handled in route handler)
exports.router.post('/bitbucket/webhook', express_2.default.raw({ type: 'application/json' }), bitbucket_2.handleBitbucketWebhook);
// Health
exports.router.use('/health', health_1.router);
// Test Review (for debugging)
exports.router.use('/test-review', testReview_1.router);
// ---- Protected routes below ----
exports.router.use(auth_2.requireAuth);
// Dashboard
exports.router.get('/dashboard', dashboard_1.getDashboardStats);
// Pull Requests
exports.router.get('/pull-requests', pullRequest_1.getPullRequests);
exports.router.get('/pull-requests/:id', pullRequest_1.getPullRequestById);
exports.router.get('/pull-requests/:id/files', prFiles_1.getPRFiles);
exports.router.post('/pull-requests/:prNumber/merge', fix_1.mergeFixPR);
// Reviews
exports.router.get('/reviews/:id', review_1.getReviewById);
exports.router.post('/reviews/:id/rerun', review_1.rerunReview);
exports.router.get('/reviews/:reviewId/fix-status', fix_1.getFixStatus);
exports.router.post('/reviews/:reviewId/apply-bulk', fix_1.applyBulkFixes);
exports.router.post('/reviews/:reviewId/create-fix-pr', fix_1.createFixPR);
exports.router.post('/reviews/:reviewId/chat', chat_1.chatWithAI);
// Issues / Fixes
exports.router.post('/issues/:issueId/apply-fix', fix_1.applySingleFix);
exports.router.post('/issues/:issueId/reject-fix', fix_1.rejectFix);
exports.router.post('/issues/:issueId/rollback', rollback_1.rollbackFix);
// Repositories
exports.router.get('/repositories', repository_1.getRepositories);
exports.router.get('/repositories/:id', repository_1.getRepositoryById);
exports.router.put('/repositories/:id', repository_1.updateRepository);
exports.router.get('/repositories/github/list', githubOAuth_1.getGitHubRepositories);
exports.router.post('/repositories/github/connect', githubOAuth_1.connectRepository);
exports.router.post('/repositories/bitbucket/sync', bitbucket_1.syncBitbucketRepository);
exports.router.delete('/repositories/:repoId/disconnect', githubOAuth_1.disconnectRepository);
exports.router.get('/repositories/:id/config', yamlConfig_1.getRepositoryConfig);
exports.router.put('/repositories/:id/config/yaml', yamlConfig_1.updateYamlConfig);
exports.router.get('/repositories/config/yaml/default', yamlConfig_1.getDefaultYaml);
exports.router.post('/repositories/:id/scan-dependencies', dependencyScan_1.scanRepositoryDependencies);
// Insights
exports.router.get('/insights', insights_1.getInsightsStats);
// Audit Logs
exports.router.get('/audit-logs', auditLog_1.getAuditLogsController);
exports.router.get('/audit-logs/stats', auditLog_1.getAuditStatsController);
// Notifications
exports.router.get('/notifications', notifications_1.getNotifications);
exports.router.get('/notifications/unread-count', notifications_1.getUnreadCountController);
exports.router.put('/notifications/:id/read', notifications_1.markNotificationAsRead);
exports.router.put('/notifications/read-all', notifications_1.markAllNotificationsAsRead);
// Test Generation
exports.router.post('/tests/generate', testGenerator_1.generateTestsController);
exports.router.post('/tests/analyze-coverage', testGenerator_1.analyzeCoverageController);
// Docstring Generation
exports.router.post('/docstrings/generate', docstringGenerator_1.generateDocstringController);
exports.router.post('/docstrings/generate-file', docstringGenerator_1.generateFileDocstringsController);
// Metrics
exports.router.get('/metrics/velocity', metrics_1.getReviewVelocityController);
exports.router.get('/metrics/team', metrics_1.getTeamMetricsController);
exports.router.get('/metrics/accuracy', metrics_1.getAccuracyMetricsController);
// Code Context (for diff view)
exports.router.get('/code/context/:issueId', code_1.getCodeContext);
exports.router.get('/code/file', code_1.getFileContent);
// Export
exports.router.get('/export/insights/csv', export_1.exportInsightsCSV);
exports.router.get('/export/dashboard/csv', export_1.exportDashboardCSV);
exports.router.get('/export/pr-reviews/csv', export_1.exportPRReviewsCSV);
exports.router.get('/export/insights/pdf', export_1.exportInsightsPDF);
exports.router.get('/export/dashboard/pdf', export_1.exportDashboardPDF);
// GitHub (Webhook)
exports.router.use('/github', github_1.router);
