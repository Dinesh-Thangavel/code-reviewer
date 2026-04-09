// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { createServer } from 'http';
import { initializeWebSocket } from './services/websocket';

// --- Environment Variable Validation ---
// DATABASE_URL is strictly required; the server cannot function without it.
const criticalEnvVars = ['DATABASE_URL'];

const missingCritical = criticalEnvVars.filter((key) => !process.env[key]);
if (missingCritical.length > 0) {
    console.error('❌ Missing critical environment variables:', missingCritical.join(', '));
    process.exit(1);
}

// GitHub env vars are optional – only needed for webhook + fix features
const githubEnvVars = ['GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET'];
const missingGitHub = githubEnvVars.filter((key) => !process.env[key]);
if (missingGitHub.length > 0) {
    console.warn('⚠️  Missing GitHub env vars:', missingGitHub.join(', '));
    console.warn('   GitHub webhooks and fix application will not work until these are set.');
}

// AI Provider configuration (CodeRabbit uses Claude primarily)
const AI_PROVIDER = process.env.AI_PROVIDER || 'claude';
const useClaude = (AI_PROVIDER.toLowerCase() === 'claude' || AI_PROVIDER.toLowerCase() === 'anthropic') && !!process.env.ANTHROPIC_API_KEY;
const useOpenAI = (AI_PROVIDER.toLowerCase() === 'openai' || AI_PROVIDER.toLowerCase() === 'gpt') && !!process.env.OPENAI_API_KEY;
const useGemini = (AI_PROVIDER.toLowerCase() === 'gemini') && !!process.env.GEMINI_API_KEY && !useClaude && !useOpenAI;

if (useClaude) {
    const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
    console.log(`🤖 AI Provider: Anthropic Claude (CodeRabbit-style) — Model: ${claudeModel}`);
} else if (useOpenAI) {
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    console.log(`🤖 AI Provider: OpenAI GPT-4 — Model: ${openaiModel}`);
} else if (useGemini) {
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    console.log(`🤖 AI Provider: Google Gemini — Model: ${geminiModel}`);
} else {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
    console.log(`🤖 AI Provider: Ollama (${ollamaUrl}) — Model: ${ollamaModel}`);
    console.log(`⚠️  For CodeRabbit-level reviews, use Claude or GPT-4. Set AI_PROVIDER=claude and ANTHROPIC_API_KEY`);
}

// Only start the BullMQ worker if Redis is configured
const hasRedis = !!(process.env.REDIS_HOST || process.env.REDIS_URL);
if (hasRedis) {
    import('./jobs/worker').then(() => {
        console.log('✅ Background worker started');
    }).catch((err) => {
        console.warn('⚠️  Failed to start background worker:', err.message);
    });
} else {
    console.warn('⚠️  Background worker skipped (Redis not configured).');
}

const PORT = process.env.PORT || 5000;

// Create HTTP server for WebSocket support
const httpServer = createServer(app);

// Initialize WebSocket
initializeWebSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 WebSocket server initialized`);
});
