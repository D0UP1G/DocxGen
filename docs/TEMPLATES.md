# Templates

Two visual templates for document rendering. Each defines font, spacing, layout blocks, and placeholder behavior.

## Classic — Классический

**Config:** `packages/backend/config/templates/classic.json`

Traditional corporate layout: Times New Roman, 14pt, 1.5 line spacing, right-aligned addressee.

### Typography

| Property | Value |
|----------|-------|
| Font family | Times New Roman |
| Font size | 14pt |
| Line spacing | 1.5 (polu-torny interval) |
| First line indent | 12.5mm |
| Alignment | Justified |
| Space after paragraph | 0pt |

### Page Layout

| Property | Value |
|----------|-------|
| Top margin | 20mm |
| Right margin | 10mm |
| Bottom margin | 20mm |
| Left margin | 30mm |

### Header / Footer

| Property | Value |
|----------|-------|
| Header text | `null` (no text) |
| Header page number | Center (from second page) |
| First page header | Empty (titlePage mode) |
| Footer text | `null` |

### Blocks

| Block | Configuration |
|-------|---------------|
| `orgHeader` | `show: true`, centered, bold |
| `addressee` | `position: "right"`, `widthPercent: 45` (borderless 2-column table) |
| `docTitle` | centered, bold |
| `dateNumber` | `layout: "row"` (side-by-side in borderless table) |
| `title` | left-aligned, not bold, not italic |
| `signature` | `layout: "row"` (position left, name right) |

### Required Fields

```json
"requiredFields": ["Адресат", "Дата", "Номер", "Автор", "Должность", "Подпись"]
```

### Layout Combinations

| DocType | Block Order |
|---------|-------------|
| Memo | orgHeader → addressee → docTitle → dateNumber → title → body → signature |
| Report | orgHeader → addressee → docTitle → dateNumber → title → body → signature |
| Reference | orgHeader → docTitle → dateNumber → title → body → signature |
| Letter | orgHeader → dateNumber → addressee → title → salutation → body → signature → executor |

---

## Modern — Современный

**Config:** `packages/backend/config/templates/modern.json`

Contemporary regulatory layout: Arial, 12pt, 1.15 line spacing, left-aligned addressee.

### Typography

| Property | Value |
|----------|-------|
| Font family | Arial |
| Font size | 12pt |
| Line spacing | 1.15 |
| First line indent | 0mm (no indent) |
| Alignment | Left |
| Space after paragraph | 6pt |

### Page Layout

| Property | Value |
|----------|-------|
| Top margin | 25mm |
| Right margin | 15mm |
| Bottom margin | 25mm |
| Left margin | 25mm |

### Header / Footer

| Property | Value |
|----------|-------|
| Header text | `ООО «Пример"` (organization name) |
| Header page number | None |
| First page header | Same as default |
| Footer text | `null` |
| Footer page number | `nOfM` ("Страница N из M") |

### Blocks

| Block | Configuration |
|-------|---------------|
| `orgHeader` | `show: false` (org is in the header) |
| `addressee` | `position: "left"`, `widthPercent: 100` (plain paragraphs, no indent) |
| `docTitle` | centered, bold |
| `dateNumber` | `layout: "stack"` (separate paragraphs) |
| `title` | left-aligned, bold, not italic |
| `signature` | `layout: "stack"` (position over name) |

### Required Fields

```json
"requiredFields": ["Адресат", "Дата", "Номер", "Автор", "Должность", "Подпись"]
```

### Layout Combinations

| DocType | Block Order |
|---------|-------------|
| Memo | addressee → docTitle → dateNumber → title → body → signature |
| Report | addressee → docTitle → dateNumber → title → body → signature |
| Reference | docTitle → dateNumber → title → body → signature |
| Letter | dateNumber → addressee → title → salutation → body → signature → executor |

---

## Template Comparison

| Property | Classic | Modern |
|----------|---------|--------|
| Font | Times New Roman 14pt | Arial 12pt |
| Line spacing | 1.5 | 1.15 |
| First line indent | 12.5mm | 0mm |
| Alignment | Justified | Left |
| Addressee position | Right (45% width) | Left (full width) |
| Date/Number layout | Row (side-by-side) | Stack (separate) |
| Signature layout | Row (position left, name right) | Stack (position over name) |
| Org header | Shown (centered, bold) | Hidden (in page header) |
| Page numbers | Center (from page 2) | "Страница N из M" in footer |

## Block Rendering Details

### orgHeader

Renders the organization name and address from the template config:

```javascript
// From packages/backend/src/docx/blocks.js:50-65
function orgHeader(model) {
  const t = model.template;
  const cfg = t.blocks.orgHeader;
  if (!cfg.show) return [];  // Modern: hidden (org is in header)

  const runs = [];
  runs.push(new TextRun({ text: t.organization.name, bold: cfg.bold }));
  if (t.organization.address) {
    runs.push(new TextRun({ text: `\n${t.organization.address}`, bold: cfg.bold }));
  }
  return [new Paragraph({ alignment: ALIGN[cfg.align], children: runs })];
}
```

### addressee

Two modes based on `position`:

- **`"right"`** (Classic): Borderless 2-column table, left empty, right = `widthPercent`%
- **`"left"`** (Modern): Plain paragraphs without indent

For letters, the addressee renders three separate paragraphs: `Организация адресата`, `Лицо адресата`, `Адрес адресата`.

### dateNumber

Two modes based on `layout`:

- **`"row"`** (Classic): Date and number in a borderless table row (50%/50%)
- **`"stack"`** (Modern): Two separate paragraphs

Number always gets `№ ` prefix: `№ [Номер]` when placeholder, `№ 123` when filled.

### signature

Two modes based on `layout`:

- **`"row"`** (Classic): Borderless table, position left (50%), name right (50%, right-aligned)
- **`"stack"`** (Modern): Two paragraphs, position over name

For letters, uses `Должность подписывающего` + `ФИО подписывающего`. For other docTypes, uses `Должность автора` + `ФИО автора`.

### salutation

Letter-only block. Renders `Обращение` centered. Only appears if the AI derived a value (requires first name + patronymic in the recipient's name).

### executor

Letter-only block. Renders `Исполнитель` in smaller font (template font size - 2pt).
