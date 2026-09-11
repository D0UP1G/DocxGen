import { payloadOf } from '../common/buttons.js';
import { splitText } from '../common/splitText.js';
export const MAX_TEXT_LIMIT = 4000;
export function keyboardAttachment(buttons) { return buttons?.length ? [{ type: 'inline_keyboard', payload: { buttons: buttons.map((row) => row.map((button) => ({ type: 'callback', text: button.label, payload: payloadOf(button) }))) } }] : []; }
export function toMessageBodies(reply) { const parts = splitText(reply.text, MAX_TEXT_LIMIT); return parts.map((text, index) => ({ text, ...(['html', 'markdown'].includes(reply.format) ? { format: reply.format } : {}), attachments: index === parts.length - 1 ? keyboardAttachment(reply.buttons) : [] })); }
