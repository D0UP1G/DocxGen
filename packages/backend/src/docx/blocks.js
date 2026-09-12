import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { mm, halfPt } from './units.js';

/**
 * @typedef {{
 *   docType: object,
 *   template: object,
 *   values: Record<string, { value: string|null, label: string, source: string }>,
 *   title: string|null,
 *   body: string[]
 * }} RenderModel
 */

const ALIGN = {
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
  center: AlignmentType.CENTER,
  justify: AlignmentType.JUSTIFIED,
};

/**
 * Returns a TextRun with the field value, or a highlighted placeholder [Label]
 * when the value is missing. All unfilled placeholders MUST go through this
 * function to ensure consistent formatting.
 *
 * @param {RenderModel} model
 * @param {string} key  field key (e.g. 'Адресат', 'Дата', 'Номер')
 * @returns {TextRun|TextRun[]}
 */
export function valueRuns(model, key) {
  const val = model.values[key]?.value;
  // Empty string "" is intentionally treated as missing — it falls through to the placeholder.
  // This matches the AI extraction behavior: empty fields come back as "" not null.
  if (val) {
    return [new TextRun(val)];
  }
  const label = model.values[key]?.label ?? key;
  return [new TextRun({
    text: `[${label}]`,
    highlight: model.template.placeholder.highlight ?? undefined,
  })];
}

// ── Block functions ─────────────────────────────────────────────────────────

/**
 * Organization header — name and address from template.
 * For 'modern' template: empty (org is in the header).
 */
function orgHeader(model) {
  const t = model.template;
  const cfg = t.blocks.orgHeader;
  if (!cfg.show) return [];

  const runs = [];
  runs.push(new TextRun({ text: t.organization.name, bold: cfg.bold }));
  if (t.organization.address) {
    runs.push(new TextRun({ text: `\n${t.organization.address}`, bold: cfg.bold }));
  }

  return [new Paragraph({
    alignment: ALIGN[cfg.align],
    children: runs,
  })];
}

/**
 * Addressee block.
 * position "right": borderless table, 2 columns (left empty, right = widthPercent%).
 * position "left": paragraphs without indent.
 * For letter: outputs Организация адресата, Лицо адресата, Адрес адресата separately.
 */
function addressee(model) {
  const t = model.template;
  const cfg = t.blocks.addressee;
  const isLetter = model.docType.id === 'letter';

  if (cfg.position === 'right') {
    // Table without borders, two columns
    const cells = [
      new TableCell({ children: [new Paragraph({ children: [] })], borders: noBorders() }),
      new TableCell({
        width: { size: cfg.widthPercent, type: WidthType.PERCENTAGE },
        children: isLetter ? letterAddresseeParas(model) : [new Paragraph({ children: valueRuns(model, 'Адресат') })],
        borders: noBorders(),
      }),
    ];
    return [new Table({ rows: [new TableRow({ children: cells })] })];
  }

  // position === 'left': plain paragraphs, no indent
  if (isLetter) return letterAddresseeParas(model);
  return [new Paragraph({ children: valueRuns(model, 'Адресат') })];
}

/** Letter-specific addressee: three separate paragraphs. */
function letterAddresseeParas(model) {
  return [
    new Paragraph({ children: valueRuns(model, 'Организация адресата') }),
    new Paragraph({ children: valueRuns(model, 'Лицо адресата') }),
    new Paragraph({ children: valueRuns(model, 'Адрес адресата') }),
  ];
}

/**
 * Document type title (e.g. "СЛУЖЕБНАЯ ЗАПИСКА").
 * Skipped for letter (docTitle is null).
 */
function docTitle(model) {
  const dt = model.docType;
  if (!dt.docTitle) return [];

  const cfg = model.template.blocks.docTitle;
  return [new Paragraph({
    alignment: ALIGN[cfg.align],
    children: [new TextRun({ text: dt.docTitle, bold: cfg.bold })],
  })];
}

/**
 * Date and number row.
 * "row" layout: both in one borderless table row.
 * "stack" layout: two separate paragraphs.
 */
function dateNumber(model) {
  const cfg = model.template.blocks.dateNumber;
  const dateRuns = valueRuns(model, 'Дата');
  // For placeholder number, prepend "№ " so it reads "№ [Номер]"
  const numberParaRuns = model.values['Номер']?.value
    ? [new TextRun(` № ${model.values['Номер'].value}`)]
    : [new TextRun(' № '), ...valueRuns(model, 'Номер')];

  if (cfg.layout === 'row') {
    return [new Table({
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: dateRuns })],
            borders: noBorders(),
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: numberParaRuns })],
            borders: noBorders(),
          }),
        ],
      })],
    })];
  }

  // stack layout
  return [
    new Paragraph({ children: dateRuns }),
    new Paragraph({ children: numberParaRuns }),
  ];
}

/**
 * Title paragraph: "О ..." from version.title or placeholder.
 */
function title(model) {
  const cfg = model.template.blocks.title;
  const runs = model.title
    ? [new TextRun({ text: `О ${model.title}`, bold: cfg.bold, italics: cfg.italic })]
    : [new TextRun({ text: 'О ', bold: cfg.bold, italics: cfg.italic }), ...valueRuns(model, 'Тема')];
  return [new Paragraph({
    alignment: ALIGN[cfg.align],
    children: runs,
  })];
}

/**
 * Salutation paragraph — centered, letter only.
 */
function salutation(model) {
  if (!model.values['Обращение']?.value) return [];
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun(model.values['Обращение'].value)],
  })];
}

/**
 * Body paragraphs — with firstLineIndentMm and align from template.
 */
