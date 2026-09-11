// ГОСТ Р 6.30-2003 — Деловая переписка (Inspection Report)
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
    [*Кому:* Руководителю департамента продаж ООО «Ромашка» Сидорову С.С.,],
    [*Дата:* 14.03.2025,],
    [*От кого:* Специалист по контролю качества Николаева Н.Н.,],
    [*Номер:* 12-ДЗ,],
  )
]

// Subject line
#align(center)[
  #text(weight: "bold", size: 14pt)[
    О результатах проверки склада
  ]
]

// Body
#par[Докладываю, что с 10 по 13 марта 2025 года проведена проверка склада по адресу: г. Москва, ул. Складская, д. 15.]

#par[Выявлены следующие нарушения:]

// Findings table
#let findings = (
  ("Температура", "Выше нормы на 4 градуса"),
  ("Стеллажи", "Обнаружена коррозия"),
  ("Вентиляция", "Работает с перебоями"),
)

#block(inset: (left: 1.25cm))[
  #table(
    columns: (auto, 1fr),
    stroke: 0.5pt,
    [*Находка*], [*Описание*],
    ..findings.map(row => ([#row.at(0)], [#row.at(1)])).flatten()
  )
]

#par[Данные нарушения могут привести к порче товара. Предлагаю отремонтировать вентиляцию и заменить стеллажи до 01.04.2025.]

// Signature block
#block(width: 100%, inset: (top: 24pt))[
  #grid(
    columns: (2fr, 1fr),
    [],
    [
      _________________ \
      Николаева Н.Н.
    ],
  )
]
