# Fields Reference

Complete field reference for each document type. All fields use Russian labels as keys.

## Memo — Служебная записка

**Config:** `packages/backend/config/doc-types/memo.json`

Internal memo between departments: request, proposal, or information sharing.

| Field (Key) | Label | Kind | Required | Question | Example |
|-------------|-------|------|----------|----------|---------|
| `Адресат` | Адресат | extract | ✅ | Кому адресована записка? Укажите должность и ФИО. | Начальнику отдела кадров Петровой А. С. |
| `Должность автора` | Должность автора | extract | ✅ | Ваша должность и подразделение? | Ведущий специалист отдела закупок |
| `ФИО автора` | ФИО автора | extract | ✅ | Ваши фамилия и инициалы? | Сидоров П. П. |
| `Тема` | Тема | derived | ✅ | — | (AI derives from content) |
| `Дата` | Дата | auto | ✅ | — | 12.09.2026 |
| `Номер` | Номер | registry | ❌ | — | [Номер] (always placeholder) |

**Layout blocks:** orgHeader → addressee → docTitle → dateNumber → title → body → signature

**Doc title:** `СЛУЖЕБНАЯ ЗАПИСКА`

---

## Report — Докладная записка

**Config:** `packages/backend/config/doc-types/report.json`

Report memo to management: facts, conclusions, proposals.

| Field (Key) | Label | Kind | Required | Question | Example |
|-------------|-------|------|----------|----------|---------|
| `Адресат` | Адресат | extract | ✅ | Кому адресована записка? Укажите должность и ФИО. | Генеральному директору Иванову И. И. |
| `Должность автора` | Должность автора | extract | ✅ | Ваша должность и подразделение? | Начальник отдела логистики |
| `ФИО автора` | ФИО автора | extract | ✅ | Ваши фамилия и инициалы? | Петров П. П. |
| `Тема` | Тема | derived | ✅ | — | (AI derives from content) |
| `Дата` | Дата | auto | ✅ | — | 12.09.2026 |
| `Номер` | Номер | registry | ❌ | — | [Номер] (always placeholder) |

**Layout blocks:** orgHeader → addressee → docTitle → dateNumber → title → body → signature

**Doc title:** `ДОКЛАДНАЯ ЗАПИСКА`

---

## Reference — Информационная справка

**Config:** `packages/backend/config/doc-types/reference.json`

Informational reference: factual summary for a period, for reports, audits, archives.

| Field (Key) | Label | Kind | Required | Question | Example |
|-------------|-------|------|----------|----------|---------|
| `Тема` | Тема | derived | ✅ | — | (AI derives from content) |
| `Дата` | Дата | auto | ✅ | — | 12.09.2026 |
| `Должность автора` | Должность автора | extract | ✅ | Ваша должность и подразделение? | Старший инженер отдела ИТ |
| `ФИО автора` | ФИО автора | extract | ✅ | Ваши фамилия и инициалы? | Сидоров П. П. |
| `Адресат` | Адресат | extract | ❌ | Кому адресована справка? | В отдел кадров |
| `Период` | Период | extract | ❌ | За какой период? | за сентябрь 2026 г. |

**Layout blocks:** orgHeader → docTitle → dateNumber → title → body → signature

**Doc title:** `СПРАВКА`

**Note:** No addressee block in the layout — the `Адресат` field appears in the body text if provided.

---

## Letter — Письмо

**Config:** `packages/backend/config/doc-types/letter.json`

Official organizational letter: salutation, occasion, substance, request.

