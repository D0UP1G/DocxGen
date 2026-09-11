---
name: typst-docs
description: Complete Typst syntax reference for generating valid Typst documents. Use this when creating, editing, or fixing Typst markup.
---

# Typst Documentation — Condensed Reference

## Page Setup

```typst
#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2.5cm),
  numbering: "1",
  header: align(right)[Document Title],
  footer: align(center)[#context counter(page).display()],
)
```

### Page Parameters
- `paper`: string — paper size ("a4", "us-letter", "iso-b7", etc.)
- `width`, `height`: auto | length — custom page dimensions
- `margin`: auto | relative | dictionary — page margins
- `numbering`: none | str | function — page numbering format
- `number-align`: alignment — where to place page numbers
- `header`: none | auto | content — header content
- `header-ascent`: relative — header spacing from content
- `footer`: none | auto | content — footer content
- `footer-descent`: relative — footer spacing from content
- `fill`: none | auto | color | gradient | tiling — page background
- `columns`: int — number of columns
- `binding`: auto | alignment — binding offset
- `bleed`: relative | dictionary — bleed area for print
- `flipped`: bool — flip page dimensions
- `background`: none | content — background content layer
- `foreground`: none | content — foreground content layer

## Text & Paragraph

```typst
#set text(font: "New Computer Modern", size: 12pt)
#set par(justify: true, leading: 0.78em, first-line-indent: 1.2em)
```

### Text Parameters
- `font`: string | array — font family
- `size`: relative — font size
- `fill`: color | gradient | tiling — text color
- `stroke`: length | color | gradient | stroke — text outline
- `tracking`: relative — character spacing
- `spacing`: relative | fraction — word spacing
- `weight`: int | string — font weight ("regular", "bold", 400-900)
- `style`: string — "normal", "italic"
- `lang`: string — language code for hyphenation
- `dir`: direction — text direction (ltr, rtl)

### Paragraph Parameters
- `justify`: bool — justify text
- `leading`: relative — line spacing
- `spacing`: relative — paragraph spacing
- `first-line-indent`: relative | dictionary — indent first line
- `hanging-indent`: relative — hanging indent
- `linebreaks`: auto | "none" | "simple" — line break mode

## Headings

```typst
= Level 1 Heading
== Level 2 Heading
=== Level 3 Heading
==== Level 4 Heading
```

## Lists

```typst
- Unordered item
- Item with *bold* and _italic_

+ Ordered item
+ Second item

/ Term: Definition
/ Another term: Another definition
```

## Links & References

```typst
#link("https://example.com")[Link text]
#link("mailto:user@example.com")[Email]
<cite>Reference citation
```

## Strong & Emphasis

```typst
**Bold text**
_Italic text_
***Bold and italic***
```

## Code

```typst
`inline code`

```python
def hello():
    print("Hello")
```
```

## Math

```typst
$ integral_0^oo f(x) dx $
$ E = m c^2 $
$ frac(a, b) = a / b $
```

## Quotes

```typst
#quote[Quotation text]
#quote(block: true)[Block quotation]
```

## Tables

```typst
#figure(
  table(
    columns: 3,
    fill: (_, y) => if y == 0 { rgb("#1a5276") },
    table.header[
      [Header 1]
      [Header 2]
      [Header 3]
    ],
    [Data 1], [Data 2], [Data 3],
    [Data 4], [Data 5], [Data 6],
  ),
  caption: [Table caption],
)
```

### Table Parameters
- `columns`: auto | int | relative | fraction | array
- `rows`: auto | int | relative | fraction | array
- `gutter`: auto | int | relative | fraction | array
- `column-gutter`, `row-gutter`: auto | int | relative | fraction | array
- `inset`: relative | array | dictionary | function
- `align`: auto | array | function | alignment
- `fill`: none | color | gradient | tiling | array | function
- `stroke`: none | length | color | gradient | stroke | tiling | array | dictionary

### Table Header
```typst
table.header[
  [Cell 1]
  [Cell 2]
]
```

## Colors

```typst
// Hex
rgb("#ff5733")
rgb("#ff573380")  // with alpha

// RGB values
rgb(255, 87, 51)
rgb(100%, 34%, 20%)

// Named colors
red, blue, green, black, white, gray
cyan, magenta, yellow, orange, purple

// HSL
hsl(10deg, 80%, 60%)

// Luminance
luma(230)

// Transparentize
color.transparentize(50%)

// Opacify
color.opacify(50%)

// Mix
color.mix(red, blue)
color.mix((red, 70%), (blue, 30%))

// Lighten/Darken
color.lighten(20%)
color.darken(20%)
```

## Visual Elements

### Rectangle

```typst
#rect(
  width: 100%,
  height: auto,
  fill: rgb("#f8f9fa"),
  stroke: 1pt + rgb("#1a5276"),
  radius: 4pt,
  inset: 12pt,
  outset: 0pt,
  clip: false,
)[Content]
```

### Circle

```typst
#circle(
  radius: 10pt,  // OR width/height
  fill: rgb("#2e86c1"),
  stroke: auto,
  inset: 0% + 5pt,
  outset: (:),
)[Content]
```

### Ellipse

```typst
#ellipse(
  width: 100pt,
  height: 50pt,
  fill: aqua,
  stroke: auto,
)[Content]
```

### Line

