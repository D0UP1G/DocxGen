import { DeliveryError } from '../../core/errors.js';

/**
 * Адаптер локального стенда: вместо отправки в мессенджер складывает ответы бота в память,
 * откуда их забирает страница /dev/chat. Диалог, ИИ, реквизиты и DOCX — те же, что у MAX и ВК.
 */
export function createLocalChatAdapter({ files }) {
  const chats = new Map();
  const failNextFile = new Set();
  let seq = 0;
  const push = (peerId, message) => {
    const list = chats.get(peerId) ?? [];
    list.push({ id: ++seq, at: new Date().toISOString(), ...message });
    chats.set(peerId, list.slice(-500));
  };

  return {
    platform: 'local',
    pushUser(peerId, text) { push(peerId, { from: 'user', text }); },
    messages(peerId, after = 0) { return (chats.get(peerId) ?? []).filter((message) => message.id > after); },
    reset(peerId) { chats.delete(peerId); },
    /** Имитация сбоя отправки DOCX для проверки кнопки «Отправить ещё раз». */
    armFileFailure(peerId) { failNextFile.add(peerId); },
    async send(peerId, replies) {
      for (const reply of replies) {
        if (reply.file) {
          const file = files.get(reply.file.fileId);
          if (!file || failNextFile.delete(peerId)) throw new DeliveryError(reply.file.fileId, new Error(file ? 'имитация сбоя отправки' : 'файл не найден'));
          push(peerId, { from: 'bot', text: reply.file.caption, html: reply.format === 'html', buttons: reply.buttons, file: { id: file.id, name: file.filename, url: `/dev/chat/files/${file.id}` } });
        } else {
          push(peerId, { from: 'bot', text: reply.text, html: reply.format === 'html', buttons: reply.buttons, ...(reply.image ? { image: `/dev/chat/previews/${reply.image.templateId}.png` } : {}) });
        }
      }
    },
  };
}
