# Accessibility: ARIA Attributes for Status, Error, and Step Components

**Date:** 2026-09-11
**Source:** QA Engineer
**Priority:** medium
**Status:** pending
**Effort:** quick (<1hr)

## Recommendation
Add missing ARIA attributes to improve screen reader support:

1. **StatusBar.tsx** — Add `role="status"` and `aria-live="polite"` to the status container
2. **ErrorBar.tsx** — Add `role="alert"` and `aria-live="assertive"` to the error container
3. **StepIndicator.tsx** — Add `aria-label={`Шаг ${currentStep} из 3`}` to the step indicator container
4. **DraftSection.tsx** — Wrap Textarea in a `<label>` element or add `aria-label="Черновик документа"`
5. **CorrectedSection.tsx** — Wrap Textarea in a `<label>` element or add `aria-label="Исправленный текст"`

## Rationale
Screen readers cannot announce status changes, errors, or step progress without proper ARIA attributes. This is WCAG 2.1 Level A compliance (Success Criteria 1.3.1, 4.1.2).

## Evidence
- QA Engineer acceptance criteria check: 4/7 accessibility items failed
- WCAG 2.1 Level A: 1.3.1 (Info and Relationships), 4.1.2 (Name, Role, Value)
