import type { DocumentTypeId, Requisites } from '../document-types.js';
import { generateDocumentStream, type AiProcessedDocument } from './ai.service.js';
import { generateDocx, type DocxDocumentData } from './docx.service.js';
import { validateRequisites, type ValidationResult } from './validation.service.js';

export interface ProcessedDraft {
  originalText: string;
  correctedText: string;
  requisites: Requisites;
  documentType: DocumentTypeId;
  validation: ValidationResult;
  source: AiProcessedDocument['source'];
}

export interface GenerateDocumentInput {
  text: string;
  correctedText?: string;
  requisites?: Partial<Requisites>;
  documentType: DocumentTypeId;
  templateId: 'official' | 'standard';
  onAiChunk?: (chunk: string) => void;
}

function mergeRequisites(base: Requisites, override?: Partial<Requisites>): Requisites {
  return {
    ...base,
    ...override,
    to: override?.to ?? base.to,
    from: override?.from ?? base.from,
    date: override?.date ?? base.date,
    subject: override?.subject ?? base.subject,
    number: override?.number ?? base.number,
    position: override?.position ?? base.position,
    signature: override?.signature ?? base.signature,
    greeting: override?.greeting ?? base.greeting,
    executor: override?.executor ?? base.executor,
  };
}

export async function processDraft(
  text: string,
  documentType: DocumentTypeId,
  onAiChunk?: (chunk: string) => void,
): Promise<ProcessedDraft> {
  const ai = await generateDocumentStream(text, documentType, onAiChunk || (() => undefined));
  const validation = validateRequisites(ai.requisites, documentType, ai.correctedText);
  return {
    originalText: text,
    correctedText: ai.correctedText,
    requisites: ai.requisites,
    documentType,
    validation,
    source: ai.source,
  };
}

export function createDocx(input: GenerateDocumentInput): { buffer: Buffer; filename: string; validation: ValidationResult } {
  const correctedText = input.correctedText?.trim() || input.text.trim();
  const requisites = mergeRequisites(
    {
      to: '', from: '', date: '', subject: '', number: '', position: '', signature: '', greeting: '', executor: '',
    },
    input.requisites,
  );
  const validation = validateRequisites(requisites, input.documentType, correctedText);
  const data: DocxDocumentData = {
    documentType: input.documentType,
    templateId: input.templateId,
    requisites,
    body: correctedText,
  };
  const buffer = generateDocx(data);
  const filename = `${input.documentType}-${input.templateId}.docx`;
  return { buffer, filename, validation };
}
