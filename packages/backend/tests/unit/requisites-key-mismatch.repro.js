/**
 * REPRO TEST: Missing requisites bug — key mismatch between template.requiredFields and docType.fields
 *
 * ROOT CAUSE HYPOTHESIS:
 *   template.requiredFields (classic.json) uses keys: 'Автор', 'Должность', 'Подпись'
 *   docType.fields (memo.json) uses keys: 'ФИО автора', 'Должность автора'
 *   mergeRequisites() creates BOTH sets in values{}, but blocks.js only reads docType keys.
 *
 *   When userFields arrive with docType keys → values populated correctly, dead entries created.
 *   When userFields arrive with template keys → values stored under template keys, blocks.js reads docType keys → SILENT LOSS.
 *
 * Run: node --experimental-vm-modules packages/backend/tests/unit/requisites-key-mismatch.repro.js
 */

import { mergeRequisites } from '../../src/validation/requisites.js';

// ── Fixtures (minimal config from actual JSON files) ──────────────────────

const memoDocType = {
  id: 'memo',
  name: 'Служебная записка',
  docTitle: 'СЛУЖЕБНАЯ ЗАПИСКА',
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
  organization: { name: 'ООО Ромашка', address: 'г. Москва', phone: '+7 000' },
  autoFill: { date: true },
  dateFormat: 'D MMMM YYYY г.',
  // THIS IS THE MISMATCH: these keys differ from docType.fields keys
  requiredFields: ['Организация', 'Адресат', 'Дата', 'Номер', 'Автор', 'Должность', 'Подпись'],
};

const today = '2026-09-12';

// ── Test helpers ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${message}`);
  }
}

function assertMissing(message) {
  failed++;
  console.log(`  ❌ FAIL (missing): ${message}`);
}

// ── TEST 1: userFields with docType keys → values populated correctly ────

console.log('\n🧪 TEST 1: userFields with docType keys (Адресат, Должность автора, ФИО автора)');
console.log('   Expected: values populated correctly, dead entries from template created');

const result1 = mergeRequisites({
  docType: memoDocType,
  template: classicTemplate,
  aiFields: {},
  title: null,
  userFields: {
    'Адресат': 'Начальнику отдела кадров Петровой А. С.',
    'Должность автора': 'Ведущий специалист отдела закупок',
    'ФИО автора': 'Сидоров П. П.',
    'Тема': 'О закупке оборудования',
  },
  today,
});

// What blocks.js signature() reads:
const posKey = 'Должность автора';
const nameKey = 'ФИО автора';
const addrKey = 'Адресат';

assert(result1.values[posKey]?.value === 'Ведущий специалист отдела закупок',
  `values['Должность автора'] = "${result1.values[posKey]?.value}" (expected user value)`);

assert(result1.values[nameKey]?.value === 'Сидоров П. П.',
  `values['ФИО автора'] = "${result1.values[nameKey]?.value}" (expected user value)`);

assert(result1.values[addrKey]?.value === 'Начальнику отдела кадров Петровой А. С.',
  `values['Адресат'] = "${result1.values[addrKey]?.value}" (expected user value)`);

// Dead entries from template.requiredFields that aren't in docType.fields
assert(result1.values['Автор'] !== undefined,
  `values['Автор'] exists (dead entry from template)`);

assert(result1.values['Должность'] !== undefined,
  `values['Должность'] exists (dead entry from template)`);

assert(result1.values['Подпись'] !== undefined,
  `values['Подпись'] exists (dead entry from template)`);

// Dead entries should have null values (userFields didn't have these keys)
assert(result1.values['Автор']?.value === null,
  `values['Автор'].value = null (dead entry, never populated)`);

assert(result1.values['Должность']?.value === null,
  `values['Должность'].value = null (dead entry, never populated)`);

console.log(`\n   📊 Summary: ${Object.keys(result1.values).length} entries in values, 3 dead entries from template`);


// ── TEST 2: userFields with template keys → SILENT LOSS ─────────────────

console.log('\n🧪 TEST 2: userFields with template keys (Автор, Должность, Адресат)');
console.log('   Expected: values stored under template keys, blocks.js reads docType keys → SILENT LOSS');

const result2 = mergeRequisites({
  docType: memoDocType,
  template: classicTemplate,
  aiFields: {},
  title: null,
  userFields: {
    'Адресат': 'Начальнику отдела кадров Петровой А. С.',
    'Должность': 'Ведущий специалист отдела закупок',  // template key, NOT docType key
    'Автор': 'Сидоров П. П.',                           // template key, NOT docType key
    'Тема': 'О закупке оборудования',
  },
  today,
});

