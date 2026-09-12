import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createApp } from '../../src/app.js';
import { createDocumentService } from '../../src/core/documentService.js';
import { createQueue } from '../../src/jobs/queue.js';

/**
 * Делегирование владельца между сервисами.
 *
 * Заголовки X-Owner-Platform / X-Owner-Id решают, чьи документы вернёт сервис,
 * поэтому принимать их можно только от своих — после сверки X-API-Key.
 * Раньше они принимались безусловно: два заголовка давали доступ к документам
 * любого пользователя.
 */

const API_KEY = 'test-key-0123456789';

function createTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-headers-test-'));
  const db = new Database(path.join(tmpDir, 'test.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(
    path.resolve(import.meta.dirname, '../../src/db/migrations/001_init.sql'),
    'utf8',
  ));
  return { db, tmpDir };
}

const docTypes = {
  get: (id) => (id === 'memo'
    ? { id: 'memo', name: 'Служебная записка', hint: 'memo', docTitle: null, layout: ['body'], structureHint: 'test', fields: [] }
    : null),
  list: () => [],
};
const templates = { get: () => ({ template: null, fallback: null }), list: () => [] };

describe('владелец из заголовков', () => {
  let app;
  let db;
  let tmpDir;

  beforeAll(() => {
    ({ db, tmpDir } = createTestDb());
    const log = pino({ level: 'silent' });
    const documentService = createDocumentService({
      db,
      queue: createQueue(db),
      fileStorage: { save: () => ({ path: '' }) },
      docTypes,
      templates,
      renderDocx: async () => Buffer.alloc(0),
      log,
    });
    app = createApp({
      log,
      deps: { documentService, docTypes, templates, db, log, apiKey: API_KEY, routers: [] },
    });
  });

  afterAll(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('без ключа заголовки владельца отклоняются (браузер не может выдать себя за другого)', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('X-Owner-Platform', 'max')
      .set('X-Owner-Id', '167298982')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('с ключом, но чужой платформой — отказ', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('X-API-Key', API_KEY)
      .set('X-Owner-Platform', 'web')
      .set('X-Owner-Id', 'someone-elses-session')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('с неверным ключом заголовки не принимаются', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('X-API-Key', 'wrong-key-0123456789')
      .set('X-Owner-Platform', 'max')
      .set('X-Owner-Id', '167298982')
      .send({});

    expect(res.status).toBe(401);
  });

  it('с верным ключом бот действует от имени пользователя', async () => {
    const created = await request(app)
      .post('/api/documents')
      .set('X-API-Key', API_KEY)
      .set('X-Owner-Platform', 'max')
      .set('X-Owner-Id', '167298982')
      .send({ docType: 'memo' });

    expect(created.status).toBe(201);

    const read = await request(app)
      .get(`/api/documents/${created.body.id}`)
      .set('X-API-Key', API_KEY)
      .set('X-Owner-Platform', 'max')
      .set('X-Owner-Id', '167298982');

    expect(read.status).toBe(200);
    expect(read.body.id).toBe(created.body.id);
  });

  it('чужой документ не достаётся другому владельцу той же платформы', async () => {
    const created = await request(app)
      .post('/api/documents')
      .set('X-API-Key', API_KEY)
      .set('X-Owner-Platform', 'max')
      .set('X-Owner-Id', 'owner-a')
      .send({ docType: 'memo' });

    const stolen = await request(app)
      .get(`/api/documents/${created.body.id}`)
      .set('X-API-Key', API_KEY)
      .set('X-Owner-Platform', 'max')
      .set('X-Owner-Id', 'owner-b');

    expect(stolen.status).toBe(404);
  });

  it('веб-клиент без ключа и без заголовков работает по cookie сессии', async () => {
    // Браузеру ключ взять негде: он ходит от своего имени, владелец — значение cookie.
    const agent = request.agent(app);

    const created = await agent.post('/api/documents').send({ docType: 'memo' });
    expect(created.status).toBe(201);

    const read = await agent.get(`/api/documents/${created.body.id}`);
    expect(read.status).toBe(200);
  });

  it('чужая веб-сессия не видит документ даже без заголовков', async () => {
    const owner = request.agent(app);
    const stranger = request.agent(app);

    const created = await owner.post('/api/documents').send({ docType: 'memo' });
    const stolen = await stranger.get(`/api/documents/${created.body.id}`);

    expect(stolen.status).toBe(404);
  });
});
