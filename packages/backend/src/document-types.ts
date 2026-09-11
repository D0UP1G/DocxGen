/**
 * Document type definitions for the DocxGen system.
 *
 * Covers the 4 document types required by the hackathon:
 * - Служебная записка (Internal Memo)
 * - Докладная записка (Report Memo)
 * - Информационная справка (Information Report)
 * - Письмо (Letter)
 */

/** Identifiers for each supported document type. */
export type DocumentTypeId = "sluzhebnaya" | "dokladnaya" | "informacionnaya" | "pismo";

/** Section structure of a document type (ordered list of section keys). */
export type SectionKey =
  | "header"
  | "body"
  | "conclusion"
  | "greeting"
  | "closing"
  | "signature"
  | "facts"
  | "analysis";

/** Metadata describing a single document type. */
export interface DocumentType {
  /** Unique identifier. */
  id: DocumentTypeId;
  /** Russian name (as shown on official documents). */
  nameRu: string;
  /** Transliterated name for machine keys. */
  nameTranslit: string;
  /** Short English description. */
  description: string;
  /** Ordered section keys that make up the document structure. */
  sections: SectionKey[];
  /** Fields from Requisites that are mandatory for this document type. */
  requiredFields: (keyof Requisites)[];
}

/**
 * Requisites (реквизиты) — the standard header fields that appear on
 * every official document. The set of required fields varies by type;
 * this union captures all possible fields.
 */
export interface Requisites {
  /** Кому — addressee (recipient). */
  to: string;
  /** От кого — sender. */
  from: string;
  /** Дата — document date (ISO-8601 or DD.MM.YYYY). */
  date: string;
  /** Тема — subject line. */
  subject: string;
  /** Номер — document number (required only for Письмо). */
  number?: string;
}

/**
 * Full map of document types keyed by ID.
 * Use `DOCUMENT_TYPES[typeId]` to look up metadata.
 */
export const DOCUMENT_TYPES: Record<DocumentTypeId, DocumentType> = {
  sluzhebnaya: {
    id: "sluzhebnaya",
    nameRu: "Служебная записка",
    nameTranslit: "sluzhebnaya",
    description: "Internal memo — short, informal, for intra-org communication.",
    sections: ["header", "body", "signature"],
    requiredFields: ["to", "from", "date", "subject"],
  },
  dokladnaya: {
    id: "dokladnaya",
    nameRu: "Докладная записка",
    nameTranslit: "dokladnaya",
    description: "Report memo — formal report with a conclusion section.",
    sections: ["header", "body", "conclusion", "signature"],
    requiredFields: ["to", "from", "date", "subject"],
  },
  informacionnaya: {
    id: "informacionnaya",
    nameRu: "Информационная справка",
    nameTranslit: "informacionnaya",
    description: "Information report — facts, analysis, and conclusion.",
    sections: ["header", "facts", "analysis", "conclusion"],
    requiredFields: ["to", "from", "date", "subject"],
  },
  pismo: {
    id: "pismo",
    nameRu: "Письмо",
    nameTranslit: "pismo",
    description: "Letter — formal external correspondence with greeting and closing.",
    sections: ["header", "greeting", "body", "closing", "signature"],
    requiredFields: ["to", "from", "date", "subject", "number"],
  },
};

/**
 * Flat array of document types for UI dropdowns / select inputs.
 * Each entry carries the `id` and `nameRu` for easy rendering.
 */
export const DOCUMENT_TYPE_LIST: { id: DocumentTypeId; label: string }[] =
  Object.values(DOCUMENT_TYPES).map((t) => ({ id: t.id, label: t.nameRu }));
