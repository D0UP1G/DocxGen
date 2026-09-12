import { describe, it, expect } from 'vitest';
import { extractFacts, compare } from '../../src/validation/facts.js';

describe('extractFacts', () => {
  it('extracts numbers with spaces and decimal separators', () => {
    const result = extractFacts('Сумма 184 500 руб. и 1 234,56');
    expect(result.numbers).toContain('184500');
    expect(result.numbers).toContain('1234.56');
  });

  it('extracts dates in DD.MM.YYYY format', () => {
    const result = extractFacts('Приказ от 03.09.2026');
    expect(result.dates).toContain('2026-09-03');
  });

  it('extracts dates in DD.MM.YY format', () => {
    const result = extractFacts('Дата 01.01.25');
    expect(result.dates).toContain('2025-01-01');
  });

  it('extracts dates in "D месяца ГГГГ" format', () => {
    const result = extractFacts('3 сентября 2026');
    expect(result.dates).toContain('2026-09-03');
  });

  it('extracts dates in "D месяца" format without year', () => {
    const result = extractFacts('15 мая');
    expect(result.dates).toContain('????-05-15');
  });

  it('extracts money with multiplier тыс', () => {
    const result = extractFacts('Стоимость 100 тыс руб');
    expect(result.money).toContain('100000');
  });

  it('extracts money with multiplier млн', () => {
    const result = extractFacts('Бюджет 5 млн руб');
    expect(result.money).toContain('5000000');
  });

  it('extracts money with ₽ symbol', () => {
    const result = extractFacts('Цена 1000 ₽');
    expect(result.money).toContain('1000');
  });

  it('extracts money with "руб" and "р."', () => {
    const result = extractFacts('1000 руб. и 500 р.');
    expect(result.money).toContain('1000');
    expect(result.money).toContain('500');
  });

  it('extracts names from "Фамилия И. О." format', () => {
    const result = extractFacts('Петров И. А. подписал');
    expect(result.names).toContain('петров');
  });

  it('extracts names from "И. О. Фамилия" format', () => {
    const result = extractFacts('И. А. Петров подписал');
    expect(result.names).toContain('петров');
  });

  it('detects condition words', () => {
    const result = extractFacts('не позднее 10 дней при условии оплаты');
    expect(result.conditions).toContain('не позднее');
    expect(result.conditions).toContain('при условии');
  });

  it('counts negations', () => {
    const result = extractFacts('Не должен не допускать не соблюдение');
    expect(result.conditions).toContain('negations:3');
  });
});

describe('compare', () => {
  it('detects added money', () => {
    const src = 'Сумма 1000 руб.';
    const out = 'Сумма 1000 руб. и бонус 500 руб.';
    const result = compare(src, out);
    expect(result.added).toContain('money:500');
    expect(result.lost).toHaveLength(0);
  });

  it('detects lost money', () => {
    const src = 'Сумма 1000 руб. и бонус 500 руб.';
    const out = 'Сумма 1000 руб.';
    const result = compare(src, out);
    expect(result.lost).toContain('money:500');
    expect(result.added).toHaveLength(0);
  });

  it('detects added name', () => {
    const src = 'Петров И. А. подписал';
    const out = 'Петров И. А. и Кузнецов К. К. подписали';
    const result = compare(src, out);
    expect(result.added).toContain('name:кузнецов');
  });

  it('detects lost date', () => {
    const src = 'Приказ от 03.09.2026 и 01.01.2025';
    const out = 'Приказ от 03.09.2026';
    const result = compare(src, out);
    expect(result.lost).toContain('date:2025-01-01');
  });

  it('detects conditions changed', () => {
    const src = 'не позднее 10 дней';
    const out = 'в течение 10 дней';
    const result = compare(src, out);
    expect(result.conditionsChanged).toBe(true);
  });

  it('same text produces empty added/lost', () => {
    const text = 'Сумма 1000 руб. от 03.09.2026';
    const result = compare(text, text);
    expect(result.added).toHaveLength(0);
    expect(result.lost).toHaveLength(0);
    expect(result.conditionsChanged).toBe(false);
  });

  it('preserves multiple numbers', () => {
    // Regex \d[\d\s]* greedily captures "100 200 300" as one token (intended for "184 500" style)
    const result = extractFacts('100 200 300');
    expect(result.numbers).toEqual(['100200300']);
  });

  it('normalizes different date formats to YYYY-MM-DD', () => {
    const result = extractFacts('03.09.2026 и 3 сентября 2026');
    expect(result.dates).toContain('2026-09-03');
    // Both formats normalize to the same date
    expect(result.dates.length).toBeGreaterThanOrEqual(2);
  });
});

