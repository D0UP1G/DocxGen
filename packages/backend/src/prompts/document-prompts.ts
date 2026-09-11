/**
 * AI prompt templates for document generation and error fixing.
 *
 * Single source of truth: every prompt used by the AI service lives here.
 * When tweaking wording, model instructions, or output format — edit this file.
 */

/**
 * Main prompt for document analysis and generation.
 *
 * Instructs the AI to:
 * - Fix spelling, punctuation, grammar
 * - Rewrite in official-business style
 * - Extract requisites (to, from, date, subject, number)
 * - Return structured JSON
 *
 * @param userText - The raw text submitted by the user
 * @param documentType - Document type key (e.g. "sluzhebnaya")
 * @param typeNames - Mapping from document keys to display names in Russian
 * @returns The complete prompt string
 */
export function getMainPrompt(
  userText: string,
  documentType: string,
  typeNames: Record<string, string>,
): string {
  return `Ты — ИИ-ассистент для подготовки служебных документов. Проанализируй текст ниже и верни JSON.

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
}

/**
 * Fix prompt for Typst compilation errors.
 *
 * Sends the broken section ± context lines to the AI,
 * which returns ONLY the corrected Typst fragment.
 *
 * @param errorLine - The line number where the error occurred
 * @param compileError - The full error message from Typst
 * @param broken - The broken section of Typst content with surrounding context
 * @param startLine - The line number where the broken section starts
 * @returns The complete prompt string
 */
export function getFixPrompt(
  errorLine: number,
  compileError: string,
  broken: string,
  startLine: number,
): string {
  return `You are fixing a Typst compilation error. The error occurred at line ${errorLine}.

Error message:
${compileError}

Context around the error (lines ${startLine}–${startLine + broken.split('\n').length - 1}):
\`\`\`typst
${broken}
\`\`\`

Fix ONLY this fragment. Return ONLY the corrected Typst fragment — no comments, no markdown fences, no explanations. Just clean Typst.`;
}
