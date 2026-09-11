/**
 * Template system foundation — defines the Typst template interface
 * and a registry that maps template IDs to template objects.
 *
 * Individual template files (e.g., './official', './standard') will
 * import this module and register themselves here.
 */

import { Requisites } from '../document-types';

/**
 * Data passed to every template's `generate` function.
 * Contains all the pieces needed to render a document.
 */
export interface DocumentData {
  /** Standard document header fields (реквизиты). */
  requisites: Requisites;
  /** The main body content of the document. */
  body: string;
  /** The document type identifier (e.g., 'sluzhebnaya', 'pismo'). */
  documentType: string;
}

/**
 * A Typst template — knows how to turn DocumentData into Typst markup.
 */
export interface TypstTemplate {
  /** Unique identifier used as the registry key. */
  id: string;
  /** Human-readable name (shown in UI). */
  name: string;
  /** Short description of the template's style. */
  description: string;
  /** Render the document data into a Typst source string. */
  generate: (data: DocumentData) => string;
}

// Individual templates register themselves here.
import { officialTemplate } from './official';
import { standardTemplate } from './standard';

/** Registry mapping template IDs to their template objects. */
export const TEMPLATES: Record<string, TypstTemplate> = {
  official: officialTemplate,
  standard: standardTemplate,
};

/** Look up a template by its ID. Returns undefined if not found. */
export function getTemplate(id: string): TypstTemplate | undefined {
  return TEMPLATES[id];
}

/** Flat array for UI dropdowns — label, description, and id. */
export const TEMPLATE_LIST: { id: string; label: string; description: string }[] =
  Object.values(TEMPLATES).map(t => ({ id: t.id, label: t.name, description: t.description }));
