# UX Design Spec — DocxGen Frontend Refactor

## 1. User's Job

A Russian-speaking office worker has a rough text draft of a business document (memo, report, letter). They need to:
1. Paste the draft
2. Let the system clean it up and extract metadata (requisites)
3. Review/correct the output
4. Download a properly formatted .docx file

**Mental model:** "I'm filling out a form that does the hard work for me." Not navigating pages. Not switching views. One card, progressive disclosure.

---

## 2. Component Tree

```
App
└── DocumentGenerator              ← orchestrator: state, API calls, flow logic
    ├── Card (root wrapper)
    │   ├── CardHeader
    │   │   ├── CardTitle         ← static: icon + "DocxGen — генератор документов"
    │   │   └── CardDescription   ← static: "Три шага: вставьте черновик…"
    │   └── CardContent
    │       ├── DraftSection      ← STEP 1: draft textarea + document type + template select
    │       │   ├── Textarea      ← draft input
    │       │   ├── DocumentTypeSelect  ← 4 document types (radio-group or select)
    │       │   └── TemplateSelect      ← 2 templates (select)
    │       ├── StatusBar         ← transient: processing/generating/done status
    │       ├── ErrorBar          ← transient: error message
    │       ├── CorrectedSection  ← STEP 2: corrected text + requisites (conditionally rendered)
    │       │   ├── CheckCircle icon + "Исправленный текст"
    │       │   ├── Textarea      ← corrected text (editable)
    │       │   └── RequisitesForm ← dynamic field grid based on document type
    │       │       └── Input × N  ← one per visible field
    │       ├── ValidationAlert   ← warnings + missing fields (conditionally rendered)
    │       ├── ActionButton      ← primary CTA: changes label/icon based on step
    │       └── StepIndicator     ← visual step progress (1 → 2 → 3)
    └── (Framer Motion AnimatePresence wraps conditional sections)
```

### Component Responsibilities

| Component | Responsibility | State Owned |
|-----------|---------------|-------------|
| **DocumentGenerator** | Orchestrate flow, hold all state, call APIs | All state (text, correctedText, requisites, status, error, processing, generating, documentType, templateId, missingFields, warnings) |
| **DraftSection** | Render textarea + selects for step 1 | None (props: text, documentType, templateId, typeDescription, onTextChange, onTypeChange, onTemplateChange) |
| **StatusBar** | Render transient processing status | None (props: status, isVisible) |
| **ErrorBar** | Render error messages | None (props: error, isVisible) |
| **CorrectedSection** | Render corrected text + requisites form | None (props: correctedText, requisites, visibleFields, onTextChange, onRequisiteChange) |
| **RequisitesForm** | Render dynamic field grid | None (props: fields, requisites, visibleFields, onChange) |
| **ValidationAlert** | Render warnings + missing fields | None (props: missingFields, warnings) |
| **ActionButton** | Render primary CTA with dynamic label | None (props: step, processing, generating, onClick, disabled) |
| **StepIndicator** | Show 1 → 2 → 3 progress | None (props: currentStep) |

**Why this split:** Each component is ~30-60 lines. Pure presentational — receives props, renders UI. All logic lives in DocumentGenerator. Easy to test, easy to animate independently.

---

## 3. Interaction Flow

### Step 1: Draft Input (initial state)

```
┌─────────────────────────────────────────────────┐
│ 📄 DocxGen — генератор документов                │
│ Три шага: вставьте черновик, проверьте           │
│ обработанный текст и скачайте редактируемый DOCX.│
├─────────────────────────────────────────────────┤
│  ○─●─○  Шаг 1 из 3                              │
│                                                 │
│  ┌─ Тип документа ──────────── Шаблон ────────┐ │
│  │ ● Служебная записка    │ Классический      │ │
│  │ ○ Докладная записка    │ Современный       │ │
│  │ ○ Информационная справка│                   │ │
│  │ ○ Письмо               │                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Черновик ─────────────────────────────────┐ │
│  │ [textarea — 8 rows]                        │ │
│  │                                             │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  [  1. Обработать черновик  ]                    │
└─────────────────────────────────────────────────┘
```

**User actions:**
- Select document type (radio group or select)
- Select template (select)
- Type/paste draft text
- Click "1. Обработать черновик"

**System response on click:**
1. Button → loading state ("Обработка…" + spinner)
2. Status bar slides in: "Обработка черновика…"
3. Draft textarea disables (prevent editing during processing)
4. On success → animate to Step 2
5. On error → error bar slides in, status bar slides out

---

### Step 2: Review & Edit (after processing)

