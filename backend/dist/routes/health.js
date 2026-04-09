"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const ollamaClient_1 = require("../ai/ollamaClient");
const geminiClient_1 = require("../ai/geminiClient");
const claudeClient_1 = require("../ai/claudeClient");
const openaiClient_1 = require("../ai/openaiClient");
const db_1 = __importDefault(require("../db"));
exports.router = (0, express_1.Router)();
exports.router.get('/', async (_req, res) => {
    const AI_PROVIDER = process.env.AI_PROVIDER || 'claude';
    const useClaude = (AI_PROVIDER.toLowerCase() === 'claude' || AI_PROVIDER.toLowerCase() === 'anthropic') && !!process.env.ANTHROPIC_API_KEY;
    const useOpenAI = (AI_PROVIDER.toLowerCase() === 'openai' || AI_PROVIDER.toLowerCase() === 'gpt') && !!process.env.OPENAI_API_KEY;
    const useGemini = (AI_PROVIDER.toLowerCase() === 'gemini') && !!process.env.GEMINI_API_KEY && !useClaude && !useOpenAI;
    let aiHealth;
    let providerName;
    if (useClaude) {
        aiHealth = await (0, claudeClient_1.checkClaudeHealth)();
        providerName = 'claude';
    }
    else if (useOpenAI) {
        aiHealth = await (0, openaiClient_1.checkOpenAIHealth)();
        providerName = 'openai';
    }
    else if (useGemini) {
        aiHealth = await (0, geminiClient_1.checkGeminiHealth)();
        providerName = 'gemini';
    }
    else {
        aiHealth = await (0, ollamaClient_1.checkOllamaHealth)();
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
exports.router.get('/ollama', async (_req, res) => {
    try {
        const result = await (0, ollamaClient_1.checkOllamaHealth)();
        if (result.available) {
            res.json({ status: 'ok', ...result });
        }
        else {
            res.status(503).json({ status: 'unavailable', ...result });
        }
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
/**
 * Database connectivity health check
 * GET /api/health/db  (mounted under /api in routes/api.ts)
 */
exports.router.get('/db', async (_req, res) => {
    try {
        // Simple round-trip query; works for Postgres/Supabase and most providers
        await db_1.default.$queryRaw `SELECT 1`;
        res.json({ status: 'ok', db: 'connected' });
    }
    catch (error) {
        const message = error?.message || 'Database connection failed';
        res.status(503).json({
            status: 'unavailable',
            db: 'disconnected',
            message,
        });
    }
});
