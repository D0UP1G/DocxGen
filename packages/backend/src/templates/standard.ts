/**
 * Standard (упрощённый) Typst template.
 *
 * A simpler, more modern style compared to the official template:
 * — Libertinus Serif 12pt (or Times New Roman fallback)
 * — Slightly smaller left margin (2.5cm)
 * — No first-line indent
 * — Simplified header (no grid, just labeled lines)
 * — Right-aligned signature
 */

import { TypstTemplate, DocumentData, escapeTypst } from './index.js';

/** Helper — returns the value or a placeholder if empty/missing. */
function req(value: string | undefined, fallback = '[Заполнить]'): string {
  if (!value || value.trim() === '') return fallback;
  return value;
}

/**
 * Render the Typst source for a simplified standard document.
 */
function generate(data: DocumentData): string {
  const { requisites, body } = data;
  const toField = escapeTypst(req(requisites.to));
  const fromField = escapeTypst(req(requisites.from));
  const dateField = escapeTypst(req(requisites.date));
  const numberField = escapeTypst(req(requisites.number));
  const subjectField = escapeTypst(req(requisites.subject));

  // Clean body: remove carriage returns, normalize line breaks
  const cleanBody = body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  return `// Simplified standard document
#set page(
  paper: "a4",
  margin: (left: 2.5cm, right: 1.5cm, top: 2cm, bottom: 2cm),
)

#set text(
  font: ("Libertinus Serif", "Times New Roman", "Liberation Serif"),
  size: 12pt,
  lang: "ru",
)

#set par(
  justify: true,
  leading: 0.83em,
)

// Simplified header — just lines
#block(width: 100%, inset: (bottom: 8pt))[
  *Кому:* ${toField} \\
  *От:* ${fromField} \\
  *Дата:* ${dateField} \\
  *Номер:* ${numberField}
]

// Subject line — left-aligned, bold
#text(weight: "bold", size: 13pt)[
  ${subjectField}
]

#v(8pt)

// Body text — directly inserted
${escapeTypst(cleanBody)}

// Simple signature — right-aligned
#align(right)[
  ${fromField}
]
`;
}

export const standardTemplate: TypstTemplate = {
  id: 'standard',
  name: 'Стандартный',
  description: 'Упрощённый стиль для внутренних документов',
  generate,
};