```
┌─────────────────────────────────────────────────┐
│ 📄 DocxGen — генератор документов                │
├─────────────────────────────────────────────────┤
│  ○─●─○  Шаг 2 из 3                              │
│                                                 │
│  ┌─ Исправленный текст — можно отредактировать ┐ │
│  │ ✓ Текст обработан AI                        │ │
│  │ ┌─────────────────────────────────────────┐ │ │
│  │ │ [corrected textarea — 10 rows]          │ │ │
│  │ └─────────────────────────────────────────┘ │ │
│  │                                             │ │
│  │ ┌─ Реквизиты ─────────────────────────────┐ │ │
│  │ │ Адресат:    [________]  Должность:[___] │ │ │
│  │ │ Автор:      [________]  Дата:     [___] │ │ │
│  │ │ Номер:      [________]  Тема:     [___] │ │ │
│  │ │ Подпись:    [________]  Исполнит.: [___] │ │ │
│  │ └─────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ ⚠ Проверьте реквизиты ────────────────────┐ │
│  │ • Адресат — заполните или оставьте отметку  │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  [  📥 Сформировать и скачать DOCX  ]           │
└─────────────────────────────────────────────────┘
```

**User actions:**
- Review corrected text (can edit)
- Fill in / correct requisite fields
- Address validation warnings if any
- Click "Сформировать и скачать DOCX"

**System response on click:**
1. Button → loading state ("Формирование…" + spinner)
2. Status bar: "Формирование DOCX…"
3. On success → file downloads, status: "DOCX готов и скачан"
4. On error → error bar slides in

---

### Step 3: Complete (after download)

```
┌─────────────────────────────────────────────────┐
│ 📄 DocxGen — генератор документов                │
├─────────────────────────────────────────────────┤
│  ○─○─●  Шаг 3 из 3                              │
│                                                 │
│  ✓ DOCX готов и скачан                           │
│                                                 │
│  ┌─ Исправленный текст ───────────────────────┐ │
│  │ (same as step 2, but button changes)       │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  [  🔄 Обработать заново  ]  [ 📥 Скачать ещё ] │
└─────────────────────────────────────────────────┘
```

**User actions:**
- Can download again ("Скачать ещё")
- Can restart ("Обработать заново" → resets to step 1)

---

## 4. Animation Specification

### Dependencies
- **framer-motion** (add to `packages/frontend/package.json`)

### Animation Table

| Element | Trigger | Animation | Duration | Easing | Notes |
|---------|---------|-----------|----------|--------|-------|
| **Card** | Page load | `fadeIn` + slight `y: 10 → 0` | 400ms | ease-out | One-time entrance |
| **DraftSection** | Step 1 active | `layout` prop for smooth reflow | — | — | Avoids jumps when sections appear/disappear |
| **CorrectedSection** | Step 1 → 2 | `AnimatePresence` exit: fade + `y: 0 → -20`, enter: fade + `y: 20 → 0` | 300ms | ease-in-out | Key transition — makes step change feel like progression |
| **RequisitesForm fields** | Step 2 appear | Staggered `fadeIn` — each field `opacity: 0→1, y: 8→0` | 200ms each, 50ms stagger | ease-out | Professional, not flashy. Suggests order of attention |
| **ValidationAlert** | Missing fields/warnings appear | `fadeIn` + `scale: 0.98→1` | 250ms | ease-out | Subtle emphasis on warnings |
| **StatusBar** | Processing starts | `AnimatePresence` + slide down `y: -8→0` + fade | 200ms | ease-out | Appears quickly, doesn't distract |
| **ErrorBar** | Error occurs | `fadeIn` + `scale: 0.98→1` | 250ms | ease-out | Red background, clear but not alarming |
| **ActionButton** | Step change / loading | Label crossfade: `opacity: 0→1` | 150ms | ease-in-out | Text swaps without layout shift |
| **StepIndicator** | Step change | Dot fill transitions: `scale: 1→1.2→1` | 300ms | ease-out | Subtle pulse on active dot |
| **DraftSection** | Step 1 → 2 | `exit: { opacity: 0, height: 0 }` with `layout` | 300ms | ease-in-out | Collapses cleanly, no jump |

### Animation Principles
1. **No flashy effects.** Corporate/professional = subtle, purposeful motion
2. **Entrance > exit.** Elements arriving get more attention than departing
3. **Staggered reveals.** Multiple items appear in sequence, not all at once
4. **Layout stability.** Use `layout` prop on shared containers to prevent content jumps
5. **Reduced motion.** Respect `prefers-reduced-motion` — disable all animations if user prefers

### Framer Motion Implementation Pattern

