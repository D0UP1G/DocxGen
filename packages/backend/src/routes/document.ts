import { Router, type Request, type Response } from 'express';
import { DOCUMENT_TYPES, type DocumentTypeId, type Requisites } from '../document-types.js';
import { createDocx, processDraft } from '../services/document-generation.service.js';
import { getFieldLabel } from '../services/validation.service.js';

const router = Router();

function parseType(value: unknown): DocumentTypeId {
  return value && typeof value === 'string' && value in DOCUMENT_TYPES ? value as DocumentTypeId : 'sluzhebnaya';
}

function parseTemplate(value: unknown): 'official' | 'standard' {
  return value === 'standard' ? 'standard' : 'official';
}

function sendValidation(res: Response, validation: ReturnType<typeof getValidationPayload>) {
  res.write(`event: validation\ndata: ${JSON.stringify(JSON.stringify(validation))}\n\n`);
}

function getValidationPayload(validation: { isValid: boolean; missingFields: Array<keyof Requisites>; warnings: string[] }, documentType: DocumentTypeId) {
  return {
    isValid: validation.isValid,
    missing: validation.missingFields.map((field) => ({ field, label: getFieldLabel(field, documentType) })),
    warnings: validation.warnings,
    message: validation.missingFields.length
      ? `Не заполнены: ${validation.missingFields.map((field) => getFieldLabel(field, documentType)).join(', ')}`
      : validation.warnings.join(' '),
  };
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

router.post('/process', async (req: Request, res: Response) => {
  const text = req.body?.text;
  const documentType = parseType(req.body?.documentType);
  if (!validText(text)) return res.status(400).json({ error: 'Text is required' });
  try {
    const processed = await processDraft(text, documentType);
    return res.json({
      originalText: processed.originalText,
      correctedText: processed.correctedText,
      requisites: processed.requisites,
      documentType: processed.documentType,
      source: processed.source,
      validation: getValidationPayload(processed.validation, documentType),
    });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'AI processing failed' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  const text = req.body?.text;
  const documentType = parseType(req.body?.documentType);
  const templateId = parseTemplate(req.body?.templateId);
  if (!validText(text)) return res.status(400).json({ error: 'Text is required' });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(typeof data === 'string' ? data : JSON.stringify(data))}\n\n`);

  try {
    send('status', 'Анализ текста и извлечение реквизитов...');
    const processed = validText(req.body?.correctedText)
      ? {
          originalText: text,
          correctedText: req.body.correctedText,
          requisites: { ...(req.body.requisites || {}) } as Requisites,
          documentType,
          source: 'edited' as const,
          validation: { isValid: false, missingFields: [], warnings: [] },
        }
      : await processDraft(text, documentType, (chunk) => send('chunk', chunk));

    send('ai_result', {
      correctedText: processed.correctedText,
      requisites: processed.requisites,
      documentType,
      source: processed.source,
    });
    if (!validText(req.body?.correctedText)) sendValidation(res, getValidationPayload(processed.validation, documentType));

    send('status', `Формирование DOCX по шаблону «${templateId === 'official' ? 'Классический корпоративный' : 'Современный регламентный'}»...`);
    const generated = createDocx({
      text,
      correctedText: processed.correctedText,
      requisites: processed.requisites,
      documentType,
      templateId,
    });
    sendValidation(res, getValidationPayload(generated.validation, documentType));
    send('done', generated.buffer.toString('base64'));
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document generation failed';
    send('error', message);
    res.end();
  }
});

export default router;
