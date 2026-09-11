import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { DomainError } from '../../core/errors.js';
import { decode } from '../../bot/payload.js';

const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'chat.html');
const COMMANDS = { '/start': 'start', 'начать': 'start', '/help': 'help', '/new': 'new', '/ai_fail': 'ai_fail' };

/**
 * Локальный стенд (LOCAL_CHAT=1): страница /dev/chat, имитирующая мессенджер, и её API.
 * Диалог, ИИ, реквизиты и DOCX — те же, что у MAX и ВК: события идут через общий диспетчер.
 * Без аутентификации — только для локальной разработки, в production не включать.
 */
export function createLocalChatRouter({ adapter, dispatcher, db, previewDir, samplesDir }) {
  const router = express.Router();
  let seq = 0;

  const peerOf = (value) => {
    const peer = String(value ?? '');
    if (!/^[\w-]{1,40}$/.test(peer)) throw new DomainError('BAD_PEER', 'Некорректный идентификатор пользователя', 400);
    return peer;
  };
  /** Имя из поля «Имя и фамилия» на странице стенда — как first_name/last_name в MAX. */
  const profileOf = (name) => {
    const [firstName, ...rest] = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    return firstName ? { firstName: firstName.slice(0, 60), lastName: rest.join(' ').slice(0, 60) || null } : undefined;
  };
  const handle = async (peer, event, name) => {
    const full = { platform: 'local', peerId: peer, userId: peer, eventId: `local:${Date.now()}:${++seq}`, meta: {}, profile: profileOf(name), ...event };
    const accepted = dispatcher.accept(full, full);
    if (accepted) await dispatcher.run(accepted, adapter);
  };

  router.get('/dev/chat', (req, res) => res.sendFile(PAGE));

  router.get('/dev/chat/api/messages', (req, res) => {
    const peer = peerOf(req.query.peer);
    const conv = dispatcher.getConversation('local', peer);
    const doc = conv?.documentId ? db.prepare('SELECT status, doc_type, template_id FROM documents WHERE id = ?').get(conv.documentId) : null;
    res.json({
      messages: adapter.messages(peer, Number(req.query.after) || 0),
      state: { state: conv?.state ?? 'idle', version: conv?.stateVersion ?? 0, document: doc },
    });
  });

  router.post('/dev/chat/api/send', async (req, res) => {
    const peer = peerOf(req.body?.peer);
    const text = String(req.body?.text ?? '').slice(0, 20000);
    adapter.pushUser(peer, text);
    const command = COMMANDS[text.trim().toLowerCase()];
    await handle(peer, command ? { kind: 'command', command, text } : { kind: 'text', text }, req.body?.name);
    res.json({ ok: true });
  });

  router.post('/dev/chat/api/press', async (req, res) => {
    const peer = peerOf(req.body?.peer);
    // Кнопки движка несут закодированную строку payload — как в реальных мессенджерах.
    const action = typeof req.body?.action === 'string' ? decode(req.body.action) : req.body?.action;
    if (!action || typeof action.a !== 'string') throw new DomainError('BAD_ACTION', 'Некорректное действие', 400);
    adapter.pushUser(peer, `▸ ${String(req.body?.label ?? action.a)}`);
    await handle(peer, { kind: 'action', action }, req.body?.name);
    res.json({ ok: true });
  });

  router.post('/dev/chat/api/fail-next-file', (req, res) => { adapter.armFileFailure(peerOf(req.body?.peer)); res.json({ ok: true }); });

  /** Журнал обработки текущего документа: промпт, сырой ответ ИИ, проверки реквизитов и фактов. */
  router.get('/dev/chat/api/log', (req, res) => {
    const conv = dispatcher.getConversation('local', peerOf(req.query.peer));
    if (!conv?.documentId) return res.json([]);
    res.json(db.prepare('SELECT stage, data, created_at FROM processing_log WHERE document_id = ? ORDER BY id').all(conv.documentId)
      .map((row) => ({ ...row, data: JSON.parse(row.data) })));
  });

  router.get('/dev/chat/api/samples', async (req, res) => {
    const names = (await fs.readdir(samplesDir).catch(() => [])).filter((name) => name.endsWith('.json')).sort();
    res.json(await Promise.all(names.map(async (name) => {
      const item = JSON.parse(await fs.readFile(path.join(samplesDir, name), 'utf8'));
      return { id: item.id, docType: item.docType, draft: item.draft };
    })));
  });

  router.get('/dev/chat/files/:id', (req, res) => {
    const file = db.prepare("SELECT files.* FROM files JOIN documents ON documents.id = files.document_id WHERE files.id = ? AND documents.owner_platform = 'local'").get(req.params.id);
    if (!file) throw new DomainError('NOT_FOUND', 'Файл не найден', 404);
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').attachment(file.filename).sendFile(path.resolve(file.path));
  });

  router.use('/dev/chat/previews', express.static(previewDir));
  return router;
}
