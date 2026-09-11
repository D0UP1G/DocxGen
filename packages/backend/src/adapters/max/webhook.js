import crypto from 'node:crypto';
import express from 'express';
import { toInboundEvents } from './normalize.js';

export function createMaxWebhookRouter({ secret, dispatcher, adapter, log = console }) {
  const router = express.Router(); const expected = Buffer.from(secret ?? '');
  router.post('/integrations/max/webhook', (req, res) => { const got = Buffer.from(req.get('X-Max-Bot-Api-Secret') ?? ''); if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) { log.warn?.('max webhook: bad secret'); return res.sendStatus(401); } const accepted = toInboundEvents(req.body).map((event) => dispatcher.accept(event, req.body)); res.sendStatus(200); for (const event of accepted.filter(Boolean)) setImmediate(() => void dispatcher.run(event, adapter)); });
  return router;
}
