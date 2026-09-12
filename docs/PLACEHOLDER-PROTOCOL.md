# Placeholder Protocol

The placeholder system is the bridge between AI-processed text and the final DOCX output. Every field that needs a value in the document goes through this protocol.

## Naming Convention

**Russian labels ARE the keys.** There is no separate English key namespace.

| Convention | Example |
|------------|---------|
| Field key | `Адресат` |
| Placeholder format | `[Адресат]` |
| Config field | `{ "key": "Адресат", "label": "Адресат", ... }` |

This means the same string `Адресат` is used:
1. As the `key` in `docType.fields` array
2. As the `label` displayed to the user
3. Inside the `[...]` placeholder in the DOCX
4. As the property name in `values`, `aiFields`, and `userFields` objects

## Placeholder Format

Placeholders follow the pattern `[{label}]` where `{label}` is the Russian label:

```
[Адресат]          ← addressee
[Дата]             ← date
[Номер]            ← registry number
[Тема]             ← subject/title
[Должность автора] ← author's position
[ФИО автора]       ← author's full name
[Должность подписывающего] ← signer's position (letter only)
[ФИО подписывающего]       ← signer's full name (letter only)
```

The format is configured per template:

```json
// From config/templates/classic.json
"placeholder": {
  "format": "[{label}]",
  "highlight": "yellow"
}
```

Both templates use the same format. The `highlight` property adds a yellow background to unfilled placeholders in the DOCX.

## Merge Rules

The final set of fields is the **union** of two sources, deduplicated by Russian label:

```
template.requiredFields ∪ docType.fields → unique set by label
```

**Source:** `packages/backend/src/validation/requisites.js:29-47`

### Source 1: `docType.fields`

Full field metadata from the document type config:

```json
// From config/doc-types/memo.json
{
  "key": "Адресат",
  "label": "Адресат",
  "kind": "extract",
  "required": true,
  "question": "Кому адресована записка? Укажите должность и ФИО.",
  "example": "Начальнику отдела кадров Петровой А. С."
}
```

### Source 2: `template.requiredFields`

Array of Russian label strings from the template config:

```json
// From config/templates/classic.json
"requiredFields": ["Адресат", "Дата", "Номер", "Автор", "Должность", "Подпись"]
```

### Deduplication

Both sources are merged into a `Map` keyed by the Russian label. If both define `Адресат`, the `docType.fields` version wins (it has richer metadata). Template-only fields get a minimal descriptor:

```javascript
// From requisites.js:39-46
if (!fieldsByLabel.has(requiredKey)) {
  fieldsByLabel.set(requiredKey, {
    key: requiredKey,
    label: requiredKey,
    kind: 'required',
    required: true,
  });
}
```

## AI Instructions

The AI prompt includes awareness of existing placeholders to avoid creating duplicates:

```javascript
// From packages/backend/src/ai/prompt.js:58-72
const existingLabels = new Set();
if (template?.requiredFields) {
  for (const field of template.requiredFields) {
    existingLabels.add(field);
  }
}
for (const field of docType.fields) {
  existingLabels.add(field.label);
}
const existingPlaceholders = [...existingLabels].map(label => `[${label}]`).join(', ');

const existingPlaceholdersSection = existingLabels.size > 0
  ? `Эти плейсхолдеры уже существуют в шаблоне: ${existingPlaceholders}.\nНЕ создавай дублирующие плейсхолдеры для этих полей.\nТы МОЖЕШЬ использовать их в тексте, если это необходимо.`
  : 'В шаблоне пока нет плейсхолдеров.';
```

**Key rule for AI:** Do NOT create `[Label]` placeholders for fields that already exist in the template. You MAY reference existing placeholders in the generated text if needed.

## Replacement Flow

### Step 1: Priority Chain

For each field in the merged set, the system applies this priority chain:

```
1. User explicitly provided a value  → source: 'user'
2. User explicitly set to null       → source: 'user_skip' (leave empty)
3. AI-verified value                 → source: 'ai'
4. Auto value (date only)            → source: 'auto'
5. Template value (org info)         → source: 'template'
```

**Source:** `packages/backend/src/validation/requisites.js:50-81`

### Step 2: valueRuns Rendering

The `valueRuns(model, key)` function renders either the value or the placeholder:

```javascript
// From packages/backend/src/docx/blocks.js:30-42
export function valueRuns(model, key) {
  const val = model.values[key]?.value;
  if (val) {
    return [new TextRun(val)];                    // Value exists → render it
  }
  const label = model.values[key]?.label ?? key;
  return [new TextRun({
    text: `[${label}]`,                           // No value → render placeholder
    highlight: model.template.placeholder.highlight ?? undefined,  // yellow
  }]);
}
```

**Important:** Empty string `""` is treated as missing — it falls through to the placeholder.

### Step 3: Final DOCX

In the generated DOCX file:
- **Filled fields** show the user/AI value as plain text
- **Empty fields** show `[Label]` with yellow highlight

## Empty Fields

When a field has no value (neither from user, AI, auto-fill, nor template), the placeholder remains in the DOCX with yellow highlighting.

**Registry fields** (`kind: "registry"`) are **always** placeholders — they never go through the priority chain:

```javascript
// From requisites.js:107-109
if (isRegistry) {
  // Registry fields never go to pending — always show as placeholder
  placeholders.push(field.label);
}
```

**Optional fields without values** also become placeholders:

```javascript
// From requisites.js:118-121
} else if (!hasValue && !field.required) {
  // Optional field without value → placeholder
  placeholders.push(field.label);
}
```

## Field Kinds

| Kind | Description | AI Behavior | Render Behavior |
|------|-------------|-------------|-----------------|
| `extract` | Found in the draft text | AI finds and quotes the value | Shows value or `[Label]` |
| `derived` | Created from context by AI | AI creates from draft content | Shows value or `[Label]` |
| `auto` | System fills automatically | AI skips (e.g., `Дата`) | Shows auto value (date) |
| `template` | From template config | AI skips (e.g., org info) | Shows template value |
| `registry` | Always a placeholder | AI skips (e.g., `Номер`) | Always shows `[Label]` |

## Examples

### Memo (Служебная записка)

| Field | Kind | Value Source |
|-------|------|--------------|
| Адресат | extract | AI finds in draft |
| Должность автора | extract | AI finds in draft |
| ФИО автора | extract | AI finds in draft |
| Тема | derived | AI creates from content |
| Дата | auto | System fills (today) |
| Номер | registry | Always placeholder |

### Letter (Письмо)

| Field | Kind | Value Source |
|-------|------|--------------|
| Организация адресата | extract | AI finds in draft |
| Лицо адресата | extract | AI finds in draft |
| Адрес адресата | extract | AI finds in draft (optional) |
| Обращение | derived | AI creates from recipient name |
| Тема | derived | AI creates from content |
| Должность подписывающего | extract | AI finds in draft |
| ФИО подписывающего | extract | AI finds in draft |
| Исполнитель | extract | AI finds in draft (optional) |
| Дата | auto | System fills (today) |
| Номер | registry | Always placeholder |
