import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildOpencodeCommand, createLimiter, createOpencodeProvider, parseOpencodeOutput, resolveOpencodeBin, toPrompt } from '../../src/ai/providers/opencodeCli.js';

/** Поддельный процесс opencode: принимает промпт в stdin, печатает заданные строки и завершается с кодом. */
function fakeSpawn({ lines = [], code = 0, calls = [] } = {}) {
  return (file, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.kill = () => {};
    let prompt = '';
    child.stdin.on('data', (chunk) => { prompt += chunk; });
    child.stdin.on('end', () => {
      calls.push({ file, args, options, prompt });
      // Кириллица разрезана между кусками — провайдер должен собрать её без искажений.
      const out = Buffer.from(lines.join('\n'));
      child.stdout.write(out.subarray(0, 3)); child.stdout.end(out.subarray(3));
      child.stdout.on('end', () => child.emit('close', code));
    });
    return child;
  };
}

describe('OpenCode CLI provider', () => {
  it('sends the whole conversation as one prompt and joins text events', async () => {
    const calls = [];
    const provider = createOpencodeProvider({ runtime: 'local', configDir: '/cfg', spawnImpl: fakeSpawn({ calls, lines: ['INFO starting', JSON.stringify({ type: 'text', part: { text: '{"title":' } }), JSON.stringify({ type: 'text', part: { text: '"О привете"}' } })] }) });
    await expect(provider.complete([{ role: 'system', content: 'Правила' }, { role: 'user', content: 'Черновик' }])).resolves.toBe('{"title":"О привете"}');
    expect(calls[0].args).toEqual(['run', '--format', 'json', '--agent', 'doc-editor']);
    expect(calls[0].options.cwd).toBe('/cfg');
    expect(calls[0].prompt).toBe('Правила\n\nЧерновик');
  });

  it('maps failures to AiUnavailableError so the queue and the user see an AI error', async () => {
    await expect(createOpencodeProvider({ spawnImpl: fakeSpawn({ code: 1 }) }).complete([])).rejects.toMatchObject({ name: 'AiUnavailableError' });
    await expect(createOpencodeProvider({ spawnImpl: fakeSpawn({ lines: [JSON.stringify({ type: 'error', error: { data: { message: 'rate limited' } } })] }) }).complete([])).rejects.toThrow('rate limited');
    await expect(createOpencodeProvider({ spawnImpl: () => { throw new Error('ENOENT'); } }).complete([])).rejects.toMatchObject({ name: 'AiUnavailableError' });
  });

  it('runs the local CLI with PWD of the agent config directory and the real exe on Windows', () => {
    // CLI берёт каталог сессии из PWD; без него агент doc-editor не находится.
    expect(buildOpencodeCommand({ runtime: 'local', bin: '/usr/bin/opencode', configDir: '/cfg' }).options.env.PWD).toBe('/cfg');
    const exe = 'C:\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe';
    expect(resolveOpencodeBin('opencode', { platform: 'win32', env: { APPDATA: 'C:\\', PATH: '' }, exists: (file) => file.replaceAll('/', '\\') === exe })).toBe(exe);
    expect(resolveOpencodeBin('opencode', { platform: 'linux', env: {} })).toBe('opencode');
  });

  it('runs model calls one at a time by default', async () => {
    const limit = createLimiter(1);
    let active = 0; let peak = 0;
    const task = () => new Promise((resolve) => { active += 1; peak = Math.max(peak, active); setTimeout(() => { active -= 1; resolve(); }, 20); });
    await Promise.all([limit(task), limit(task), limit(task)]);
    expect(peak).toBe(1);
    await expect(limit(async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(limit(async () => 'after error')).resolves.toBe('after error');
  });

  it('builds container and model arguments', () => {
    expect(buildOpencodeCommand({ runtime: 'docker', image: 'img', model: 'opencode/big-pickle' })).toMatchObject({ file: 'docker', args: ['run', '--rm', '-i', 'img', 'opencode', 'run', '--format', 'json', '--agent', 'doc-editor', '--model', 'opencode/big-pickle'] });
    expect(toPrompt([{ role: 'assistant', content: 'x' }])).toContain('предыдущий ответ');
    expect(parseOpencodeOutput('not json\n').text).toBe('');
  });
});
