# Decomposition: DraftSection Under 60 Lines

**Date:** 2026-09-11
**Source:** QA Engineer
**Priority:** low
**Status:** pending
**Effort:** quick (<1hr)

## Recommendation
DraftSection.tsx is 91 lines (UX spec target: ≤60 lines). Extract the document type + template select grid into a subcomponent (e.g., `DocumentSettings.tsx` or `SelectGrid.tsx`).

## Rationale
Smaller components are easier to test, animate independently, and maintain. The UX spec explicitly targets ≤60 lines per component.

## Evidence
- QA Engineer line count check: DraftSection = 91 lines
- UX Design Spec: "Each component ≤ 60 lines — if it's longer, split further"
