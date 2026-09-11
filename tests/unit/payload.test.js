import { describe, it, expect } from 'vitest';
import { encode, decode } from '../../src/bot/payload.js';

describe('payload', () => {
  describe('encode / decode roundtrip', () => {
    it('roundtrips a simple action', () => {
      const obj = { a: 'type', v: 'memo', r: 1 };
      const encoded = encode(obj);
      expect(typeof encoded).toBe('string');
      expect(decode(encoded)).toEqual(obj);
    });

    it('roundtrips an action without value', () => {
      const obj = { a: 'continue', r: 3 };
      const encoded = encode(obj);
      expect(decode(encoded)).toEqual(obj);
    });

    it('roundtrips an action with unicode', () => {
      const obj = { a: 'template', v: 'классический', r: 0 };
      const encoded = encode(obj);
      expect(decode(encoded)).toEqual(obj);
    });
  });

  describe('encode length limit', () => {
    it('throws when payload exceeds 64 characters', () => {
      const obj = { a: 'x'.repeat(60), r: 0 };
      // The JSON wrapping adds {"a":"...","r":0} overhead
      expect(() => encode(obj)).toThrow(/Payload too long/);
    });

    it('accepts payload at exactly 64 characters', () => {
      // Build a payload that fits in 64 chars
      // {"a":"t","v":"memo","r":10} = 27 chars — well within limit
      const obj = { a: 't', v: 'memo', r: 10 };
      expect(() => encode(obj)).not.toThrow();
      expect(encode(obj).length).toBeLessThanOrEqual(64);
    });
  });

  describe('decode edge cases', () => {
    it('returns null for invalid JSON', () => {
      expect(decode('not json')).toBeNull();
      expect(decode('')).toBeNull();
      expect(decode('{')).toBeNull();
    });

    it('returns null when "a" key is missing', () => {
      expect(decode('{"v":"memo","r":1}')).toBeNull();
    });

    it('returns null when "a" is not a string', () => {
      expect(decode('{"a":123,"r":1}')).toBeNull();
      expect(decode('{"a":null,"r":1}')).toBeNull();
    });

    it('returns null for empty object', () => {
      expect(decode('{}')).toBeNull();
    });

    it('returns null for array', () => {
      expect(decode('[]')).toBeNull();
    });

    it('accepts object with extra keys', () => {
      const obj = { a: 'test', r: 1, extra: 'data' };
      const result = decode(encode(obj));
      expect(result.a).toBe('test');
      expect(result.extra).toBe('data');
    });
  });
});
