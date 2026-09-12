import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DomainError } from '../core/errors.js';

/** Convert any ffmpeg-supported input to the exact stream Vosk expects. */
export function decodeAudio(input, { ffmpeg = 'ffmpeg', maxBytes = 25 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > maxBytes) {
    throw DomainError.AUDIO_INVALID('Аудиофайл пустой или слишком большой');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1']);
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => reject(DomainError.STT_FAILED(`Не удалось запустить ffmpeg: ${error.message}`)));
    child.once('close', (code) => code === 0 && chunks.length
      ? resolve(Buffer.concat(chunks))
      : reject(DomainError.AUDIO_INVALID(stderr.trim() || 'Не удалось прочитать аудиофайл')));
    child.stdin.end(input);
  });
}

/** Vosk runs in an isolated Python environment; Node 24 cannot build ffi-napi. */
export async function createVoskTranscriber({ modelPath, ffmpeg, maxBytes, python = 'python3' } = {}) {
  if (!fs.existsSync(modelPath)) throw DomainError.STT_FAILED(`Модель Vosk не найдена: ${modelPath}. Скачайте vosk-model-small-ru-0.22 и распакуйте её в этот каталог.`);
  const sidecar = spawn(python, [path.join(import.meta.dirname, 'transcriber.py')], { env: { ...process.env, VOSK_MODEL_PATH: modelPath } });
  let startupError = '';
  sidecar.stderr.on('data', (chunk) => { startupError += chunk.toString(); });
  const pending = [];
  let buffer = '';
  sidecar.stdout.setEncoding('utf8');
  sidecar.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      const request = pending.shift();
      if (!request) continue;
      try { const result = JSON.parse(line); result.error ? request.reject(DomainError.STT_FAILED(result.error)) : request.resolve(result); }
      catch { request.reject(DomainError.STT_FAILED('Vosk вернул некорректный ответ')); }
    }
  });
  sidecar.once('error', (error) => { while (pending.length) pending.shift().reject(DomainError.STT_FAILED(`Не удалось запустить Vosk: ${error.message}`)); });
  sidecar.once('exit', (code) => { while (pending.length) pending.shift().reject(DomainError.STT_FAILED(startupError || `Vosk завершился с кодом ${code}`)); });
  return {
    async transcribe(input) {
      const pcm = await decodeAudio(input, { ffmpeg, maxBytes });
      const result = await new Promise((resolve, reject) => { pending.push({ resolve, reject }); sidecar.stdin.write(`${JSON.stringify({ pcm: pcm.toString('hex') })}\n`); });
      const text = String(result.text ?? '').trim();
      if (!text) throw DomainError.STT_FAILED('Речь не распознана');
      return { text, duration: Number((pcm.length / 32000).toFixed(2)) };
    },
    close() { sidecar.kill(); },
  };
}
