export function createPeerQueue({ intervalMs = 600, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const tails = new Map();
  return { enqueue(peerId, task) { const key = String(peerId); const previous = tails.get(key) ?? Promise.resolve(); const next = previous.catch(() => {}).then(async () => { const result = await task(); await sleep(intervalMs); return result; }); const chained = next.finally(() => { if (tails.get(key) === chained) tails.delete(key); }); tails.set(key, chained); return next; } };
}
