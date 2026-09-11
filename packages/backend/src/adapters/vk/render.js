import { payloadOf } from '../common/buttons.js';
import { splitText } from '../common/splitText.js';
import { randomIdFor } from './randomId.js';
import { plainText } from '../common/markup.js';
export const VK_TEXT_LIMIT = 4000;
const COLOR = { primary: 'primary', secondary: 'secondary', negative: 'negative' };
export function toKeyboard(buttons) { if (!buttons?.length) return undefined; return JSON.stringify({ inline: true, buttons: buttons.map((row) => row.map((button) => ({ action: { type: 'text', label: button.label.slice(0, 40), payload: payloadOf(button) }, color: COLOR[button.style] ?? 'secondary' }))) }); }
export function buttonsAsText(buttons) { return buttons.flat().map((button, index) => `${index + 1} — ${button.label}`).join('\n'); }
// В ВК сообщения без разметки: HTML-теги из bot/texts.js убираются.
export function toSendParams(reply, { inlineKeyboard = true, seed = 'message' } = {}) { const base = plainText(reply); const text = inlineKeyboard || !reply.buttons?.length ? base : `${base}\n\n${buttonsAsText(reply.buttons)}`; const parts = splitText(text, VK_TEXT_LIMIT); return parts.map((message, index) => ({ message, keyboard: inlineKeyboard && index === parts.length - 1 ? toKeyboard(reply.buttons) : undefined, randomId: randomIdFor(`${seed}:${index}`) })); }
