/**
 * Dialog flow handler — the core state machine for bot conversations.
 *
 * This is the heart of the dialog engine. It receives inbound events
 * and returns reply arrays. It does NOT send replies — that's the
 * dispatcher's job. It does NOT manage adapter-specific concerns —
 * that's the adapter's job.
 *
 * State machine:
 *   idle → collecting → choose_type → choose_template → processing
 *   processing → (ai_failed | confirm_warnings | asking_field | delivering)
 *   confirming_warnings → (asking_field | delivering | processing | editing)
 *   asking_field → (asking_field | delivering)
 *   delivering → ready
 *   delivery_failed → (ready | delivery_failed)
 *   ready → (choose_template | choose_type | editing)
 *   editing → delivering
 *
 * Every state transition increments stateVersion for stale-button detection.
 *
 * Dependencies are injected (Dependency Inversion):
 *   docServiceClient — REST client for document lifecycle CRUD (sends owner via headers)
 *   documentService — (fallback) direct service for monolith mode / backward compat
 *   docTypes — document type catalog (list, get)
 *   templates — template catalog (list, get)
 *   log — pino-compatible logger
 */

import { mergeRequisites } from '../validation/requisites.js';
import * as keyboards from './keyboards.js';
import * as texts from './texts.js';

/**
 * Extract text string from texts.js function result.
 * Some functions return { text, buttons }, others return a plain string.
 * @param {string | { text: string }} result
 * @returns {string}
 */
function textOf(result) {
  return typeof result === 'string' ? result : result.text;
}

/**
 * Create the dialog flow handler.
 *
 * Accepts either `docServiceClient` (REST) or `documentService` (direct).
 * When both are provided, `docServiceClient` takes precedence.
 *
 * @param {{ docServiceClient?: object, documentService?: object, docTypes: object, templates: object, log: object }} deps
 * @returns {{ handle: function, onDocumentEvent: function, onDeliveryFailed: function, setNotifier: function, trackProcessing: function }}
 */
