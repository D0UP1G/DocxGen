import { z } from 'zod';

// ── Field value schema ───────────────────────────────────────────────────────
// Each extracted field has a `value` (normalized) and a `quote` (verbatim snippet from draft).
// null means "not found / could not extract".

const FieldValue = z.object({
  value: z.string().trim().min(1),
  quote: z.string().trim().min(1),
});

// ── Full AI result schema ────────────────────────────────────────────────────
// title: nullable — AI may leave it unchanged or return null
// body: array of paragraphs (non-empty, trimmed)
// fields: record of fieldKey → FieldValue | null
// changes: human-readable list of what was modified (max 10 to prevent noise)

export const AiResultSchema = z.object({
  title: z.string().trim().min(1).nullable(),
  body: z.array(z.string().trim().min(1)).min(1),
  fields: z.record(z.string(), FieldValue.nullable()).default({}),
  changes: z.array(z.string()).max(10).default([]),
});

/**
 * Extract JSON from AI response — handles markdown fences and surrounding text.
 * Strategy: strip ```json fences, find first { to last }, parse that slice.
 * @param {string} raw
 * @returns {object}
 */
export function extractJson(raw) {
  const text = raw.replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in AI response');
  return JSON.parse(text.slice(start, end + 1));
}
