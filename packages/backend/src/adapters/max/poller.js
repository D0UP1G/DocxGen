export function createMaxPoller({ client, onEvent, log = console, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let stopped = false; let marker;
  async function run() { while (!stopped) { try { const result = await client.getUpdates({ marker, timeout: 30, types: ['bot_started', 'message_created', 'message_callback'] }); marker = result.marker ?? marker; for (const update of result.updates ?? []) await onEvent(update); } catch (err) { log.error?.({ err }, 'max polling failed'); await sleep(3000); } } }
  return { start: run, stop: () => { stopped = true; } };
}
