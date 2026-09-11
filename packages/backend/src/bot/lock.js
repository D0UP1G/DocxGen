/**
 * Per-conversation sequential lock — chain of promises.
 *
 * Why: a user might send multiple messages rapidly (e.g., paste text, then
 * immediately click "Continue"). Without locking, these could race and corrupt
 * conversation state. The lock ensures only one event is processed per
 * conversation at a time.
 *
 * Why promises (not mutex): Node.js is single-threaded but async. A user's
 * second message arrives while the first is being processed (awaiting DB or AI).
 * Promise chaining serializes async work naturally — no OS-level mutex needed.
 *
 * Cleanup: resolved promise references are removed from the map to prevent
 * memory leaks for idle conversations.
 */

/**
 * Create a lock manager.
 * @returns {{ acquire: (key: string) => Promise<function> }}
 */
export function createLockManager() {
  const locks = new Map();

  return {
    /**
     * Acquire lock for a key. Returns a release function.
     * All calls with the same key are sequential.
     * @param {string} key - e.g. "max:12345"
     * @returns {Promise<function>} release function
     */
    async acquire(key) {
      let release;
      const previous = locks.get(key) || Promise.resolve();

      const current = new Promise(resolve => { release = resolve; });
      locks.set(key, current);

      await previous;

      // Cleanup: remove resolved reference to prevent memory leak
      const cleanup = () => {
        if (locks.get(key) === current) {
          locks.delete(key);
        }
      };

      return () => {
        release();
        // Schedule cleanup after microtask to allow next waiter to set new entry
        Promise.resolve().then(cleanup);
      };
    },
  };
}