export function createFlow({ docServiceClient, documentService, docTypes, templates, faultManager, debugCommands = false, log }) {
  // Determine the active document service interface.
  // REST mode: use docServiceClient (sends owner via headers).
  // Direct mode: use documentService (in-process calls with owner parameter).
  const useRest = !!docServiceClient;
  const ds = docServiceClient || documentService;

  /**
   * Create an owner-bound client for a specific user.
   * REST mode: returns a client with owner headers attached.
   * Direct mode: returns a proxy that passes owner as the first argument.
   * @param {{ platform: string, id: string }} owner
   * @returns {object} client with methods: createDocument, getDocument, setDraft, etc.
   */
  function clientFor(owner) {
    if (useRest) {
      return docServiceClient.withOwner(owner);
    }
    // Direct mode: wrap the documentService to match the REST client interface
    return {
      createDocument: () => documentService.create(owner),
      getDocument: (id) => documentService.get(owner, id),
      setDraft: (id, text, opts) => documentService.setDraft(owner, id, text, opts),
      updateDocument: (id, data) => {
        if (data.docType !== undefined) documentService.setType(owner, id, data.docType);
        if (data.templateId !== undefined) documentService.setTemplate(owner, id, data.templateId);
        return documentService.get(owner, id);
      },
      processDocument: (id) => documentService.startProcessing(owner, id),
      retryProcessing: (id) => documentService.retryProcessing(owner, id),
      renderDocument: (id) => documentService.render(owner, id),
      setFields: (id, fields) => {
        for (const [key, value] of Object.entries(fields)) {
          documentService.setField(owner, id, key, value);
        }
        return documentService.get(owner, id);
      },
      setManualText: (id, content) => documentService.setManualText(owner, id, content),
    };
  }

  // Notifier reference — set after creation to avoid circular dependency
  let notifier = null;

  return {
    /**
     * Set the notifier for polling support. Called after creation to avoid circular deps.
     * @param {object} n — notifier instance with trackDocument method
     */
    setNotifier(n) {
      notifier = n;
    },

    /**
     * Track a document for polling when processing starts.
     * @param {string} documentId
     */
    trackProcessing(documentId) {
      if (notifier) notifier.trackDocument(documentId, 'processing');
    },
    /**
     * Handle an inbound event and return replies.
     * @param {object} conversation - current conversation state (mutated in place)
     * @param {object} event - InboundEvent
     * @returns {Promise<Array<{text, buttons?, format?, image?, file?}>>}
     */
    async handle(conversation, event) {
      // ── Global commands (work from any state) ─────────────────────────────

      // ── Commands ────────────────────────────────────────────────────
      if (event.kind === 'command') {
        if (event.command === 'help') {
          return [{ text: textOf(texts.help()), buttons: this._currentKeyboard(conversation) }];
        }
        // Scenario 6: simulate an AI outage for this user only (guarded by DEBUG_COMMANDS)
        if (event.command === 'ai_fail') {
          if (!debugCommands) return [{ text: 'Эта команда отключена.' }];
          faultManager?.armOnce(`${event.platform}:${event.userId}`);
          return [{ text: textOf(texts.aiFaultArmed()), buttons: this._currentKeyboard(conversation) }];
        }
        if (event.command === 'new') return this._startDocument(conversation, event);

        // /start — back to the welcome screen
        conversation.state = 'idle';
        conversation.stateVersion++;
        return [{ text: textOf(texts.greeting(conversation.profile)), buttons: keyboards.mainKeyboard(conversation.stateVersion) }];
      }

      // "Начать" / "/start" typed as plain text
      if (event.kind === 'text' && /^(начать|\/start)$/i.test(event.text)) {
        conversation.state = 'idle';
        conversation.stateVersion++;
        return [{ text: textOf(texts.greeting(conversation.profile)), buttons: keyboards.mainKeyboard(conversation.stateVersion) }];
      }

      // "Новый документ" from any state (typed or pressed)
      if ((event.kind === 'text' && /^(новый документ)$/i.test(event.text)) || (event.kind === 'action' && event.action?.a === 'new')) {
        return this._startDocument(conversation, event);
      }

      // ── State-based handling ──────────────────────────────────────────────
      switch (conversation.state) {
        case 'idle':
          return this._handleIdle(conversation, event);
        case 'collecting':
          return this._handleCollecting(conversation, event);
        case 'choose_type':
          return this._handleChooseType(conversation, event);
        case 'choose_template':
          return this._handleChooseTemplate(conversation, event);
        case 'processing':
          return [{ text: textOf(texts.busy()) }];
        case 'ai_failed':
          return this._handleAiFailed(conversation, event);
        case 'confirm_warnings':
          return this._handleConfirmWarnings(conversation, event);
        case 'asking_field':
          return this._handleAskingField(conversation, event);
        case 'delivering':
        case 'delivery_failed':
          return this._handleDelivering(conversation, event);
        case 'ready':
          return this._handleReady(conversation, event);
        case 'editing':
          return this._handleEditing(conversation, event);
        default:
          return [{ text: 'Неизвестное состояние. Начните заново.', buttons: keyboards.mainKeyboard(conversation.stateVersion) }];
      }
    },

    // ── State handlers ────────────────────────────────────────────────────

    _handleIdle(conversation, event) {
      if (event.kind === 'text') {
        // Start new document with this text as draft
        const owner = { platform: event.platform, id: event.userId };
        const doc = clientFor(owner).createDocument({});
        conversation.documentId = doc.id;
        clientFor(owner).setDraft(doc.id, event.text, { mode: 'replace' });
        conversation.state = 'collecting';
        conversation.stateVersion++;
        return [{ text: `Принято. В черновике ${event.text.length} символов.`, buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
      }
      return [{ text: 'Нажмите «Создать документ».', buttons: keyboards.mainKeyboard(conversation.stateVersion) }];
    },

    _handleCollecting(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action') {
        if (event.action?.a === 'continue') {
          const doc = clientFor(owner).getDocument(conversation.documentId);
          if (!doc.sourceText) {
            return [{ text: 'Черновик пуст. Пришлите текст.' }];
          }
          conversation.state = 'choose_type';
          conversation.stateVersion++;
          const types = docTypes.list();
          return [{ text: textOf(texts.chooseType(types)), buttons: keyboards.typeKeyboard(types, conversation.stateVersion) }];
        }
        if (event.action?.a === 'show_draft') {
          const doc = clientFor(owner).getDocument(conversation.documentId);
          // The keyboard is repeated: in MAX the pressed message loses its buttons and the user would be stuck
          return [{ text: `Черновик (${doc.sourceText.length} символов):\n\n${doc.sourceText.slice(0, 2000)}`, buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
        }
        if (event.action?.a === 'replace_mode') {
          conversation.ctx = { ...conversation.ctx, inputMode: 'replace' };
          return [{ text: 'Отправьте новый текст — старый будет заменён.' }];
        }
      }

      if (event.kind === 'text') {
        const mode = conversation.ctx?.inputMode || 'append';
        clientFor(owner).setDraft(conversation.documentId, event.text, { mode });
        // Reset to append after replace
        conversation.ctx = { ...conversation.ctx, inputMode: 'append' };
        const doc = clientFor(owner).getDocument(conversation.documentId);
        return [{ text: `Принято. В черновике ${doc.sourceText.length} символов.`, buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
      }

      return [];
    },

    _handleChooseType(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'set_type') {
        const typeId = event.action.v;
        clientFor(owner).updateDocument(conversation.documentId, { docType: typeId });
        conversation.state = 'choose_template';
        conversation.stateVersion++;
        const tmplList = templates.list();
        return [{ text: textOf(texts.chooseTemplate(tmplList)), buttons: keyboards.templateKeyboard(tmplList, conversation.stateVersion) }];
      }

      if (event.kind === 'text') {
        // Try to match by name or id
        const types = docTypes.list();
        const match = types.find(t =>
          t.name.toLowerCase() === event.text.toLowerCase() ||
          t.id === event.text.toLowerCase()
        );
        if (match) {
          clientFor(owner).updateDocument(conversation.documentId, { docType: match.id });
          conversation.state = 'choose_template';
          conversation.stateVersion++;
          const tmplList = templates.list();
          return [{ text: textOf(texts.chooseTemplate(tmplList)), buttons: keyboards.templateKeyboard(tmplList, conversation.stateVersion) }];
        }
        return [{ text: 'Не понял тип. Выберите кнопкой.', buttons: keyboards.typeKeyboard(types, conversation.stateVersion) }];
      }

      if (event.kind === 'action' && event.action?.a === 'back') {
        conversation.state = 'collecting';
        conversation.stateVersion++;
        return [{ text: 'Вернитесь к черновику.', buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
      }

      return [];
    },

    async _handleChooseTemplate(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'set_template') {
        const templateId = event.action.v;
        clientFor(owner).updateDocument(conversation.documentId, { templateId: templateId });

        // Check if version is current (not stale)
        const doc = clientFor(owner).getDocument(conversation.documentId);
        if (doc.version && !doc.version.stale) {
          // Version is current — render directly without reprocessing
          conversation.state = 'delivering';
          conversation.stateVersion++;
          return this._doRender(conversation, owner);
        }

        // Need to process with AI
        conversation.state = 'processing';
        conversation.stateVersion++;
        this.trackProcessing(conversation.documentId);
        clientFor(owner).processDocument(conversation.documentId);
        return [{ text: textOf(texts.processing()) }];
      }

      if (event.kind === 'action' && event.action?.a === 'back') {
        conversation.state = 'choose_type';
        conversation.stateVersion++;
        const types = docTypes.list();
        return [{ text: textOf(texts.chooseType(types)), buttons: keyboards.typeKeyboard(types, conversation.stateVersion) }];
      }

      return [];
    },

    _handleAiFailed(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'retry') {
        this.trackProcessing(conversation.documentId);
        clientFor(owner).retryProcessing(conversation.documentId);
        conversation.state = 'processing';
        conversation.stateVersion++;
        return [{ text: 'Повторная обработка...' }];
      }

      if (event.kind === 'action' && event.action?.a === 'show_draft') {
        const doc = clientFor(owner).getDocument(conversation.documentId);
        return [{ text: `Черновик:\n\n${doc.sourceText.slice(0, 2000)}`, buttons: keyboards.retryKeyboard(conversation.stateVersion) }];
      }

      if (event.kind === 'action' && event.action?.a === 'new') {
        const doc = clientFor(owner).createDocument({});
        conversation.documentId = doc.id;
        conversation.state = 'collecting';
        conversation.stateVersion++;
        return [{ text: 'Новый документ создан.', buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
      }

      return [];
    },

    async _handleConfirmWarnings(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'deliver') {
        // Check if there are pending fields before delivering
        const doc = clientFor(owner).getDocument(conversation.documentId);
        const { pending } = mergeRequisites({
          docType: docTypes.get(doc.docType),
          template: templates.get(doc.templateId).template,
          aiFields: doc.version?.aiFields || {},
          title: doc.version?.title || null,
          userFields: doc.userFields,
          today: new Date().toISOString().slice(0, 10),
        });

        if (pending.length > 0) {
          conversation.state = 'asking_field';
          conversation.stateVersion++;
          const next = pending[0];
          conversation.pendingField = next.key;
          return [
            { text: textOf(texts.result(doc.version?.changes || [])) },
            { text: textOf(texts.askField(next, 1, pending.length)), buttons: keyboards.fieldKeyboard(conversation.stateVersion) },
          ];
        }

        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      if (event.kind === 'action' && event.action?.a === 'retry') {
        conversation.state = 'processing';
        conversation.stateVersion++;
        this.trackProcessing(conversation.documentId);
        clientFor(owner).processDocument(conversation.documentId);
        return [{ text: textOf(texts.processing()) }];
      }

      if (event.kind === 'action' && event.action?.a === 'edit_text') {
        conversation.state = 'editing';
        conversation.stateVersion++;
        return [{ text: 'Отправьте исправленный текст. Абзацы разделяйте пустой строкой. Первая строка — заголовок «О ...».' }];
      }

      return [];
    },

    async _handleAskingField(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'skip_field') {
        clientFor(owner).setFields(conversation.documentId, { [conversation.pendingField]: null });
        return this._nextField(conversation, owner);
      }

      if (event.kind === 'action' && event.action?.a === 'skip_all') {
        // Skip all remaining fields — deliver as-is
        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      if (event.kind === 'text') {
        clientFor(owner).setFields(conversation.documentId, { [conversation.pendingField]: event.text });
        return this._nextField(conversation, owner);
      }

      return [];
    },

    _handleDelivering(conversation, event) {
      // "Отправить ещё раз" — the same file, without AI and without re-rendering
      if (event.kind === 'action' && event.action?.a === 'resend' && conversation.lastFileId) {
        conversation.state = 'ready';
        conversation.stateVersion++;
        return [
          { text: 'Отправляю файл ещё раз.', buttons: keyboards.resultKeyboard(conversation.stateVersion) },
          { file: { fileId: conversation.lastFileId, caption: 'Документ' } },
        ];
      }
      // Otherwise the user is simply waiting for the async render
      return [];
    },

    _handleReady(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'other_template') {
        conversation.state = 'choose_template';
        conversation.stateVersion++;
        const tmplList = templates.list();
        return [{ text: textOf(texts.chooseTemplate(tmplList)), buttons: keyboards.templateKeyboard(tmplList, conversation.stateVersion) }];
      }

      if (event.kind === 'action' && event.action?.a === 'other_type') {
        conversation.state = 'choose_type';
        conversation.stateVersion++;
        const types = docTypes.list();
        return [{ text: textOf(texts.chooseType(types)), buttons: keyboards.typeKeyboard(types, conversation.stateVersion) }];
      }

      if (event.kind === 'action' && event.action?.a === 'edit_text') {
        conversation.state = 'editing';
        conversation.stateVersion++;
        return [{ text: 'Отправьте исправленный текст. Абзацы разделяйте пустой строкой. Первая строка — заголовок «О ...».' }];
      }

      if (event.kind === 'action' && event.action?.a === 'show_draft') {
        const doc = clientFor(owner).getDocument(conversation.documentId);
        if (doc.version) {
          const text = [doc.version.title, ...doc.version.body].filter(Boolean).join('\n\n');
          return [{ text: `Исправленный текст:\n\n${text}`, buttons: keyboards.resultKeyboard(conversation.stateVersion) }];
        }
      }

      return [];
    },

    async _handleEditing(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'text') {
        const lines = event.text.split('\n\n').filter(l => l.trim());
        let title = null;
        let body = lines;
        if (lines[0]?.toLowerCase().startsWith('о ')) {
          title = lines[0];
          body = lines.slice(1);
        }
        clientFor(owner).setManualText(conversation.documentId, { title, body });
        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      return [];
    },

    // ── Internal helpers ──────────────────────────────────────────────

    /**
     * Create a new document and switch to draft collection.
     * @param {object} conversation
     * @param {object} event - InboundEvent (carries platform and userId)
     * @returns {Array}
     */
    _startDocument(conversation, event) {
      const doc = clientFor({ platform: event.platform, id: event.userId }).createDocument({});
      conversation.documentId = doc.id;
      conversation.lastFileId = null;
      conversation.pendingField = null;
      conversation.state = 'collecting';
      conversation.stateVersion++;
      return [{ text: textOf(texts.collectDraftStart()), buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
    },

    /**
     * Keyboard of the current step — appended to informational replies (/help, /ai_fail)
     * so the user always has something to press.
     * @param {object} conversation
     * @returns {Array|undefined}
     */
    _currentKeyboard(conversation) {
      switch (conversation.state) {
        case 'idle': return keyboards.mainKeyboard(conversation.stateVersion);
        case 'collecting': return keyboards.draftKeyboard(conversation.stateVersion);
        case 'choose_type': return keyboards.typeKeyboard(docTypes.list(), conversation.stateVersion);
        case 'choose_template': return keyboards.templateKeyboard(templates.list(), conversation.stateVersion);
        case 'asking_field': return keyboards.fieldKeyboard(conversation.stateVersion);
        case 'confirm_warnings': return keyboards.warningKeyboard(conversation.stateVersion);
        case 'ai_failed': return keyboards.retryKeyboard(conversation.stateVersion);
        case 'delivery_failed': return keyboards.resendKeyboard(conversation.stateVersion);
        case 'ready': return keyboards.resultKeyboard(conversation.stateVersion);
        default: return undefined;
      }
    },

    /**
     * Render document and return file reply.
     * Called when state transitions to delivering.
     * @param {object} conversation
     * @param {{ platform: string, id: string }} owner
     * @returns {Promise<Array>}
     */
    async _doRender(conversation, owner) {
      try {
        // Render result format differs by mode:
        // REST API: { fileId, filename, downloadUrl, placeholders, fallback }
        // Direct service: { file: { id, filename }, fallback, placeholders }
        const result = await clientFor(owner).renderDocument(conversation.documentId);
        const fileId = result.fileId || result.file?.id;
        const filename = result.filename || result.file?.filename;
        const fallbackId = result.fallback;
        const placeholders = result.placeholders || [];

        conversation.lastFileId = fileId; // for "Отправить ещё раз"
        conversation.state = 'ready';
        conversation.stateVersion++;
        const doc = await clientFor(owner).getDocument(conversation.documentId);
        const docType = docTypes.get(doc.docType);
        const { template } = templates.get(doc.templateId);
        const fallback = fallbackId ? { requestedId: fallbackId, reason: 'missing_or_invalid' } : null;
        const replies = [{ text: texts.ready(docType?.name || doc.docType, template?.name || doc.templateId, placeholders, fallback) }];
        replies[0].buttons = keyboards.resultKeyboard(conversation.stateVersion);
        replies.push({ file: { fileId, caption: filename } });
        return replies;
      } catch (err) {
        log.error({ error: err.message }, 'render failed');
        conversation.state = 'delivery_failed';
        conversation.stateVersion++;
        return [{ text: textOf(texts.deliveryError()), buttons: keyboards.resendKeyboard(conversation.stateVersion) }];
      }
    },

    /**
     * Move to next pending field or deliver.
     * @param {object} conversation
     * @param {{ platform: string, id: string }} owner
     * @returns {Promise<Array>}
     */
    async _nextField(conversation, owner) {
      const doc = clientFor(owner).getDocument(conversation.documentId);
      const { pending } = mergeRequisites({
        docType: docTypes.get(doc.docType),
        template: templates.get(doc.templateId).template,
        aiFields: doc.version?.aiFields || {},
        title: doc.version?.title || null,
        userFields: doc.userFields,
        today: new Date().toISOString().slice(0, 10),
      });

      if (pending.length === 0) {
        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      const next = pending[0];
      conversation.pendingField = next.key;
      conversation.pendingQueue = pending.slice(1);
      return [{ text: textOf(texts.askField(next, 1, pending.length)), buttons: keyboards.fieldKeyboard(conversation.stateVersion) }];
    },

    // ── External event handlers (called by notifier/dispatcher) ───────────

    /**
     * Handle document processed/failed event — called by notifier.
     * @param {object} conversation
     * @param {{ type: 'processed'|'failed', documentId: string }} event
     * @returns {Promise<Array>}
     */
    async onDocumentEvent(conversation, event) {
      // Owner is the user, not the chat: in MAX the chat id and the user id are different numbers.
      const owner = { platform: conversation.platform, id: conversation.userId ?? conversation.peerId };

      if (event.type === 'processed') {
        const doc = clientFor(owner).getDocument(conversation.documentId);
        const { pending } = mergeRequisites({
          docType: docTypes.get(doc.docType),
          template: templates.get(doc.templateId).template,
          aiFields: doc.version?.aiFields || {},
          title: doc.version?.title || null,
          userFields: doc.userFields,
          today: new Date().toISOString().slice(0, 10),
        });

        const replies = [{ text: texts.result(doc.version?.changes || []) }];

        // Check for warnings (AI added facts not in draft)
        const warnings = doc.version?.warnings || {};
        if (warnings.added?.length > 0) {
          replies[0].text += '\n\n' + texts.factWarnings(warnings);
          conversation.state = 'confirm_warnings';
          conversation.stateVersion++;
          replies[0].buttons = keyboards.warningKeyboard(conversation.stateVersion);
          return replies;
        }

        if (pending.length > 0) {
          conversation.state = 'asking_field';
          conversation.stateVersion++;
          const next = pending[0];
          conversation.pendingField = next.key;
          replies.push({ text: textOf(texts.askField(next, 1, pending.length)), buttons: keyboards.fieldKeyboard(conversation.stateVersion) });
          return replies;
        }

        // Ready to deliver
        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      if (event.type === 'failed') {
        const doc = clientFor(owner).getDocument(conversation.documentId);
        const charCount = doc?.sourceText?.length || 0;
        conversation.state = 'ai_failed';
        conversation.stateVersion++;
        return [{ text: textOf(texts.aiError(charCount)), buttons: keyboards.retryKeyboard(conversation.stateVersion) }];
      }

      return [];
    },

    /**
     * Handle delivery failed — called by dispatcher.
     * @param {object} conversation
     * @param {string} fileId
     * @returns {Array}
     */
    onDeliveryFailed(conversation, fileId) {
      conversation.state = 'delivery_failed';
      conversation.lastFileId = fileId;
      conversation.stateVersion++;
      return [{ text: textOf(texts.deliveryError()), buttons: keyboards.resendKeyboard(conversation.stateVersion) }];
    },
  };
}
