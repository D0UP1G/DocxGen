/**
 * Unit conversion helpers for the docx library.
 * docx uses twips (twentieths of a point) internally.
 *
 * - mm  → twips: 1 inch = 25.4 mm = 1440 twips
 * - pt  → twips: 1 pt = 20 twips (for spacing/indent)
 * - halfPt → twips: 1 pt = 2 half-points (for font size)
 * - line → twips: line spacing multiplier × 240 twips per line
 */
export const mm = (v) => Math.round((v * 1440) / 25.4);
export const pt = (v) => Math.round(v * 20);
export const halfPt = (v) => Math.round(v * 2);
export const line = (k) => Math.round(k * 240);