// What blocks.js signature() actually reads:
assert(result2.values[posKey]?.value === null || result2.values[posKey]?.value === undefined || result2.values[posKey]?.value === '',
  `values['Должность автора'].value = "${result2.values[posKey]?.value}" (expected NULL — template key used, docType key NOT populated)`);

assert(result2.values[nameKey]?.value === null || result2.values[nameKey]?.value === undefined || result2.values[nameKey]?.value === '',
  `values['ФИО автора'].value = "${result2.values[nameKey]?.value}" (expected NULL — template key used, docType key NOT populated)`);

// The template-keyed entries ARE populated:
assert(result2.values['Автор']?.value === 'Сидоров П. П.',
  `values['Автор'].value = "Сидоров П. П." (populated under template key — DEAD for blocks.js)`);

assert(result2.values['Должность']?.value === 'Ведущий специалист отдела закупок',
  `values['Должность'].value = "Ведущий специалист отдела закупок" (populated under template key — DEAD for blocks.js)`);

// What this means for the rendered document:
console.log('\n   ⚠️  DOCUMENT IMPACT:');
console.log('   blocks.js signature() reads values[\'Должность автора\'] and values[\'ФИО автора\']');
console.log('   → Both are NULL because user sent data under template keys (\'Должность\', \'Автор\')');
console.log('   → Document renders placeholder [Должность автора] and [ФИО автора] instead of user values');
console.log('   → User-entered requisites are SILENTLY LOST from the output document');


// ── TEST 3: Verify the key mismatch exists between configs ──────────────

console.log('\n🧪 TEST 3: Key mismatch verification between template.requiredFields and docType.fields');

const templateOnlyKeys = classicTemplate.requiredFields.filter(
  k => !memoDocType.fields.some(f => f.key === k)
);
const docTypeOnlyKeys = memoDocType.fields
  .map(f => f.key)
  .filter(k => !classicTemplate.requiredFields.includes(k));

assert(templateOnlyKeys.length > 0,
  `Template has keys NOT in docType: [${templateOnlyKeys.join(', ')}]`);

assert(docTypeOnlyKeys.length > 0,
  `DocType has keys NOT in template: [${docTypeOnlyKeys.join(', ')}]`);

console.log(`\n   📊 Mismatch details:`);
console.log(`   Template-only keys (dead for blocks.js): ${templateOnlyKeys.join(', ')}`);
console.log(`   DocType-only keys (NOT in template.requiredFields): ${docTypeOnlyKeys.join(', ')}`);


// ── TEST 4: What blocks.js signature() actually reads ───────────────────

console.log('\n🧪 TEST 4: blocks.js signature() reads docType keys, not template keys');

// From blocks.js lines 237-238:
const blocksJsPosKey = 'Должность автора';  // isLetter ? 'Должность подписывающего' : 'Должность автора'
const blocksJsNameKey = 'ФИО автора';       // isLetter ? 'ФИО подписывающего' : 'ФИО автора'

assert(!classicTemplate.requiredFields.includes(blocksJsPosKey),
  `blocks.js reads '${blocksJsPosKey}' — NOT in template.requiredFields`);

assert(!classicTemplate.requiredFields.includes(blocksJsNameKey),
  `blocks.js reads '${blocksJsNameKey}' — NOT in template.requiredFields`);

assert(memoDocType.fields.some(f => f.key === blocksJsPosKey),
  `'${blocksJsPosKey}' IS in docType.fields`);

assert(memoDocType.fields.some(f => f.key === blocksJsNameKey),
  `'${blocksJsNameKey}' IS in docType.fields`);

console.log(`\n   📊 Root cause confirmed:`);
console.log(`   template.requiredFields: ${classicTemplate.requiredFields.join(', ')}`);
console.log(`   blocks.js reads: ${blocksJsPosKey}, ${blocksJsNameKey}`);
console.log(`   → blocks.js keys are NOT in template.requiredFields`);
console.log(`   → If userFields use template keys, mergeRequisites populates the WRONG keys`);


// ── FINAL VERDICT ──────────────────────────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ ROOT CAUSE PROVEN: Key mismatch between template.requiredFields and docType.fields');
  console.log('   causes silent loss of user-entered requisites when userFields use template keys.');
  console.log('   blocks.js reads docType keys (Должность автора, ФИО автора) but mergeRequisites');
  console.log('   stores values under the keys present in userFields — which may be template keys');
  console.log('   (Автор, Должность) that blocks.js never reads.');
} else {
  console.log('❌ SOME TESTS FAILED — hypothesis may need revision');
}

process.exit(failed > 0 ? 1 : 0);
