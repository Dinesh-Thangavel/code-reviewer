import axios from 'axios';
import dotenv from 'dotenv';

// Load env vars if not already loaded
dotenv.config();

// Read environment variables dynamically (not at module load time)
const getAnthropicApiKey = () => process.env.ANTHROPIC_API_KEY || '';
const getClaudeModel = () => process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ClaudeRequest {
    model: string;
    max_tokens: number;
    temperature?: number;
    messages: ClaudeMessage[];
    system?: string;
    response_format?: {
        type: 'json_object';
    };
}

interface ClaudeAPIResponse {
    id: string;
    type: string;
    role: string;
    content: Array<{
        type: string;
        text: string;
    }>;
    model: string;
    stop_reason: string;
    stop_sequence?: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

/**
 * Send a chat completion request to Anthropic Claude API
 * Claude is CodeRabbit's primary AI model - provides excellent code review quality
 */
export async function claudeChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
        temperature?: number;
        format?: 'json' | '';
    }
): Promise<string> {
    const ANTHROPIC_API_KEY = getAnthropicApiKey();
    const CLAUDE_MODEL = getClaudeModel();
    
    if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    try {
        // Separate system messages from user/assistant messages
        const systemMessages: string[] = [];
        const claudeMessages: ClaudeMessage[] = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemMessages.push(msg.content);
            } else if (msg.role === 'user' || msg.role === 'assistant') {
                claudeMessages.push({
                    role: msg.role,
                    content: msg.content,
                });
            }
        }

        const systemPrompt = systemMessages.join('\n\n');

        const requestBody: ClaudeRequest = {
            model: CLAUDE_MODEL,
            max_tokens: 16384, // Claude 3.5 supports up to 16K output tokens
            temperature: options?.temperature ?? 0.0, // 0.0 for maximum accuracy (CodeRabbit-style)
            messages: claudeMessages,
            ...(systemPrompt && { system: systemPrompt }),
            ...(options?.format === 'json' && {
                response_format: { type: 'json_object' },
            }),
        };

        // Log request for debugging (without sensitive data)
        if (process.env.DEBUG_AI === 'true') {
            console.log('[Claude] Request:', {
                model: CLAUDE_MODEL,
                messageCount: claudeMessages.length,
                systemPromptLength: systemPrompt.length,
                maxTokens: requestBody.max_tokens,
                temperature: requestBody.temperature,
            });
        }

        const response = await axios.post<ClaudeAPIResponse>(
            ANTHROPIC_API_URL,
            requestBody,
            {
                timeout: 180000, // 3 min timeout for complex reviews
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
            }
        );

        if (!response.data.content || response.data.content.length === 0) {
            throw new Error('Claude API returned no content');
        }

        const content = response.data.content[0]?.text || '';
        if (!content) {
            console.error('[Claude] Empty response received:', {
                stopReason: response.data.stop_reason,
                response: response.data,
            });
            throw new Error('Claude API returned empty content');
        }

        // Check stop reason
        if (response.data.stop_reason && response.data.stop_reason !== 'stop' && response.data.stop_reason !== 'end_turn') {
            console.warn('[Claude] Unexpected stop reason:', response.data.stop_reason);
        }

        // Log response for debugging
        if (process.env.DEBUG_AI === 'true') {
            console.log('[Claude] Response length:', content.length);
            console.log('[Claude] Response preview (first 500 chars):', content.substring(0, 500));
        }

        return content;
    } catch (error: any) {
        // Log detailed error for debugging
        console.error('[Claude] API Error Details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
        });
        
        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('Anthropic API key is invalid or expired. Please check your ANTHROPIC_API_KEY.');
        }
        if (error.response?.status === 400) {
            const errorMsg = error.response.data?.error?.message || error.message;
            console.error('[Claude] 400 Bad Request:', errorMsg);
            
            // Check for specific billing/credit errors
            if (errorMsg?.toLowerCase().includes('credit balance') || errorMsg?.toLowerCase().includes('billing')) {
                throw new Error('Anthropic API: Insufficient credits. Please add credits to your Anthropic account at https://console.anthropic.com/settings/billing');
            }
            
            throw new Error(`Claude API error: ${errorMsg}`);
        }
        if (error.response?.status === 429) {
            throw new Error('Claude API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Claude API error: ${error.message}`);
    }
}

/**
 * Check if Claude API is accessible and the API key is valid
 */
export async function checkClaudeHealth(): Promise<{
    available: boolean;
    model: string;
    apiKeySet: boolean;
    error?: string;
}> {
    const ANTHROPIC_API_KEY = getAnthropicApiKey();
    const model = getClaudeModel();

    if (!ANTHROPIC_API_KEY) {
        return {
            available: false,
            model,
            apiKeySet: false,
            error: 'ANTHROPIC_API_KEY is not set in environment variables',
        };
    }

    try {
        // Test with a simple request
        const testRequest: ClaudeRequest = {
            model,
            max_tokens: 10,
            messages: [
                {
                    role: 'user',
                    content: 'Say "OK" if you can read this.',
                },
            ],
        };

        await axios.post(
            ANTHROPIC_API_URL,
            testRequest,
            {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
            }
        );

        return { available: true, model, apiKeySet: true };
    } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return {
                available: false,
                model,
                apiKeySet: true,
                error: 'Anthropic API key is invalid or expired',
            };
        }
        return {
            available: false,
            model,
            apiKeySet: true,
            error: `Claude API error: ${error.message}`,
        };
    }
}

// Export model name as a getter function
export const getClaudeModelName = () => getClaudeModel();
export const CLAUDE_MODEL_NAME = getClaudeModel(); // For backward compatibility
