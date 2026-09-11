export function createVkLongPoller({ client, groupId, onEvent, log = console, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let stopped = false; let serverInfo;
  async function connect() { serverInfo = await client.api.groups.getLongPollServer({ group_id: Number(groupId) }); }
  async function run() { while (!stopped) { try { if (!serverInfo) await connect(); const url = new URL(serverInfo.server); url.searchParams.set('act', 'a_check'); url.searchParams.set('key', serverInfo.key); url.searchParams.set('ts', serverInfo.ts); url.searchParams.set('wait', '25'); const response = await fetchImpl(url); const data = await response.json(); if (data.failed === 1) serverInfo.ts = data.ts; else if (data.failed === 2 || data.failed === 3) { serverInfo = null; } else { serverInfo.ts = data.ts; for (const update of data.updates ?? []) await onEvent(update); } } catch (err) { log.error?.({ err }, 'vk long poll failed'); serverInfo = null; await sleep(3000); } } }
  return { start: run, stop: () => { stopped = true; } };
}
