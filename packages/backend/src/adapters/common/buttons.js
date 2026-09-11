import { encode } from '../../bot/payload.js';

/**
 * Полезная нагрузка кнопки для платформы.
 * Клавиатуры диалогового движка (bot/keyboards.js) отдают уже закодированную строку,
 * но адаптер принимает и объект { a, v, r } — на случай ответов, собранных вручную.
 */
export const payloadOf = (button) => (typeof button.action === 'string' ? button.action : encode(button.action));
