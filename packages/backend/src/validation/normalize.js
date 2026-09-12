/**
 * Normalize text for comparison: lowercase, ё→е, unify quotes/dashes,
 * remove punctuation except .,№%, collapse spaces.
 * @param {string} s
 * @returns {string}
 */
export function normalize(s) {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[""«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\p{L}\p{N}\s.,№%()+\-/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
