import {
  DOCUMENT_TYPES,
  type DocumentType,
  type DocumentTypeId,
  type RequisiteKey,
  type Requisites,
} from '../document-types.js';

export interface ValidationResult {
  isValid: boolean;
  missingFields: RequisiteKey[];
  warnings: string[];
}

const COMMON_LABELS: Record<RequisiteKey, string> = {
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

export function getFieldLabel(field: RequisiteKey, documentType?: DocumentTypeId | DocumentType): string {
  const typeId = typeof documentType === 'string' ? documentType : documentType?.id;
  if (typeId === 'informacionnaya' && field === 'from') return 'Составитель';
  if (typeId === 'pismo' && field === 'from') return 'Отправитель';
  if (field === 'subject') return typeId === 'pismo' ? 'Тема' : 'Заголовок';
  return COMMON_LABELS[field];
}

export function validateRequisites(
  requisites: Partial<Requisites>,
  documentType: DocumentTypeId | DocumentType,
  body = '',
): ValidationResult {
  const typeDef = typeof documentType === 'string' ? DOCUMENT_TYPES[documentType] : documentType;
  if (!typeDef) {
    return { isValid: false, missingFields: [], warnings: [`Неизвестный тип документа: ${documentType}`] };
  }

  const missingFields: RequisiteKey[] = [];
  for (const field of typeDef.requiredFields) {
    const value = requisites[field];
    if (!value || value.trim() === '') missingFields.push(field);
  }

  const warnings: string[] = [];
  if (!body.trim()) warnings.push('Основной текст документа пустой');
  if (requisites.date && !/^\d{2}\.\d{2}\.\d{4}$/.test(requisites.date) && !/^\d{4}-\d{2}-\d{2}$/.test(requisites.date)) {
    warnings.push('Поле «Дата» рекомендуется записывать в формате ДД.ММ.ГГГГ или ГГГГ-ММ-ДД');
  }

  return { isValid: missingFields.length === 0 && body.trim().length > 0, missingFields, warnings };
}
