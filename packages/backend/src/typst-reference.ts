/**
 * typst-reference.ts — Condensed Typst documentation for AI context.
 *
 * This is NOT the full Typst docs. It's the essential reference
 * that ensures the AI generates valid Typst syntax.
 */

export const TYPST_REFERENCE = `
## Typst Quick Reference

### Page Setup
\`\`\`typst
#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2.5cm),
  numbering: "1",
  header: align(right)[Документ],
  footer: align(center)[#context counter(page).display()],
)
\`\`\`

### Text & Paragraph
\`\`\`typst
#set text(font: "New Computer Modern", size: 12pt)
#set par(justify: true, leading: 0.78em, first-line-indent: 1.2em)
\`\`\`

### Headings
\`\`\`typst
= Заголовок первого уровня
== Заголовок второго уровня
=== Заголовок третьего уровня
\`\`\`

### Lists
\`\`\`typst
- Маркированный список
- Второй пункт

+ Нумерованный список
+ Второй пункт
\`\`\`

### Tables
\`\`\`typst
#figure(
  table(
    columns: 3,
    fill: (_, y) => if y == 0 { rgb("#1a5276") },
    table.header[Ячейка 1][Ячейка 2][Ячейка 3],
    [Данные 1], [Данные 2], [Данные 3],
    [Данные 4], [Данные 5], [Данные 6],
  ),
  caption: [Заголовок таблицы],
)
\`\`\`

### Colors
\`\`\`typst
// Hex
#square(fill: rgb("#1a5276"))
// RGB
#square(fill: rgb(26, 82, 118))
// Named
#square(fill: blue)
// Transparent
#square(fill: red.transparentize(50%))
// Mix
#square(fill: red.mix(blue))
\`\`\`

### Layout & Alignment
\`\`\`typst
#align(center)[Центрированный текст]
#align(right)[Выравнивание вправо]
#pad(x: 1em)[Отступы]
#block(width: 100%, fill: rgb("#f8f9fa"), radius: 4pt)[Блок]
\`\`\`

### Grid Layout
\`\`\`typst
#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 10pt,
  [Ячейка 1], [Ячейка 2], [Ячейка 3],
)
\`\`\`

### Visual Elements
\`\`\`typst
// Линия
#line(length: 100%, stroke: 1pt + rgb("#1a5276"))

// Прямоугольник
#rect(
  width: 100%,
  fill: rgb("#f8f9fa"),
  stroke: 1pt + rgb("#1a5276"),
  radius: 4pt,
  inset: 12pt,
)[Содержимое]

// Круг
#circle(fill: rgb("#2e86c1"), radius: 10pt)

// Блок с цветной полосой
#block(
  width: 100%,
  fill: rgb("#f8f9fa"),
  radius: (left: 4pt, right: 0pt),
  inset: (left: 16pt, y: 12pt, right: 12pt),
  stroke: (left: 4pt + rgb("#1a5276")),
)[Важная информация]
\`\`\`

### Figure
\`\`\`typst
#figure(
  rect(width: 100%, height: 60pt, fill: rgb("#e8f4f8")),
  caption: [Рисунок 1],
)
\`\`\`

### Links & References
\`\`\`typst
#link("https://example.com")[Ссылка]
<cite>reference
\`\`\`

### Code Blocks
\`\`\`typst
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`
\`\`\`

### Math
\`\`\`typst
$ integral_0^oo f(x) dx $
$ E = m c^2 $
\`\`\`

### Columns
\`\`\`typst
#columns(2)[
  Текст в первой колонке.
  #colbreak()
  Текст во второй колонке.
]
\`\`\`

### Page Break
\`\`\`typst
#pagebreak()
\`\`\`

### Strong & Emphasis
\`\`\`typst
**Жирный текст**
_Курсивный текст_
\`\`\`

### Quote
\`\`\`typst
#quote[Цитата]
\`\`\`

### Line Break
\`\`\`typst
Первая строка \
Вторая строка
\`\`\`

### Important Syntax Rules
- Use \`=\` for headings (not \`#\`)
- Use \`-\` for unordered lists
- Use \`+\` for ordered lists
- Use \`$\` for inline math
- Use \`#\` prefix for functions: \`#set\`, \`#show\`, \`#align\`, etc.
- Strings use \`[brackets]\` not quotes
- Comments use \`//\`
- No semicolons needed
- Indentation is for readability, not syntax
`;
