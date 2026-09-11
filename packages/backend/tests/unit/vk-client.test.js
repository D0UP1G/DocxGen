import { describe, expect, it } from 'vitest';
import { createVkClient } from '../../src/adapters/vk/client.js';

describe('VK client', () => { it('passes numeric peer_id and random_id', async () => { const calls = []; const api = { messages: { send: async (params) => { calls.push(params); return 1; } } }; const client = createVkClient({ api, upload: {} }); await client.sendMessage({ peerId: '42', randomId: 7, message: 'ok' }); expect(calls[0]).toMatchObject({ peer_id: 42, random_id: 7 }); expect(client.isRetryable({ code: 6 })).toBe(true); expect(client.isRetryable({ code: 901 })).toBe(false); }); });
