/**
 * Document slice — manages document state, text processing, and document generation.
 * Uses createAsyncThunk for async operations (process, generate).
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type {
  DocumentState,
  DocumentTypeId,
  TemplateId,
  ProcessResponse,
} from '@/types/document';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

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
  documentId: undefined,
};

// ---------------------------------------------------------------------------
// Async thunks
// ---------------------------------------------------------------------------

/**
 * Process raw text → corrected text + requisites + validation.
 */
export const processText = createAsyncThunk<
  ProcessResponse,
  { text: string; documentType: DocumentTypeId; templateId: TemplateId },
  { rejectValue: string }
>('document/processText', async ({ text, documentType, templateId }, { rejectWithValue }) => {
  try {
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sourceText: text, docType: documentType, templateId }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return rejectWithValue(
        (errorBody as { message?: string }).message ?? `Server error ${response.status}`,
      );
    }

    const document = (await response.json()) as import('@/types/document').DocumentView;
    const process = await fetch(`/api/documents/${document.id}/process`, {
      method: 'POST', credentials: 'include',
    });
    if (!process.ok) return rejectWithValue(await getErrorMessage(process));

    let current = document;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const statusResponse = await fetch(`/api/documents/${document.id}`, { credentials: 'include' });
      if (!statusResponse.ok) return rejectWithValue(await getErrorMessage(statusResponse));
      current = (await statusResponse.json()) as import('@/types/document').DocumentView;
      if (current.status === 'processed' || current.status === 'ai_failed') break;
    }
    if (current.status === 'ai_failed') return rejectWithValue(current.error ?? 'Обработка текста не удалась');
    if (!current.version) return rejectWithValue('Сервер не вернул обработанный документ');
    return {
      correctedText: current.version.body.join('\n'),
      requisites: { ...current.version.aiFields, ...current.userFields },
      validation: { missing: [], warnings: current.version.warnings ?? [] },
      source: current.id,
      documentId: current.id,
    } as ProcessResponse & { documentId: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return rejectWithValue(message);
  }
});

/**
 * Generate a DOCX via SSE → download on completion.
 */
export const generateDocument = createAsyncThunk<
  void,
  {
    text: string;
    correctedText: string;
    requisites: Record<string, string>;
    documentType: DocumentTypeId;
    templateId: TemplateId;
  },
  { rejectValue: string }
>(
  'document/generateDocument',
  async (
    { text: _text, correctedText, requisites, documentType: _documentType, templateId: _templateId },
    { getState, rejectWithValue },
  ) => {
    try {
      let documentId = (getState() as { document: DocumentState }).document.documentId;
      if (!documentId) return rejectWithValue('Документ ещё не создан');

      // Keep the AI-derived title ("О …") instead of overwriting it with a placeholder.
      const currentResponse = await fetch(`/api/documents/${documentId}`, { credentials: 'include' });
      const current = currentResponse.ok
        ? (await currentResponse.json()) as import('@/types/document').DocumentView
        : null;
      const title = current?.version?.title || 'Документ';

      const textResponse = await fetch(`/api/documents/${documentId}/text`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: correctedText.split(/\r?\n/).filter(Boolean) }),
      });
      if (!textResponse.ok) return rejectWithValue(await getErrorMessage(textResponse));
      const fieldsResponse = await fetch(`/api/documents/${documentId}/fields`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requisites),
      });
      if (!fieldsResponse.ok) return rejectWithValue(await getErrorMessage(fieldsResponse));

      const response = await fetch(`/api/documents/${documentId}/render`, {
        method: 'POST', credentials: 'include',
      });

      if (!response.ok) {
        return rejectWithValue(`Server error ${response.status}`);
      }

      const result = (await response.json()) as { downloadUrl: string; filename: string };
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      link.click();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return rejectWithValue(message);
    }
  },
);

async function getErrorMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
  return body.error?.message ?? body.message ?? `Server error ${response.status}`;
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    // Synchronous actions
    setText(state, action: PayloadAction<string>) {
      state.text = action.payload;
    },
    setCorrectedText(state, action: PayloadAction<string>) {
      state.correctedText = action.payload;
    },
    setRequisites(state, action: PayloadAction<Record<string, string>>) {
      state.requisites = action.payload;
    },
    setDocumentType(state, action: PayloadAction<DocumentTypeId>) {
      state.documentType = action.payload;
    },
    setTemplateId(state, action: PayloadAction<TemplateId>) {
      state.templateId = action.payload;
    },
    setMissingFields(
      state,
      action: PayloadAction<Array<{ field: string; label: string }>>,
    ) {
      state.missingFields = action.payload;
    },
    setWarnings(state, action: PayloadAction<string[]>) {
      state.warnings = action.payload;
    },
    setStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    setProcessing(state, action: PayloadAction<boolean>) {
      state.processing = action.payload;
    },
    setGenerating(state, action: PayloadAction<boolean>) {
      state.generating = action.payload;
    },
    resetDocument() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // processText
    builder
      .addCase(processText.pending, (state) => {
        state.processing = true;
        state.error = '';
        state.status = 'Обработка текста…';
      })
      .addCase(processText.fulfilled, (state, action) => {
        state.processing = false;
        state.correctedText = action.payload.correctedText;
        state.requisites = action.payload.requisites;
        state.missingFields = action.payload.validation.missing;
        state.warnings = action.payload.validation.warnings;
        state.status = 'Текст обработан';
        state.documentId = action.payload.documentId;
      })
      .addCase(processText.rejected, (state, action) => {
        state.processing = false;
        state.error = action.payload ?? 'Unknown error';
        state.status = '';
      });

    // generateDocument
    builder
      .addCase(generateDocument.pending, (state) => {
        state.generating = true;
        state.error = '';
        state.status = 'Генерация документа…';
      })
      .addCase(generateDocument.fulfilled, (state) => {
        state.generating = false;
        state.status = 'Документ готов';
      })
      .addCase(generateDocument.rejected, (state, action) => {
        state.generating = false;
        state.error = action.payload ?? 'Unknown error';
        state.status = '';
      });
  },
});

// ---------------------------------------------------------------------------
// Actions (synchronous)
// ---------------------------------------------------------------------------

export const {
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
} = documentSlice.actions;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export default documentSlice.reducer;
