import { describe, expect, it } from 'vitest';
import { toInboundEvents } from '../../src/adapters/max/normalize.js';
import { toInboundEvent } from '../../src/adapters/vk/normalize.js';

describe('normalizers', () => {
  it('normalizes MAX text and ignores groups', () => { expect(toInboundEvents({ update_type: 'message_created', message: { body: { mid: 'm1', text: 'Привет' }, recipient: { chat_id: 3, chat_type: 'dialog' }, sender: { user_id: 8 } } })[0]).toMatchObject({ platform: 'max', kind: 'text', peerId: '3', text: 'Привет' }); expect(toInboundEvents({ update_type: 'message_created', message: { body: { mid: 'm2', text: 'x' }, recipient: { chat_id: 3, chat_type: 'chat' }, sender: { user_id: 8 } } })).toEqual([]); });
  it('normalizes VK private message and ignores conversations', () => { expect(toInboundEvent({ type: 'message_new', event_id: 'e1', group_id: 1, object: { message: { peer_id: 9, from_id: 8, text: '/start', id: 1 } } })).toMatchObject({ platform: 'vk', kind: 'command', command: 'start' }); expect(toInboundEvent({ type: 'message_new', object: { message: { peer_id: 2000000001, from_id: 8, text: 'x' } } })).toBeNull(); });
});