```tsx
// Pattern for conditional sections
<AnimatePresence mode="wait">
  {correctedText && (
    <motion.div
      key="corrected"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <CorrectedSection ... />
    </motion.div>
  )}
</AnimatePresence>

// Pattern for staggered fields
{visibleFields.map((field, i) => (
  <motion.div
    key={field}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05, duration: 0.2 }}
  >
    <RequisitesInput ... />
  </motion.div>
))}
```

---

## 5. Field Visibility Matrix

### Document Type → Required Fields

| Field | Служебная | Докладная | Информ. справка | Письмо |
|-------|:---------:|:---------:|:---------------:|:------:|
| Адресат (to) | ✅ | ✅ | ❌ | ✅ |
| Автор (from) | ✅ | ✅ | ✅ | ✅ |
| Должность (position) | ✅ | ✅ | ❌ | ✅ |
| Дата (date) | ✅ | ✅ | ✅ | ✅ |
| Номер (number) | ✅ | ✅ | ❌ | ✅ |
| Тема (subject) | ✅ | ✅ | ✅ | ✅ |
| Подпись (signature) | ✅ | ✅ | ✅ | ✅ |
| Обращение (greeting) | ❌ | ❌ | ❌ | ✅ |
| Исполнитель (executor) | ✅ | ✅ | ✅ | ✅ |

### Field Order (by type)

| Служебная / Докладная | Информ. справка | Письмо |
|----------------------|-----------------|--------|
| 1. Адресат | 1. Автор | 1. Адресат |
| 2. Автор | 2. Дата | 2. Автор |
| 3. Должность | 3. Тема | 3. Должность |
| 4. Дата | 4. Подпись | 4. Дата |
| 5. Номер | 5. Исполнитель | 5. Номер |
| 6. Тема | | 6. Тема |
| 7. Подпись | | 7. Подпись |
| 8. Исполнитель | | 8. Обращение |
| | | 9. Исполнитель |

### Behavior on Document Type Change
- When user changes document type **before** processing: just update visible fields, no reset needed
- When user changes document type **after** processing (step 2): reset correctedText, requisites, and warnings. Show confirmation: "Смена типа документа сбросит обработанный текст. Продолжить?"

---

## 6. Error Handling UX

### Error Types & Display

| Error Type | Source | Display | Recovery |
|------------|--------|---------|----------|
| **Network error** | fetch fails | ErrorBar: "Ошибка сети. Проверьте подключение." | User retries |
| **Server error (4xx/5xx)** | API returns error | ErrorBar: server message or "Не удалось обработать текст" | User retries |
| **Processing error** | AI/local processing fails | ErrorBar: "Ошибка обработки. Попробуйте упростить текст." | User edits draft, retries |
| **Generation error** | DOCX generation fails | ErrorBar: "Ошибка генерации документа." | User retries |
| **SSE stream error** | event: error | ErrorBar: parsed error message | User retries |

### Error Display Rules
1. **Error bar replaces status bar** — they never show simultaneously
2. **Error bar auto-dismisses** on next user action (clicking process or generate)
3. **Error bar has no close button** — it's transient, not blocking
4. **Button stays enabled** after error — user can immediately retry

### Validation Warnings (not errors)

| Warning Type | Display | User Action |
|--------------|---------|-------------|
| **Missing required fields** | Yellow alert: "Проверьте реквизиты" + list of missing fields | User fills in fields |
| **Field warnings** | Yellow alert: individual warning messages | User reviews and decides |
| **No missing, no warnings** | Alert hidden | — |

---

## 7. Loading States UX

### Processing (Step 1 → Step 2)

```
State: processing = true
┌─────────────────────────────────────────┐
│ [textarea disabled, grayed out]         │
│ [selects disabled]                      │
│ [status bar: "Обработка черновика…"]    │
│ [button: "Обработка…" + spinner]       │
└─────────────────────────────────────────┘
```

