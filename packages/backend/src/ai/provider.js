import { createOpenAiCompatProvider } from './providers/openaiCompat.js';
import { createMockProvider } from './providers/mock.js';

/**
 * Factory: create the AI provider based on env.AI_PROVIDER.
 *
 * Supported providers:
 * - "openai-compat" → any OpenAI-compatible API (OpenAI, Anthropic proxy, local ollama)
 * - "mock"          → deterministic stub for local testing
 *
 * @param {object} env - application environment (AI_PROVIDER, AI_BASE_URL, AI_API_KEY, etc.)
 * @returns {{ name: string, complete: Function }}
 */
export function createAiProvider(env) {
  switch (env.AI_PROVIDER) {
    case 'openai-compat':
      return createOpenAiCompatProvider({
        baseUrl: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
        temperature: Number(env.AI_TEMPERATURE) || 0.1,
        timeoutMs: Number(env.AI_TIMEOUT_MS) || 30_000,
      });
    case 'mock':
      return createMockProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
  }
}
