# 🎯 DocxGen Implementation Plan

**Project:** Документ за 3 шага — AI Document Constructor  
**Hackathon:** Первенство России 2026  
**Our Lane:** INPUT → AI processing → AI output → .docx file  

---

## 📊 Evaluation Criteria We Must Hit

| Criterion | Points | Status |
|-----------|--------|--------|
| AI text quality | 5 | ✅ P0 done — structured JSON output |
| Requisites + templates | 5 | ⏳ P1 — validation + document types |
| End-to-end logic | 5 | ⏳ P1 — pipeline wiring |
| Scenario 1: Full path | 3 | ⏳ P1 — DOCX generation |
| Scenario 2+4: Text + meaning | 3 | ✅ P0 — AI corrects, no hallucinations |
| Scenario 3: Missing requisites | 3 | ⏳ P1 — validation layer |
| Scenario 5: Types + templates | 3 | ⏳ P1 — 4 types × 2 templates |
| Scenario 6: Error handling | 3 | ✅ Container errors caught |
| Architecture | 5 | ⏳ P1 — clean separation |
| Technical verifiability | 3 | ✅ SSE streaming + structured output |

**Total our lane: ~38 points**

---

## ✅ P0: AI Structured Output (DONE)

**Status:** ✅ Complete  
**Commit:** `d74da0b`  

- [x] AI outputs JSON: `{ correctedText, requisites, documentType }`
- [x] Prompts extracted to SSOT (`packages/backend/src/prompts/document-prompts.ts`)
- [x] Route accepts `documentType` parameter
- [x] SSE sends `ai_result` event with structured data

---

## ⏳ P1: Validation Layer + Document Types

**Status:** ⏳ Next  
**Effort:** ~2 hours  

### P1.1: Document Type Definitions

Create `packages/backend/src/document-types.ts`:

```typescript
export interface DocumentType {
  id: string;
  name: string;
  requiredFields: (keyof Requisites)[];
  structure: string[];  // Section order
}

export const DOCUMENT_TYPES: Record<string, DocumentType> = {
  sluzhebnaya: {
    id: 'sluzhebnaya',
    name: 'Служебная записка',
    requiredFields: ['to', 'from', 'date', 'subject'],
    structure: ['header', 'body', 'signature'],
  },
  dokladnaya: {
    id: 'dokladnaya',
    name: 'Докладная записка',
    requiredFields: ['to', 'from', 'date', 'subject'],
    structure: ['header', 'body', 'conclusion', 'signature'],
  },
  informacionnaya: {
    id: 'informacionnaya',
    name: 'Информационная справка',
    requiredFields: ['to', 'from', 'date', 'subject'],
    structure: ['header', 'facts', 'analysis', 'conclusion'],
  },
  pismo: {
    id: 'pismo',
    name: 'Письмо',
    requiredFields: ['to', 'from', 'date', 'number', 'subject'],
    structure: ['header', 'greeting', 'body', 'closing', 'signature'],
  },
};
```

### P1.2: Validation Service

Create `packages/backend/src/services/validation.service.ts`:

```typescript
export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}

export function validateRequisites(
  requisites: Requisites,
  documentType: string,
): ValidationResult {
  const type = DOCUMENT_TYPES[documentType];
  const missing = type.requiredFields.filter(
    (field) => !requisites[field] || requisites[field].trim() === ''
  );
  
  return {
    isValid: missing.length === 0,
    missingFields: missing,
    warnings: [],
  };
}
```

### P1.3: Wire Validation into Route

Update `packages/backend/src/routes/document.ts`:

```typescript
// After AI processing
const validation = validateRequisites(aiResult.requisites, documentType);

if (!validation.isValid) {
  sendEvent('validation', JSON.stringify({
    missing: validation.missingFields,
    message: `Отсутствуют обязательные реквизиты: ${validation.missingFields.join(', ')}`,
  }));
  // Option A: Request from user via follow-up
  // Option B: Mark as [Заполнить] in document
}
```

### P1.4: Frontend Validation Display

Update `DocumentGenerator.tsx` to handle `validation` event:

```typescript
case 'validation':
  const { missing, message } = JSON.parse(data);
  setMissingFields(missing);
  setStatus(message);
  break;
```

---

## ⏳ P1: Typst Templates

**Status:** ⏳ After validation  
**Effort:** ~1.5 hours  

### P1.5: Template Definitions

Create `packages/backend/src/templates/`:

```
templates/
├── index.ts          # Template registry
├── official.ts       # Официальный шаблон
├── standard.ts       # Стандартный шаблон
└── types.ts          # Template interface
```

**Template Interface:**
```typescript
export interface TypstTemplate {
  id: string;
  name: string;
  description: string;
  generate: (data: DocumentData) => string;
}

export interface DocumentData {
  requisites: Requisites;
  body: string;
  documentType: string;
}
```

### P1.6: Official Template (`official.ts`)

```typescript
export const officialTemplate: TypstTemplate = {
  id: 'official',
  name: 'Официальный',
  description: 'Строгий официальный стиль для деловой переписки',
  generate: (data) => `
