import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateDocx } from '../src/services/docx.service.js';
import { processDraft } from '../src/services/document-generation.service.js';
import { validateRequisites } from '../src/services/validation.service.js';

process.env.DOCXGEN_AI_MODE = 'local';

test('validation follows the starter requisites list', () => {
  const result = validateRequisites({ from: 'Петров П.П.', date: '12.09.2026', subject: 'Отчёт', signature: 'Петров П.П.' }, 'informacionnaya', 'Текст');
  assert.equal(result.isValid, true);

  const memo = validateRequisites({ to: 'Иванов И.И.', from: 'Петров П.П.', date: '12.09.2026', subject: 'Отчёт' }, 'sluzhebnaya', 'Текст');
  assert.deepEqual(memo.missingFields, ['position', 'number', 'signature']);
});

test('local processing extracts facts without inventing a date', async () => {
  const draft = 'Кому: Иванову И.И.\nОт кого: Петров П.П.\nДата: 12.09.2026\nЗаголовок: О выполнении плана\n\nПлан выполнент на 115%.';
  const result = await processDraft(draft, 'sluzhebnaya');
  assert.equal(result.source, 'local');
  assert.equal(result.requisites.date, '12.09.2026');
  assert.match(result.correctedText, /выполнен/);
});

test('DOCX generator creates a zip with editable document XML', () => {
  const types = ['sluzhebnaya', 'dokladnaya', 'informacionnaya', 'pismo'] as const;
  const templates = ['official', 'standard'] as const;

  for (const documentType of types) {
    for (const templateId of templates) {
      const output = generateDocx({
        documentType,
        templateId,
        requisites: {
          to: 'ООО «Ромашка»',
          from: 'ООО «Системы»',
          date: '12.09.2026',
          subject: 'Предложение',
          number: '1-П',
          position: 'Директор',
          signature: 'Белова Б.Б.',
        },
        body: 'Просим рассмотреть предложение о сотрудничестве.',
      });
      assert.equal(output.subarray(0, 2).toString(), 'PK');
      assert.ok(output.length > 1000);
    }
  }
});
