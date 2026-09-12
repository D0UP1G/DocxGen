import { describe, it, expect, vi, beforeEach } from 'vitest';
import reducer, {
  setText,
  setCorrectedText,
  setRequisites,
  setDocumentType,
  setTemplateId,
  setMissingFields,
  setWarnings,
  setStatus,
  setError,
  setProcessing,
  setGenerating,
  resetDocument,
  processText,
  generateDocument,
} from '../documentSlice';
import type { DocumentState } from '@/types/document';

const initialState: DocumentState = {
  text: '',
  correctedText: '',
  requisites: {},
  documentType: 'memo',
  templateId: 'classic',
  missingFields: [],
  warnings: [],
  status: '',
  error: '',
  processing: false,
  generating: false,
};

describe('documentSlice reducer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correct initial state', () => {
    expect(reducer(undefined, { type: 'init' })).toEqual(initialState);
  });

  describe('synchronous actions', () => {
    it('setText updates text', () => {
      const state = reducer(initialState, setText('hello'));
      expect(state.text).toBe('hello');
    });

    it('setCorrectedText updates correctedText', () => {
      const state = reducer(initialState, setCorrectedText('corrected'));
      expect(state.correctedText).toBe('corrected');
    });

    it('setRequisites updates requisites', () => {
      const req = { to: 'Addr', from: 'Auth' };
      const state = reducer(initialState, setRequisites(req));
      expect(state.requisites).toEqual(req);
    });

    it('setDocumentType updates documentType', () => {
      const state = reducer(initialState, setDocumentType('report'));
      expect(state.documentType).toBe('report');
    });

    it('setTemplateId updates templateId', () => {
      const state = reducer(initialState, setTemplateId('modern'));
      expect(state.templateId).toBe('modern');
    });

    it('setMissingFields updates missingFields', () => {
      const fields = [{ field: 'to', label: 'Адресат' }];
      const state = reducer(initialState, setMissingFields(fields));
      expect(state.missingFields).toEqual(fields);
    });

    it('setWarnings updates warnings', () => {
      const state = reducer(initialState, setWarnings(['warn1']));
      expect(state.warnings).toEqual(['warn1']);
    });

    it('setStatus updates status', () => {
      const state = reducer(initialState, setStatus('done'));
      expect(state.status).toBe('done');
    });

    it('setError updates error', () => {
      const state = reducer(initialState, setError('fail'));
      expect(state.error).toBe('fail');
    });

    it('setProcessing updates processing', () => {
      expect(reducer(initialState, setProcessing(true)).processing).toBe(true);
    });

    it('setGenerating updates generating', () => {
      expect(reducer(initialState, setGenerating(true)).generating).toBe(true);
    });

    it('resetDocument returns to initial state', () => {
      const modified = {
        ...initialState,
        text: 'something',
        correctedText: 'else',
        processing: true,
      };
      const state = reducer(modified, resetDocument());
      expect(state).toEqual(initialState);
    });
  });

  describe('processText thunk', () => {
    const fulfilledPayload = {
      correctedText: 'fixed text',
      requisites: { to: 'Addr' },
      validation: { missing: [], warnings: [] },
      source: 'test',
    };

    it('pending sets processing=true, error="", status', () => {
      const state = reducer(initialState, { type: processText.pending.type });
      expect(state.processing).toBe(true);
      expect(state.error).toBe('');
      expect(state.status).toBe('Обработка текста…');
    });

    it('fulfilled updates correctedText, requisites, validation, status', () => {
      const state = reducer(initialState, {
        type: processText.fulfilled.type,
        payload: fulfilledPayload,
      });
      expect(state.processing).toBe(false);
      expect(state.correctedText).toBe('fixed text');
      expect(state.requisites).toEqual({ to: 'Addr' });
      expect(state.status).toBe('Текст обработан');
    });

    it('rejected sets processing=false, error=payload', () => {
      const state = reducer(initialState, {
        type: processText.rejected.type,
        payload: 'Server error 500',
      });
      expect(state.processing).toBe(false);
      expect(state.error).toBe('Server error 500');
    });

    it('rejected with no payload uses "Unknown error"', () => {
      const state = reducer(initialState, {
        type: processText.rejected.type,
        payload: undefined,
      });
      expect(state.error).toBe('Unknown error');
    });
  });

  describe('generateDocument thunk', () => {
    it('pending sets generating=true, error="", status', () => {
      const state = reducer(initialState, { type: generateDocument.pending.type });
      expect(state.generating).toBe(true);
      expect(state.error).toBe('');
      expect(state.status).toBe('Генерация документа…');
    });

    it('fulfilled sets generating=false, status="Документ готов"', () => {
      const state = reducer(initialState, {
        type: generateDocument.fulfilled.type,
      });
      expect(state.generating).toBe(false);
      expect(state.status).toBe('Документ готов');
    });

    it('rejected sets generating=false, error=payload', () => {
      const state = reducer(initialState, {
        type: generateDocument.rejected.type,
        payload: 'Network error',
      });
      expect(state.generating).toBe(false);
      expect(state.error).toBe('Network error');
    });
  });
});
