import * as crypto from 'crypto';
import { SYSTEM_PROMPT } from '../prompts.js';

const OPENCODE_API_URL = 'https://opencode.ai/zen/v1/chat/completions';

function generateId(prefix: string): string {
  return prefix + crypto.randomBytes(12).toString('hex');
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'x-opencode-client': 'opencode',
    'x-opencode-session': generateId('ses_'),
    'x-opencode-request': generateId('req_'),
    'User-Agent': 'opencode/1.18.15',
  };
}

/**
 * Streams Typst generation from the AI API.
 * Calls `onChunk` for every token received.
 * Returns the full accumulated Typst content when done.
 */
export async function generateTypstStream(
  userText: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const response = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: 'big-pickle',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            result += content;
            onChunk(content);
          }
        } catch {}
      }
    }
  }

  return result;
}