function body(model) {
  const t = model.template;
  return (model.body || []).map((text) => new Paragraph({
    alignment: ALIGN[t.paragraph.align],
    indent: t.paragraph.firstLineIndentMm > 0
      ? { firstLine: mm(t.paragraph.firstLineIndentMm) }
      : undefined,
    children: [new TextRun(text)],
  }));
}

/**
 * Signature block.
 * "row" layout: position left, name right (borderless table).
 * "stack" layout: position over name (modern).
 *
 * Memo/report: Должность автора + ФИО автора.
 * Letter: Должность подписывающего + ФИО подписывающего.
 *
 * NOTE: Letter uses different field keys than other docTypes.
 */
function signature(model) {
  const isLetter = model.docType.id === 'letter';
  const posKey = isLetter ? 'Должность подписывающего' : 'Должность автора';
  const nameKey = isLetter ? 'ФИО подписывающего' : 'ФИО автора';
  const cfg = model.template.blocks.signature;

  if (cfg.layout === 'row') {
    return [new Table({
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: valueRuns(model, posKey) })],
            borders: noBorders(),
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: valueRuns(model, nameKey) })],
            borders: noBorders(),
          }),
        ],
      })],
    })];
  }

  // stack layout
  return [
    new Paragraph({ children: valueRuns(model, posKey) }),
    new Paragraph({ children: valueRuns(model, nameKey) }),
  ];
}

/**
 * Executor — small font at bottom, letter only.
 */
function executor(model) {
  if (!model.values['Исполнитель']?.value) return [];
  const t = model.template;
  return [new Paragraph({
    children: [new TextRun({
      text: model.values['Исполнитель'].value,
      size: halfPt(t.font.sizePt - 2),
    })],
  })];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns zero-width border config for borderless table cells. */
function noBorders() {
  const b = { style: 'none', size: 0, color: 'FFFFFF' };
  return { top: b, bottom: b, left: b, right: b };
}

// ── Layout builders ─────────────────────────────────────────────────────────

/**
 * Layout builders — one per template+docType combination.
 * Each builder calls the block functions in the correct order for its combo.
 * Block functions read their own config from model.template.blocks.*,
 * so layout builders only need to specify the sequence.
 */

/** classic + memo: orgHeader → addressee → docTitle → dateNumber → title → body → signature */
function classicMemoLayout(model) {
  return [
    ...orgHeader(model),
    ...addressee(model),
    ...docTitle(model),
    ...dateNumber(model),
    ...title(model),
    ...body(model),
    ...signature(model),
  ];
}

/** classic + report: same as classic + memo */
const classicReportLayout = classicMemoLayout;

/** classic + reference: orgHeader → docTitle → dateNumber → title → body → signature */
function classicReferenceLayout(model) {
  return [
    ...orgHeader(model),
    ...docTitle(model),
    ...dateNumber(model),
    ...title(model),
    ...body(model),
    ...signature(model),
  ];
}

/** classic + letter: orgHeader → dateNumber → addressee → title → salutation → body → signature → executor */
function classicLetterLayout(model) {
  return [
    ...orgHeader(model),
    ...dateNumber(model),
    ...addressee(model),
    ...title(model),
    ...salutation(model),
    ...body(model),
    ...signature(model),
    ...executor(model),
  ];
}

/** modern + memo: addressee → docTitle → dateNumber → title → body → signature */
function modernMemoLayout(model) {
  return [
    ...addressee(model),
    ...docTitle(model),
    ...dateNumber(model),
    ...title(model),
    ...body(model),
    ...signature(model),
  ];
}

/** modern + report: same as modern + memo */
const modernReportLayout = modernMemoLayout;

/** modern + reference: docTitle → dateNumber → title → body → signature */
function modernReferenceLayout(model) {
  return [
    ...docTitle(model),
    ...dateNumber(model),
    ...title(model),
    ...body(model),
    ...signature(model),
  ];
}

/** modern + letter: dateNumber → addressee → title → salutation → body → signature → executor */
function modernLetterLayout(model) {
  return [
    ...dateNumber(model),
    ...addressee(model),
    ...title(model),
    ...salutation(model),
    ...body(model),
    ...signature(model),
    ...executor(model),
  ];
}

/**
 * Registry of layout builders, keyed by "templateId:docTypeId".
 * @type {Record<string, (model: RenderModel) => (Paragraph|Table)[]>}
 */
const LAYOUTS = {
  'classic:memo': classicMemoLayout,
  'classic:report': classicReportLayout,
  'classic:reference': classicReferenceLayout,
  'classic:letter': classicLetterLayout,
  'modern:memo': modernMemoLayout,
  'modern:report': modernReportLayout,
  'modern:reference': modernReferenceLayout,
  'modern:letter': modernLetterLayout,
};

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Main entry point — generates the full document layout for a given
 * template+docType combination with [Label] placeholders.
 *
 * @param {RenderModel} model
 * @returns {(Paragraph|Table)[]}
 */
export function construct(model) {
  const key = `${model.template.id}:${model.docType.id}`;
  const layout = LAYOUTS[key];
  if (!layout) {
    throw new Error(`No layout defined for template=${model.template.id} docType=${model.docType.id}`);
  }
  return layout(model);
}

/**
 * Registry of block functions, keyed by layout name.
 * Each function receives the full RenderModel and returns (Paragraph|Table)[].
 *
 * Kept for backward compatibility with render.js (docType.layout iteration).
 *
 * @type {Record<string, (model: RenderModel) => (Paragraph|Table)[]>}
 */
export const BLOCKS = {
  orgHeader,
  addressee,
  docTitle,
  dateNumber,
  title,
  salutation,
  body,
  signature,
  executor,
};
