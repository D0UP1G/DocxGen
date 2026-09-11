/**
 * Shared constants for the DocxGen document generator.
 */

import type { DocumentTypeId } from '@/types/document';

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
