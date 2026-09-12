/**
 * Bots end-to-end — the wired runtime driven through the local stand (/dev/chat).
 *
 * The stand speaks to the very same dispatcher, flow, document service and DOCX generator
 * as the MAX and VK adapters, so this test covers the bot path without any platform tokens.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/runtime.js';

// Логи теста молчат по умолчанию; TEST_LOG_LEVEL=debug включает их для разбора падения
const silentLog = pino({ level: process.env.TEST_LOG_LEVEL ?? 'silent' });

// Весь backend поднимается прямо здесь с временной базой: тест не зависит
// от запущенного снаружи процесса и от ключей из .env.
const API_KEY = 'bots-test-api-key';

const testEnv = (dataDir) => ({
  PORT: 0, DATA_DIR: dataDir, LOCAL_CHAT: true, DEBUG_COMMANDS: true,
  AI_PROVIDER: 'mock', AI_FAULT: 'off', AI_TIMEOUT_MS: 5000,
  MAX_ENABLED: false, VK_ENABLED: false,
  CLEANUP_ENABLED: false, CLEANUP_FILE_MAX_AGE_HOURS: 24, CLEANUP_LOG_MAX_AGE_DAYS: 30,
  API_KEY, DOCUMENT_POLL_INTERVAL_MS: 100,
});

let runtime;
let dataDir;

afterEach(async () => {
  if (runtime) await runtime.close();
  runtime = null;
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Starts both runtimes and returns helpers that talk to the stand like a browser would. */
async function startBot() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bots-test-'));

  const config = testEnv(dataDir);
  runtime = createRuntime(config, { log: silentLog });
  const app = runtime.app;
  const peer = 'tester';

  const state = async () => (await request(app).get(`/dev/chat/api/messages?peer=${peer}`)).body;
  const messages = async () => (await state()).messages;
  const send = (text) => request(app).post('/dev/chat/api/send').send({ peer, text, name: 'Иван Христофоров' }).expect(200);
  const press = async (label) => {
    // Template buttons carry a description after the name, so a prefix match is enough.
    const button = (await messages()).flatMap((m) => (m.buttons ?? []).flat()).reverse().find((b) => b.label.startsWith(label));
    expect(button, `кнопка «${label}»`).toBeDefined();
    await request(app).post('/dev/chat/api/press').send({ peer, action: button.action, label }).expect(200);
  };
  const waitFor = async (predicate, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const snapshot = await state();
      if (predicate(snapshot)) return snapshot;
      if (Date.now() > deadline) throw new Error(`не дождались, состояние: ${snapshot.state?.state}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  return { app, peer, state, messages, send, press, waitFor };
}

describe('bots end-to-end (local stand)', () => {
  it('greets by name and walks the draft to a downloadable DOCX', async () => {
    const bot = await startBot();

    await bot.send('/start');
    expect((await bot.messages()).at(-1).text).toContain('Иван Христофоров');

    await bot.press('Создать документ');
    await bot.send('Прошу выделить 5000 руб. на канцтовары до 20.09.2026.');
    await bot.press('Продолжить');
    await bot.press('Служебная записка');
    await bot.press('Классический');

    // The AI runs in a background job; the notifier pushes the next question.
    await bot.waitFor((s) => ['asking_field', 'ready'].includes(s.state.state), 8000);
    if ((await bot.state()).state.state === 'asking_field') {
      await bot.send('Директору Иванову И. И.');
      await bot.press('Пропустить остальные');
    }
    await bot.waitFor((s) => s.state.state === 'ready');

    const file = (await bot.messages()).find((m) => m.file)?.file;
    expect(file, 'сообщение с файлом').toBeDefined();
    const download = await request(bot.app).get(file.url).buffer(true)
      .parse((res, done) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => done(null, Buffer.concat(chunks))); });
    expect(download.status).toBe(200);
    expect(download.body.subarray(0, 2).toString()).toBe('PK'); // ZIP signature of a DOCX

    // The user's answer must reach the document, not stay a placeholder.
    const doc = runtime.db.prepare('SELECT user_fields FROM documents LIMIT 1').get();
    expect(JSON.parse(doc.user_fields)['Адресат']).toBe('Директору Иванову И. И.');
  });

  it('keeps the draft and offers a retry when the AI fails (/ai_fail)', async () => {
    const bot = await startBot();

    await bot.send('Прошу согласовать отпуск с 1 октября.');
    await bot.send('/ai_fail');
    await bot.press('Продолжить');
    await bot.press('Докладная записка');
    await bot.press('Классический');

    await bot.waitFor((s) => s.state.state === 'ai_failed', 8000);
    const failure = (await bot.messages()).at(-1);
    expect(failure.text).toContain('недоступен');
    expect(failure.buttons.flat().map((b) => b.label)).toContain('Повторить');

    const doc = runtime.db.prepare('SELECT source_text, status FROM documents LIMIT 1').get();
    expect(doc.source_text).toBe('Прошу согласовать отпуск с 1 октября.');
    expect(doc.status).toBe('ai_failed');

    await bot.press('Повторить');
    await bot.waitFor((s) => ['asking_field', 'ready'].includes(s.state.state), 8000);
  });

  it('offers «Отправить ещё раз» without reprocessing when the file cannot be sent', async () => {
    const bot = await startBot();

    await bot.send('Справка о выполнении работ за сентябрь.');
    await bot.press('Продолжить');
    await bot.press('Информационная справка');
    runtime.adapters.get('local').armFileFailure(bot.peer);
    await bot.press('Классический');

    await bot.waitFor((s) => s.state.state === 'asking_field' || s.state.state === 'delivery_failed', 8000);
    if ((await bot.state()).state.state === 'asking_field') await bot.press('Пропустить остальные');
    await bot.waitFor((s) => s.state.state === 'delivery_failed');

    const before = runtime.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind = 'process'").get().n;
    await bot.press('Отправить ещё раз');
    await bot.waitFor((s) => s.state.state === 'ready');
    expect((await bot.messages()).at(-1).file).toBeDefined();
    // No new AI job: the same file is sent again.
    expect(runtime.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind = 'process'").get().n).toBe(before);
  });
});