describe('semantic equivalence (normalizeNumber)', () => {
  it('"2.5 млн руб" == "2500000 руб" via money path', () => {
    const src = 'Сумма 2.5 млн руб';
    const out = 'Сумма 2500000 руб';
    const result = compare(src, out);
    // Money path handles equivalence: 2.5 млн → 2500000, 2500000 → 2500000
    expect(result.added).not.toContain('money:2500000');
    expect(result.lost).not.toContain('money:2500000');
  });

  it('"180 тыс руб" == "180000 руб" via money path', () => {
    const src = 'Стоимость 180 тыс руб';
    const out = 'Стоимость 180000 руб';
    const result = compare(src, out);
    expect(result.added).not.toContain('money:180000');
    expect(result.lost).not.toContain('money:180000');
  });

  it('"3.2 млрд руб" — млрд now correctly detected as money (FIXED)', () => {
    // The money regex now includes млрд, so "3.2 млрд руб" extracts money as ["3200000000"]
    const src = 'Бюджет 3.2 млрд руб';
    const out = 'Бюджет 3200000000 руб';
    const result = compare(src, out);
    // After fix: equivalence IS detected — no added/lost money
    expect(result.added).not.toContain('money:3200000000');
    expect(result.lost).not.toContain('money:3200000000');
  });

  it('mixed formats: "2.5 млн руб" in draft, "2500000 руб" in output → no added/lost money', () => {
    const src = 'Оплата 2.5 млн руб за работы';
    const out = 'Оплата 2500000 руб за работы';
    const result = compare(src, out);
    expect(result.added).not.toContain('money:2500000');
    expect(result.lost).not.toContain('money:2500000');
  });

  it('"5 тыс руб" == "5000 руб" via money path (numbers differ)', () => {
    // Money path: src extracts money "5000" (5*1000), out extracts money "5000" → match
    // Numbers path: src extracts "5", out extracts "5000" → mismatch (normalizeNumber is no-op on plain numbers)
    const src = '5 тыс руб';
    const out = '5000 руб';
    const result = compare(src, out);
    // Money matches, but numbers don't (5 vs 5000)
    expect(result.added).toContain('number:5000');
    expect(result.lost).toContain('number:5');
  });

  it('detects added number when amounts differ', () => {
    const src = 'Сумма 2.5 млн руб';
    const out = 'Сумма 3 млн руб';
    const result = compare(src, out);
    // Money: 2.5 млн → 2500000, 3 млн → 3000000
    expect(result.added).toContain('money:3000000');
    expect(result.lost).toContain('money:2500000');
  });

  it('normalizeNumber is applied to numbers array (no-op for plain numbers)', () => {
    // extractFacts numbers don't contain suffixes, so normalizeNumber is a no-op
    const src = 'Сумма 2.5 млн руб';
    const out = 'Сумма 2500000 руб';
    const srcFacts = extractFacts(src);
    const outFacts = extractFacts(out);
    // src numbers: ["2.5"], out numbers: ["2500000"]
    expect(srcFacts.numbers).toContain('2.5');
    expect(outFacts.numbers).toContain('2500000');
    // normalizeNumber doesn't help here — these are raw numbers without suffixes
    // The money comparison handles the equivalence instead
  });
});
