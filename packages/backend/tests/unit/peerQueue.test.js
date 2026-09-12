import { describe, it, expect, afterEach } from 'vitest';
import { createPeerQueue } from '../../src/adapters/common/peerQueue.js';

/**
 * Очередь хранит «хвост» цепочки, чтобы сообщения одному собеседнику уходили по очереди.
 * Хвост — отдельный промис, производный от возвращаемого вызывающему коду: если у него нет
 * обработчика отказа, падение отправки (таймаут API MAX) валит весь процесс Node.
 */
function trackUnhandled() {
  const seen = [];
  const listener = (err) => seen.push(err);
  process.on('unhandledRejection', listener);
  return { seen, stop: () => process.off('unhandledRejection', listener) };
}

describe('peerQueue', () => {
  it('не оставляет необработанный rejection, когда задача падает', async () => {
    const tracker = trackUnhandled();
    try {
      const queue = createPeerQueue({ intervalMs: 0 });
      await expect(queue.enqueue('u1', async () => { throw new Error('timeout'); })).rejects.toThrow('timeout');
      // Node сообщает о необработанных отказах в конце микрозадач — даём событийному циклу дойти до этого
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(tracker.seen.map(String)).toEqual([]);
    } finally {
      tracker.stop();
    }
  });

  it('после падения продолжает обслуживать того же собеседника по очереди', async () => {
    const queue = createPeerQueue({ intervalMs: 0 });
    const order = [];
    await expect(queue.enqueue('u1', async () => { order.push('fail'); throw new Error('timeout'); })).rejects.toThrow('timeout');
    await expect(queue.enqueue('u1', async () => { order.push('ok'); return 'ok'; })).resolves.toBe('ok');
    expect(order).toEqual(['fail', 'ok']);
  });
});
