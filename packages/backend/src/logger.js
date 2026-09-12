/**
 * Логирование: два приёмника из одного pino-инстанса.
 *
 *   stdout — человекочитаемый цветной вывод (свой форматтер, без pino-pretty:
 *            транспорт pino поднимает worker-поток, из-за которого vitest не завершается)
 *   файл   — тот же поток в JSON-строках, DATA_DIR/logs/app.log, чтобы ничего не терялось
 *            после закрытия терминала и можно было грепать
 *
 * Уровень задаётся LOG_LEVEL (fatal|error|warn|info|debug|trace). Для разбора сценариев
 * ставьте debug: тогда видны входящие события ботов, переходы состояний диалога,
 * жизненный цикл задач очереди и тайминги вызовов ИИ.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import pino from 'pino';
import { env } from './config/env.js';

const IS_TEST = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

// ── Человекочитаемый вывод ───────────────────────────────────────────────────

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (COLOR ? `\u001b[${code}m${text}\u001b[0m` : text);
const dim = (text) => paint('2', text);

const LEVELS = {
  10: paint('90', 'TRACE'),
  20: paint('36', 'DEBUG'),
  30: paint('32', 'INFO '),
  40: paint('33', 'WARN '),
  50: paint('31', 'ERROR'),
  60: paint('41;97', 'FATAL'),
};

/** Служебные поля pino и pino-http, которые не несут смысла в консоли. */
const SKIP = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'err', 'v']);

const clock = (ms) => new Date(ms).toISOString().slice(11, 23);

/** Значение в одну строку: длинные тексты черновиков обрезаются, объекты — компактный JSON. */
function short(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 300 ? `${json.slice(0, 300)}…` : json;
  }
  return String(value);
}

function formatLine(line) {
  let rec;
  try { rec = JSON.parse(line); } catch { return line; }

  const parts = [dim(clock(rec.time)), LEVELS[rec.level] ?? String(rec.level)];

  // pino-http кладёт запрос/ответ в req/res — отдельной строкой, иначе шум перекрывает всё остальное
  if (rec.req) {
    parts.push(paint('35', `${rec.req.method} ${rec.req.url}`));
    if (rec.res) parts.push(dim(`→ ${rec.res.statusCode} ${Math.round(rec.responseTime ?? 0)}ms`));
  }

  if (rec.msg) parts.push(rec.msg);

  const fields = Object.entries(rec)
    .filter(([key]) => !SKIP.has(key) && key !== 'req' && key !== 'res' && key !== 'responseTime')
    .map(([key, value]) => `${dim(key + '=')}${short(value)}`);
  if (fields.length) parts.push(fields.join(' '));

  let out = parts.join(' ');
  if (rec.err) {
    out += `\n${paint('31', rec.err.stack ?? `${rec.err.type}: ${rec.err.message}`)}`;
  }
  return out;
}

const prettyStdout = new Writable({
  write(chunk, _enc, cb) {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) process.stdout.write(`${formatLine(line)}\n`);
    }
    cb();
  },
});

// ── Файловый приёмник ────────────────────────────────────────────────────────

function fileStream() {
  const dir = path.resolve(env.DATA_DIR, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return pino.destination({ dest: path.join(dir, 'app.log'), append: true, sync: false });
}

// ── Инстанс ──────────────────────────────────────────────────────────────────

const options = {
  level: env.LOG_LEVEL,
  // Токены ботов и ключ ИИ не должны попасть ни в консоль, ни в файл лога
  redact: {
    paths: ['token', '*.token', 'headers.authorization', 'req.headers.cookie', 'req.headers.authorization'],
    censor: '[скрыто]',
  },
};

export const log = IS_TEST
  ? pino({ ...options, level: process.env.LOG_LEVEL ?? 'silent' })
  : pino(options, pino.multistream([
      { level: env.LOG_LEVEL, stream: prettyStdout },
      { level: env.LOG_LEVEL, stream: fileStream() },
    ], { dedupe: false }));

/** Путь к файлу лога — сервер печатает его при старте. */
export const logFilePath = path.resolve(env.DATA_DIR, 'logs', 'app.log');
