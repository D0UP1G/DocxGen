import { describe, it, expect } from 'vitest';
import { buildMessages } from '../../src/ai/prompt.js';

const DOC_TYPE = {
  id: 'zapiska',
  name: 'Записка',
  structureHint: 'Заголовок, дата, от кого, кому, текст',
  fields: [
    { key: 'recipient', label: 'Кому', kind: 'extract', question: 'Имя и должность получателя' },
    { key: 'sender', label: 'От кого', kind: 'extract' },
    { key: 'title', label: 'Заголовок', kind: 'derived' },
  ],
};

describe('buildMessages', () => {
  it('fieldsList includes kind indicator (extract/derived)', () => {
    const messages = buildMessages({ draft: 'Текст', docType: DOC_TYPE });
    const systemContent = messages[0].content;

    // extract fields get "(найди в тексте)" hint
    expect(systemContent).toContain('recipient: Кому (найди в тексте)');
    expect(systemContent).toContain('sender: От кого (найди в тексте)');
    // derived fields get "(создай на основе текста)" hint
    expect(systemContent).toContain('title: Заголовок (создай на основе текста)');
  });

  it('fieldsList includes question when present', () => {
    const messages = buildMessages({ draft: 'Текст', docType: DOC_TYPE });
    const systemContent = messages[0].content;

    expect(systemContent).toContain('recipient: Кому (найди в тексте) — Имя и должность получателя');
  });

  it('docTypeId injected into prompt', () => {
    const messages = buildMessages({ draft: 'Текст', docType: DOC_TYPE });
    const systemContent = messages[0].content;

    expect(systemContent).toContain('zapiska');
  });

  it('docTypeName injected into prompt', () => {
    const messages = buildMessages({ draft: 'Текст', docType: DOC_TYPE });
    const systemContent = messages[0].content;

    expect(systemContent).toContain('Записка');
  });

  it('{{ in docType.name is escaped', () => {
    const docType = {
      id: 'test',
      name: 'Записка {{Draft}}',
      structureHint: 'Текст',
      fields: [],
    };
    const messages = buildMessages({ draft: 'Текст', docType });
    const systemContent = messages[0].content;

    // The {{ should be escaped to \{ so it doesn't cause template injection
    expect(systemContent).not.toContain('{{Draft}}');
  });

  it('{{ in structureHint is escaped', () => {
    const docType = {
      id: 'test',
      name: 'Тест',
      structureHint: 'Заголовок {{var}} текст',
      fields: [],
    };
    const messages = buildMessages({ draft: 'Текст', docType });
    const systemContent = messages[0].content;

    expect(systemContent).not.toContain('{{var}}');
  });

  it('user message contains draft in <draft> tags', () => {
    const messages = buildMessages({ draft: 'Мой черновик', docType: DOC_TYPE });
    const userContent = messages[1].content;

    expect(userContent).toContain('<draft>');
    expect(userContent).toContain('Мой черновик');
    expect(userContent).toContain('</draft>');
  });

  it('system message is first, user message is second', () => {
    const messages = buildMessages({ draft: 'Текст', docType: DOC_TYPE });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });
});
