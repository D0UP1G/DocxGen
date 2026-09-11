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
  documentType: 'sluzhebnaya',
  templateId: 'official',
  missingFields: [],
  warnings: [],
  status: '',
  error: '',
  processing: false,
  generating: false,
};

// ---------------------------------------------------------------------------
// Async thunks
// ---------------------------------------------------------------------------

/**
 * Process raw text → corrected text + requisites + validation.
 */
export const processText = createAsyncThunk<
  ProcessResponse,
  { text: string; documentType: DocumentTypeId },
  { rejectValue: string }
>('document/processText', async ({ text, documentType }, { rejectWithValue }) => {
  try {
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, documentType }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return rejectWithValue(
        (errorBody as { message?: string }).message ?? `Server error ${response.status}`,
      );
    }

    const payload = (await response.json()) as ProcessResponse;
    return payload;
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
    { text, correctedText, requisites, documentType, templateId },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, correctedText, requisites, documentType, templateId }),
      });

      if (!response.ok) {
        return rejectWithValue(`Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) return rejectWithValue('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data) as {
              type: string;
              message?: string;
              missing?: Array<{ field: string; label: string }>;
              warnings?: string[];
              data?: string;
              filename?: string;
            };

            switch (event.type) {
              case 'status':
                dispatch(setStatus(event.message ?? ''));
                break;
              case 'validation':
                if (event.missing) dispatch(setMissingFields(event.missing));
                if (event.warnings) dispatch(setWarnings(event.warnings));
                break;
              case 'error':
                dispatch(setError(event.message ?? 'Generation failed'));
                break;
              case 'done': {
                // Decode base64 DOCX and trigger download
                if (event.data) {
                  const binary = atob(event.data);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                  }
                  const blob = new Blob([bytes], {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = event.filename ?? 'document.docx';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
                break;
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return rejectWithValue(message);
    }
  },
);

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
