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
 *
 * This template is registered in the TEMPLATES registry via index.ts.
 */

import { TypstTemplate, DocumentData } from './index';

/** Helper — returns the value or a placeholder if empty/missing. */
function req(value: string | undefined, fallback = '[Заполнить]'): string {
  if (!value || value.trim() === '') return fallback;
  return value;
}

/**
 * Render the Typst source for a ГОСТ-compliant official document.
 *
 * Rationale for Typst over DOCX generation:
 * — Typst produces clean, predictable PDF without Word-version quirks.
 * — The `typst` CLI can convert to .docx via `typst compile --format docx`
 *   when Word compatibility is required downstream.
 * — Template logic stays in TypeScript; no Word XML manipulation.
 */
function generate(data: DocumentData): string {
  const { requisites, body } = data;
  const toField = req(requisites.to);
  const fromField = req(requisites.from);
  const dateField = req(requisites.date);
  const numberField = req(requisites.number);
  const subjectField = req(requisites.subject);

  // Split body into paragraphs, preserving blank-line paragraph breaks.
  // Each non-empty line becomes its own Typst paragraph with first-line indent.
  const bodyParagraphs = body
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const bodyTypst = bodyParagraphs
    .map(p => `#pad(first-line: 1.25cm)[\n  ${p}\n]`)
    .join('\n\n');

  return `// ── ГОСТ-compliant official document template ──
// Page setup: A4, ГОСТ margins
#set page(
  paper: "a4",
  margin: (
    left:   3cm,
    right:  1.5cm,
    top:    2cm,
    bottom: 2cm,
  ),
)

// Typography: Times New Roman 14pt, 1.5 line spacing
#set text(
  font: "Times New Roman",
  size: 14pt,
  lang: "ru",
)
#set par(
  leading: 0.83em,   // 1.5 line spacing (0.83em ≈ 14pt × 1.5)
  justify: true,
)

// ── Header block (реквизиты) ──
#grid(
  columns: (1fr, 1fr),
  column-gutter: 1cm,
  [**Кому:** ${toField} \ ],   [**Дата:** ${dateField}],
  [**От кого:** ${fromField} \ ], [**Номер:** ${numberField}],
)

#v(0.5cm)

// ── Subject line (centered, bold) ──
#align(center)[
  #text(weight: "bold", size: 14pt)[Тема: ${subjectField}]
]

#v(0.5cm)

// ── Body text ──
${bodyTypst}

#v(1cm)

// ── Signature block ──
#align(right)[
  ${fromField} \
  _________________________ \
  ${dateField}
]
`;
}

/** The official ГОСТ template — registered in index.ts. */
export const officialTemplate: TypstTemplate = {
  id: 'official',
  name: 'Официальный (ГОСТ)',
  description: 'Строгий ГОСТ-шаблон: A4, Times New Roman 14pt, поля по ГОСТ, сетка реквизитов.',
  generate,
};
