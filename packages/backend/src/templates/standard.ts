/**
 * Standard (упрощённый) Typst template — a lighter, modern alternative
 * to the strict ГОСТ-compliant official template.
 *
 * Visual differences from official:
 * — Libertinus Serif 12pt (vs Times New Roman 14pt)
 * — Margins: left 2.5cm, right 1.5cm, top/bottom 2cm
 * — No first-line indent on body paragraphs
 * — Simplified header: labeled lines, no grid
 * — Minimal right-aligned signature block
 *
 * Registered in TEMPLATES via index.ts.
 */

import { TypstTemplate, DocumentData } from './index';

/** Returns the value or a placeholder if empty/missing. */
function req(value: string | undefined, fallback = '[Заполнить]'): string {
  if (!value || value.trim() === '') return fallback;
  return value;
}

/**
 * Render the Typst source for a simplified, modern-styled document.
 *
 * Key design choices:
 * — Libertinus Serif gives a lighter, more contemporary feel than Times.
 * — Smaller left margin (2.5cm vs 3cm) fits more text per line.
 * — No first-line indent simplifies the paragraph look.
 * — Header is just labeled lines — no grid, no table.
 */
function generate(data: DocumentData): string {
  const { requisites, body } = data;
  const toField = req(requisites.to);
  const fromField = req(requisites.from);
  const dateField = req(requisites.date);
  const numberField = req(requisites.number);
  const subjectField = req(requisites.subject);

  // Split body into paragraphs — no first-line indent, just plain text blocks.
  const bodyParagraphs = body
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const bodyTypst = bodyParagraphs
    .map(p => `  ${p}`)
    .join('\n\n');

  return `// ── Standard (упрощённый) template ──
// Page setup: A4, relaxed margins
#set page(
  paper: "a4",
  margin: (
    left:   2.5cm,
    right:  1.5cm,
    top:    2cm,
    bottom: 2cm,
  ),
)

// Typography: Libertinus Serif 12pt — lighter, modern feel
#set text(
  font: ("Libertinus Serif", "Times New Roman"),
  size: 12pt,
  lang: "ru",
)
#set par(
  leading: 0.75em,   // 1.5 line spacing for 12pt
  justify: true,
)

// ── Header block (реквизиты) — simple labeled lines ──
#pad(bottom: 0.5cm)[
  *Кому:* ${toField} \
  *От кого:* ${fromField} \
  *Дата:* ${dateField} \
  *Номер:* ${numberField} \
]

// ── Subject line (left-aligned, bold) ──
#pad(bottom: 0.5cm)[
  #text(weight: "bold")[Тема: ${subjectField}]
]

// ── Body text — no first-line indent ──
${bodyTypst}

#v(1cm)

// ── Signature block — right-aligned, minimal ──
#align(right)[
  ${fromField} \
  ${dateField}
]
`;
}

/** The standard (упрощённый) template — registered in index.ts. */
export const standardTemplate: TypstTemplate = {
  id: 'standard',
  name: 'Стандартный (упрощённый)',
  description: 'Упрощённый шаблон: Libertinus Serif 12pt, уменьшенные поля, без отступа абзацев.',
  generate,
};
