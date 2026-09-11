# DocxGen — Implementation Plan

## Architecture Decision

**Option C (Hybrid)**: Keep Typst→PDF→Pandoc→DOCX pipeline, add structured JSON output + validation + template selection. Judges check observable behavior, not internal architecture.

## Overview

This plan covers two things:
1. **Hackathon deliverable** — the Typst pipeline, backend API, and React UI
2. **Demo-quality output** — clean .docx files that impress the judges

---

## What's Done ✅

### P0 — AI Structured Output
- [x] AI outputs structured JSON (`correctedText`, `requisites`, `documentType`)
- [x] Error recovery loop (parse error → AI patch → retry, MAX_RETRIES=10)
- [x] Prompts extracted to SSOT: `packages/backend/src/prompts/document-prompts.ts`
- [x] Few-shot examples in prompt for proper output format

### P1 — Templates, Validation, Document Types
- [x] **P1.1**: Document type definitions — `packages/backend/src/document-types.ts`
- [x] **P1.2**: Validation service — `packages/backend/src/services/validation.service.ts`
- [x] **P1.3**: Validation wired into route — sends `validation` SSE event
- [x] **P1.4**: Frontend validation display — shows yellow warning for missing fields
- [x] **P1.5**: Template interface + registry — `packages/backend/src/templates/index.ts`
- [x] **P1.6**: Official template (ГОСТ) — `packages/backend/src/templates/official.ts`
- [x] **P1.7**: Standard template — `packages/backend/src/templates/standard.ts`
- [x] **P1.8**: Templates wired into route — accepts `templateId`, generates via template
- [x] **P1.9**: Frontend template selector — dropdown for Официальный/Стандартный
- [x] Bracket artifacts fixed — no more `[` `]` in output

### P2 — Example Quality
- [ ] Convert spec/ examples to Typst for AI reference ← **IN PROGRESS**
- [ ] Update prompt with correct output examples ← **DONE**
- [ ] Test full pipeline with test inputs

### P3 — Demo Polish
- [ ] Preview before download
- [ ] Edit requisites in UI
- [ ] Multiple document types in one session

---

## Architecture

```
User text → AI (podman/opencode) → Structured JSON
                                         ↓
                                    Validation
                                         ↓
                                    Template
                                         ↓
                                    Typst source
                                         ↓
                                    Typst compile → PDF
                                         ↓
                                    Pandoc → DOCX
                                         ↓
                                    Download
```

---

## File Structure

```
packages/
├── backend/
│   └── src/
│       ├── document-types.ts          # 4 document types, Requisites interface
│       ├── prompts/
│       │   ├── document-prompts.ts    # SSOT for AI prompts
│       │   └── examples/              # Few-shot examples for AI
│       ├── routes/
│       │   └── document.ts            # POST /api/generate (SSE)
│       ├── services/
│       │   ├── ai.service.ts          # podman run opencode
│       │   ├── validation.service.ts  # validateRequisites()
│       │   ├── typst.service.ts       # compileTypstContent(), retryCompile()
│       │   └── pandoc.service.ts      # convertToDocx()
│       ├── templates/
│       │   ├── index.ts               # Template interface, registry
│       │   ├── official.ts            # ГОСТ Р 6.30-2003
│       │   └── standard.ts            # Simplified style
│       └── index.ts                   # Express server (port 3001)
├── frontend/
│   └── src/
│       └── components/
│           └── DocumentGenerator.tsx   # Main UI
```

---

## Known Issues

1. **AI output format**: AI sometimes generates Typst markup instead of plain text → fixed with few-shot examples
2. **Template brackets**: Was rendering literal `[` `]` → fixed by removing `escapeTypst`
3. **Body text missing**: AI sometimes outputs empty correctedText → need to test with examples

---

## Testing

Test inputs available in `test_inputs/`:
1. `input1_official_letter.txt` — Official letter with all fields
2. `input2_sluzhebnaya.txt` — Internal memo with missing fields
3. `input3_dokladnaya.txt` — Inspection report with all fields
4. `input4_informatsionnaya.txt` — Information note with all fields
5. `input5_dirty_draft.txt` — Messy draft with errors

Run full pipeline:
```bash
pnpm dev
# Then test with any input from test_inputs/
```

---

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build production |
| `pnpm test` | Run tests |
