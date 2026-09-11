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
    const vwPrefix = vw.slice(0, 4);
    const matched = quoteWords.some(qw => qw.startsWith(vwPrefix));
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

const STOPWORDS = new Set([
  'для', 'при', 'из', 'или', 'но', 'за', 'от', 'до', 'по', 'не',
  'что', 'как', 'это', 'его', 'её', 'их', 'все', 'тот', 'та', 'те',
]);
