/**
 * Validation service for document requisites.
 *
 * Checks that all required fields for a given document type are present
 * and non-empty before document generation.
 */

import {
  type DocumentType,
  type DocumentTypeId,
  type Requisites,
  DOCUMENT_TYPES,
} from "../document-types";

/** Result of a requisites validation check. */
export interface ValidationResult {
  /** `true` if all required fields are present and non-empty. */
  isValid: boolean;
  /** List of required field keys that are missing or empty. */
  missingFields: (keyof Requisites)[];
  /** Human-readable warnings (e.g. format hints). */
  warnings: string[];
}

/** Russian labels for requisites fields — used in user-facing messages. */
const FIELD_LABELS: Record<keyof Requisites, string> = {
  to: "Кому",
  from: "От кого",
  date: "Дата",
  subject: "Тема",
  number: "Номер",
};

/**
 * Get the Russian display label for a requisites field.
 *
 * @param field - The Requisites key to look up.
 * @returns The Russian label (e.g. "Кому", "От кого").
 */
export function getFieldLabel(field: keyof Requisites): string {
  return FIELD_LABELS[field] ?? field;
}

/**
 * Validate that all required fields for the given document type are present
 * and non-empty in the provided requisites.
 *
 * @param requisites - The requisites to validate.
 * @param documentType - The document type ID or full DocumentType object.
 * @returns A ValidationResult with isValid, missingFields, and warnings.
 */
export function validateRequisites(
  requisites: Partial<Requisites>,
  documentType: DocumentTypeId | DocumentType,
): ValidationResult {
  const typeDef: DocumentType =
    typeof documentType === "string"
      ? DOCUMENT_TYPES[documentType]
      : documentType;

  if (!typeDef) {
    return {
      isValid: false,
      missingFields: [],
      warnings: [`Неизвестный тип документа: ${documentType}`],
    };
  }

  const missingFields: (keyof Requisites)[] = [];
  const warnings: string[] = [];

  for (const field of typeDef.requiredFields) {
    const value = requisites[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(field);
    }
  }

  // Format warning for date field if present and non-empty
  if (
    requisites.date &&
    !/^\d{2}\.\d{2}\.\d{4}$/.test(requisites.date) &&
    !/^\d{4}-\d{2}-\d{2}$/.test(requisites.date)
  ) {
    warnings.push(
      `Поле "Дата" рекомендуется записывать в формате ДД.ММ.ГГГГ или ГГГГ-ММ-ДД`,
    );
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
