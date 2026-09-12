export function createPeerQueue({ intervalMs = 600, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const tails = new Map();
  // next уходит вызывающему коду — он и обрабатывает отказ. Хвост цепочки (chained) — отдельный
  // промис: без своего catch отказ задачи (например, таймаут API MAX) остаётся необработанным
  // и Node убивает процесс. Отказ здесь гасим — очередь только соблюдает порядок отправки.
  return { enqueue(peerId, task) { const key = String(peerId); const previous = tails.get(key) ?? Promise.resolve(); const next = previous.then(async () => { const result = await task(); await sleep(intervalMs); return result; }); const chained = next.catch(() => {}).finally(() => { if (tails.get(key) === chained) tails.delete(key); }); tails.set(key, chained); return next; } };
}
