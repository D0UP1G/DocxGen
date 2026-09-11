/**
 * Shared constants for the DocxGen document generator.
 */

import type { DocumentTypeId, TemplateId } from '@/types/document';

export const DOCUMENT_TYPES: Array<{
  id: DocumentTypeId;
  label: string;
  description: string;
}> = [
  { id: 'sluzhebnaya', label: 'Служебная записка', description: 'Внутренняя переписка' },
  { id: 'dokladnaya', label: 'Докладная записка', description: 'Формальный отчёт' },
  { id: 'informacionnaya', label: 'Информационная справка', description: 'Справка с фактами' },
  { id: 'pismo', label: 'Письмо', description: 'Внешняя корреспонденция' },
];

export const FIELD_LABELS: Record<string, string> = {
  to: 'Адресат',
  from: 'Автор / отправитель',
  date: 'Дата',
  subject: 'Заголовок / тема',
  number: 'Номер',
  position: 'Должность',
  signature: 'Подпись',
  greeting: 'Обращение',
  executor: 'Исполнитель',
};

export const FIELD_ORDER: string[] = [
  'to',
  'from',
  'position',
  'date',
  'number',
  'subject',
  'signature',
  'greeting',
  'executor',
];

// IDs used by the existing UI are kept for compatibility with the design.
// The backend catalog uses its canonical IDs.
export const DOC_TYPE_MAP: Record<DocumentTypeId, string> = {
  sluzhebnaya: 'memo',
  dokladnaya: 'report',
  informacionnaya: 'reference',
  pismo: 'letter',
};

export const TEMPLATE_MAP: Record<TemplateId, string> = {
  official: 'classic',
  standard: 'modern',
};
