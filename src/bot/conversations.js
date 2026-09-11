/**
 * Conversation state store — in-memory Map keyed by "platform:peerId".
 *
 * Why in-memory: single-process architecture. Conversations are ephemeral
 * (user session lifetime). If the process restarts, conversations reset to
 * idle — the user simply restarts the flow. No persistence needed.
 *
 * Why a factory: keeps the store testable — each test gets its own instance
 * with no shared state.
 *
 * @returns {{ get: function, set: function, delete: function, findByDocumentId: function }}
 */
export function createConversationStore() {
  const store = new Map();
  // Reverse index: documentId → key (for notifier to find conversation by document)
  const docIndex = new Map();

  return {
    /**
     * Get conversation for a platform:peerId pair.
     * @param {string} platform
     * @param {string} peerId
     * @returns {object|null}
     */
    get(platform, peerId) {
      return store.get(`${platform}:${peerId}`) || null;
    },

    /**
     * Set (create or update) a conversation.
     * Also indexes by documentId if present.
     * @param {string} platform
     * @param {string} peerId
     * @param {object} conversation
     */
    set(platform, peerId, conversation) {
      const key = `${platform}:${peerId}`;
      store.set(key, conversation);
      // Update reverse index
      if (conversation.documentId) {
        docIndex.set(conversation.documentId, key);
      }
    },

    /**
     * Delete a conversation.
     * @param {string} platform
     * @param {string} peerId
     */
    delete(platform, peerId) {
      const key = `${platform}:${peerId}`;
      const conv = store.get(key);
      if (conv?.documentId) {
        docIndex.delete(conv.documentId);
      }
      store.delete(key);
    },

    /**
     * Find conversation by documentId (used by notifier).
     * @param {string} documentId
     * @returns {object|null}
     */
    findByDocumentId(documentId) {
      const key = docIndex.get(documentId);
      return key ? store.get(key) || null : null;
    },
  };
}
