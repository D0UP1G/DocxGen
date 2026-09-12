import { describe, it, expect } from 'vitest';
import { extractJson, AiResultSchema } from '../../src/ai/schema.js';

describe('extractJson', () => {
  it('extracts from markdown json fence', () => {
    const input = '```json\n{"title":"Test","body":["Hi"],"fields":{},"changes":[]}\n```';
    expect(extractJson(input)).toEqual({
      title: 'Test',
      body: ['Hi'],
      fields: {},
      changes: [],
    });
  });

  it('extracts from markdown fence without language tag', () => {
    const input = '```\n{"title":"Test","body":["Hi"],"fields":{},"changes":[]}\n```';
    expect(extractJson(input)).toEqual({
      title: 'Test',
      body: ['Hi'],
      fields: {},
      changes: [],
    });
  });

  it('falls back to raw extraction when fence parsing fails', () => {
    const input = 'Here is the result: {"title":"Test","body":["Hi"],"fields":{},"changes":[]}';
    expect(extractJson(input)).toEqual({
      title: 'Test',
      body: ['Hi'],
      fields: {},
      changes: [],
    });
  });

  it('extracts JSON with surrounding text (no fence)', () => {
    const input = 'Sure, here is the JSON: {"a": 1} and some trailing text.';
    expect(extractJson(input)).toEqual({ a: 1 });
  });

  it('throws on no JSON object', () => {
    expect(() => extractJson('no json here')).toThrow('no JSON object in AI response');
  });

  it('throws on empty string', () => {
    expect(() => extractJson('')).toThrow('no JSON object in AI response');
  });
});

describe('AiResultSchema', () => {
  it('accepts valid result', () => {
    const result = AiResultSchema.parse({
      title: 'Записка',
      body: ['Параграф 1'],
      fields: { name: { value: 'Иван', quote: 'Иван' } },
      changes: ['Исправлено'],
    });
    expect(result.title).toBe('Записка');
    expect(result.body).toEqual(['Параграф 1']);
  });

  it('body rejects > 50 paragraphs', () => {
    const body = Array.from({ length: 51 }, (_, i) => `Параграф ${i}`);
    expect(() => AiResultSchema.parse({
      title: null,
      body,
      fields: {},
      changes: [],
    })).toThrow();
  });

  it('body accepts exactly 50 paragraphs', () => {
    const body = Array.from({ length: 50 }, (_, i) => `Параграф ${i}`);
    const result = AiResultSchema.parse({
      title: null,
      body,
      fields: {},
      changes: [],
    });
    expect(result.body).toHaveLength(50);
  });

  it('individual paragraph rejects > 5000 chars', () => {
    const longPara = 'x'.repeat(5001);
    expect(() => AiResultSchema.parse({
      title: null,
      body: [longPara],
      fields: {},
      changes: [],
    })).toThrow();
  });

  it('individual paragraph accepts exactly 5000 chars', () => {
    const para = 'x'.repeat(5000);
    const result = AiResultSchema.parse({
      title: null,
      body: [para],
      fields: {},
      changes: [],
    });
    expect(result.body[0]).toHaveLength(5000);
  });

  it('changes rejects > 10 items', () => {
    expect(() => AiResultSchema.parse({
      title: null,
      body: ['x'],
      fields: {},
      changes: Array.from({ length: 11 }, (_, i) => `change ${i}`),
    })).toThrow();
  });

  it('body accepts empty paragraphs after trim', () => {
    // Paragraphs that are just whitespace get trimmed to empty → rejected by min(1)
    expect(() => AiResultSchema.parse({
      title: null,
      body: ['   '],
      fields: {},
      changes: [],
    })).toThrow();
  });

  it('title can be null', () => {
    const result = AiResultSchema.parse({
      title: null,
      body: ['text'],
      fields: {},
      changes: [],
    });
    expect(result.title).toBeNull();
  });
});
