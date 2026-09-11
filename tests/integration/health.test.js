import { describe, it, expect } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import { createApp } from '../../src/app.js';

// Silent pino logger — suppresses output during tests
const silentLog = pino({ level: 'silent' });

describe('GET /health', () => {
  it('returns 200 with ok, ai, and templates count', async () => {
    const app = createApp({ log: silentLog });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ai).toHaveProperty('provider');
    expect(res.body.ai).toHaveProperty('reachable');
    expect(typeof res.body.templates).toBe('number');
  });
});
