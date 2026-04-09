import { Router } from 'express';
import express from 'express';
import { getDashboardStats } from '../controllers/dashboard';
import { getPullRequests, getPullRequestById } from '../controllers/pullRequest';
import { getRepositories, updateRepository, getRepositoryById } from '../controllers/repository';
import { scanRepositoryDependencies } from '../controllers/dependencyScan';
import { rerunReview, getReviewById } from '../controllers/review';
import { applySingleFix, rejectFix, applyBulkFixes, createFixPR, getFixStatus, mergeFixPR } from '../controllers/fix';
import { rollbackFix } from '../controllers/rollback';
import { getInsightsStats } from '../controllers/insights';
import { chatWithAI } from '../controllers/chat';
import { getFileContent, getCodeContext } from '../controllers/code';
import { getPRFiles } from '../controllers/prFiles';
import {
    initiateOAuth,
    handleOAuthCallback,
    disconnectGitHub,
    getGitHubRepositories,
    connectRepository,
    disconnectRepository,
} from '../controllers/githubOAuth';
import {
    initiateOAuth as initiateBitbucketOAuth,
    handleOAuthCallback as handleBitbucketOAuthCallback,
    disconnectBitbucket,
} from '../controllers/bitbucketOAuth';
import { syncBitbucketRepository } from '../controllers/bitbucket';
import {
    getRepositoryConfig,
    updateYamlConfig,
    getDefaultYaml,
} from '../controllers/yamlConfig';
import {
    getAuditLogsController,
    getAuditStatsController,
} from '../controllers/auditLog';
import {
    getNotifications,
    getUnreadCountController,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from '../controllers/notifications';
import {
    generateTestsController,
    analyzeCoverageController,
} from '../controllers/testGenerator';
import {
    generateDocstringController,
    generateFileDocstringsController,
} from '../controllers/docstringGenerator';
import {
    getReviewVelocityController,
    getTeamMetricsController,
    getAccuracyMetricsController,
} from '../controllers/metrics';
import {
    exportInsightsCSV,
    exportDashboardCSV,
    exportPRReviewsCSV,
    exportInsightsPDF,
    exportDashboardPDF,
} from '../controllers/export';
import { router as githubRouter } from './github';
import { router as healthRouter } from './health';
import { router as authRouter } from './auth';
import { router as testReviewRouter } from './testReview';
import { requireAuth } from '../middleware/auth';
import { handleBitbucketWebhook } from '../controllers/bitbucket';

export const router = Router();

// Auth (public routes)
router.use('/auth', authRouter);

// GitHub OAuth
router.get('/auth/github', initiateOAuth);
router.get('/auth/github/callback', handleOAuthCallback);
router.post('/auth/github/disconnect', disconnectGitHub);

// Bitbucket OAuth
router.get('/auth/bitbucket', initiateBitbucketOAuth);
router.get('/auth/bitbucket/callback', handleBitbucketOAuthCallback);
router.post('/auth/bitbucket/disconnect', disconnectBitbucket);

// Bitbucket Webhook (raw body handled in route handler)
router.post('/bitbucket/webhook', express.raw({ type: 'application/json' }), handleBitbucketWebhook);

// Health
router.use('/health', healthRouter);

// Test Review (for debugging)
router.use('/test-review', testReviewRouter);

// ---- Protected routes below ----
router.use(requireAuth);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Pull Requests
router.get('/pull-requests', getPullRequests);
router.get('/pull-requests/:id', getPullRequestById);
router.get('/pull-requests/:id/files', getPRFiles);
router.post('/pull-requests/:prNumber/merge', mergeFixPR);

// Reviews
router.get('/reviews/:id', getReviewById);
router.post('/reviews/:id/rerun', rerunReview);
router.get('/reviews/:reviewId/fix-status', getFixStatus);
router.post('/reviews/:reviewId/apply-bulk', applyBulkFixes);
router.post('/reviews/:reviewId/create-fix-pr', createFixPR);
router.post('/reviews/:reviewId/chat', chatWithAI);

// Issues / Fixes
router.post('/issues/:issueId/apply-fix', applySingleFix);
router.post('/issues/:issueId/reject-fix', rejectFix);
router.post('/issues/:issueId/rollback', rollbackFix);

// Repositories
router.get('/repositories', getRepositories);
router.get('/repositories/:id', getRepositoryById);
router.put('/repositories/:id', updateRepository);
router.get('/repositories/github/list', getGitHubRepositories);
router.post('/repositories/github/connect', connectRepository);
router.post('/repositories/bitbucket/sync', syncBitbucketRepository);
router.delete('/repositories/:repoId/disconnect', disconnectRepository);
router.get('/repositories/:id/config', getRepositoryConfig);
router.put('/repositories/:id/config/yaml', updateYamlConfig);
router.get('/repositories/config/yaml/default', getDefaultYaml);
router.post('/repositories/:id/scan-dependencies', scanRepositoryDependencies);

// Insights
router.get('/insights', getInsightsStats);

// Audit Logs
router.get('/audit-logs', getAuditLogsController);
router.get('/audit-logs/stats', getAuditStatsController);

// Notifications
router.get('/notifications', getNotifications);
router.get('/notifications/unread-count', getUnreadCountController);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/read-all', markAllNotificationsAsRead);

// Test Generation
router.post('/tests/generate', generateTestsController);
router.post('/tests/analyze-coverage', analyzeCoverageController);

// Docstring Generation
router.post('/docstrings/generate', generateDocstringController);
router.post('/docstrings/generate-file', generateFileDocstringsController);

// Metrics
router.get('/metrics/velocity', getReviewVelocityController);
router.get('/metrics/team', getTeamMetricsController);
router.get('/metrics/accuracy', getAccuracyMetricsController);

// Code Context (for diff view)
router.get('/code/context/:issueId', getCodeContext);
router.get('/code/file', getFileContent);

// Export
router.get('/export/insights/csv', exportInsightsCSV);
router.get('/export/dashboard/csv', exportDashboardCSV);
router.get('/export/pr-reviews/csv', exportPRReviewsCSV);
router.get('/export/insights/pdf', exportInsightsPDF);
router.get('/export/dashboard/pdf', exportDashboardPDF);

// GitHub (Webhook)
router.use('/github', githubRouter);
