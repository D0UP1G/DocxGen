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

## ГОСТ DOCUMENT FORMATTING RULES

ГОСТ standards for Russian business documentation (ГОСТ Р 7.0.5-2008, ГОСТ 2.105-95, ГОСТ Р 6.30-2003):

### ГОСТ Page Setup (A4)
\`\`\`typst
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 3cm, right: 1.5cm),
  numbering: "1",
  header: align(right)[Документ],
  footer: align(center)[#context counter(page).display()],
)
\`\`\`

### ГОСТ Typography
\`\`\`typst
// Основной шрифт — Times New Roman ( Libertinus Serif)
#set text(font: ("Times New Roman", "Libertinus Serif"), size: 14pt)

// Межстрочный интервал 1.5, абзацный отступ 1.25 см
#set par(justify: true, leading: 0.83em, first-line-indent: 1.25cm)

// Заголовки — 12-14pt, жирный
#show heading: set text(weight: "bold")
#show heading: set par(first-line-indent: 0cm)
\`\`\`

### ГОСТ Document Header (Шапка)
\`\`\`typst
// Шапка документа по ГОСТ
#align(center)[
  *КОМУ:* Иванов И. И.\\
  *ОТ КОГО:* Петров П. П.\\
  *ДАТА:* #datetime.today().display("[day].[month].[year]")\\
  *НОМЕР:* 001-2024
]

#v(1em)

// Заголовок документа
#align(center)[= ЗАГОЛОВОК ДОКУМЕНТА]

#v(1em)
\`\`\`

### ГОСТ Signature Block (Подпись)
\`\`\`typst
// Блок подписи по ГОСТ
#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *Исполнитель:*\\
    #underline[_______________] / Иванов И. И./\\
    *Дата:* #datetime.today().display("[day].[month].[year]")
  ],
  [
    *Руководитель:*\\
    #underline[_______________] / Петров П. П./\\
    *Дата:* #datetime.today().display("[day].[month].[year]")
  ],
)
\`\`\`

### ГОСТ Table Formatting
\`\`\`typst
// Таблица по ГОСТ с границами
#figure(
  table(
    columns: 3,
    stroke: 0.5pt,
    fill: (_, y) => if y == 0 { rgb("#1a5276") },
    table.header[Наименование][Количество][Примечание],
    [Пункт 1], [10 шт.], [Важный],
    [Пункт 2], [5 шт.], [Срочный],
    [Пункт 3], [20 шт.], [Обычный],
  ),
  caption: [Таблица 1 — Перечень элементов],
)
\`\`\`

### ГОСТ Russian Typography Rules
\`\`\`typst
// Кавычки — русские «ёлочки»
«Текст в кавыках»

// Тире — не дефис, а длинное тире (—)
Первая фраза — вторая фраза.

// Неразрывные пробелы после инициалов
И.#sym.space.nobreak#sym.space.nobreakП.#sym.space.nobreak#sym.space.nobreakПетров

// Или используйте символ неразрывного пробела
И.\u{00A0}П.\u{00A0}Петров
\`\`\`

### ГОСТ Document Structure Template
\`\`\`typst
//     по ГОСТ
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 3cm, right: 1.5cm),
  numbering: "1",
)

#set text(font: ("Times New Roman", "Libertinus Serif"), size: 14pt)
#set par(justify: true, leading: 0.83em, first-line-indent: 1.25cm)

// Шапка
#align(center)[
  *КОМУ:* #context state("recipient").get()\\
  *ОТ КОГО:* #context state("sender").get()\\
  *ДАТА:* #datetime.today().display("[day].[month].[year]")
]

#v(1em)

// Заголовок
#align(center)[= ЗАГОЛОВОК ДОКУМЕНТА]

#v(1em)

// Содержание
#lorem(50)

// Таблица
#figure(
  table(
    columns: 2,
    stroke: 0.5pt,
    table.header[Параметр][Значение],
    [Параметр 1], [Значение 1],
  ),
  caption: [Таблица 1],
)

// Подпись
#v(2em)
#align(right)[
  *Подпись:* #underline[_______________] / ФИО /
]
\`\`\`
`;
