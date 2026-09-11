import fs from 'node:fs/promises';
import path from 'node:path';
import { createPeerQueue } from '../common/peerQueue.js';
import { deliverFile } from '../../core/deliveries.js';
import { randomIdFor } from './randomId.js';
import { toKeyboard, toSendParams } from './render.js';
import { plainText } from '../common/markup.js';

export function createVkAdapter({ db, client, files, log = console, previewRoot = path.resolve('config/templates'), retryDelaysMs } = {}) {
  const queue = createPeerQueue({ intervalMs: 350 });
  async function preview(peerId, templateId) { const cached = db.prepare('SELECT attachment FROM template_assets WHERE platform=? AND template_id=?').get('vk', templateId)?.attachment; if (cached) return cached; try { const name = templateId === 'modern' ? 'previews/modern.png' : 'previews/classic.png'; const attachment = await client.uploadPhoto(peerId, await fs.readFile(path.join(previewRoot, name))); db.prepare('INSERT OR REPLACE INTO template_assets(platform, template_id, attachment) VALUES (?, ?, ?)').run('vk', templateId, attachment); return attachment; } catch (err) { log.warn?.({ err, templateId }, 'vk preview unavailable'); return null; } }
  async function sendFile(peerId, reply, event) { const file = files.get(reply.file.fileId); if (!file) throw new Error('Файл не найден'); return deliverFile(db, { platform: 'vk', peerId, fileId: file.id, triggerEventId: event.eventId, log, upload: async () => client.uploadDoc(peerId, await fs.readFile(file.path), file.filename), send: (attachment, deliveryKey) => sendWithRetry(() => client.sendMessage({ peerId, randomId: randomIdFor(deliveryKey), message: plainText({ text: reply.file.caption, format: reply.format }), attachment, keyboard: toKeyboard(reply.buttons) }), client, retryDelaysMs) }); }
  async function sendWithRetry(task, api, delays = [1000, 2000, 4000]) { for (let i = 0; ; i += 1) try { return await task(); } catch (err) { if (!api.isRetryable?.(err) || i >= delays.length) throw err; await new Promise((resolve) => setTimeout(resolve, delays[i])); } }
  /** ВК не присылает имя в событии сообщения — берём его один раз через users.get (ключ сообщества это позволяет). */
  async function getProfile(userId) {
    const [user] = await client.api.users.get({ user_ids: [Number(userId)] });
    return user?.first_name ? { firstName: user.first_name, lastName: user.last_name ?? null } : null;
  }
  return { platform: 'vk', getProfile, async send(peerId, replies, { event } = {}) { for (const [replyIndex, reply] of replies.entries()) await queue.enqueue(peerId, async () => { if (reply.file) return sendFile(peerId, reply, event); let attachment = reply.image ? await preview(peerId, reply.image.templateId) : undefined; for (const [partIndex, params] of toSendParams(reply, { inlineKeyboard: event?.meta?.inlineKeyboard !== false, seed: `${event?.eventId ?? 'system'}:${replyIndex}` }).entries()) await sendWithRetry(() => client.sendMessage({ peerId, ...params, attachment: partIndex === 0 ? attachment : undefined }), client, retryDelaysMs); }); }, preview };
}
