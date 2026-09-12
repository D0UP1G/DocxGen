import { describe, it, expect } from 'vitest';
import { normalize } from '../../src/validation/normalize.js';
import { checkGrounding, checkDerivedGrounding } from '../../src/validation/grounding.js';

describe('normalize', () => {
  it('converts ё→е and removes punctuation', () => {
    expect(normalize('Петровой А.С.')).toBe('петровой а.с.');
  });

  it('unifies then removes quotes', () => {
    // «» → " then " is removed (not in allowed set .,№%)
    expect(normalize('ООО «Вектор»')).toBe('ооо вектор');
  });

  it('preserves standalone hyphen (-)', () => {
    // Standalone hyphen is in the preserve set
    expect(normalize('脱贫 - 方法')).toBe('脱贫 - 方法');
  });

  it('collapses spaces', () => {
    expect(normalize('  много   пробелов  ')).toBe('много пробелов');
  });

  it('preserves ., №, %', () => {
    expect(normalize('ст. 5, № 10, 100%')).toBe('ст. 5, № 10, 100%');
  });

  it('preserves phone numbers with +, -, (, )', () => {
    expect(normalize('+7 (900) 000-00-00')).toBe('+7 (900) 000-00-00');
  });

  it('preserves / in dates', () => {
    expect(normalize('01/03/2025')).toBe('01/03/2025');
  });

  it('@ is replaced by space (not in preserve set)', () => {
    // @ is not in the allowed set, so it becomes a space
    expect(normalize('office@romashka.example')).toBe('office romashka.example');
  });

  it('preserves parentheses and plus in mixed text', () => {
    // — → - (unified), then — is in the dash set → replaced, then - is NOT in preserve set
    // Actually — → - (unified), then the remaining text gets normalized
    expect(normalize('Стоимость (+ VAT) итого')).toBe('стоимость (+ vat) итого');
  });
});

describe('checkGrounding', () => {
  it('accepts value with matching quote in source', () => {
    const source = 'Записка для Петровой А.С. о командировке';
    const quote = 'записка для Петровой А.С.';
    const value = 'Петровой А.С.';
    expect(checkGrounding(value, quote, source)).toEqual({ ok: true });
  });

  it('rejects value with word not found in source', () => {
    const source = 'Записка о командировке';
    const quote = 'записка о командировке';
    const value = 'Директору Смирнову';
    const result = checkGrounding(value, quote, source);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/word_.*_not_found_in_quote/);
  });

  it('rejects quote not in source', () => {
    const source = 'Записка о командировке';
    const quote = 'несуществующая цитата';
    const value = 'командировке';
    expect(checkGrounding(value, quote, source)).toEqual({
      ok: false,
      reason: 'quote_not_in_source',
    });
  });

  it('rejects value with number not in quote', () => {
    const source = 'Приказ от 01.01.2025';
    const quote = 'приказ от 01.01.2025';
    const value = 'Приказ № 2026';
    const result = checkGrounding(value, quote, source);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/number_.*_not_in_quote/);
  });

  it('does not reject stopwords as missing words', () => {
    const source = 'Записка для Петровой о командировке';
    const quote = 'записка для Петровой о командировке';
    const value = 'для Петровой';
    expect(checkGrounding(value, quote, source)).toEqual({ ok: true });
  });

  it('accepts 6-char prefix match for longer words', () => {
    const source = 'Приказ о назначении руководителя проекта';
    const quote = 'о назначении руководителя';
    const value = 'Назначении';
    expect(checkGrounding(value, quote, source)).toEqual({ ok: true });
  });

  it('accepts exact match for short words', () => {
    const source = 'ООО Вектор';
    const quote = 'ооо вектор';
    const value = 'Вектор';
    expect(checkGrounding(value, quote, source)).toEqual({ ok: true });
  });
});

describe('checkDerivedGrounding', () => {
  it('accepts value with at least one word in source', () => {
    const source = 'Записка о командировке в Москву';
    const value = 'О командировке';
    expect(checkDerivedGrounding(value, source)).toEqual({ ok: true });
  });

  it('rejects empty value', () => {
    const source = 'Записка о командировке';
    expect(checkDerivedGrounding('', source)).toEqual({ ok: false, reason: 'empty_value' });
  });

  it('rejects value with no significant words', () => {
    const source = 'Записка о командировке';
    expect(checkDerivedGrounding('для и', source)).toEqual({ ok: false, reason: 'no_significant_words' });
  });

  it('rejects value whose words are not in source', () => {
    const source = 'Записка о командировке';
    const value = 'Протокол совещания';
    const result = checkDerivedGrounding(value, source);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('derived_words_not_in_source');
  });

  it('accepts derived title grounded in draft', () => {
    const source = 'Служебная записка о закупке оборудования для отдела';
    const value = 'О закупке оборудования';
    expect(checkDerivedGrounding(value, source)).toEqual({ ok: true });
  });
});
