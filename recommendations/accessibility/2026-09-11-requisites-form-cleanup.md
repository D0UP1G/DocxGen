# Cleanup: Remove Unused visibleFields Prop from RequisitesForm

**Date:** 2026-09-11
**Source:** QA Engineer
**Priority:** low
**Status:** pending
**Effort:** quick (<1hr)

## Recommendation
Remove the unused `visibleFields` prop from `RequisitesFormProps` interface. The component receives `fields` which already serves the same purpose.

## Rationale
Unused props create confusion about the component's API surface. Clean interfaces are easier to understand and maintain.

## Evidence
- QA Engineer code review: `RequisitesFormProps.visibleFields` is declared but never used in the component body
