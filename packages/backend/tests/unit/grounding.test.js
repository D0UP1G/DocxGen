import { describe, it, expect } from 'vitest';
import { normalize } from '../../src/validation/normalize.js';
import { checkGrounding } from '../../src/validation/grounding.js';

describe('normalize', () => {
  it('converts ё→е and removes punctuation', () => {
    expect(normalize('Петровой А.С.')).toBe('петровой а.с.');
  });

  it('unifies then removes quotes', () => {
    // «» → " then " is removed (not in allowed set .,№%)
    expect(normalize('ООО «Вектор»')).toBe('ооо вектор');
  });

  it('unifies then removes dashes', () => {
    // – → - then - is removed (not in allowed set .,№%)
    expect(normalize('脱贫 – метод')).toBe('脱贫 метод');
  });

  it('collapses spaces', () => {
    expect(normalize('  много   пробелов  ')).toBe('много пробелов');
  });

  it('preserves ., №, %', () => {
    expect(normalize('ст. 5, № 10, 100%')).toBe('ст. 5, № 10, 100%');
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
});
