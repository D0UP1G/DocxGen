/**
 * Official (строгий) ГОСТ-compliant Typst template.
 *
 * Produces a typst source string that renders a document conforming to
 * Russian ГОСТ standards for official correspondence:
 * — A4 page, specified margins (left 3cm, right 1.5cm, top/bottom 2cm)
 * — Times New Roman 14pt body, 1.5 line spacing
 * — First-line indent 1.25cm on body paragraphs
 * — Header grid: Кому | Дата / От кого | Номер
 * — Centered bold subject line
 * — Signature block at the end
 */

import { TypstTemplate, DocumentData, escapeTypst } from './index.js';

/** Helper — returns the value or a placeholder if empty/missing. */
function req(value: string | undefined, fallback = '[Заполнить]'): string {
  if (!value || value.trim() === '') return fallback;
  return value;
}

/**
 * Render the Typst source for a ГОСТ-compliant official document.
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

  return `// ГОСТ Р 6.30-2003 compliant document
#set page(
  paper: "a4",
  margin: (left: 3cm, right: 1.5cm, top: 2cm, bottom: 2cm),
)

#set text(
  font: ("Times New Roman", "Liberation Serif"),
  size: 14pt,
  lang: "ru",
)

#set par(
  justify: true,
  leading: 0.83em,
  first-line-indent: 1.25cm,
)

// Header block — 2x2 grid with fields
#block(width: 100%, inset: (bottom: 12pt))[
  #grid(
    columns: (1fr, 1fr),
    gutter: 12pt,
    [*Кому:* ${toField},],
    [*Дата:* ${dateField},],
    [*От кого:* ${fromField},],
    [*Номер:* ${numberField},],
  )
]

// Subject line — centered, bold
#align(center)[
  #text(weight: "bold", size: 14pt)[
    ${subjectField}
  ]
]

// Body text — directly inserted, no brackets
${escapeTypst(cleanBody)}

// Signature block
#block(width: 100%, inset: (top: 24pt))[
  #grid(
    columns: (2fr, 1fr),
    [],
    [
      _________________ \
      ${fromField}
    ],
  )
]
`;
}

export const officialTemplate: TypstTemplate = {
  id: 'official',
  name: 'Официальный',
  description: 'Строгий официальный стиль для деловой переписки',
  generate,
};
