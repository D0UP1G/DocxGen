export function createMaxPoller({ client, onEvent, log = console, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let stopped = false; let marker;
  // Пустые циклы не логируем — их десятки в минуту; только старт, батчи с событиями и ошибки.
  async function run() { log.debug?.('MAX: опрос обновлений запущен'); while (!stopped) { try { const result = await client.getUpdates({ marker, timeout: 30, types: ['bot_started', 'message_created', 'message_callback'] }); marker = result.marker ?? marker; const updates = result.updates ?? []; if (updates.length) log.debug?.({ updates: updates.length, marker }, 'MAX: получены обновления'); for (const update of updates) await onEvent(update); } catch (err) { log.error?.({ err }, 'max polling failed'); await sleep(3000); } } }
  return { start: run, stop: () => { stopped = true; } };
}
