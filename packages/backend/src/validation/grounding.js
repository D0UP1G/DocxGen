import { normalize } from './normalize.js';

/**
 * Check if an AI-extracted field value is grounded in the source text.
 * A value passes if:
 * 1. normalize(quote) is contained in normalize(source)
 * 2. Each significant word (len >= 3, not stopword) matches first 4 chars of some quote word
 * 3. All numbers in the value appear in the quote
 *
 * @param {string} value - The extracted field value
 * @param {string} quote - The AI-provided quote from the draft
 * @param {string} source - The original draft text
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkGrounding(value, quote, source) {
  const normSource = normalize(source);
  const normQuote = normalize(quote);
  const normValue = normalize(value);

  // Check 1: quote exists in source
  if (!normSource.includes(normQuote)) {
    return { ok: false, reason: 'quote_not_in_source' };
  }

  // Check 2: significant words in value match quote words
  // Skip pure-digit tokens (handled by number check below) and stopwords
  const valueWords = normValue.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  const quoteWords = normQuote.split(/\s+/);

  for (const vw of valueWords) {
    // Exact word match OR 6-char prefix minimum (looser than old 4-char prefix)
    const matched = quoteWords.some(qw => qw === vw || qw.startsWith(vw.slice(0, Math.max(6, vw.length - 1))));
    if (!matched) {
      return { ok: false, reason: `word_${vw}_not_found_in_quote` };
    }
  }

  // Check 3: all numbers in value appear in quote
  const valueNumbers = normValue.match(/\d[\d\s]*/g) || [];
  for (const num of valueNumbers) {
    const normNum = num.replace(/\s/g, '');
    if (!normQuote.replace(/\s/g, '').includes(normNum)) {
      return { ok: false, reason: `number_${normNum}_not_in_quote` };
    }
  }

  return { ok: true };
}

/**
 * Relaxed grounding check for derived fields (title, salutation).
 * Only checks that the value is not empty and contains at least one significant word
 * that appears in the draft — looser than extract grounding.
 * @param {string} value - The derived field value
 * @param {string} source - The original draft text
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkDerivedGrounding(value, source) {
  const normSource = normalize(source);
  const normValue = normalize(value);

  if (!normValue) {
    return { ok: false, reason: 'empty_value' };
  }

  // Get significant words (len >= 3, not stopwords, not pure digits)
  const valueWords = normValue.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  // If no significant words, it's likely a placeholder or empty — reject
  if (valueWords.length === 0) {
    return { ok: false, reason: 'no_significant_words' };
  }

  // Relaxed check: at least ONE significant word from the value must appear in the source
  const hasWordInSource = valueWords.some(vw => normSource.includes(vw));
  if (!hasWordInSource) {
    return { ok: false, reason: 'derived_words_not_in_source' };
  }

  return { ok: true };
}

const STOPWORDS = new Set([
  'для', 'при', 'из', 'или', 'но', 'за', 'от', 'до', 'по', 'не',
  'что', 'как', 'это', 'его', 'её', 'их', 'все', 'тот', 'та', 'те',
]);