#set page(
  paper: "a4",
  margin: (left: 3cm, right: 1.5cm, top: 2cm, bottom: 2cm),
)

#set text(
  font: "Times New Roman",
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
    [
      *Кому:* ${data.requisites.to || "[Заполнить]"} \
      *От кого:* ${data.requisites.from || "[Заполнить]"}
    ],
    [
      *Дата:* ${data.requisites.date || "[Заполнить]"} \
      *Номер:* ${data.requisites.number || "[Н/Д]"}
    ],
  )
]

// Subject line
#align(center)[
  #text(weight: "bold", size: 14pt)[
    ${data.requisites.subject || "[Заполнить]"}
  ]
]

// Body
${data.body}

// Signature block
#block(width: 100%, inset: (top: 24pt))[
  #grid(
    columns: (2fr, 1fr),
    [],
    [
      _________________ \
      ${data.requisites.from || "[Подпись]"}
    ],
  )
]
`,
};
```

### P1.7: Standard Template (`standard.ts`)

```typescript
export const standardTemplate: TypstTemplate = {
  id: 'standard',
  name: 'Стандартный',
  description: 'Упрощённый стиль для внутренних документов',
  generate: (data) => `
#set page(
  paper: "a4",
  margin: (left: 2.5cm, right: 1.5cm, top: 2cm, bottom: 2cm),
)

#set text(
  font: "Libertinus Serif",
  size: 12pt,
  lang: "ru",
)

// Simplified header
#block(width: 100%, inset: (bottom: 8pt))[
  ${data.requisites.to ? `*Кому:* ${data.requisites.to} \\` : ""}
  ${data.requisites.from ? `*От:* ${data.requisites.from} \\` : ""}
  ${data.requisites.date ? `*Дата:* ${data.requisites.date}` : ""}
]

// Body (no first-line indent)
${data.body}

// Simple signature
#if data.requisites.from [#align(right)[${data.requisites.from}]]
`,
};
```

---

## ⏳ P1: Wire Everything Together

**Status:** ⏳ After templates  
**Effort:** ~1 hour  

### P1.8: Update Route to Use Templates

```typescript
import { getTemplate } from '../templates';

// After AI processing
const template = getTemplate(templateId);  // 'official' or 'standard'
const typstContent = template.generate({
  requisites: aiResult.requisites,
  body: aiResult.correctedText,
  documentType: aiResult.documentType,
});

// Then compile as before
```

### P1.9: Frontend Template Selection

Add template selector to `DocumentGenerator.tsx`:

```tsx
const [templateId, setTemplateId] = useState('official');

// In the form
<select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
  <option value="official">Официальный</option>
  <option value="standard">Стандартный</option>
</select>

// Send with request
body: JSON.stringify({ text, documentType, templateId })
```

---

## ⏳ P2: Preview + Polish

**Status:** ⏳ After P1  
**Effort:** ~1 hour  

### P2.1: Preview Before Download

Show corrected text + requisites before generating DOCX:

```tsx
case 'ai_result':
  const result = JSON.parse(data);
  setCorrectedText(result.correctedText);
  setRequisites(result.requisites);
  setShowPreview(true);
  break;
```

### P2.2: Edit Requisites

Allow user to fill missing fields:

```tsx
{missingFields.map(field => (
  <input
    key={field}
    placeholder={fieldLabels[field]}
    value={requisites[field]}
    onChange={(e) => updateRequisite(field, e.target.value)}
  />
))}
```

### P2.3: Regenerate with Edits

After user edits, regenerate DOCX with updated requisites.

---

## 📋 Implementation Order

| Step | Task | Time | Dependencies |
|------|------|------|--------------|
| P1.1 | Document type definitions | 30 min | None |
| P1.2 | Validation service | 30 min | P1.1 |
| P1.3 | Wire validation into route | 15 min | P1.2 |
| P1.4 | Frontend validation display | 15 min | P1.3 |
| P1.5 | Template interface + registry | 15 min | None |
| P1.6 | Official template | 30 min | P1.5 |
| P1.7 | Standard template | 30 min | P1.5 |
| P1.8 | Wire templates into route | 15 min | P1.6, P1.7 |
| P1.9 | Frontend template selection | 15 min | P1.8 |
| P2.1 | Preview before download | 30 min | P1.9 |
| P2.2 | Edit requisites UI | 30 min | P2.1 |
| P2.3 | Regenerate with edits | 30 min | P2.2 |

**Total P1+P2: ~4.5 hours**

---

## 🎯 Success Criteria

After P1+P2, we should be able to:

1. ✅ User inputs text → selects type + template → gets DOCX
2. ✅ AI corrects text + extracts requisites
3. ✅ Missing fields marked as [Заполнить]
4. ✅ 4 document types with correct structure
5. ✅ 2 templates with different visual styles
6. ✅ Preview before download
7. ✅ Edit requisites before generation

---

## 📝 Notes

- Keep Typst pipeline (superior ГОСТ output)
- Don't over-engineer (hackathon prototype)
- Test each step before moving to next
- Focus on scenarios 1-6 from evaluation criteria
