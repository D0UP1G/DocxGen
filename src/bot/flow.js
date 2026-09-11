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
 *   documentService — document lifecycle CRUD
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
 * @param {{ documentService: object, docTypes: object, templates: object, log: object }} deps
 * @returns {{ handle: function, onDocumentEvent: function, onDeliveryFailed: function }}
 */
export function createFlow({ documentService, docTypes, templates, log }) {
  return {
    /**
     * Handle an inbound event and return replies.
     * @param {object} conversation - current conversation state (mutated in place)
     * @param {object} event - InboundEvent
     * @returns {Promise<Array<{text, buttons?, format?, image?, file?}>>}
     */
    async handle(conversation, event) {
      // ── Global commands (work from any state) ─────────────────────────────

      // /start or greeting text → show welcome
      if (event.kind === 'command' || (event.kind === 'text' && /^(начать|\/start)$/i.test(event.text))) {
        return [{ text: textOf(texts.greeting()), buttons: keyboards.mainKeyboard(conversation.stateVersion), format: 'markdown' }];
      }

      // "Новый документ" from any state (text)
      if (event.kind === 'text' && /^(новый документ)$/i.test(event.text)) {
        const doc = documentService.create({ platform: event.platform, id: event.userId });
        conversation.documentId = doc.id;
        conversation.state = 'collecting';
        conversation.stateVersion++;
        return [{ text: 'Новый документ создан. Пришлите текст черновика.', buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
      }

      // "Создать документ" button action (from any state)
      if (event.kind === 'action' && event.action?.a === 'new') {
        const doc = documentService.create({ platform: event.platform, id: event.userId });
        conversation.documentId = doc.id;
        conversation.state = 'collecting';
        conversation.stateVersion++;
        return [{ text: 'Новый документ создан. Пришлите текст черновика.', buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
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
        const doc = documentService.create(owner);
        conversation.documentId = doc.id;
        documentService.setDraft(owner, doc.id, event.text, { mode: 'replace' });
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
          const doc = documentService.get(owner, conversation.documentId);
          if (!doc.sourceText) {
            return [{ text: 'Черновик пуст. Пришлите текст.' }];
          }
          conversation.state = 'choose_type';
          conversation.stateVersion++;
          const types = docTypes.list();
          return [{ text: textOf(texts.chooseType(types)), buttons: keyboards.typeKeyboard(types, conversation.stateVersion) }];
        }
        if (event.action?.a === 'show_draft') {
          const doc = documentService.get(owner, conversation.documentId);
          return [{ text: `Черновик (${doc.sourceText.length} символов):\n\n${doc.sourceText.slice(0, 2000)}` }];
        }
        if (event.action?.a === 'replace_mode') {
          conversation.ctx = { ...conversation.ctx, inputMode: 'replace' };
          return [{ text: 'Отправьте новый текст — старый будет заменён.' }];
        }
      }

      if (event.kind === 'text') {
        const mode = conversation.ctx?.inputMode || 'append';
        documentService.setDraft(owner, conversation.documentId, event.text, { mode });
        // Reset to append after replace
        conversation.ctx = { ...conversation.ctx, inputMode: 'append' };
        const doc = documentService.get(owner, conversation.documentId);
        return [{ text: `Принято. В черновике ${doc.sourceText.length} символов.`, buttons: keyboards.draftKeyboard(conversation.stateVersion) }];
      }

      return [];
    },

    _handleChooseType(conversation, event) {
      const owner = { platform: event.platform, id: event.userId };

      if (event.kind === 'action' && event.action?.a === 'set_type') {
        const typeId = event.action.v;
        documentService.setType(owner, conversation.documentId, typeId);
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
          documentService.setType(owner, conversation.documentId, match.id);
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
        documentService.setTemplate(owner, conversation.documentId, templateId);

        // Check if version is current (not stale)
        const doc = documentService.get(owner, conversation.documentId);
        if (doc.version && !doc.version.stale) {
          // Version is current — render directly without reprocessing
          conversation.state = 'delivering';
          conversation.stateVersion++;
          return this._doRender(conversation, owner);
        }

        // Need to process with AI
        conversation.state = 'processing';
        conversation.stateVersion++;
        documentService.startProcessing(owner, conversation.documentId);
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
        documentService.retryProcessing(owner, conversation.documentId);
        conversation.state = 'processing';
        conversation.stateVersion++;
        return [{ text: 'Повторная обработка...' }];
      }

      if (event.kind === 'action' && event.action?.a === 'show_draft') {
        const doc = documentService.get(owner, conversation.documentId);
        return [{ text: `Черновик:\n\n${doc.sourceText.slice(0, 2000)}` }];
      }

      if (event.kind === 'action' && event.action?.a === 'new') {
        const doc = documentService.create(owner);
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
        const doc = documentService.get(owner, conversation.documentId);
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
        documentService.startProcessing(owner, conversation.documentId);
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
        documentService.setField(owner, conversation.documentId, conversation.pendingField, null);
        return this._nextField(conversation, owner);
      }

      if (event.kind === 'action' && event.action?.a === 'skip_all') {
        // Skip all remaining fields — deliver as-is
        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      if (event.kind === 'text') {
        documentService.setField(owner, conversation.documentId, conversation.pendingField, event.text);
        return this._nextField(conversation, owner);
      }

      return [];
    },

    _handleDelivering(conversation, event) {
      // Shouldn't receive user events in this state — processing is async
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
        const doc = documentService.get(owner, conversation.documentId);
        if (doc.version) {
          return [{ text: `Исправленный текст:\n\n${doc.version.body.join('\n\n')}` }];
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
        documentService.setManualText(owner, conversation.documentId, { title, body });
        conversation.state = 'delivering';
        conversation.stateVersion++;
        return this._doRender(conversation, owner);
      }

      return [];
    },

    // ── Internal helpers ──────────────────────────────────────────────────

    /**
     * Render document and return file reply.
     * Called when state transitions to delivering.
     * @param {object} conversation
     * @param {{ platform: string, id: string }} owner
     * @returns {Promise<Array>}
     */
    async _doRender(conversation, owner) {
      try {
        const { file, fallback: fallbackId, placeholders } = await documentService.render(owner, conversation.documentId);
        conversation.state = 'ready';
        conversation.stateVersion++;
        const doc = documentService.get(owner, conversation.documentId);
        const docType = docTypes.get(doc.docType);
        const { template } = templates.get(doc.templateId);
        const fallback = fallbackId ? { requestedId: fallbackId, reason: 'missing_or_invalid' } : null;
        const replies = [{ text: texts.ready(docType?.name || doc.docType, template?.name || doc.templateId, placeholders, fallback) }];
        replies[0].buttons = keyboards.resultKeyboard(conversation.stateVersion);
        replies.push({ file: { fileId: file.id, caption: file.filename } });
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
      const doc = documentService.get(owner, conversation.documentId);
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
      const owner = { platform: conversation.platform, id: conversation.peerId };

      if (event.type === 'processed') {
        const doc = documentService.get(owner, conversation.documentId);
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
        const doc = documentService.get(owner, conversation.documentId);
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