| Field (Key) | Label | Kind | Required | Question | Example |
|-------------|-------|------|----------|----------|---------|
| `Организация адресата` | Организация адресата | extract | ✅ | Название организации-получателя? | ООО «СтройМонтаж» |
| `Лицо адресата` | Лицо адресата | extract | ✅ | ФИО и должность получателя? | Директору Петрову И. С. |
| `Адрес адресата` | Адрес адресата | extract | ❌ | Почтовый адрес? | 123456, г. Москва, ул. Примерная, д. 1 |
| `Обращение` | Обращение | derived | ❌ | — | (AI derives from recipient name + patronymic) |
| `Тема` | Тема | derived | ✅ | — | (AI derives from content) |
| `Должность подписывающего` | Должность подписывающего | extract | ✅ | Должность подписывающего? | Генеральный директор |
| `ФИО подписывающего` | ФИО подписывающего | extract | ✅ | ФИО подписывающего? | Иванов И. И. |
| `Исполнитель` | Исполнитель | extract | ❌ | Исполнитель (кто подготовил)? | Сидоров П. П., тел. +7 (000) 000-00-00 |
| `Дата` | Дата | auto | ✅ | — | 12.09.2026 |
| `Номер` | Номер | registry | ❌ | — | [Номер] (always placeholder) |

**Layout blocks:** orgHeader → dateNumber → addressee → title → salutation → body → signature → executor

**Doc title:** `null` (no title block for letters)

**Special behaviors:**
- **Addressee** renders as three separate paragraphs: `Организация адресата`, `Лицо адресата`, `Адрес адресата`
- **Salutation** (`Обращение`) only renders if the AI derived a value (requires first name + patronymic)
- **Signature** uses `Должность подписывающего` + `ФИО подписывающего` instead of `Должность автора` + `ФИО автора`
- **Executor** renders in smaller font at the bottom

---

## Field Kinds — Complete Reference

| Kind | Description | AI Behavior | User Can Edit | Render Behavior |
|------|-------------|-------------|---------------|-----------------|
| `extract` | Value found directly in the draft text | AI extracts with a verbatim quote for grounding | ✅ Yes | Shows value or `[Label]` |
| `derived` | Value created by AI from context | AI creates from surrounding content | ✅ Yes | Shows value or `[Label]` |
| `auto` | System fills automatically (e.g., date) | AI skips | ✅ Yes (overrides auto) | Shows auto-formatted value |
| `template` | From template config (e.g., org name) | AI skips | ❌ No | Shows template value |
| `registry` | Always a placeholder (e.g., registry number) | AI skips | ✅ Yes (becomes value) | Always shows `[Label]` |

### Extract Fields — Grounding

Extract fields require a `quote` from the AI — a verbatim snippet from the draft. The grounding check verifies the quote exists in the original text:

```javascript
// From packages/backend/src/ai/processDraft.js:95-103
if (fieldDef.kind === 'extract' && fieldVal.quote) {
  const check = checkGrounding(fieldVal.value, fieldVal.quote, draft);
  if (!check.ok) {
    warnings.push({ key, reason: check.reason, severity: 'grounding' });
    aiFields[key] = null;  // ← grounding failed → field is null
  }
}
```

### Derived Fields — Relaxed Grounding

Derived fields use a relaxed check — at least one word from the derived value must appear in the draft:

```javascript
// From packages/backend/src/ai/processDraft.js:107-116
if (fieldDef.kind === 'derived' && fieldVal.value) {
  const check = checkDerivedGrounding(fieldVal.value, draft);
  if (!check.ok) {
    warnings.push({ key, reason: check.reason, severity: 'grounding' });
    aiFields[key] = null;
  }
}
```

## Priority Chain — When Multiple Sources Exist

For each field, values are resolved in this order:

| Priority | Source | When |
|----------|--------|------|
| 1 | User answer | User explicitly provided a value via API or dialog |
| 2 | User skip | User explicitly set field to `null` (leave empty) |
| 3 | AI value | AI extracted or derived the field, grounding passed |
| 4 | Auto value | `kind: "auto"` + `template.autoFill` enabled (date only) |
| 5 | Template value | `kind: "template"` (organization info from template config) |

**Source:** `packages/backend/src/validation/requisites.js:50-81`
