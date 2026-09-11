import { deflateRawSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import type { DocumentTypeId, Requisites } from '../document-types.js';

export interface DocxDocumentData {
  documentType: DocumentTypeId;
  templateId: 'official' | 'standard';
  requisites: Requisites;
  body: string;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);
    const local = Buffer.concat([
      Buffer.from('PK\x03\x04', 'binary'),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressed.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
      compressed,
    ]);
    localParts.push(local);

    const central = Buffer.concat([
      Buffer.from('PK\x01\x02', 'binary'),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressed.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const locals = Buffer.concat(localParts);
  const end = Buffer.concat([
    Buffer.from('PK\x05\x06', 'binary'),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.length),
    u32(locals.length),
    u16(0),
  ]);
  return Buffer.concat([locals, centralDirectory, end]);
}

function xml(value: string | undefined): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paragraph(
  text: string,
  options: { bold?: boolean; center?: boolean; right?: boolean; indent?: number; spacing?: number; style?: string } = {},
): string {
  const pPr: string[] = [];
  if (options.style) pPr.push(`<w:pStyle w:val="${options.style}"/>`);
  if (options.center) pPr.push('<w:jc w:val="center"/>');
  if (options.right) pPr.push('<w:jc w:val="right"/>');
  if (options.indent !== undefined) pPr.push(`<w:ind w:firstLine="${options.indent}"/>`);
  if (options.spacing !== undefined) pPr.push(`<w:spacing w:line="${options.spacing}" w:lineRule="auto" w:after="120"/>`);
  const rPr = options.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}<w:r>${rPr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

function table(rows: Array<[string, string]>, fontSize: number): string {
  const rowXml = rows.map(([left, right]) =>
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${paragraph(left, { spacing: 276 })}</w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${paragraph(right, { spacing: 276 })}</w:tc></w:tr>`,
  ).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E2F3"/><w:left w:val="single" w:sz="4" w:color="D9E2F3"/><w:bottom w:val="single" w:sz="4" w:color="D9E2F3"/><w:right w:val="single" w:sz="4" w:color="D9E2F3"/><w:insideH w:val="single" w:sz="4" w:color="D9E2F3"/><w:insideV w:val="single" w:sz="4" w:color="D9E2F3"/></w:tblBorders></w:tblPr>${rowXml}</w:tbl>`;
}

function typeTitle(documentType: DocumentTypeId): string {
  return {
    sluzhebnaya: 'СЛУЖЕБНАЯ ЗАПИСКА',
    dokladnaya: 'ДОКЛАДНАЯ ЗАПИСКА',
    informacionnaya: 'ИНФОРМАЦИОННАЯ СПРАВКА',
    pismo: 'ПИСЬМО',
  }[documentType];
}

function labelFor(documentType: DocumentTypeId, field: keyof Requisites): string {
  if (documentType === 'informacionnaya' && field === 'from') return 'Составитель';
  if (field === 'from') return documentType === 'pismo' ? 'Отправитель' : 'Автор';
  if (field === 'subject') return documentType === 'pismo' ? 'Тема' : 'Заголовок';
  if (field === 'to') return 'Адресат';
  return { date: 'Дата', number: 'Номер', position: 'Должность', signature: 'Подпись', greeting: 'Обращение', executor: 'Исполнитель' }[field] || field;
}

function valueOrPlaceholder(value: string | undefined, label: string): string {
  return value?.trim() || `[${label}]`;
}

function documentXml(data: DocxDocumentData): string {
  const { documentType, templateId, requisites } = data;
  const official = templateId === 'official';
  const font = official ? 'Times New Roman' : 'Arial';
  const size = official ? 28 : 24;
  const line = official ? 360 : 276;
  const indent = official ? 709 : 0;
  const margin = official ? { left: 1701, right: 850, top: 1134, bottom: 1134 } : { left: 1418, right: 1134, top: 850, bottom: 850 };
  const p = (text: string, options: Parameters<typeof paragraph>[1] = {}) => paragraph(text, { spacing: line, indent, ...options });

  const rows: Array<[string, string]> = [];
  if (documentType !== 'informacionnaya') rows.push([`${labelFor(documentType, 'to')}:`, valueOrPlaceholder(requisites.to, labelFor(documentType, 'to'))]);
  rows.push([`${labelFor(documentType, 'from')}:`, valueOrPlaceholder(requisites.from, labelFor(documentType, 'from'))]);
  rows.push(['Дата:', valueOrPlaceholder(requisites.date, 'Дата')]);
  if (documentType !== 'informacionnaya') rows.push(['Номер:', valueOrPlaceholder(requisites.number, 'Номер')]);

  const body = data.body.trim() || '[Текст]';
  const bodyParagraphs = body.split(/\n\s*\n/).map((part) => p(part.trim()));
  const title = p(typeTitle(documentType), { bold: true, center: true, indent: 0, spacing: line });
  const subject = p(valueOrPlaceholder(requisites.subject, documentType === 'pismo' ? 'Тема' : 'Заголовок'), { bold: true, center: official, indent: 0, spacing: line });
  const greeting = requisites.greeting?.trim() ? p(requisites.greeting, { indent: 0, spacing: line }) : '';
  const signature = p(`${valueOrPlaceholder(requisites.position, 'Должность')} ____________________ ${valueOrPlaceholder(requisites.signature || requisites.from, 'Подпись')}`, { right: !official, indent: 0, spacing: line });
  const meta = official ? rows.map(([label, value]) => p(`${label} ${value}`, { right: true, indent: 0, spacing: line })).join('') : table(rows, size);
  const headerRef = official ? '<w:headerReference w:type="default" r:id="rId2"/>' : '';
  const footerRef = '<w:footerReference w:type="default" r:id="rId3"/>';
  const bodyContent = `${meta}${title}${subject}${greeting}${bodyParagraphs.join('')}${signature}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyContent}<w:sectPr>${headerRef}${footerRef}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${margin.top}" w:right="${margin.right}" w:bottom="${margin.bottom}" w:left="${margin.left}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:num="1"/></w:sectPr></w:body></w:document>`;
}

function stylesXml(templateId: 'official' | 'standard'): string {
  const font = templateId === 'official' ? 'Times New Roman' : 'Arial';
  const size = templateId === 'official' ? '28' : '24';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:line="${templateId === 'official' ? 360 : 276}" w:lineRule="auto"/></w:pPr></w:style></w:styles>`;
}

function headerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraph('Документ за 3 шага', { center: true, spacing: 240 })}</w:hdr>`;
}

function footerXml(data: DocxDocumentData): string {
  const date = data.requisites.date?.trim() || '[Дата]';
  if (data.templateId === 'official') {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Страница </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraph(`${typeTitle(data.documentType)} — ${date}`, { center: true, spacing: 180 })}</w:ftr>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
}

export function generateDocx(data: DocxDocumentData): Buffer {
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypesXml()) },
    { name: '_rels/.rels', data: Buffer.from(rootRels) },
    { name: 'word/document.xml', data: Buffer.from(documentXml(data)) },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(documentRels) },
    { name: 'word/styles.xml', data: Buffer.from(stylesXml(data.templateId)) },
    { name: 'word/header.xml', data: Buffer.from(headerXml()) },
    { name: 'word/footer.xml', data: Buffer.from(footerXml(data)) },
  ];
  return buildZip(entries);
}

export function makeDocxFilename(data: Pick<DocxDocumentData, 'documentType' | 'templateId'>): string {
  const suffix = randomBytes(3).toString('hex');
  return `${data.documentType}-${data.templateId}-${suffix}.docx`;
}
