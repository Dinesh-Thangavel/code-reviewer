import axios from 'axios';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

interface OllamaChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OllamaChatResponse {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    eval_count?: number;
}

/**
 * Send a chat completion request to Ollama's local API.
 * Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export async function ollamaChat(
    messages: OllamaChatMessage[],
    options?: {
        model?: string;
        temperature?: number;
        format?: 'json' | '';
    }
): Promise<string> {
    const model = options?.model || OLLAMA_MODEL;

    try {
        const response = await axios.post<OllamaChatResponse>(
            `${OLLAMA_BASE_URL}/api/chat`,
            {
                model,
                messages,
                stream: false,
                format: options?.format || 'json',
                options: {
                    temperature: options?.temperature ?? 0.2,
                    num_predict: 4096,
                },
            },
            {
                timeout: 120000, // 2 min timeout per chunk (reduced from 5 min)
                headers: { 'Content-Type': 'application/json' },
            }
        );

        return response.data.message.content;
    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error(
                `Ollama is not running at ${OLLAMA_BASE_URL}. ` +
                `Start it with: ollama serve`
            );
        }
        if (error.response?.status === 404) {
            throw new Error(
                `Ollama model "${model}" not found. Pull it with: ollama pull ${model}`
            );
        }
        throw new Error(`Ollama API error: ${error.message}`);
    }
}

/**
 * Check if Ollama is reachable and the model is available.
 */
export async function checkOllamaHealth(): Promise<{
    available: boolean;
    model: string;
    modelReady: boolean;
    error?: string;
}> {
    const model = OLLAMA_MODEL;

    try {
        // Check Ollama is running
        await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });

        // Check model is available
        try {
            const tagsRes = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
            const models: { name: string }[] = tagsRes.data.models || [];
            const modelReady = models.some(
                (m) => m.name === model || m.name.startsWith(`${model}:`)
            );

            return { available: true, model, modelReady };
        } catch {
            return { available: true, model, modelReady: false };
        }
    } catch (error: any) {
        return {
            available: false,
            model,
            modelReady: false,
            error: `Ollama not reachable at ${OLLAMA_BASE_URL}: ${error.message}`,
        };
    }
}
