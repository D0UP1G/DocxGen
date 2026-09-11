import { describe, expect, it } from 'vitest';
import { createMaxClient, MaxApiError } from '../../src/adapters/max/client.js';

describe('MAX client', () => {
  it('uses the Authorization header and query parameters', async () => { const seen = []; const client = createMaxClient({ baseUrl: 'https://max.test', token: 'secret', fetchImpl: async (url, options) => { seen.push({ url: String(url), options }); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }); } }); await client.sendMessage('123', { text: 'hi' }); expect(seen[0].options.headers.Authorization).toBe('secret'); expect(seen[0].url).toContain('chat_id=123'); });
  it('keeps the long-poll request open longer than the server-side wait', async () => {
    let signal;
    const client = createMaxClient({ baseUrl: 'https://max.test', token: 't', timeoutMs: 50, fetchImpl: async (url, options) => { signal = options.signal; await new Promise((resolve) => setTimeout(resolve, 120)); return new Response('{"updates":[],"marker":1}', { status: 200 }); } });
    await expect(client.getUpdates({ timeout: 1 })).resolves.toMatchObject({ marker: 1 });
    expect(signal.aborted).toBe(false);
  });
  it('maps API errors', async () => { const client = createMaxClient({ baseUrl: 'https://max.test', token: 'secret', fetchImpl: async () => new Response(JSON.stringify({ code: 'bad.token', message: 'no' }), { status: 400 }) }); await expect(client.me()).rejects.toMatchObject({ code: 'bad.token', status: 400 }); expect(MaxApiError).toBeDefined(); });
});