- Draft textarea: `disabled` + `opacity-60` (shows it's locked, not gone)
- Selects: `disabled`
- Button: loading variant (spinner + text change)
- Status bar: slide in with spinner icon

### Generating (Step 2 → download)

```
State: generating = true
┌─────────────────────────────────────────┐
│ [corrected textarea disabled]           │
│ [requisites inputs disabled]            │
│ [status bar: "Формирование DOCX…"]      │
│ [button: "Формирование…" + spinner]    │
└─────────────────────────────────────────┘
```

- Corrected textarea: `disabled` + `opacity-60`
- Requisites inputs: `disabled`
- Button: loading variant

### Post-download

```
Status bar: "DOCX готов и скачан" (blue, auto-dismiss after 5s)
Button changes to: "📥 Скачать ещё" + secondary "🔄 Обработать заново"
```

---

## 8. Accessibility Spec

### Keyboard Navigation

| Element | Tab Order | Keyboard Action |
|---------|-----------|-----------------|
| Document type radio/select | 1 | Arrow keys (radio) or Enter/Space (select) |
| Template select | 2 | Enter/Space to open, arrows to navigate |
| Draft textarea | 3 | Standard textarea keys |
| Process button | 4 | Enter/Space to activate |
| Corrected textarea (step 2) | 3 (replaces draft) | Standard textarea keys |
| Requisite inputs (step 2) | 4-N | Tab through fields |
| Generate button | N+1 | Enter/Space to activate |

### ARIA Requirements

```tsx
// Status bar — live region for screen readers
<div role="status" aria-live="polite" aria-atomic="true">
  {status}
</div>

// Error bar — alert role
<div role="alert" aria-live="assertive">
  {error}
</div>

// Step indicator — progress role
<div role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={3}
     aria-label={`Шаг ${currentStep} из 3`}>
  ...
</div>

// Textarea labels
<label htmlFor="draft-input">Черновик документа</label>
<textarea id="draft-input" ... />

// Requisite inputs
<label htmlFor="field-to">Адресат</label>
<input id="field-to" ... />

// Document type — fieldset + legend
<fieldset>
  <legend>Тип документа</legend>
  ...radio buttons...
</fieldset>
```

### Focus Management
- On step transition: focus moves to the new section's first interactive element
- On error: focus stays on the action button (user can retry immediately)
- On success (download): focus stays on the new action buttons

### Contrast
- All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Status blue: `bg-blue-50` / `text-blue-700` → 7.2:1 ✅
- Error red: `bg-red-50` / `text-red-700` → 6.8:1 ✅
- Warning yellow: `bg-yellow-50` / `text-yellow-800` → 7.1:1 ✅

---

## 9. Responsive Behavior

| Breakpoint | Layout Change |
|------------|---------------|
| **≥768px (md)** | 2-column grid for document type + template selects |
| **<768px** | Single column, selects stack vertically |
| **≥768px** | 2-column grid for requisite fields |
| **<768px** | Single column, requisites stack vertically |

---

## 10. Micro-interactions

| Element | Interaction | Effect |
|---------|-------------|--------|
| **Draft textarea** | Focus | `ring-2 ring-ring ring-offset-2` (already via shadcn) |
| **Select dropdowns** | Focus | Same ring effect |
| **Action button** | Hover | `hover:bg-primary/90` (already via shadcn) |
| **Action button** | Disabled | `opacity-50 cursor-not-allowed` (already via shadcn) |
| **Action button** | Click | Brief scale: `scale(0.98)` for 100ms (tactile feedback) |
| **Document type card** | Select | Border highlight + subtle shadow lift |
| **Step indicator dot** | Active | `scale: 1.2` pulse animation |
| **Status bar** | Appear | Slide down from top of content area |
| **Error bar** | Appear | Fade in with slight scale |
| **Corrected section** | Appear | Fade + slide up from below |

---

## 11. Implementation Notes for Engineers

### Dependencies to Add
```bash
pnpm add framer-motion
```

### File Structure (new)
```
packages/frontend/src/components/
├── DocumentGenerator.tsx          ← orchestrator (refactored, ~150 lines)
├── DraftSection.tsx               ← ~50 lines
├── CorrectedSection.tsx           ← ~40 lines
├── RequisitesForm.tsx             ← ~35 lines
├── StatusBar.tsx                  ← ~15 lines
├── ErrorBar.tsx                   ← ~12 lines
├── ValidationAlert.tsx            ← ~25 lines
├── ActionButton.tsx               ← ~30 lines
├── StepIndicator.tsx              ← ~25 lines
└── ui/                            ← existing shadcn components (unchanged)
```

### State Management
- All state stays in `DocumentGenerator.tsx` — no external state library needed
- Components are pure: receive props, render UI, call callbacks
- `useMemo` for `visibleFields` and `typeDescription` (already exists)

### Type Sharing
- `DocumentTypeId`, `TemplateId`, `Requisites` types → extract to `src/types/document.ts`
- `DOCUMENT_TYPES`, `FIELD_LABELS`, `FIELD_ORDER` constants → extract to `src/lib/constants.ts`

### Key Refactoring Rules
1. **No new dependencies** except `framer-motion`
2. **Keep all existing functionality** — refactor, don't rewrite
3. **Each component ≤ 60 lines** — if it's longer, split further
4. **Props interface per component** — explicit, documented
5. **`AnimatePresence mode="wait"`** — ensures exit completes before enter starts
6. **`layout` prop** on containers that change size — prevents content jumps
7. **`prefers-reduced-motion`** — wrap animations in a check: `const prefersReduced = useReducedMotion()` from framer-motion
