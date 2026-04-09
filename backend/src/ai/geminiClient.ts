import axios from 'axios';
import dotenv from 'dotenv';

// Load env vars if not already loaded
dotenv.config();

// Read environment variables dynamically (not at module load time)
const getGeminiApiKey = () => process.env.GEMINI_API_KEY || '';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-1.5-pro';
const getGeminiApiUrl = () => `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`;

interface GeminiMessage {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

interface GeminiRequest {
    contents: GeminiMessage[];
    generationConfig?: {
        temperature?: number;
        topK?: number;
        topP?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
    };
}

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
        };
        finishReason: string;
    }>;
}

/**
 * Send a chat completion request to Google Gemini API
 */
export async function geminiChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
        temperature?: number;
        format?: 'json' | '';
    }
): Promise<string> {
    const GEMINI_API_KEY = getGeminiApiKey();
    const GEMINI_API_URL = getGeminiApiUrl();
    
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    try {
        // Convert messages to Gemini format
        // Gemini doesn't have a system role, so we'll prepend system messages to the first user message
        const geminiContents: GeminiMessage[] = [];
        let systemContent = '';

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemContent += msg.content + '\n\n';
            } else if (msg.role === 'user') {
                const userContent = systemContent + msg.content;
                systemContent = ''; // Clear after using
                geminiContents.push({
                    role: 'user',
                    parts: [{ text: userContent }],
                });
            } else if (msg.role === 'assistant') {
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

        const requestBody: GeminiRequest = {
            contents: geminiContents,
            generationConfig: {
                temperature: options?.temperature ?? 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: options?.format === 'json' ? 'application/json' : undefined,
            },
        };

        const response = await axios.post<GeminiResponse>(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            requestBody,
            {
                timeout: 120000, // 2 min timeout
                headers: { 'Content-Type': 'application/json' },
            }
        );

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
    } catch (error: any) {
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
export async function checkGeminiHealth(): Promise<{
    available: boolean;
    model: string;
    apiKeySet: boolean;
    error?: string;
}> {
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
        const testRequest: GeminiRequest = {
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

        await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            testRequest,
            {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' },
            }
        );

        return { available: true, model, apiKeySet: true };
    } catch (error: any) {
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
export const getGeminiModelName = () => getGeminiModel();
export const GEMINI_MODEL_NAME = getGeminiModel(); // For backward compatibility
