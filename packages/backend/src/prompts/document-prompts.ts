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
  const typeName = typeNames[documentType] || 'Служебная записка';
  
  // Document type specific instructions
  const typeInstructions: Record<string, string> = {
    sluzhebnaya: `СЛУЖЕБНАЯ ЗАПИСКА — внутренний документ организации.
Структура:
- Заголовок (тема)
- Обращение (если есть)
- Основной текст: суть вопроса, факты, предложения
- Заключение (краткое)
- Подпись

Стиль: краткий, деловой, без излишней формальности.`,
    
    dokladnaya: `ДОКЛАДНАЯ ЗАПИСКА — формальный отчёт руководителю.
Структура:
- Заголовок (тема)
- Введение (кто, когда, где проверял)
- Основная часть (факты, данные, нарушения)
- Выводы и предложения
- Подпись

Стиль: формальный, детальный, с конкретными фактами.`,
    
    informacionnaya: `ИНФОРМАЦИОННАЯ СПРАВКА — документ с фактами и анализом.
Структура:
- Заголовок (тема)
- Введение (контекст, период, объект)
- Факты (данные, статистика, события)
- Анализ (причины, последствия)
- Заключение (рекомендации)
- Подпись

Стиль: объективный, информативный, без эмоций.`,
    
    pismo: `ПИСЬМО — внешняя корреспонденция.
Структура:
- Обращение (Уважаемый/ая...)
- Введение (кто пишет, цель)
- Основная часть (суть предложения/запроса)
- Заключение (ожидания, контактная информация)
- Подпись

Стиль: формальный, но с элементами вежливости.`,
  };

  return `Ты — ИИ-ассистент для подготовки служебных документов. Проанализируй текст ниже и верни JSON.

Тип документа: ${typeName}

${typeInstructions[documentType] || typeInstructions.sluzhebnaya}

ЗАДАЧА:
1. Исправь орфографические, пунктуационные и грамматические ошибки
2. Приведи формулировки к официально-деловому стилю
3. Извлеки реквизиты: Кому, От кого, Дата, Тема, Номер
4. Организуй текст ПО СТРУКТУРЕ ТИПА ДОКУМЕНТА
5. НЕ добавляй факты, даты, фамилии которых нет в исходном тексте
6. Если реквизит отсутствует — поставь пустую строку ""

КРИТИЧЕСКИ ВАЖНО:
1. correctedText должен быть ЧИСТЫМ текстом — только слова и абзацы
2. НЕ добавляй никакой разметки: никаких таблиц, списков, заголовков, выделений
3. НЕ используй символы форматирования: *, #, -, |, >, `
4. ТОЛЬКО plain text с абзацами (разделёнными пустыми строками)
5. Шаблон сам отформатирует документ — твоя задача только текст

ПРИМЕРЫ ДЛЯ КАЖДОГО ТИПА:

--- СЛУЖЕБНАЯ ЗАПИСКА ---
"Довожу до Вашего сведения, что в ходе проверки складского помещения 15.03.2025 были выявлены нарушения условий хранения.

На основании изложенного предлагаю:
1. Устранить выявленные нарушения в срок до 01.04.2025
2. Провести дополнительный инструктаж для сотрудников склада"

--- ДОКЛАДНАЯ ЗАПИСКА ---
"Докладываю, что с 10 по 13 марта 2025 года проведена проверка склада по адресу: г. Москва, ул. Складская, д. 15.

Выявлены следующие нарушения: температура выше нормы на 4 градуса, на стеллажах коррозия, вентиляция работает с перебоями.

Данные нарушения могут привести к порче товара. Предлагаю отремонтировать вентиляцию и заменить стеллажи до 01.04.2025."

--- ИНФОРМАЦИОННАЯ СПРАВКА ---
"В период с 10 по 13 марта 2025 года проведена проверка складского помещения по адресу: г. Москва, ул. Складская, д. 15.

В ходе проверки установлено: температура воздуха превышает норму на 4 градуса, на металлоконструкциях стеллажей обнаружена коррозия, система вентиляции работает с перебоями.

Указанные нарушения могут привести к порче хранящихся товарных запасов. Для устранения выявленных недостатков необходимо провести ремонт вентиляционной системы и замену повреждённых стеллажей."

--- ПИСЬМО ---
"Уважаемый Фёдор Фёдорович!

ООО «Ромашка» рассматривает возможность заключения договора поставки офисной мебели. Просим предоставить коммерческое предложение на 50 столов и 100 стульев с указанием сроков и условий оплаты.

Ответ просим направить до 25.03.2025 на office@romashka.example.

Надеемся на сотрудничество."

ФОРМАТ ОТВЕТА — ТОЛЬКО JSON (без markdown, без комментариев):
{
  "correctedText": "Исправленный и отформатированный текст по структуре типа документа. Абзацы разделены переносами строк.",
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
