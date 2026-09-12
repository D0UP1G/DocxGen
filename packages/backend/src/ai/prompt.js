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
 * Build field-specific instructions per doc type.
 * Memo/report/reference use authorPosition/authorName; letter uses signerPosition/signerName.
 * @param {string} docTypeId
 * @returns {string}
 */
function buildFieldKeyInstructions(docTypeId) {
  if (docTypeId === 'letter') {
    return `Для документа типа letter извлекай:
- addresseeOrg (наименование организации-получателя)
- addresseePerson (ФИО получателя)
- addresseeAddress (адрес получателя)
- salutation (формула обращения — derived)
- signerPosition (должность подписывающего)
- signerName (ФИО подписывающего)
- executor (исполнитель)
- title (заголовок — derived)
- date (дата документа)`;
  }
  return `Для документа типа ${docTypeId} извлекай:
- authorPosition (должность автора)
- authorName (ФИО автора)
- addressee (адресат документа)
- title (заголовок — derived)
- date (дата документа)`;
}

/**
 * Build messages array for AI completion.
 *
 * @param {{ draft: string, docType: { id: string, name: string, structureHint: string, fields: Array<{key: string, label: string, kind: string, question?: string}> } }} params
 * @returns {Array<{role: string, content: string}>}
 */
export function buildMessages({ draft, docType }) {
  const fieldsList = docType.fields
    .filter(f => f.kind === 'extract' || f.kind === 'derived')
    .map(f => `- ${f.key}: ${f.label}${f.kind === 'extract' ? ' (найди в тексте)' : ' (создай на основе текста)'}${f.question ? ' — ' + f.question : ''}`)
    .join('\n');

  const fieldKeyInstructions = buildFieldKeyInstructions(docType.id);

  // Sanitize template variable values to prevent injection via {{ }}
  const safeDocTypeName = docType.name.replace(/\{/g, '\\{');
  const safeStructureHint = docType.structureHint.replace(/\{/g, '\\{');

  const systemPrompt = getSystemPrompt()
    .replaceAll('{{docTypeName}}', safeDocTypeName)
    .replaceAll('{{docTypeId}}', docType.id)
    .replaceAll('{{structureHint}}', safeStructureHint)
    .replaceAll('{{fieldsList}}', fieldsList)
    .replaceAll('{{fieldKeyInstructions}}', fieldKeyInstructions);

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Черновик:\n<draft>\n${draft}\n</draft>` },
  ];
}
