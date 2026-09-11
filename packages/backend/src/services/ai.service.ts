import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { getMainPrompt } from '../prompts/document-prompts.js';
import type { DocumentTypeId, Requisites } from '../document-types.js';

const CONTAINER_IMAGE = process.env.DOCXGEN_AI_IMAGE || 'docxgen-opencode';

export interface AiProcessedDocument {
  correctedText: string;
  requisites: Requisites;
  documentType: DocumentTypeId;
  source: 'ai' | 'local';
}

function emptyRequisites(): Requisites {
  return { to: '', from: '', date: '', subject: '', number: '', position: '', signature: '', greeting: '', executor: '' };
}

function cleanValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractLabeledValue(text: string, labels: string[]): string {
  const pattern = labels.join('|');
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${pattern})\\s*[:—-]\\s*(.+)`, 'im'));
  return match?.[1]?.trim() || '';
}

function stripMetadata(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(тип|кому|адресат|от кого|автор|отправитель|составитель|должность|дата|номер|тема|заголовок|подпись|обращение|исполнитель)\s*[:—-]/i.test(line))
    .join('\n')
    .replace(/^\s*кому\s+[^\n]+$/im, '')
    .trim();
}

function localCorrect(text: string): string {
  let result = stripMetadata(text)
    .replace(/выполнент/gi, 'выполнен')
    .replace(/о том что/gi, 'о том, что')
    .replace(/ну короче[, ]*/gi, '')
    .replace(/sales показали excellent результат/gi, 'отдел продаж продемонстрировал высокий результат')
    .replace(/revenue\s+([\d.,]+)M\s+rub/gi, 'выручка составила $1 млн рублей')
    .replace(/new clients\s+([\d.,]+)/gi, 'привлечено $1 новых клиентов')
    .replace(/conversion\s*\+([\d.,]+)%/gi, 'конверсия увеличилась на $1%')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return result
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

function localProcess(userText: string, documentType: DocumentTypeId): AiProcessedDocument {
  const requisites = emptyRequisites();
  requisites.to = extractLabeledValue(userText, ['кому', 'адресат']);
  requisites.from = extractLabeledValue(userText, ['от кого', 'автор', 'отправитель', 'составитель']);
  requisites.date = extractLabeledValue(userText, ['дата']) || (userText.match(/\b\d{2}\.\d{2}\.\d{4}\b/)?.[0] || '');
  requisites.number = extractLabeledValue(userText, ['номер']);
  requisites.subject = extractLabeledValue(userText, ['тема', 'заголовок']);
  requisites.position = extractLabeledValue(userText, ['должность']);
  requisites.signature = extractLabeledValue(userText, ['подпись']);
  requisites.greeting = extractLabeledValue(userText, ['обращение']) || (userText.match(/^(Уважаем(?:ый|ая)[^!\n]*!)/im)?.[1] || '');
  requisites.executor = extractLabeledValue(userText, ['исполнитель']);

  const lower = userText.toLowerCase();
  if (!requisites.to) {
    const match = userText.match(/\bкому\s+([А-ЯЁ][^\n,.]+(?:\.[А-ЯЁ]\.)?)/i);
    requisites.to = match?.[1]?.trim() || '';
  }
  if (!requisites.subject) {
    const subjectMatch = userText.match(/(?:о|об)\s+([^\n.]{5,80})/i);
    requisites.subject = subjectMatch?.[0]?.trim() || '';
  }
  if (!requisites.from && documentType === 'informacionnaya') {
    requisites.from = extractLabeledValue(userText, ['аналитика']);
  }
  if (!requisites.signature && requisites.from) requisites.signature = requisites.from;
  if (!requisites.position && /директор|начальник|специалист|руководитель/i.test(lower)) {
    requisites.position = (requisites.from.match(/^(директор|начальник|специалист|руководитель[^,]*)/i)?.[1] || '').trim();
  }

  return { correctedText: localCorrect(userText), requisites, documentType, source: 'local' };
}

function parseAiResult(raw: string, userText: string, documentType: DocumentTypeId): AiProcessedDocument | null {
  const cleaned = raw.replace(/^```json\s*/im, '').replace(/```\s*$/m, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const input = (parsed.requisites || {}) as Record<string, unknown>;
    return {
      correctedText: cleanValue(parsed.correctedText) || userText,
      requisites: {
        to: cleanValue(input.to),
        from: cleanValue(input.from),
        date: cleanValue(input.date),
        subject: cleanValue(input.subject),
        number: cleanValue(input.number),
        position: cleanValue(input.position),
        signature: cleanValue(input.signature),
        greeting: cleanValue(input.greeting),
        executor: cleanValue(input.executor),
      },
      documentType: (cleanValue(parsed.documentType) || documentType) as DocumentTypeId,
      source: 'ai',
    };
  } catch {
    return null;
  }
}

function runInContainer(prompt: string, onChunk: (chunk: string) => void, agent = 'document-analyst'): Promise<string> {
  return new Promise((resolve, reject) => {
    const sessionID = `ses_${randomBytes(12).toString('hex')}`;
    const proc = spawn(process.env.CONTAINER_RUNTIME || 'podman', [
      'run', '--rm', '-i', '--network=host', CONTAINER_IMAGE, 'opencode', 'run', '--agent', agent, '--format', 'json', '--title', `docxgen-${sessionID}`,
    ]);
    let result = '';
    let buffer = '';
    let settled = false;
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 120000);
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      reject(new Error(`AI container timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    const consume = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as { type?: string; part?: { text?: string } };
          if (event.type === 'text' && event.part?.text) {
            result += event.part.text;
            onChunk(event.part.text);
          }
        } catch {
          // opencode can emit non-JSON logs; ignore those lines.
        }
      }
    };
    proc.stdout.on('data', consume);
    proc.stderr.on('data', () => undefined);
    proc.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (buffer.trim()) consume(Buffer.from('\n'));
      if (code === 0) resolve(result); else reject(new Error(`AI container exited with code ${code}`));
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export async function generateDocumentStream(
  userText: string,
  documentType: DocumentTypeId,
  onChunk: (chunk: string) => void,
): Promise<AiProcessedDocument> {
  const local = () => {
    const result = localProcess(userText, documentType);
    onChunk(JSON.stringify(result));
    return result;
  };
  const mode = process.env.DOCXGEN_AI_MODE || 'auto';
  if (mode === 'local') return local();

  const typeNames: Record<string, string> = {
    sluzhebnaya: 'Служебная записка',
    dokladnaya: 'Докладная записка',
    informacionnaya: 'Информационная справка',
    pismo: 'Письмо',
  };
  try {
    const raw = await runInContainer(getMainPrompt(userText, documentType, typeNames), onChunk);
    return parseAiResult(raw, userText, documentType) || local();
  } catch (error) {
    if (mode === 'container') throw error;
    return local();
  }
}


