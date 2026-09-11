/**
 * Document types shared across the DocxGen frontend.
 * Used by Redux store, components, and API utilities.
 */

export type DocumentTypeId = 'sluzhebnaya' | 'dokladnaya' | 'informacionnaya' | 'pismo';

export type TemplateId = 'official' | 'standard';

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
}
