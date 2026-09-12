/**
 * Document types shared across the DocxGen frontend.
 * Used by Redux store, components, and API utilities.
 */

export type DocumentTypeId = 'memo' | 'report' | 'reference' | 'letter';

export type TemplateId = 'classic' | 'modern';

export type Requisites = Record<string, string>;

export interface MissingField {
  field: string;
  label: string;
}

export interface ProcessResponse {
  correctedText: string;
  requisites: Requisites;
  validation: {
    missing: MissingField[];
    warnings: string[];
  };
  source: string;
  documentId?: string;
}

export interface DocumentView {
  id: string;
  status: string;
  docType: DocumentTypeId | null;
  templateId: TemplateId | null;
  sourceText: string;
  draftVersion: number;
  userFields: Requisites;
  version: {
    title: string;
    body: string[];
    aiFields: Record<string, string | { value: string; quote: string } | null>;
    warnings?: Array<string | { key?: string; reason?: string; severity?: string }>;
  } | null;
  pending?: Array<{ key: string; label: string; question?: string; example?: string }>;
  placeholders?: string[];
  error: string | null;
}

export interface GenerateRequest {
  text: string;
  correctedText: string;
  requisites: Requisites;
  documentType: DocumentTypeId;
  templateId: TemplateId;
}

export interface DocumentState {
  text: string;
  correctedText: string;
  requisites: Requisites;
  documentType: DocumentTypeId;
  templateId: TemplateId;
  missingFields: MissingField[];
  warnings: string[];
  status: string;
  error: string;
  processing: boolean;
  generating: boolean;
  documentId?: string;
}
