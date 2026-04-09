"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENAI_MODEL_NAME = void 0;
exports.openaiChat = openaiChat;
exports.checkOpenAIHealth = checkOpenAIHealth;
const axios_1 = __importDefault(require("axios"));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
/**
 * Send a chat completion request to OpenAI API
 * GPT-4 is used by CodeRabbit as a fallback model - provides excellent code understanding
 */
async function openaiChat(messages, options) {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    try {
        const openaiMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
        const requestBody = {
            model: OPENAI_MODEL,
            messages: openaiMessages,
            temperature: options?.temperature ?? 0.1, // Lower temperature for accuracy
            max_tokens: 16384, // GPT-4 Turbo supports up to 16K output tokens
            ...(options?.format === 'json' && {
                response_format: { type: 'json_object' },
            }),
        };
        const response = await axios_1.default.post(OPENAI_API_URL, requestBody, {
            timeout: 180000, // 3 min timeout
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
        });
        if (!response.data.choices || response.data.choices.length === 0) {
            throw new Error('OpenAI API returned no choices');
        }
        const content = response.data.choices[0]?.message?.content || '';
        if (!content) {
            throw new Error('OpenAI API returned empty content');
        }
        return content;
    }
    catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('OpenAI API key is invalid or expired. Please check your OPENAI_API_KEY.');
        }
        if (error.response?.status === 400) {
            throw new Error(`OpenAI API error: ${error.response.data?.error?.message || error.message}`);
        }
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}
/**
 * Check if OpenAI API is accessible and the API key is valid
 */
async function checkOpenAIHealth() {
    const model = OPENAI_MODEL;
    if (!OPENAI_API_KEY) {
        return {
            available: false,
            model,
            apiKeySet: false,
            error: 'OPENAI_API_KEY is not set in environment variables',
        };
    }
    try {
        // Test with a simple request
        const testRequest = {
            model,
            messages: [
                {
                    role: 'user',
                    content: 'Say "OK" if you can read this.',
                },
            ],
            max_tokens: 10,
        };
        await axios_1.default.post(OPENAI_API_URL, testRequest, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
        });
        return { available: true, model, apiKeySet: true };
    }
    catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return {
                available: false,
                model,
                apiKeySet: true,
                error: 'OpenAI API key is invalid or expired',
            };
        }
        return {
            available: false,
            model,
            apiKeySet: true,
            error: `OpenAI API error: ${error.message}`,
        };
    }
}
exports.OPENAI_MODEL_NAME = OPENAI_MODEL;