```typst
#line(
  length: 100%,  // OR use end: (x, y)
  angle: 0deg,
  stroke: 1pt + black,
)

#line(
  start: (0%, 0%),
  end: (50%, 50%),
  stroke: 2pt + red,
)
```

### Polygon

```typst
#polygon(
  fill: blue,
  stroke: black,
  (0%, 0%),
  (100%, 0%),
  (50%, 100%),
)
```

## Layout & Alignment

### Align

```typst
#align(center)[Centered content]
#align(right)[Right-aligned]
#align(horizon + center)[Centered both ways]
#align(left + top)[Top-left]
```

### Pad

```typst
#pad(
  left: 1em,
  right: 1em,
  top: 1em,
  bottom: 1em,
  x: 1em,      // shorthand for left + right
  y: 1em,      // shorthand for top + bottom
  rest: 1em,   // all sides
)[Content]
```

### Block

```typst
#block(
  width: 100%,
  height: auto,
  fill: luma(230),
  stroke: auto,
  radius: 4pt,
  inset: 8pt,
  clip: false,
  sticky: false,
  breakable: false,
)[Content]
```

### Columns

```typst
#columns(2)[
  Text in first column.
  #colbreak()
  Text in second column.
]
```

### Stack

```typst
#stack(
  dir: ltr,  // or ttb, rtl, btt
  spacing: 1fr,
)[A][B][C]
```

## Grid Layout

```typst
#grid(
  columns: (1fr, 1fr, 1fr),
  rows: auto,
  gutter: 10pt,
  column-gutter: 10pt,
  row-gutter: 10pt,
  inset: 2pt,
  align: center + horizon,
  fill: (x, y) => if calc.even(x + y) { luma(230) },
  stroke: (x, y) => if x > 0 { (left: 0.5pt + gray) },
  [Cell 1], [Cell 2], [Cell 3],
  [Cell 4], [Cell 5], [Cell 6],
)
```

## Figures

```typst
#figure(
  image("image.png", width: 80%),
  caption: [Image caption],
  placement: auto,  // none | auto | top | bottom
  kind: image,      // image | table | raw | "custom"
  supplement: [Figure],
  numbering: "1",
  gap: 1em,
  outlined: true,
)

#figure(
  table(columns: 2)[A][B],
  caption: [Table caption],
  kind: table,
)
```

## Placement & Floats

```typst
#place(
  top + center,
  float: true,
  scope: "parent",
)[Floating content]
```

## Page Break & Colbreak

```typst
#pagebreak()
#pagebreak(weak: true)  // only if not already at top

#colbreak()
#colbreak(weak: true)
```

## Language & Hyphenation

```typst
#set text(lang: "ru")
#set text(hyphenate: true)
```

## Counter & Numbering

```typst
#set page(numbering: "1")
#set page(numbering: "1 of 1")
#set page(numbering: "— 1 —")

#context counter(page).display()
```

## Show Rules

```typst
#show heading: set text(size: 1.2em)
#show heading: set text(weight: "bold")
#show heading: set block(above: 1.5em, below: 0.8em)

#show figure.where(kind: table): set figure.caption(position: top)
```

## Set Rules

```typst
#set text(font: "Arial")
#set page(paper: "a4")
#set par(justify: true)
#set heading(numbering: "1.1")
```

## Typst Syntax Rules

- `#` prefix for functions: `#set`, `#show`, `#align`, `#block`, etc.
- `[brackets]` for content (not quotes)
- `//` for comments
- No semicolons
- Indentation is for readability, not syntax
- Named arguments: `name: value`
- Positional arguments: just `value`
- Arrays: `(1, 2, 3)`
- Dictionaries: `(key: value)`
- Strings: `"text"` or `[content]`
- Content blocks: `[text with #functions]`

## Common Patterns

### Callout Box

```typst
#block(
  width: 100%,
  fill: rgb("#f8f9fa"),
  radius: (left: 4pt, right: 0pt),
  inset: (left: 16pt, y: 12pt, right: 12pt),
  stroke: (left: 4pt + rgb("#1a5276")),
)[
  *Important:* This is a callout box.
]
```

### Metric Card

```typst
#rect(
  width: 30%,
  fill: rgb("#2e86c1"),
  radius: 8pt,
  inset: 16pt,
  stroke: none,
)[
  #set text(fill: white)
  #align(center)[
    #text(size: 2em, weight: "bold")[42%]
    #v(0.5em)
    Growth Rate
  ]
]
```

### Alternating Row Colors

```typst
#figure(
  table(
    columns: 3,
    fill: (_, y) => if y == 0 { rgb("#1a5276") }
                     else if calc.rem(y, 2) == 0 { rgb("#f8f9fa") }
                     else { white },
    table.header[Header 1][Header 2][Header 3],
    [Data 1], [Data 2], [Data 3],
    [Data 4], [Data 5], [Data 6],
  ),
)
```

### Section Divider

```typst
#line(length: 100%, stroke: 0.5pt + rgb("#cccccc"))
```

### Styled List

```typst
#set enum(numbering: "1.")
+ First item
+ Second item

#set list(marker: [--])
-- First bullet
-- Second bullet
```

### Reference Style

```typst
See @figure1 for details.

#figure(
  rect(width: 100%, height: 50pt),
  caption: [Example],
) <figure1>
```

### Columns with Break

```typst
#columns(2, gutter: 20pt)[
  First column text.
  #colbreak()
  Second column text.
]
```
