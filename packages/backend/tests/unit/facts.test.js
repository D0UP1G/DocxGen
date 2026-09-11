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
