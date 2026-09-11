import { Document, Packer, Header, Footer, Paragraph, TextRun, AlignmentType, PageNumber } from 'docx';
import { mm, pt, halfPt, line } from './units.js';
import { BLOCKS } from './blocks.js';

const ALIGN = {
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
  center: AlignmentType.CENTER,
  justify: AlignmentType.JUSTIFIED,
};

/**
 * Renders a DOCX document from the model.
 *
 * @param {{ docType: object, template: object, values: object, title: string|null, body: string[] }} model
 * @returns {Promise<Buffer>}  DOCX file as a Node.js Buffer
 */
export async function renderDocx(model) {
  const t = model.template;
  const font = {
    ascii: t.font.family,
    hAnsi: t.font.family,
    cs: t.font.family,
    eastAsia: t.font.family,
  };

  // Build document body from the layout block list
  const children = model.docType.layout.flatMap((block) => BLOCKS[block](model));

  const doc = new Document({
    creator: 'Документ за 3 шага',
    styles: {
      default: {
        document: {
          run: { font, size: halfPt(t.font.sizePt) },
          paragraph: {
            spacing: {
              line: line(t.paragraph.lineSpacing),
              after: pt(t.paragraph.spaceAfterPt),
            },
          },
        },
      },
    },
    sections: [{
    properties: {
      page: {
        margin: {
          top: mm(t.page.marginsMm.top),
          right: mm(t.page.marginsMm.right),
          bottom: mm(t.page.marginsMm.bottom),
          left: mm(t.page.marginsMm.left),
        },
      },
      titlePage: !t.header.firstPage,
    },
    headers: {
      default: buildHeader(t),
      first: buildFirstHeader(t),
    },
    footers: {
      default: buildFooter(t),
      first: buildFooter(t),
    },
    children,
    }],
  });

  return Packer.toBuffer(doc);
}

// ── Header / Footer builders ───────────────────────────────────────────────

function buildHeader(t) {
  const paragraphs = [];
  if (t.header.text) {
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun(t.header.text)],
    }));
  }
  if (t.header.pageNumber !== 'none') {
    paragraphs.push(new Paragraph({
      alignment: ALIGN[t.header.pageNumber],
      children: [new TextRun({ children: [PageNumber.CURRENT] })],
    }));
  }
  return new Header({ children: paragraphs });
}

/**
 * First-page header — empty when titlePage is active.
 * Uses a zero-width space so the docx library doesn't strip the file entirely.
 */
function buildFirstHeader(t) {
  if (t.header.firstPage) return buildHeader(t);
  // docx lib strips Header with empty children; use empty string TextRun
  return new Header({ children: [new Paragraph({ children: [new TextRun('')] })] });
}

function buildFooter(t) {
  const children = [];
  if (t.footer.text) {
    children.push(new Paragraph({
      children: [new TextRun({ text: t.footer.text, size: halfPt(t.font.sizePt - 2) })],
    }));
  }
  if (t.footer.pageNumber === 'nOfM') {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: ['Страница ', PageNumber.CURRENT, ' из ', PageNumber.TOTAL_PAGES] })],
    }));
  }
  // docx lib strips Footer with empty children — always emit content
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }));
  }
  return new Footer({ children });
}
