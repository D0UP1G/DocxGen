/**
 * Shared constants for the DocxGen document generator.
 */

import type { DocumentTypeId } from '@/types/document';

export const DOCUMENT_TYPES: Array<{
  id: DocumentTypeId;
  label: string;
  description: string;
}> = [
  { id: 'memo', label: 'Служебная записка', description: 'Внутренняя переписка' },
  { id: 'report', label: 'Докладная записка', description: 'Формальный отчёт' },
  { id: 'reference', label: 'Информационная справка', description: 'Справка с фактами' },
  { id: 'letter', label: 'Письмо', description: 'Внешняя корреспонденция' },
];

export const FIELD_LABELS: Record<string, string> = {
  addressee: 'Адресат',
  authorPosition: 'Должность автора',
  authorName: 'ФИО автора',
  addresseeOrg: 'Организация-получатель',
  addresseePerson: 'ФИО получателя',
  addresseeAddress: 'Адрес получателя',
  signerPosition: 'Должность подписывающего',
  signerName: 'ФИО подписывающего',
  period: 'Период',
  date: 'Дата',
  number: 'Номер',
  executor: 'Исполнитель',
};

export const FIELD_ORDER: string[] = [
  'addressee',
  'authorPosition',
  'authorName',
  'addresseeOrg',
  'addresseePerson',
  'addresseeAddress',
  'signerPosition',
  'signerName',
  'period',
  'date',
  'number',
  'executor',
];
