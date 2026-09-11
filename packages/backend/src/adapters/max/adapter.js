import fs from 'node:fs/promises';
import path from 'node:path';
import { createPeerQueue } from '../common/peerQueue.js';
import { deliverFile } from '../../core/deliveries.js';
import { keyboardAttachment, toMessageBodies } from './render.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const tokenFromUpload = ({ slot, uploaded }) => uploaded?.token ?? slot?.token ?? uploaded?.photos?.[0]?.token ?? uploaded?.photos?.[0] ?? null;
const retry = async (task, shouldRetry, delays = [1000, 2000, 4000]) => { for (let i = 0; ; i += 1) try { return await task(); } catch (err) { if (!shouldRetry(err) || i >= delays.length) throw err; await new Promise((resolve) => setTimeout(resolve, delays[i])); } };

export function createMaxAdapter({ db, client, files, log = console, previewRoot = path.resolve('config/templates') , retryDelaysMs } = {}) {
  const queue = createPeerQueue({ intervalMs: 600 });
  async function previewAttachment(templateId) {
    const cached = db.prepare('SELECT attachment FROM template_assets WHERE platform=? AND template_id=?').get('max', templateId)?.attachment; if (cached) return [{ type: 'image', payload: { token: cached } }];
    const template = templateId === 'modern' ? 'previews/modern.png' : 'previews/classic.png';
    try { const upload = await client.upload('image', await fs.readFile(path.join(previewRoot, template)), `${templateId}.png`, 'image/png'); const token = tokenFromUpload(upload); if (!token) return []; db.prepare('INSERT OR REPLACE INTO template_assets(platform, template_id, attachment) VALUES (?, ?, ?)').run('max', templateId, token); return [{ type: 'image', payload: { token } }]; } catch (err) { log.warn?.({ err, templateId }, 'max preview unavailable'); return []; }
  }
  async function sendFile(peerId, reply, event) { const file = files.get(reply.file.fileId); if (!file) throw new Error('Файл не найден'); return deliverFile(db, { platform: 'max', peerId, fileId: file.id, triggerEventId: event.eventId, log, upload: async () => { const result = await client.upload('file', await fs.readFile(file.path), file.filename, DOCX); const token = tokenFromUpload(result); if (!token) throw new Error('MAX не вернул токен файла'); return token; }, send: async (token) => retry(() => client.sendMessage(peerId, { text: reply.file.caption, ...(reply.format ? { format: reply.format } : {}), attachments: [{ type: 'file', payload: { token } }, ...keyboardAttachment(reply.buttons)] }), (err) => err.code === 'attachment.not.ready', retryDelaysMs ?? [1000, 2000, 4000, 8000, 16000]) }); }
  /**
   * Ответ на нажатие: исходное сообщение получает отметку «✓ …» и теряет клавиатуру, чтобы старые кнопки не мешали.
   * Пустой attachments в MAX удаляет все вложения сообщения, поэтому файл или картинку переносим по токену,
   * а если токена нет — сообщение не редактируем и показываем только уведомление (файл остаётся в переписке).
   */
  async function answerCallback(event) {
    const label = event.meta?.label ?? 'Выбрано';
    const kept = (event.meta?.attachments ?? []).filter((attachment) => attachment?.type !== 'inline_keyboard');
    const body = kept.every((attachment) => attachment.payload?.token)
      ? { message: { text: `${event.meta?.text ?? ''}\n\n✓ ${label}`, attachments: kept.map((attachment) => ({ type: attachment.type, payload: { token: attachment.payload.token } })) } }
      : { notification: `✓ ${label}` };
    try { await client.answerCallback(event.callbackId, body); } catch (err) { log.warn?.({ err }, 'max callback answer failed'); }
  }
  return { platform: 'max', async send(peerId, replies, { event } = {}) { if (event?.kind === 'action' && event.callbackId && !event.meta?.answered) { event.meta = { ...event.meta, answered: true }; await answerCallback(event); }
    for (const [replyIndex, reply] of replies.entries()) await queue.enqueue(peerId, async () => { if (reply.file) return sendFile(peerId, reply, event); let bodies = toMessageBodies(reply); if (reply.image) bodies[0].attachments = [...(await previewAttachment(reply.image.templateId)), ...(bodies[0].attachments ?? [])]; for (const body of bodies) await retry(() => client.sendMessage(peerId, body), (err) => err.status === 429 || err.status >= 500, retryDelaysMs ?? [1000, 2000, 4000]); return replyIndex; }); }, previewAttachment };
}
