import { describe, it, expect } from 'vitest';
import { mergeRequisites } from '../../src/validation/requisites.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const memoDocType = {
  id: 'memo',
  name: 'Служебная записка',
  fields: [
    { key: 'Адресат', label: 'Адресат', kind: 'extract', required: true,
      question: 'Кому адресована записка? Укажите должность и ФИО.',
      example: 'Начальнику отдела кадров Петровой А. С.' },
    { key: 'Должность автора', label: 'Должность автора', kind: 'extract', required: true,
      question: 'Ваша должность и подразделение?', example: 'Ведущий специалист отдела закупок' },
    { key: 'ФИО автора', label: 'ФИО автора', kind: 'extract', required: true,
      question: 'Ваши фамилия и инициалы?', example: 'Сидоров П. П.' },
    { key: 'Тема', label: 'Тема', kind: 'derived', required: true },
    { key: 'Дата', label: 'Дата', kind: 'auto', required: true },
    { key: 'Номер', label: 'Номер', kind: 'registry', required: false },
  ],
};

const classicTemplate = {
  id: 'classic',
  organization: { name: '', address: 'г. Москва, ул. Примерная, д. 1', phone: '+7 (000) 000-00-00' },
  autoFill: { date: true },
  dateFormat: 'D MMMM YYYY г.',
};

const templateWithOrgFields = {
  id: 'with-org',
  fields: [
    { key: 'name', label: 'Наименование организации', kind: 'template', required: false },
    { key: 'address', label: 'Адрес организации', kind: 'template', required: false },
    { key: 'phone', label: 'Телефон организации', kind: 'template', required: false },
  ],
};

// ── Priority tests ───────────────────────────────────────────────────────────

