"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_MODEL_NAME = exports.getGeminiModelName = void 0;
exports.geminiChat = geminiChat;
exports.checkGeminiHealth = checkGeminiHealth;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env vars if not already loaded
dotenv_1.default.config();
// Read environment variables dynamically (not at module load time)
const getGeminiApiKey = () => process.env.GEMINI_API_KEY || '';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-1.5-pro';
const getGeminiApiUrl = () => `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`;
/**
 * Send a chat completion request to Google Gemini API
 */
async function geminiChat(messages, options) {
    const GEMINI_API_KEY = getGeminiApiKey();
    const GEMINI_API_URL = getGeminiApiUrl();
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    try {
        // Convert messages to Gemini format
        // Gemini doesn't have a system role, so we'll prepend system messages to the first user message
        const geminiContents = [];
        let systemContent = '';
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemContent += msg.content + '\n\n';
            }
            else if (msg.role === 'user') {
                const userContent = systemContent + msg.content;
                systemContent = ''; // Clear after using
                geminiContents.push({
                    role: 'user',
                    parts: [{ text: userContent }],
                });
            }
            else if (msg.role === 'assistant') {
                geminiContents.push({
                    role: 'model',
                    parts: [{ text: msg.content }],
                });
            }
        }
        // If there's leftover system content, add it to the last user message
        if (systemContent && geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === 'user') {
            const lastMsg = geminiContents[geminiContents.length - 1];
            lastMsg.parts[0].text = systemContent + lastMsg.parts[0].text;
        }
        const requestBody = {
            contents: geminiContents,
            generationConfig: {
                temperature: options?.temperature ?? 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: options?.format === 'json' ? 'application/json' : undefined,
            },
        };
        const response = await axios_1.default.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, requestBody, {
            timeout: 120000, // 2 min timeout
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.data.candidates || response.data.candidates.length === 0) {
            throw new Error('Gemini API returned no candidates');
        }
        const candidate = response.data.candidates[0];
        if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            throw new Error(`Gemini API finished with reason: ${candidate.finishReason}`);
        }
        const content = candidate.content.parts[0]?.text || '';
        if (!content) {
            throw new Error('Gemini API returned empty content');
        }
        return content;
    }
    catch (error) {
        if (error.response?.status === 400) {
            throw new Error(`Gemini API error: ${error.response.data?.error?.message || error.message}`);
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('Gemini API key is invalid or expired. Please check your GEMINI_API_KEY.');
        }
        throw new Error(`Gemini API error: ${error.message}`);
    }
}
/**
 * Check if Gemini API is accessible and the API key is valid
 */
async function checkGeminiHealth() {
    const GEMINI_API_KEY = getGeminiApiKey();
    const model = getGeminiModel();
    const GEMINI_API_URL = getGeminiApiUrl();
    if (!GEMINI_API_KEY) {
        return {
            available: false,
            model,
            apiKeySet: false,
            error: 'GEMINI_API_KEY is not set in environment variables',
        };
    }
    try {
        // Test with a simple request
        const testRequest = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: 'Say "OK" if you can read this.' }],
                },
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 10,
            },
        };
        await axios_1.default.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, testRequest, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        return { available: true, model, apiKeySet: true };
    }
    catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return {
                available: false,
                model,
                apiKeySet: true,
                error: 'Gemini API key is invalid or expired',
            };
        }
        return {
            available: false,
            model,
            apiKeySet: true,
            error: `Gemini API error: ${error.message}`,
        };
    }
}
// Export model name as a getter function
const getGeminiModelName = () => getGeminiModel();
exports.getGeminiModelName = getGeminiModelName;
exports.GEMINI_MODEL_NAME = getGeminiModel(); // For backward compatibility
