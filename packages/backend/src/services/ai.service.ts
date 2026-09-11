import * as crypto from 'crypto';
import { SYSTEM_PROMPT, FIX_PROMPT } from '../prompts.js';

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
 * Parses the error line number from Typst's stderr.
 * Example: "error: expected content\n  ┌─ document.typ:5:10" → 5
 */
function parseErrorLine(stderr: string): number | null {
  const match = stderr.match(/document\.typ:(\d+):/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts the broken section ± context lines around the error.
 * Returns: { before, broken, after, startLine }
 */
function extractBrokenSection(
  typstContent: string,
  errorLine: number,
  contextLines: number = 10,
): { before: string; broken: string; after: string; startLine: number } {
  const lines = typstContent.split('\n');
  const start = Math.max(0, errorLine - 1 - contextLines);
  const end = Math.min(lines.length, errorLine + contextLines);

  const before = lines.slice(0, start).join('\n');
  const broken = lines.slice(start, end).join('\n');
  const after = lines.slice(end).join('\n');

  return { before, broken, after, startLine: start + 1 };
}

/**
 * Patches the fixed section back into the original Typst content.
 * The AI returns ONLY the fixed section — we splice it in.
 */
function applyPatch(
  before: string,
  fixedSection: string,
  after: string,
): string {
  const parts = [before, fixedSection, after].filter((p) => p.length > 0);
  return parts.join('\n');
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

/**
 * PATCH MODE: Sends only the broken section ± context to the AI.
 * AI fixes ONLY those lines — not the whole document.
 * Returns the full patched Typst content.
 */
export async function patchTypstErrors(
  typstContent: string,
  compileError: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const errorLine = parseErrorLine(compileError);
  if (!errorLine) {
    throw new Error(`Cannot parse error line from: ${compileError}`);
  }

  const { before, broken, after, startLine } = extractBrokenSection(typstContent, errorLine);

  const patchPrompt = `Типст-компиляция завершилась с ошибкой в строке ${errorLine}:

${compileError}

Вот контекст вокруг ошибки (строки ${startLine}–${startLine + broken.split('\n').length - 1}):

\`\`\`typst
${broken}
\`\`\`

Почини ТОЛЬКО этот фрагмент. Верни ИСПРАВЛЕННЫЙ фрагмент целиком — без комментариев, без markdown-ограждений, без пояснений. Только чистый Типст.`;

  const response = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: 'big-pickle',
      messages: [
        { role: 'system', content: FIX_PROMPT },
        { role: 'user', content: patchPrompt },
      ],
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fixedSection = '';
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
            fixedSection += content;
            onChunk(content);
          }
        } catch {}
      }
    }
  }

  // Clean up markdown fences if AI wrapped them
  const cleaned = fixedSection
    .replace(/^```typst\n?/gm, '')
    .replace(/^```\n?/gm, '')
    .trim();

  return applyPatch(before, cleaned, after);
}