describe('mergeRequisites', () => {
  describe('priority', () => {
    it('user value overrides AI value for same key', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: { 'Адресат': { value: 'ИИ значение', quote: 'цитата' } },
        title: null,
        userFields: { 'Адресат': 'Значение пользователя' },
        today: '2026-09-11',
      });
      expect(result.values['Адресат'].value).toBe('Значение пользователя');
      expect(result.values['Адресат'].source).toBe('user');
    });

    it('AI value used when user has no value', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: { 'Адресат': { value: 'Петровой А. С.', quote: 'для Петровой' } },
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values['Адресат'].value).toBe('Петровой А. С.');
      expect(result.values['Адресат'].source).toBe('ai');
    });
  });

  // ── User skip ────────────────────────────────────────────────────────────

  describe('user skip', () => {
    it('userFields[key] === null → value is null, field NOT in pending', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: { 'Адресат': null },
        today: '2026-09-11',
      });
      expect(result.values['Адресат'].value).toBeNull();
      expect(result.values['Адресат'].source).toBe('user_skip');
      expect(result.pending.find((p) => p.key === 'Адресат')).toBeUndefined();
    });
  });

  // ── Auto date ────────────────────────────────────────────────────────────

  describe('auto date', () => {
    it('autoFill.date = true → date filled with today in dateFormat', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values['Дата'].value).toBe('11 сентября 2026 г.');
      expect(result.values['Дата'].source).toBe('auto');
    });

    it('autoFill.date = false → date goes to pending', () => {
      const templateNoAuto = { ...classicTemplate, autoFill: { date: false } };
      const result = mergeRequisites({
        docType: memoDocType,
        template: templateNoAuto,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values['Дата'].value).toBeNull();
      expect(result.pending.find((p) => p.key === 'Дата')).toBeDefined();
    });
  });

  // ── Registry ─────────────────────────────────────────────────────────────

  describe('registry', () => {
    it('kind = "registry" → never in pending, always placeholder', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values['Номер'].value).toBeNull();
      expect(result.values['Номер'].source).toBe('none');
      expect(result.pending.find((p) => p.key === 'Номер')).toBeUndefined();
      expect(result.placeholders).toContain('Номер');
    });
  });

  // ── Required / optional ──────────────────────────────────────────────────

  describe('required field empty', () => {
    it('goes to pending with question', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      const addresseePending = result.pending.find((p) => p.key === 'Адресат');
      expect(addresseePending).toBeDefined();
      expect(addresseePending.question).toBe('Кому адресована записка? Укажите должность и ФИО.');
      expect(addresseePending.example).toBe('Начальнику отдела кадров Петровой А. С.');
    });
  });

  describe('optional field empty', () => {
    it('placeholder, not pending', () => {
      const docType = {
        id: 'test',
        fields: [
          { key: 'optional', label: 'Опциональное', kind: 'extract', required: false },
        ],
      };
      const result = mergeRequisites({
        docType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.pending.find((p) => p.key === 'optional')).toBeUndefined();
      expect(result.placeholders).toContain('Опциональное');
    });
  });

  // ── Pending order ────────────────────────────────────────────────────────

  describe('pending order', () => {
    it('preserves order from docType.fields', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      // date is auto-filled, number is registry → pending should be: Адресат, Должность автора, ФИО автора, Тема
      const keys = result.pending.map((p) => p.key);
      expect(keys).toEqual(['Адресат', 'Должность автора', 'ФИО автора', 'Тема']);
    });
  });

  // ── Template fields ──────────────────────────────────────────────────────

  describe('template fields', () => {
    it('organization name/address/phone from template', () => {
      const result = mergeRequisites({
        docType: templateWithOrgFields,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values.name.value).toBe('');
      expect(result.values.name.source).toBe('template');
      expect(result.values.address.value).toBe('г. Москва, ул. Примерная, д. 1');
      expect(result.values.phone.value).toBe('+7 (000) 000-00-00');
    });
  });

  // ── Title ────────────────────────────────────────────────────────────────

  describe('title', () => {
    it('from AI if available and no user title', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: 'О закупке оборудования',
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values['Тема'].value).toBe('О закупке оборудования');
      expect(result.values['Тема'].source).toBe('ai');
    });

    it('from userFields.title when provided', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: 'О чем-то другом',
        userFields: { 'Тема': 'Мой заголовок' },
        today: '2026-09-11',
      });
      expect(result.values['Тема'].value).toBe('Мой заголовок');
      expect(result.values['Тема'].source).toBe('user');
    });

    it('null when neither AI nor user provide title', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values['Тема'].value).toBeNull();
    });
  });

  // ── Multiple pending ─────────────────────────────────────────────────────

  describe('multiple pending', () => {
    it('all required empty fields appear in correct order', () => {
      const docType = {
        id: 'multi',
        fields: [
          { key: 'a', label: 'A', kind: 'extract', required: true, question: 'Q1?', example: 'E1' },
          { key: 'b', label: 'B', kind: 'extract', required: true, question: 'Q2?', example: 'E2' },
          { key: 'c', label: 'C', kind: 'extract', required: true, question: 'Q3?', example: 'E3' },
        ],
      };
      const result = mergeRequisites({
        docType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.pending).toHaveLength(3);
      expect(result.pending.map((p) => p.key)).toEqual(['a', 'b', 'c']);
    });
  });

  // ── All fields filled ────────────────────────────────────────────────────

  describe('all fields filled', () => {
    it('empty pending array', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {
          'Адресат': { value: 'Петровой А. С.', quote: 'для Петровой' },
          'Должность автора': { value: 'Инженер', quote: 'инженер' },
          'ФИО автора': { value: 'Сидоров П. П.', quote: 'Сидоров' },
        },
        title: 'О закупке',
        userFields: {},
        today: '2026-09-11',
      });
      // date is auto-filled, number is registry → no pending
      expect(result.pending).toEqual([]);
    });
  });

  // ── Edge case ────────────────────────────────────────────────────────────

  describe('edge case', () => {
    it('empty userFields object', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      // Should not throw, should produce valid structure
      expect(result.values).toBeDefined();
      expect(result.pending).toBeInstanceOf(Array);
      expect(result.placeholders).toBeInstanceOf(Array);
      // date auto-filled, number registry → 4 pending (Адресат, Должность автора, ФИО автора, Тема)
      expect(result.pending).toHaveLength(4);
      expect(result.placeholders).toContain('Номер');
    });

    it('undefined aiFields', () => {
      const result = mergeRequisites({
        docType: memoDocType,
        template: classicTemplate,
        aiFields: undefined,
        title: null,
        userFields: {},
        today: '2026-09-11',
      });
      expect(result.values).toBeDefined();
      expect(result.pending).toHaveLength(4);
    });

    it('user provided value for optional field', () => {
      const docType = {
        id: 'test',
        fields: [
          { key: 'opt', label: 'Опциональное', kind: 'extract', required: false },
        ],
      };
      const result = mergeRequisites({
        docType,
        template: classicTemplate,
        aiFields: {},
        title: null,
        userFields: { opt: 'значение' },
        today: '2026-09-11',
      });
      expect(result.values.opt.value).toBe('значение');
      expect(result.values.opt.source).toBe('user');
      expect(result.placeholders).not.toContain('Опциональное');
    });
  });
});
