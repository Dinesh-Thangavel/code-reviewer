"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OLLAMA_MODEL = void 0;
exports.ollamaChat = ollamaChat;
exports.checkOllamaHealth = checkOllamaHealth;
const axios_1 = __importDefault(require("axios"));
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
exports.OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
/**
 * Send a chat completion request to Ollama's local API.
 * Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
async function ollamaChat(messages, options) {
    const model = options?.model || exports.OLLAMA_MODEL;
    try {
        const response = await axios_1.default.post(`${OLLAMA_BASE_URL}/api/chat`, {
            model,
            messages,
            stream: false,
            format: options?.format || 'json',
            options: {
                temperature: options?.temperature ?? 0.2,
                num_predict: 4096,
            },
        }, {
            timeout: 120000, // 2 min timeout per chunk (reduced from 5 min)
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data.message.content;
    }
    catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Ollama is not running at ${OLLAMA_BASE_URL}. ` +
                `Start it with: ollama serve`);
        }
        if (error.response?.status === 404) {
            throw new Error(`Ollama model "${model}" not found. Pull it with: ollama pull ${model}`);
        }
        throw new Error(`Ollama API error: ${error.message}`);
    }
}
/**
 * Check if Ollama is reachable and the model is available.
 */
async function checkOllamaHealth() {
    const model = exports.OLLAMA_MODEL;
    try {
        // Check Ollama is running
        await axios_1.default.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
        // Check model is available
        try {
            const tagsRes = await axios_1.default.get(`${OLLAMA_BASE_URL}/api/tags`);
            const models = tagsRes.data.models || [];
            const modelReady = models.some((m) => m.name === model || m.name.startsWith(`${model}:`));
            return { available: true, model, modelReady };
        }
        catch {
            return { available: true, model, modelReady: false };
        }
    }
    catch (error) {
        return {
            available: false,
            model,
            modelReady: false,
            error: `Ollama not reachable at ${OLLAMA_BASE_URL}: ${error.message}`,
        };
    }
}
