// Прогон демо-черновиков через ИИ-провайдер из .env: разобран ли ответ, сохранены ли обязательные факты
// (mustKeep), не добавлено ли лишнего, какие реквизиты извлечены. Результат — demo/eval-report.md.
// Запуск: pnpm --filter @docxgen/backend eval [префикс-случая]
import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { env } from '../src/config/env.js';
import { loadDocTypes } from '../src/catalog/docTypes.js';
import { createAiProvider } from '../src/ai/provider.js';
import { processDraft } from '../src/ai/processDraft.js';
import { compare as compareFacts } from '../src/validation/facts.js';
import { normalize } from '../src/validation/normalize.js';

const log = pino({ level: 'silent' });
const root = path.resolve(import.meta.dirname, '..');
const casesDir = path.join(root, 'demo/cases');
const docTypes = loadDocTypes(path.join(root, 'config/doc-types'), log);
const provider = createAiProvider(env);
const only = process.argv[2];
const files = (await fs.readdir(casesDir)).filter((file) => file.endsWith('.json') && (!only || file.startsWith(only))).sort();
const cell = (value) => String(value).replaceAll('|', '/').replaceAll('\n', ' ');

const rows = [];
for (const file of files) {
  const item = JSON.parse(await fs.readFile(path.join(casesDir, file), 'utf8'));
  const started = Date.now();
  process.stdout.write(`${item.id}… `);
  try {
    const result = await processDraft({ draft: item.draft, docType: docTypes.get(item.docType), userFields: {}, provider, log });
    // Факт может законно уйти из текста в реквизит (адресат, подписант) — учитываем и то и другое.
    const output = normalize([result.title, ...result.body, ...Object.values(result.aiFields ?? {}).map((field) => field?.value)].filter(Boolean).join('\n'));
    const missing = (item.mustKeep ?? []).filter((fact) => {
      const needle = normalize(fact);
      return !output.includes(needle.slice(0, Math.max(4, needle.length - 2)));
    });
    const facts = compareFacts(item.draft, result.body.join('\n'));
    const added = facts.added ?? [];
    rows.push(`| ${item.id} | да | ${missing.length ? `нет: ${cell(missing.join(', '))}` : 'да'} | ${added.length ? `нет: ${cell(added.map((f) => f.raw ?? f.value ?? f).join(', '))}` : 'да'} | ${cell(Object.keys(result.aiFields ?? {}).join(', ') || '—')} | ${Date.now() - started} мс |`);
    console.log('ok');
  } catch (err) {
    rows.push(`| ${item.id} | нет | — | — | — | ошибка: ${cell(err.message)} |`);
    console.log(`ошибка: ${err.message}`);
  }
}

const report = `# Оценка ИИ-обработки\n\nПровайдер: \`${provider.name ?? env.AI_PROVIDER}\`, ${new Date().toISOString().slice(0, 16)}\n\n| Черновик | Ответ разобран | Факты сохранены | Нет лишних фактов | Извлечённые реквизиты | Время |\n|---|---|---|---|---|---:|\n${rows.join('\n')}\n`;
if (!only) await fs.writeFile(path.join(root, 'demo/eval-report.md'), report);
console.log(`\n${report}`);
