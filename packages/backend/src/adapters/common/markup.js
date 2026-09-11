/**
 * Тексты ботов пишутся в HTML (жирный, курсив; значения экранированы в bot/texts.js).
 * MAX принимает разметку как есть (format: 'html' | 'markdown'); там, где разметки нет (ВК),
 * теги и markdown-символы убираются, а HTML-сущности раскрываются.
 */
export function htmlToPlain(html) {
  return String(html ?? '')
    .replace(/<\/?(?:b|i|u|s|code)>/g, '')
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
}

/** Текст ответа для платформы без разметки. */
export function markdownToPlain(text) {
  return String(text ?? '').replace(/\*\*(.+?)\*\*/gs, '$1').replace(/__(.+?)__/gs, '$1');
}

/** Текст ответа для платформы без разметки. */
export function plainText(reply) {
  if (reply.format === 'html') return htmlToPlain(reply.text);
  if (reply.format === 'markdown') return markdownToPlain(reply.text);
  return reply.text;
}
