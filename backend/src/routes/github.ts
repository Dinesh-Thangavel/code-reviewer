import { Router } from 'express';
import express from 'express';
import { handleWebhook, testGitHubConnection, syncRepository, getInstallationUrl } from '../controllers/github';

export const router = Router();

// Use raw body for signature verification
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    handleWebhook
);
router.get('/test', testGitHubConnection);
router.get('/app-installation-url', getInstallationUrl);
router.post('/sync', syncRepository);
