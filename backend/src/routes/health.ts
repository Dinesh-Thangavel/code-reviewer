import { Router } from 'express';
import { checkOllamaHealth } from '../ai/ollamaClient';
import { checkGeminiHealth } from '../ai/geminiClient';
import { checkClaudeHealth } from '../ai/claudeClient';
import { checkOpenAIHealth } from '../ai/openaiClient';
import prisma from '../db';

export const router = Router();

router.get('/', async (_req, res) => {
    const AI_PROVIDER = process.env.AI_PROVIDER || 'claude';
    const useClaude = (AI_PROVIDER.toLowerCase() === 'claude' || AI_PROVIDER.toLowerCase() === 'anthropic') && !!process.env.ANTHROPIC_API_KEY;
    const useOpenAI = (AI_PROVIDER.toLowerCase() === 'openai' || AI_PROVIDER.toLowerCase() === 'gpt') && !!process.env.OPENAI_API_KEY;
    const useGemini = (AI_PROVIDER.toLowerCase() === 'gemini') && !!process.env.GEMINI_API_KEY && !useClaude && !useOpenAI;
    
    let aiHealth;
    let providerName;
    
    if (useClaude) {
        aiHealth = await checkClaudeHealth();
        providerName = 'claude';
    } else if (useOpenAI) {
        aiHealth = await checkOpenAIHealth();
        providerName = 'openai';
    } else if (useGemini) {
        aiHealth = await checkGeminiHealth();
        providerName = 'gemini';
    } else {
        aiHealth = await checkOllamaHealth();
        providerName = 'ollama';
    }
    
    res.json({
        status: 'ok',
        ai: {
            provider: providerName,
            ...aiHealth,
        },
    });
});

router.get('/ollama', async (_req, res) => {
    try {
        const result = await checkOllamaHealth();
        if (result.available) {
            res.json({ status: 'ok', ...result });
        } else {
            res.status(503).json({ status: 'unavailable', ...result });
        }
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * Database connectivity health check
 * GET /api/health/db  (mounted under /api in routes/api.ts)
 */
router.get('/db', async (_req, res) => {
    try {
        // Simple round-trip query; works for Postgres/Supabase and most providers
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', db: 'connected' });
    } catch (error: any) {
        const message = error?.message || 'Database connection failed';
        res.status(503).json({
            status: 'unavailable',
            db: 'disconnected',
            message,
        });
    }
});
