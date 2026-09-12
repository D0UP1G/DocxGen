import { spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AiUnavailableError } from '../../core/errors.js';

/**
 * Провайдер ИИ через официальный CLI OpenCode: `opencode run --format json` с промптом в stdin.
 * Модель и запрет инструментов задаются агентом doc-editor в каталоге opencode/ (см. README).
 *
 * runtime:
 *   local  — `opencode` из PATH (установка: npm i -g opencode-ai), рабочий каталог — opencode/ с конфигом агента;
 *   docker / podman — образ с CLI и конфигом агента (npm run opencode:build).
 */

/** Сообщения чата → один текстовый запрос: CLI принимает промпт целиком. Повтор после ошибки схемы идёт тем же текстом. */
export function toPrompt(messages) {
  return messages.map(({ role, content }) => {
    if (role === 'system') return `[Системный промпт]\n${content}`;
    if (role === 'assistant') return `[Предыдущий ответ модели]\n${content}`;
    return content;
  }).join('\n\n');
}

/** Собирает текст ответа модели из потока JSON-событий CLI; строки логов, не являющиеся JSON, пропускаются. */
export function parseOpencodeOutput(stdout) {
  let text = '';
  let error = null;
  for (const line of String(stdout).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'text' && event.part?.text) text += event.part.text;
    if (event.type === 'error') error = event.error?.data?.message ?? event.error?.message ?? event.message ?? JSON.stringify(event.error ?? event);
  }
  return { text, error };
}

/**
 * На Windows npm ставит обёртку opencode.cmd, которую Node запускает только через cmd.exe (с ограничением длины
 * командной строки и небезопасной склейкой аргументов). Поэтому ищем настоящий opencode.exe рядом с обёрткой.
 */
export function resolveOpencodeBin(bin, { platform = process.platform, env = process.env, exists = fs.existsSync } = {}) {
  if (platform !== 'win32' || bin !== 'opencode') return bin;
  // path.win32: пути с учётом Windows-семантики, даже когда код выполняется не на Windows (например, в тестах).
  const dirs = [env.APPDATA && path.win32.join(env.APPDATA, 'npm'), ...String(env.PATH ?? env.Path ?? '').split(path.win32.delimiter)].filter(Boolean);
  for (const dir of dirs) {
    const exe = path.win32.join(dir, 'node_modules', 'opencode-ai', 'bin', 'opencode.exe');
    if (exists(exe)) return exe;
    if (exists(path.win32.join(dir, 'opencode.exe'))) return path.win32.join(dir, 'opencode.exe');
  }
  return bin;
}

export function buildOpencodeCommand({ runtime = 'local', bin = 'opencode', image = 'doc3steps-opencode', model = '', agent = 'doc-editor', configDir }) {
  const runArgs = ['run', '--format', 'json', '--agent', agent, ...(model ? ['--model', model] : [])];
  if (runtime === 'local') {
    // CLI определяет каталог сессии по переменной PWD, а не по фактическому cwd процесса. Без PWD сессия создаётся
    // в каталоге родителя, агент doc-editor не находится, и CLI отвечает «Unexpected server error».
    return { file: resolveOpencodeBin(bin), args: runArgs, options: { cwd: configDir, env: { ...process.env, PWD: configDir } } };
  }
  return { file: runtime, args: ['run', '--rm', '-i', image, 'opencode', ...runArgs], options: {} };
}

/** Не более limit одновременных задач; остальные ждут своей очереди. */
export function createLimiter(limit = 1) {
  let active = 0;
  const waiting = [];
  const next = () => { if (active < limit && waiting.length) { active += 1; waiting.shift()(); } };
  return (task) => new Promise((resolve, reject) => {
    waiting.push(() => Promise.resolve().then(task).then(resolve, reject).finally(() => { active -= 1; next(); }));
    next();
  });
}

export function createOpencodeProvider({ timeoutMs = 180000, maxParallel = 1, spawnImpl = nodeSpawn, ...commandOptions } = {}) {
  const command = buildOpencodeCommand(commandOptions);
  // Бесплатные модели OpenCode Zen не держат параллельные запросы с одного адреса: второй одновременный вызов
  // зависает до таймаута. Поэтому вызовы идут по очереди; таймаут отсчитывается с запуска процесса, а не с постановки в очередь.
  const limit = createLimiter(maxParallel);
  return {
    name: `opencode:${commandOptions.runtime ?? 'local'}${commandOptions.model ? `:${commandOptions.model}` : ''}`,
    complete(messages) {
      return limit(() => run(messages));
    },
  };

  /** Один запуск CLI: промпт в stdin, ответ — текстовые события из stdout. */
  function run(messages) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timer;
      const finish = (err, value) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (err) reject(new AiUnavailableError(err)); else resolve(value);
      };
      let child;
      try {
        child = spawnImpl(command.file, command.args, { ...command.options, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        finish(`OpenCode не запустился: ${err.message}`);
        return;
      }
      timer = setTimeout(() => { child.kill(); finish(`OpenCode не ответил за ${timeoutMs} мс`); }, timeoutMs);
      // Кодировка на потоке, а не на кусках: иначе кириллица, разрезанная между кусками, испортится.
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', (err) => finish(`OpenCode не запустился (${command.file}): ${err.message}`));
      child.on('close', (code) => {
        const { text, error } = parseOpencodeOutput(stdout);
        if (code !== 0 || error || !text.trim()) finish(`OpenCode: ${error ?? (code !== 0 ? `код выхода ${code}` : 'пустой ответ')}. ${stderr.trim().slice(-300)}`.trim());
        else finish(null, text);
      });
      child.stdin.on('error', () => {}); // процесс мог завершиться раньше, чем принял промпт; ошибку сообщит close
      child.stdin.end(toPrompt(messages));
    });
  }
}
