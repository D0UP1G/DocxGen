/**
 * Bot text templates — all user-facing strings for the dialog engine.
 *
 * Every function returns a plain string (or a structured object for messages
 * that include buttons). Russian language only.
 *
 * Import and call the function at reply time — never pre-compute.
 */

// ── Greeting ─────────────────────────────────────────────────────────────────

/**
 * Welcome message shown on /start or first interaction.
 * @returns {{ text: string, buttons: string[][] }}
 */
export function greeting() {
  return {
    text: [
      'Здравствуйте! Я помогу оформить служебный документ за 3 шага:',
      '1) пришлите черновик,',
      '2) выберите тип и шаблон,',
      '3) получите готовый файл Word.',
      '',
      'Исправлю ошибки и стиль, но не добавлю сведений, которых нет в тексте.',
    ].join('\n'),
    buttons: [['Создать документ']],
  };
}

// ── Draft collection ─────────────────────────────────────────────────────────

/**
 * Step 1 prompt — ask for the draft text.
 * @returns {string}
 */
export function collectDraftStart() {
  return 'Шаг 1 из 3. Пришлите текст черновика — можно несколькими сообщениями. Когда закончите, нажмите «Продолжить».';
}

/**
 * Acknowledge draft received, show character count.
 * @param {number} charCount
 * @returns {{ text: string, buttons: string[][] }}
 */
export function collectDraftAccepted(charCount) {
  return {
    text: `Принято. В черновике ${charCount} символов.`,
    buttons: [
      ['Продолжить'],
      ['Показать черновик', 'Заменить текст'],
    ],
  };
}

// ── Document type selection ──────────────────────────────────────────────────

/**
 * Show available document types for selection.
 * @param {Array<{ id: string, name: string, hint: string }>} types
 * @returns {{ text: string, buttons: string[][] }}
 */
export function chooseType(types) {
  const lines = ['Шаг 2 из 3. Какой документ нужен?'];
  const buttons = [];
  for (const t of types) {
    lines.push(`• ${t.name} — ${t.hint}`);
    buttons.push([t.name]);
  }
  return { text: lines.join('\n'), buttons };
}

// ── Template selection ───────────────────────────────────────────────────────

/**
 * Show available templates for selection.
 * @param {Array<{ id: string, name: string, description: string }>} templates
 * @returns {{ text: string, buttons: string[][] }}
 */
export function chooseTemplate(templates) {
  const lines = [
    'Выберите оформление. Шаблон меняет только внешний вид, текст остаётся тем же.',
  ];
  const buttons = [];
  for (const t of templates) {
    lines.push(`• ${t.name} — ${t.description}`);
    buttons.push([t.name]);
  }
  return { text: lines.join('\n'), buttons };
}

// ── Processing ───────────────────────────────────────────────────────────────

/**
 * "Processing..." message shown while AI is working.
 * @returns {string}
 */
export function processing() {
  return 'Шаг 3 из 3. Исправляю текст и проверяю реквизиты. Обычно это занимает до минуты.';
}

// ── Result ───────────────────────────────────────────────────────────────────

/**
 * Show AI processing results — what was changed.
 * @param {string[]} changes  list of changes made by AI
 * @returns {string}
 */
export function result(changes) {
  if (!changes || changes.length === 0) {
    return 'Текст обработан. Исправлений не потребовалось.';
  }
  const items = changes.map((c) => `• ${c}`).join('\n');
  return `Текст обработан. Что изменено:\n${items}`;
}

// ── Field prompt ─────────────────────────────────────────────────────────────

/**
 * Ask the user for a missing required field.
 * @param {{ key: string, label: string, question: string, example?: string }} field
 * @param {number} index   1-based position in the queue
 * @param {number} total   total fields to ask
 * @returns {{ text: string, buttons: string[][] }}
 */
export function askField(field, index, total) {
  const lines = [
    `Не хватает реквизита (${index} из ${total}): ${field.label}.`,
    field.question,
  ];
  if (field.example) {
    lines.push(`Например: ${field.example}`);
  }
  lines.push('Если не заполнить, в документе будет пометка [' + field.label + '].');

  return {
    text: lines.join('\n'),
    buttons: [
      ['Оставить незаполненным'],
      ['Пропустить остальные'],
    ],
  };
}

// ── Document ready ───────────────────────────────────────────────────────────

/**
 * Final message — document is ready.
 * @param {string} typeName
 * @param {string} templateName
 * @param {string[]} placeholders  labels of unfilled fields (may be empty)
 * @param {{ requestedId: string, reason: string } | null} fallback  if fallback template was used
 * @returns {string}
 */
export function ready(typeName, templateName, placeholders = [], fallback = null) {
  const lines = [`Готово: ${typeName}, шаблон «${templateName}».`];

  if (placeholders.length > 0) {
    lines.push(`Незаполненные реквизиты выделены жёлтым: ${placeholders.join(', ')}.`);
  }

  if (fallback) {
    lines.push(`Шаблон «${fallback.requestedId}» недоступен, использован стандартный.`);
  }

  return lines.join('\n');
}

// ── Error messages ───────────────────────────────────────────────────────────

/**
 * AI unavailable error message.
 * @param {number} charCount  draft character count (reassurance that data is safe)
 * @returns {{ text: string, buttons: string[][] }}
 */
export function aiError(charCount = 0) {
  const lines = [
    'Не удалось обработать текст: сервис ИИ сейчас недоступен.',
  ];
  if (charCount > 0) {
    lines.push(`Ваш черновик сохранён (${charCount} символов) — ничего вводить заново не нужно.`);
  }
  return {
    text: lines.join('\n'),
    buttons: [
      ['Повторить'],
      ['Показать черновик', 'Новый документ'],
    ],
  };
}

/**
 * Delivery error — file ready but send failed.
 * @returns {{ text: string, buttons: string[][] }}
 */
export function deliveryError() {
  return {
    text: 'Файл готов, но отправить его не удалось. Нажмите «Отправить ещё раз» — документ не будет обрабатываться заново.',
    buttons: [['Отправить ещё раз']],
  };
}

/**
 * Stale button pressed — the state has moved on.
 * @returns {string}
 */
export function staleButton() {
  return 'Эта кнопка относится к предыдущему шагу.';
}

/**
 * Generic "busy" message — user sends text while processing.
 * @returns {string}
 */
export function busy() {
  return 'Обработка ещё идёт.';
}

/**
 * Fact warnings from AI processing.
 * @param {{ added?: string[], lost?: string[] }} warnings
 * @returns {string}
 */
export function factWarnings(warnings) {
  const lines = ['Проверьте результат:'];
  if (warnings.added?.length) {
    lines.push(
      `В исправленном тексте есть сведения, которых нет в черновике: ${warnings.added.join(', ')}.`,
    );
  }
  if (warnings.lost?.length) {
    lines.push(
      `Не найдены сведения из черновика: ${warnings.lost.join(', ')}.`,
    );
  }
  return lines.join('\n');
}
