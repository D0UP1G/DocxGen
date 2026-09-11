/**
 * Unit tests for the dialog flow handler (state machine).
 *
 * Uses mock documentService, docTypes, and templates — no real DB, no real AI.
 * Tests cover the full dialog path, state transitions, button actions, and
 * edge cases specified in plan-backend.md §11.1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFlow } from '../../src/bot/flow.js';
import { encode } from '../../src/bot/payload.js';

// ── Mock data ────────────────────────────────────────────────────────────

const mockDocTypes = [
  { id: 'memo', name: 'Служебная записка', hint: 'Для внутренних обращений', fields: [
    { key: 'addressee', label: 'Адресат', kind: 'extract', required: true, question: 'Кому адресовано?', example: 'Директору Иванову И.И.' },
    { key: 'authorPosition', label: 'Должность автора', kind: 'extract', required: true, question: 'Какая ваша должность?', example: 'Начальник отдела' },
    { key: 'authorName', label: 'ФИО автора', kind: 'extract', required: true, question: 'Ваши ФИО?', example: 'Петров П.П.' },
  ]},
  { id: 'report', name: 'Докладная записка', hint: 'Для докладов руководству', fields: [
    { key: 'addressee', label: 'Адресат', kind: 'extract', required: true, question: 'Кому адресовано?', example: 'Директору' },
  ]},
];

const mockTemplates = [
  { id: 'classic', name: 'Классический', description: 'Стандартное оформление', organization: { name: 'ООО Рога и Копыта' }, autoFill: { date: true }, dateFormat: 'DD.MM.YYYY' },
  { id: 'modern', name: 'Современный', description: 'С включённым стилем', organization: { name: 'ООО Рога и Копыта' }, autoFill: { date: true }, dateFormat: 'DD.MM.YYYY' },
];

function mockDocTypesService() {
  return {
    list: () => mockDocTypes,
    get: (id) => mockDocTypes.find(t => t.id === id) || null,
  };
}

function mockTemplatesService() {
  return {
    list: () => mockTemplates,
    get: (id) => {
      const t = mockTemplates.find(t => t.id === id);
      return t ? { template: t, fallback: null } : { template: mockTemplates[0], fallback: { requestedId: id, reason: 'missing' } };
    },
  };
}

function mockDocumentService() {
  let docCounter = 0;
  const docs = new Map();

  return {
    create: vi.fn((owner) => {
      const id = `doc-${++docCounter}`;
      docs.set(id, {
        id, owner_platform: owner.platform, owner_id: owner.id,
        status: 'draft', doc_type: null, template_id: null,
        source_text: '', draft_version: 0, user_fields: '{}',
        current_version_id: null, last_error: null,
      });
      return { id, status: 'draft', docType: null, templateId: null, sourceText: '', draftVersion: 0, userFields: {}, version: null, error: null };
    }),
    get: vi.fn((owner, id) => {
      const doc = docs.get(id);
      if (!doc) return null;
      const uf = JSON.parse(doc.user_fields || '{}');
      let version = null;
      if (doc.current_version_id) {
        const parsed = JSON.parse(doc.current_version_id);
        version = { ...parsed, stale: parsed.draftVersion !== doc.draft_version };
      }
      return {
        id: doc.id, status: doc.status, docType: doc.doc_type, templateId: doc.template_id,
        sourceText: doc.source_text, draftVersion: doc.draft_version, userFields: uf,
        version,
        error: doc.last_error,
      };
    }),
    setDraft: vi.fn((owner, id, text, { mode } = {}) => {
      const doc = docs.get(id);
      if (mode === 'replace') {
        doc.source_text = text;
      } else {
        doc.source_text = doc.source_text ? doc.source_text + '\n' + text : text;
      }
      doc.draft_version++;
      return docs.get(id);
    }),
    setType: vi.fn((owner, id, typeId) => {
      const doc = docs.get(id);
      doc.doc_type = typeId;
      return doc;
    }),
    setTemplate: vi.fn((owner, id, templateId) => {
      const doc = docs.get(id);
      doc.template_id = templateId;
      return doc;
    }),
    startProcessing: vi.fn((owner, id) => {
      const doc = docs.get(id);
      doc.status = 'processing';
      return { job: { id: 'job-1' }, reused: false };
    }),
    retryProcessing: vi.fn((owner, id) => {
      const doc = docs.get(id);
      doc.status = 'processing';
      return { job: { id: 'job-2' }, reused: false };
    }),
    setField: vi.fn((owner, id, key, value) => {
      const doc = docs.get(id);
      const fields = JSON.parse(doc.user_fields || '{}');
      fields[key] = value;
      doc.user_fields = JSON.stringify(fields);
      return doc;
    }),
    setManualText: vi.fn((owner, id, { title, body }) => {
      const doc = docs.get(id);
      doc.status = 'processed';
      doc.current_version_id = JSON.stringify({ kind: 'manual', title, body: JSON.stringify(body), aiFields: {}, changes: [], warnings: [], stale: false });
      return doc;
    }),
    render: vi.fn(async (owner, id) => {
      return {
        file: { id: 'file-1', filename: 'test.docx' },
        fallback: null,
        placeholders: [],
      };
    }),
    _docs: docs,
  };
}

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// ── Helpers ──────────────────────────────────────────────────────────────

function makeEvent(overrides = {}) {
  return {
    platform: 'max',
    userId: 'user-1',
    peerId: 'peer-1',
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'text',
    text: '',
    ...overrides,
  };
}

function actionEvent(action, overrides = {}) {
  return makeEvent({ kind: 'action', action, ...overrides });
}

function commandEvent(cmd = 'start') {
  return makeEvent({ kind: 'command', command: cmd });
}

function makeConversation(overrides = {}) {
  return {
    platform: 'max',
    peerId: 'peer-1',
    state: 'idle',
    stateVersion: 0,
    documentId: null,
    pendingField: null,
    pendingQueue: [],
    ctx: {},
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('flow', () => {
  let flow;
  let docService;

  beforeEach(() => {
    docService = mockDocumentService();
    flow = createFlow({
      documentService: docService,
      docTypes: mockDocTypesService(),
      templates: mockTemplatesService(),
      log: mockLog,
    });
  });

  // ── 1. Full path: idle → collecting → choose_type → choose_template → processing → ready

  it('full path: idle → collecting → choose_type → choose_template → processing → ready', async () => {
    const conv = makeConversation();

    // Start from idle with /start
    const r1 = await flow.handle(conv, commandEvent('start'));
    expect(r1[0].text).toContain('Здравствуйте');
    expect(r1[0].buttons).toBeDefined();

    // User sends text → creates doc, moves to collecting
    const r2 = await flow.handle(conv, makeEvent({ text: 'Текст черновика' }));
    expect(conv.state).toBe('collecting');
    expect(conv.documentId).toBeTruthy();
    expect(docService.setDraft).toHaveBeenCalled();

    // Click "Продолжить" → choose_type
    const r3 = await flow.handle(conv, actionEvent({ a: 'continue', r: conv.stateVersion }));
    expect(conv.state).toBe('choose_type');
    expect(r3[0].buttons).toBeDefined();

    // Select type → choose_template
    const r4 = await flow.handle(conv, actionEvent({ a: 'set_type', v: 'memo', r: conv.stateVersion }));
    expect(conv.state).toBe('choose_template');
    expect(docService.setType).toHaveBeenCalled();

    // Select template → processing
    const r5 = await flow.handle(conv, actionEvent({ a: 'set_template', v: 'classic', r: conv.stateVersion }));
    expect(conv.state).toBe('processing');
    expect(docService.startProcessing).toHaveBeenCalled();
    expect(r5[0].text).toContain('Исправляю текст');
  });

  // ── 2. Two text messages appended in collecting

  it('two text messages appended in collecting', async () => {
    const conv = makeConversation({ state: 'collecting', documentId: 'doc-1' });
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: '', draft_version: 0, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    await flow.handle(conv, makeEvent({ text: 'Первая часть' }));
    expect(docService.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'max' }),
      'doc-1', 'Первая часть', { mode: 'append' }
    );

    await flow.handle(conv, makeEvent({ text: 'Вторая часть' }));
    expect(docService.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'max' }),
      'doc-1', 'Вторая часть', { mode: 'append' }
    );
  });

  // ── 3. "Назад" at each step

  it('"Назад" from choose_type returns to collecting', async () => {
    const conv = makeConversation({ state: 'choose_type', documentId: 'doc-1', stateVersion: 2 });
    const r = await flow.handle(conv, actionEvent({ a: 'back', r: conv.stateVersion }));
    expect(conv.state).toBe('collecting');
    expect(r[0].buttons).toBeDefined();
  });

  it('"Назад" from choose_template returns to choose_type', async () => {
    const conv = makeConversation({ state: 'choose_template', documentId: 'doc-1', stateVersion: 3 });
    const r = await flow.handle(conv, actionEvent({ a: 'back', r: conv.stateVersion }));
    expect(conv.state).toBe('choose_type');
    expect(r[0].buttons).toBeDefined();
  });

  // ── 4. Stale button (wrong state_version) → handled by dispatcher, not flow
  // The flow itself doesn't check stateVersion — that's the dispatcher's job.
  // The flow processes the action normally regardless of r value.

  it('flow processes action regardless of stateVersion (stale check is in dispatcher)', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: 'Some text', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });
    const conv = makeConversation({ state: 'collecting', documentId: 'doc-1', stateVersion: 5 });
    // Send action with wrong stateVersion — flow still processes it
    const r = await flow.handle(conv, actionEvent({ a: 'continue', r: 3 }));
    // Flow processes the action (stateVersion check is dispatcher's job)
    expect(conv.state).toBe('choose_type');
  });

  // ── 5. Input during processing → "wait" message

  it('input during processing returns busy message', async () => {
    const conv = makeConversation({ state: 'processing' });
    const r = await flow.handle(conv, makeEvent({ text: 'Привет' }));
    expect(r[0].text).toContain('Обработка ещё идёт');
  });

  // ── 6. AI failure → retry → new job

  it('AI failure → retry triggers retryProcessing', async () => {
    const conv = makeConversation({ state: 'ai_failed', documentId: 'doc-1', stateVersion: 3 });

    // Set up doc with failed status
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'ai_failed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: 'AI error',
    });

    const r = await flow.handle(conv, actionEvent({ a: 'retry', r: conv.stateVersion }));
    expect(conv.state).toBe('processing');
    expect(docService.retryProcessing).toHaveBeenCalled();
  });

  // ── 7. "Другой шаблон" doesn't trigger startProcessing

  it('"Другой шабloon" from ready goes to choose_template without processing', async () => {
    const conv = makeConversation({ state: 'ready', documentId: 'doc-1', stateVersion: 5 });
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: '{"kind":"ai","title":null,"body":[],"aiFields":{},"changes":[],"warnings":[],"stale":false}',
      last_error: null,
    });

    const r = await flow.handle(conv, actionEvent({ a: 'other_template', r: conv.stateVersion }));
    expect(conv.state).toBe('choose_template');
    expect(docService.startProcessing).not.toHaveBeenCalled();
    expect(r[0].buttons).toBeDefined();
  });

  // ── 8. "Другой тип" triggers re-processing

  it('"Другой тип" from ready goes to choose_type', async () => {
    const conv = makeConversation({ state: 'ready', documentId: 'doc-1', stateVersion: 5 });
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: '{"kind":"ai","title":null,"body":[],"aiFields":{},"changes":[],"warnings":[],"stale":false}',
      last_error: null,
    });

    const r = await flow.handle(conv, actionEvent({ a: 'other_type', r: conv.stateVersion }));
    expect(conv.state).toBe('choose_type');
    expect(r[0].buttons).toBeDefined();
  });

  // ── 9. "Оставить незаполненным" → setField(key, null)

  it('"Оставить незаполненным" sets field to null', async () => {
    const conv = makeConversation({
      state: 'asking_field', documentId: 'doc-1', stateVersion: 4,
      pendingField: 'addressee',
    });
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    // Mock _nextField to return empty (no more fields)
    docService.get = vi.fn(() => ({
      id: 'doc-1', status: 'processed', docType: 'memo', templateId: 'classic',
      sourceText: 'Текст', draftVersion: 1, userFields: { addressee: null },
      version: { aiFields: {}, title: null, stale: false },
    }));

    await flow.handle(conv, actionEvent({ a: 'skip_field', r: conv.stateVersion }));
    expect(docService.setField).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'max' }),
      'doc-1', 'addressee', null
    );
  });

  // ── 10. "Показать черновик" → shows text

  it('"Показать черновик" shows draft text', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: 'Это черновик документа', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    const conv = makeConversation({ state: 'collecting', documentId: 'doc-1', stateVersion: 1 });
    const r = await flow.handle(conv, actionEvent({ a: 'show_draft', r: conv.stateVersion }));
    expect(r[0].text).toContain('Черновик');
    expect(r[0].text).toContain('Это черновик документа');
  });

  // ── 11. "Заменить текст" → next message replaces

  it('"Заменить текст" then next message uses replace mode', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: 'Старый текст', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    const conv = makeConversation({ state: 'collecting', documentId: 'doc-1', stateVersion: 1 });

    // Click "Заменить текст"
    await flow.handle(conv, actionEvent({ a: 'replace_mode', r: conv.stateVersion }));
    expect(conv.ctx.inputMode).toBe('replace');

    // Send new text
    await flow.handle(conv, makeEvent({ text: 'Новый текст' }));
    expect(docService.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'max' }),
      'doc-1', 'Новый текст', { mode: 'replace' }
    );
    // Should reset to append after replace
    expect(conv.ctx.inputMode).toBe('append');
  });

  // ── Additional tests

  it('idle + text creates document and moves to collecting', async () => {
    const conv = makeConversation();
    const r = await flow.handle(conv, makeEvent({ text: 'Мой черновик' }));
    expect(conv.state).toBe('collecting');
    expect(conv.documentId).toBeTruthy();
    expect(docService.create).toHaveBeenCalled();
    expect(docService.setDraft).toHaveBeenCalled();
    expect(r[0].text).toContain('Принято');
  });

  it('collecting + continue with empty draft returns error', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: '', draft_version: 0, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    const conv = makeConversation({ state: 'collecting', documentId: 'doc-1' });
    const r = await flow.handle(conv, actionEvent({ a: 'continue', r: conv.stateVersion }));
    expect(r[0].text).toContain('Черновик пуст');
    expect(conv.state).toBe('collecting');
  });

  it('choose_type text match by name', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    const conv = makeConversation({ state: 'choose_type', documentId: 'doc-1', stateVersion: 2 });
    const r = await flow.handle(conv, makeEvent({ text: 'Служебная записка' }));
    expect(conv.state).toBe('choose_template');
    expect(docService.setType).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'max' }),
      'doc-1', 'memo'
    );
  });

  it('choose_type unrecognized text returns error with keyboard', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: null, template_id: null,
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    const conv = makeConversation({ state: 'choose_type', documentId: 'doc-1', stateVersion: 2 });
    const r = await flow.handle(conv, makeEvent({ text: 'Что-то непонятное' }));
    expect(r[0].text).toContain('Не понял тип');
    expect(r[0].buttons).toBeDefined();
    expect(conv.state).toBe('choose_type');
  });

  it('choose_template with stale version triggers processing', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'draft', doc_type: 'memo', template_id: null,
      source_text: 'Текст', draft_version: 2, user_fields: '{}',
      // draftVersion:1 in version vs draft_version:2 in doc → stale=true
      current_version_id: '{"kind":"ai","draftVersion":1}', last_error: null,
    });

    const conv = makeConversation({ state: 'choose_template', documentId: 'doc-1', stateVersion: 3 });
    const r = await flow.handle(conv, actionEvent({ a: 'set_template', v: 'classic', r: conv.stateVersion }));
    expect(conv.state).toBe('processing');
    expect(docService.startProcessing).toHaveBeenCalled();
  });

  it('ready + show_draft shows version body', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: '{"kind":"ai","title":"О тесте","body":["Абзац 1","Абзац 2"],"aiFields":{},"changes":[],"warnings":[],"stale":false}',
      last_error: null,
    });

    const conv = makeConversation({ state: 'ready', documentId: 'doc-1', stateVersion: 5 });
    const r = await flow.handle(conv, actionEvent({ a: 'show_draft', r: conv.stateVersion }));
    expect(r[0].text).toContain('Исправленный текст');
    expect(r[0].text).toContain('Абзац 1');
  });

  it('ready + edit_text moves to editing', async () => {
    const conv = makeConversation({ state: 'ready', documentId: 'doc-1', stateVersion: 5 });
    const r = await flow.handle(conv, actionEvent({ a: 'edit_text', r: conv.stateVersion }));
    expect(conv.state).toBe('editing');
    expect(r[0].text).toContain('Отправьте исправленный текст');
  });

  it('editing + text parses title and body, transitions to ready via _doRender', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: null, last_error: null,
    });

    const conv = makeConversation({ state: 'editing', documentId: 'doc-1', stateVersion: 6 });
    const r = await flow.handle(conv, makeEvent({ text: 'О важном\n\nПараграф первый.\n\nПараграф второй.' }));
    expect(docService.setManualText).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'max' }),
      'doc-1',
      { title: 'О важном', body: ['Параграф первый.', 'Параграф второй.'] }
    );
    // _doRender is async and sets state to 'ready' after successful render
    expect(conv.state).toBe('ready');
  });

  it('global "Новый документ" from any state resets to collecting', async () => {
    const conv = makeConversation({ state: 'choose_template', documentId: 'doc-old', stateVersion: 3 });
    const r = await flow.handle(conv, makeEvent({ text: 'Новый документ' }));
    expect(conv.state).toBe('collecting');
    // New doc should have been created with a new ID
    expect(docService.create).toHaveBeenCalled();
    expect(conv.documentId).toBeTruthy();
    expect(r[0].buttons).toBeDefined();
  });

  it('unknown state returns error with main keyboard', async () => {
    const conv = makeConversation({ state: 'unknown_state' });
    const r = await flow.handle(conv, makeEvent({ text: 'test' }));
    expect(r[0].text).toContain('Неизвестное состояние');
    expect(r[0].buttons).toBeDefined();
  });

  it('confirm_warnings + deliver with pending fields goes to asking_field', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: '{"kind":"ai","title":null,"body":[],"aiFields":{},"changes":["Исправлена орфография"],"warnings":{"added":["факт"]},"stale":false}',
      last_error: null,
    });

    const conv = makeConversation({ state: 'confirm_warnings', documentId: 'doc-1', stateVersion: 4 });
    const r = await flow.handle(conv, actionEvent({ a: 'deliver', r: conv.stateVersion }));
    // Should go to asking_field because memo has required fields without values
    expect(conv.state).toBe('asking_field');
    expect(conv.pendingField).toBeTruthy();
  });

  it('confirm_warnings + retry goes to processing', async () => {
    docService._docs.set('doc-1', {
      id: 'doc-1', owner_platform: 'max', owner_id: 'user-1',
      status: 'processed', doc_type: 'memo', template_id: 'classic',
      source_text: 'Текст', draft_version: 1, user_fields: '{}',
      current_version_id: '{"kind":"ai","title":null,"body":[],"aiFields":{},"changes":[],"warnings":{"added":["факт"]},"stale":false}',
      last_error: null,
    });

    const conv = makeConversation({ state: 'confirm_warnings', documentId: 'doc-1', stateVersion: 4 });
    await flow.handle(conv, actionEvent({ a: 'retry', r: conv.stateVersion }));
    expect(conv.state).toBe('processing');
    expect(docService.startProcessing).toHaveBeenCalled();
  });

  it('confirm_warnings + edit_text goes to editing', async () => {
    const conv = makeConversation({ state: 'confirm_warnings', documentId: 'doc-1', stateVersion: 4 });
    const r = await flow.handle(conv, actionEvent({ a: 'edit_text', r: conv.stateVersion }));
    expect(conv.state).toBe('editing');
    expect(r[0].text).toContain('Отправьте исправленный текст');
  });
});
