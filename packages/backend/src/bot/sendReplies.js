import { DeliveryError } from '../core/errors.js';

/**
 * Sends dialog replies through the platform adapter.
 *
 * Used by the dispatcher (answers to user events) and by the notifier (background results),
 * so a failed DOCX delivery is handled the same way everywhere: the conversation moves to
 * delivery_failed and the user gets «Отправить ещё раз» — the document is not processed again.
 */
export async function sendReplies({ adapter, flow, conversation, replies, event }) {
  try {
    await adapter.send(conversation.peerId, replies, { event });
  } catch (err) {
    if (!(err instanceof DeliveryError)) throw err;
    await adapter.send(conversation.peerId, flow.onDeliveryFailed(conversation, err.fileId), { event });
  }
}
