/**
 * Normalize Russian number abbreviations to plain numbers for comparison.
 * "2.5 млн" → "2500000", "15 тыс" → "15000", "3.2 млрд" → "3200000000"
 * @param {string} text
 * @returns {string}
 */
function normalizeNumber(text) {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*тыс/gi, (_, n) => String(parseFloat(n.replace(',', '.')) * 1000))
    .replace(/(\d+(?:[.,]\d+)?)\s*млн/gi, (_, n) => String(parseFloat(n.replace(',', '.')) * 1000000))
    .replace(/(\d+(?:[.,]\d+)?)\s*млрд/gi, (_, n) => String(parseFloat(n.replace(',', '.')) * 1000000000));
}

/**
 * Extract structured facts from text for comparison.
 * @param {string} text
 * @returns {{ numbers: string[], dates: string[], money: string[], names: string[], conditions: string[] }}
 */
export function extractFacts(text) {
  const numbers = (text.match(/\d[\d\s]*(?:[.,]\d+)?/g) || [])
    .map(n => n.replace(/\s/g, '').replace(',', '.'));

  const dates = [];
  // DD.MM.YYYY or DD.MM.YY
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g)) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? '20' + y : y;
    dates.push(`${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }
  // "D месяца ГГГГ"
  const monthMap = { 'январ': '01', 'феврал': '02', 'март': '03', 'апрел': '04',
    'мая': '05', 'июн': '06', 'июл': '07', 'август': '08',
    'сентябр': '09', 'октябр': '10', 'ноябр': '11', 'декабр': '12' };
  for (const m of text.matchAll(/(\d{1,2})\s+(январ|феврал|март|апрел|мая|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*\s*(\d{4})?/gi)) {
    const [, d, monthPart, y] = m;
    const mo = monthMap[monthPart.toLowerCase()];
    if (mo) {
      const year = y || '????';
      dates.push(`${year}-${mo}-${d.padStart(2, '0')}`);
    }
  }

  const money = [];
  for (const m of text.matchAll(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:руб|р\.|₽|тыс|млн|млрд)/gi)) {
    let num = m[1].replace(/\s/g, '').replace(',', '.');
    let multiplier = 1;
    if (m[0].includes('млрд')) multiplier = 1000000000;
    else if (m[0].includes('млн')) multiplier = 1000000;
    else if (m[0].includes('тыс')) multiplier = 1000;
    money.push(String(parseFloat(num) * multiplier));
  }

  // \b doesn't work with Cyrillic in JS, so use lookbehind for non-Cyrillic boundary
  // Supports: "Фамилия И. О." and "И. О. Фамилия"
  const surnameFirst = (text.match(/(?<![А-ЯЁа-яё0-9])[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.?/g) || [])
    .map(n => n.split(/\s+/)[0].toLowerCase());
  const initialsFirst = (text.match(/[А-ЯЁ]\.\s*[А-ЯЁ]\.?\s+[А-ЯЁ][а-яё]+/g) || [])
    .map(n => n.split(/\s+/).pop().toLowerCase());
  const names = [...surnameFirst, ...initialsFirst];

  const conditionWords = ['не позднее', 'до', 'при условии', 'если', 'в случае'];
  const conditions = conditionWords.filter(w => text.toLowerCase().includes(w));
  // Count negations before verbs (\b doesn't work with Cyrillic in JS)
  const negCount = (text.match(/(?<![А-ЯЁа-яё])не\s+[а-яё]+/gi) || []).length;
  if (negCount > 0) conditions.push(`negations:${negCount}`);

  return { numbers, dates, money, names, conditions };
}

/**
 * Compare source and output texts for added/lost facts.
 * @param {string} sourceText
 * @param {string} outputText
 * @returns {{ added: string[], lost: string[], conditionsChanged: boolean }}
 */
export function compare(sourceText, outputText) {
  const src = extractFacts(sourceText);
  const out = extractFacts(outputText);

  // Normalize numbers for semantic equivalence (e.g. "2.5 млн" → "2500000")
  const normalizedSrcNums = src.numbers.map(normalizeNumber);
  const normalizedOutNums = out.numbers.map(normalizeNumber);

  const added = [];
  const lost = [];

  // Check numbers (using normalized forms)
  for (const n of normalizedOutNums) {
    if (!normalizedSrcNums.includes(n)) added.push(`number:${n}`);
  }
  for (const n of normalizedSrcNums) {
    if (!normalizedOutNums.includes(n)) lost.push(`number:${n}`);
  }

  // Check dates
  for (const d of out.dates) {
    if (!src.dates.includes(d)) added.push(`date:${d}`);
  }
  for (const d of src.dates) {
    if (!out.dates.includes(d)) lost.push(`date:${d}`);
  }

  // Check money
  for (const m of out.money) {
    if (!src.money.includes(m)) added.push(`money:${m}`);
  }
  for (const m of src.money) {
    if (!out.money.includes(m)) lost.push(`money:${m}`);
  }

  // Check names
  for (const n of out.names) {
    if (!src.names.includes(n)) added.push(`name:${n}`);
  }
  for (const n of src.names) {
    if (!out.names.includes(n)) lost.push(`name:${n}`);
  }

  // Check conditions
  const conditionsChanged = src.conditions.join(',') !== out.conditions.join(',');

  return { added, lost, conditionsChanged };
}
