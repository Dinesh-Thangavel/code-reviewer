"use strict";
/**
 * AI Chat controller - CodeRabbit-style chat interface
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithAI = void 0;
const ollamaClient_1 = require("../ai/ollamaClient");
const geminiClient_1 = require("../ai/geminiClient");
const claudeClient_1 = require("../ai/claudeClient");
const openaiClient_1 = require("../ai/openaiClient");
const enhancedPrompt_1 = require("../ai/enhancedPrompt");
const db_1 = __importDefault(require("../db"));
const AI_PROVIDER = process.env.AI_PROVIDER || 'claude';
const useClaude = (AI_PROVIDER.toLowerCase() === 'claude' || AI_PROVIDER.toLowerCase() === 'anthropic') && !!process.env.ANTHROPIC_API_KEY;
const useOpenAI = (AI_PROVIDER.toLowerCase() === 'openai' || AI_PROVIDER.toLowerCase() === 'gpt') && !!process.env.OPENAI_API_KEY;
const useGemini = (AI_PROVIDER.toLowerCase() === 'gemini') && !!process.env.GEMINI_API_KEY && !useClaude && !useOpenAI;
// Log AI provider configuration on module load
console.log('[Chat] AI Provider Configuration:', {
    AI_PROVIDER,
    useClaude,
    useOpenAI,
    useGemini,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
});
const chatWithAI = async (req, res) => {
    const reviewId = req.params.reviewId;
    const { question, context } = req.body;
    if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required' });
    }
    // Check if any AI provider is configured
    if (!useClaude && !useOpenAI && !useGemini) {
        console.warn('[Chat] No AI provider configured. Checking Ollama availability...');
    }
    try {
        // Fetch review and PR details
        const review = await db_1.default.review.findUnique({
            where: { id: reviewId },
            include: {
                pullRequest: {
                    include: {
                        repository: true,
                    },
                },
                issues: {
                    take: 10, // Limit to recent issues for context
                },
            },
        });
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }
        // Build chat context
        const chatContext = {
            title: review.pullRequest.title,
            summary: review.summary,
            issues: review.issues.map((issue) => ({
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                file: issue.filePath,
                line: issue.lineNumber,
            })),
            filesChanged: review.filesChanged,
        };
        // Build prompt
        const prompt = (0, enhancedPrompt_1.buildChatPrompt)(question, chatContext);
        // Get AI response (CodeRabbit uses Claude for chat)
        const systemMessage = 'You are a helpful AI code review assistant. Answer questions clearly and provide actionable advice.';
        let response;
        try {
            if (useClaude) {
                console.log('[Chat] Using Claude AI provider', {
                    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
                    apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...',
                });
                response = await (0, claudeClient_1.claudeChat)([
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: prompt },
                ], { temperature: 0.7 });
            }
            else if (useOpenAI) {
                console.log('[Chat] Using OpenAI provider');
                response = await (0, openaiClient_1.openaiChat)([
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: prompt },
                ], { temperature: 0.7 });
            }
            else if (useGemini) {
                console.log('[Chat] Using Gemini provider');
                response = await (0, geminiClient_1.geminiChat)([
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: prompt },
                ], { temperature: 0.7 });
            }
            else {
                console.log('[Chat] Using Ollama provider (fallback)');
                response = await (0, ollamaClient_1.ollamaChat)([
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: prompt },
                ], { temperature: 0.7, format: '' });
            }
        }
        catch (aiError) {
            console.error('[Chat] AI provider error:', {
                provider: useClaude ? 'Claude' : useOpenAI ? 'OpenAI' : useGemini ? 'Gemini' : 'Ollama',
                error: aiError.message,
                stack: aiError.stack,
            });
            // Provide specific error messages based on error type
            if (aiError.message.includes('API key is invalid') || aiError.message.includes('API key is not set')) {
                return res.status(500).json({
                    error: 'AI provider not configured',
                    message: aiError.message,
                    details: 'Please configure an AI provider API key in your environment variables. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.',
                });
            }
            if (aiError.message.includes('Ollama is not running')) {
                return res.status(500).json({
                    error: 'Ollama not available',
                    message: aiError.message,
                    details: 'Ollama is not running. Please start Ollama or configure a cloud AI provider (Claude, OpenAI, or Gemini).',
                });
            }
            if (aiError.message.includes('rate limit')) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: aiError.message,
                    details: 'The AI provider rate limit has been exceeded. Please try again later.',
                });
            }
            if (aiError.message.includes('Insufficient credits') || aiError.message.includes('credit balance')) {
                return res.status(402).json({
                    error: 'Insufficient API credits',
                    message: aiError.message,
                    details: 'Your Anthropic account needs credits to use the API. Please add credits at https://console.anthropic.com/settings/billing',
                });
            }
            // Re-throw to be caught by outer catch block
            throw aiError;
        }
        res.json({
            success: true,
            response: response.trim(),
        });
    }
    catch (error) {
        console.error('[Chat] Error:', {
            reviewId,
            error: error.message,
            stack: error.stack,
        });
        // Determine appropriate status code
        let statusCode = 500;
        if (error.message?.includes('not found')) {
            statusCode = 404;
        }
        else if (error.message?.includes('rate limit')) {
            statusCode = 429;
        }
        res.status(statusCode).json({
            error: 'Failed to get AI response',
            message: error.message || 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
};
exports.chatWithAI = chatWithAI;
