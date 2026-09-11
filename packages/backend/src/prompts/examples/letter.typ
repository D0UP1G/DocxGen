// ГОСТ Р 6.30-2003 compliant document example
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

// Header block
#block(width: 100%, inset: (bottom: 12pt))[
  #grid(
    columns: (1fr, 1fr),
    gutter: 12pt,
    [*Кому:* Генеральному директору ООО «Василёк» Фёдорову Ф.Ф.,],
    [*Дата:* 16.03.2025,],
    [*От кого:* Генеральный директор ООО «Ромашка» Иванов И.И.,],
    [*Номер:* 88-П,],
  )
]

// Subject line
#align(center)[
  #text(weight: "bold", size: 14pt)[
    О сотрудничестве в сфере поставок
  ]
]

// Body
Уважаемый Фёдор Фёдорович!

#par[ООО «Ромашка» рассматривает возможность заключения договора поставки офисной мебели. Просим предоставить коммерческое предложение на 50 столов и 100 стульев с указанием сроков и условий оплаты. Ответ просим направить до 25.03.2025 на office\@romashka.example. Надеемся на сотрудничество.]

// Signature block
#block(width: 100%, inset: (top: 24pt))[
  #grid(
    columns: (2fr, 1fr),
    [],
    [
      _________________ \
      Иванов И.И.
    ],
  )
]
