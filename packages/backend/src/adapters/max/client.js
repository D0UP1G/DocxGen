export class MaxApiError extends Error {
  constructor(status, code, message) { super(`MAX ${status} ${code}: ${message}`); this.name = 'MaxApiError'; this.status = status; this.code = code; }
}

export function createMaxClient({ baseUrl, token, timeoutMs = 15000, fetchImpl = globalThis.fetch } = {}) {
  async function call(method, path, { query, body, timeout = timeoutMs } = {}) {
    const url = new URL(path, baseUrl); for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await fetchImpl(url, { method, headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    const data = await response.json().catch(() => ({})); if (!response.ok) throw new MaxApiError(response.status, data.code ?? 'unknown', data.message ?? response.statusText); return data;
  }
  return {
    me: () => call('GET', '/me'), sendMessage: (chatId, body) => call('POST', '/messages', { query: { chat_id: chatId }, body }), answerCallback: (callbackId, body) => call('POST', '/answers', { query: { callback_id: callbackId }, body }),
    // Long polling: сервер держит запрос до timeout секунд, поэтому таймаут HTTP-запроса должен быть больше, иначе каждый пустой опрос обрывается.
    getUpdates: ({ marker, timeout = 30, types } = {}) => call('GET', '/updates', { query: { marker, timeout, types: types?.join(',') }, timeout: (timeout + 15) * 1000 }),
    subscribe: ({ url, secret, updateTypes }) => call('POST', '/subscriptions', { body: { url, secret, update_types: updateTypes } }), listSubscriptions: () => call('GET', '/subscriptions'), unsubscribe: (url) => call('DELETE', '/subscriptions', { query: { url } }),
    async upload(type, buffer, filename, contentType = 'application/octet-stream') {
      const slot = await call('POST', '/uploads', { query: { type } }); const form = new FormData(); form.append('data', new Blob([buffer], { type: contentType }), filename);
      const response = await fetchImpl(slot.url, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) }); if (!response.ok) throw new MaxApiError(response.status, 'upload.failed', await response.text()); const uploaded = await response.json().catch(() => ({})); return { slot, uploaded };
    },
  };
}
