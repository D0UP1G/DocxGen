import { AiUnavailableError } from '../../core/errors.js';

/**
 * Create an OpenAI-compatible chat completion provider.
 *
 * Works with OpenAI, Anthropic (via proxy), local LLM servers (llama.cpp, ollama),
 * and any API that implements POST /chat/completions with JSON body.
 *
 * @param {{ baseUrl: string, apiKey?: string, model: string, temperature: number, timeoutMs: number }} opts
 */
export function createOpenAiCompatProvider({ baseUrl, apiKey, model, temperature, timeoutMs }) {
  return {
    name: `openai-compat:${model}`,

    /**
     * Run a chat completion. Returns the assistant's content string.
     * @param {Array<{role: string, content: string}>} messages
     * @returns {Promise<string>}
     */
    async complete(messages) {
      let res;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new AiUnavailableError(`AI request failed: ${err.message}`);
      }

      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        throw new AiUnavailableError(`AI HTTP ${res.status}: ${body}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    },
  };
}
