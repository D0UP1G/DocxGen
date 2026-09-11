import { describe, expect, it } from 'vitest';
import { splitText } from '../../src/adapters/common/splitText.js';

describe('splitText', () => { it('preserves all content and respects limit', () => { const input = `${'абзац '.repeat(1000)}\n\nВторой абзац`; const parts = splitText(input, 4000); expect(parts.every((part) => part.length <= 4000)).toBe(true); expect(parts.join('\n\n')).toContain('Второй абзац'); }); });
