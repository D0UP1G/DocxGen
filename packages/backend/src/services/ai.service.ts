import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';

const CONTAINER_IMAGE = 'docxgen-opencode';

function generateId(prefix: string): string {
  return prefix + crypto.randomBytes(12).toString('hex');
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
 * Runs opencode in a container and streams the output.
 * Returns the full generated text.
 */
function runInContainer(
  prompt: string,
  onChunk: (chunk: string) => void,
  agent: string = 'typst-generator',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const sessionID = generateId('ses_');
    
    // Pass prompt via stdin, not as argument
    const proc = spawn('podman', [
      'run', '--rm', '-i',
      '--network=host',
      CONTAINER_IMAGE,
      'opencode', 'run',
      '--agent', agent,
      '--format', 'json',
      '--title', `docxgen-${sessionID}`,
    ]);

    // Write prompt to stdin
    proc.stdin?.write(prompt);
    proc.stdin?.end();

    let result = '';
    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'text' && event.part?.text) {
            const text = event.part.text;
            result += text;
            onChunk(text);
          }
        } catch {}
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      // Container stderr is mostly logs, ignore
    });

    proc.on('close', (code) => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === 'text' && event.part?.text) {
            result += event.part.text;
            onChunk(event.part.text);
          }
        } catch {}
      }

      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(`Container exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Streams Typst generation from the AI via container.
 * Calls `onChunk` for every token received.
 * Returns the full accumulated Typst content when done.
 */
export interface AiProcessedDocument {
  correctedText: string;
  requisites: {
    to: string;        // Кому (recipient)
    from: string;      // От кого (sender)
    date: string;      // Дата
    subject: string;   // Заголовок/тема
    number: string;    // Номер документа
  };
  documentType: 'sluzhebnaya' | 'dokladnaya' | 'informacionnaya' | 'pismo';
}

export async function generateTypstStream(
  userText: string,
  documentType: string,
  onChunk: (chunk: string) => void,
): Promise<AiProcessedDocument> {
  const typeNames: Record<string, string> = {
    sluzhebnaya: 'Служебная записка',
    dokladnaya: 'Докладная записка',
    informacionnaya: 'Информационная справка',
    pismo: 'Письмо',
  };

  const prompt = `Ты — ИИ-ассистент для подготовки служебных документов. Проанализируй текст ниже и верни JSON.

Тип документа: ${typeNames[documentType] || 'Служебная записка'}

ЗАДАЧА:
1. Исправь орфографические, пунктуационные и грамматические ошибки
2. Приведи формулировки к официально-деловому стилю
3. Извлеки реквизиты: Кому, От кого, Дата, Тема, Номер
4. НЕ добавляй факты, даты, фамилии которых нет в исходном тексте
5. Если реквизит отсутствует — поставь пустую строку ""

ФОРМАТ ОТВЕТА — ТОЛЬКО JSON (без markdown, без комментариев):
{
  "correctedText": "Исправленный текст документа в официально-деловом стиле",
  "requisites": {
    "to": "Кому или пустая строка",
    "from": "От кого или пустая строка", 
    "date": "Дата или пустая строка",
    "subject": "Тема/заголовок или пустая строка",
    "number": "Номер или пустая строка"
  },
  "documentType": "${documentType}"
}

Исходный текст:
${userText}`;

  const result = await runInContainer(prompt, onChunk, 'typst-generator');
  
  // Clean up: remove markdown fences if AI wrapped them
  const cleaned = result
    .replace(/^```json\n?/gm, '')
    .replace(/^```\n?/gm, '')
    .trim();
  
  // Parse JSON response
  try {
    const parsed = JSON.parse(cleaned);
    return {
      correctedText: parsed.correctedText || userText,
      requisites: {
        to: parsed.requisites?.to || '',
        from: parsed.requisites?.from || '',
        date: parsed.requisites?.date || '',
        subject: parsed.requisites?.subject || '',
        number: parsed.requisites?.number || '',
      },
      documentType: (parsed.documentType || documentType) as AiProcessedDocument['documentType'],
    };
  } catch (e) {
    // If JSON parsing fails, return the raw text as correctedText
    return {
      correctedText: cleaned,
      requisites: { to: '', from: '', date: '', subject: '', number: '' },
      documentType: documentType as AiProcessedDocument['documentType'],
    };
  }
}

/**
 * PATCH MODE: Sends only the broken section ± context to the AI via container.
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

  const prompt = `You are fixing a Typst compilation error. The error occurred at line ${errorLine}.

Error message:
${compileError}

Context around the error (lines ${startLine}–${startLine + broken.split('\n').length - 1}):
\`\`\`typst
${broken}
\`\`\`

Fix ONLY this fragment. Return ONLY the corrected Typst fragment — no comments, no markdown fences, no explanations. Just clean Typst.`;

  const fixedSection = await runInContainer(prompt, onChunk, 'typst-generator');
  
  // Clean up markdown fences if AI wrapped them
  const cleaned = fixedSection
    .replace(/^```typst\n?/gm, '')
    .replace(/^```\n?/gm, '')
    .trim();
  
  return applyPatch(before, cleaned, after);
}
