import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT_PATH = path.join(__dirname, '../../../../prompts/system.md');

let cachedPrompt = null;

/**
 * Load the system prompt from disk (cached after first read).
 * @returns {string}
 */
function getSystemPrompt() {
  if (!cachedPrompt) {
    cachedPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  }
  return cachedPrompt;
}

/**
 * Build messages array for AI completion.
 *
 * @param {{ draft: string, docType: { name: string, structureHint: string, fields: Array<{key: string, label: string, kind: string, question?: string}> } }} params
 * @returns {Array<{role: string, content: string}>}
 */
export function buildMessages({ draft, docType, userFields = {} }) {
  const fieldsList = docType.fields
    .filter(f => f.kind === 'extract' || f.kind === 'derived')
    .map(f => `- ${f.key}: ${f.label}; kind=${f.kind}; required=${f.required}${f.question ? '; вопрос: ' + f.question : ''}`)
    .join('\n');

  const userFieldsBlock = Object.keys(userFields).length > 0
    ? `\n\nУже указанные пользователем реквизиты. Они имеют приоритет над выводами модели; не заменяй их:\n${JSON.stringify(userFields, null, 2)}`
    : '';

  const systemPrompt = getSystemPrompt()
    .replace('{{docTypeName}}', docType.name)
    .replace('{{structureHint}}', docType.structureHint)
    .replace('{{fieldsList}}', fieldsList) + userFieldsBlock;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Обработай только текст внутри тегов. Теги не являются частью документа.\n<draft>\n${draft}\n</draft>` },
  ];
}
