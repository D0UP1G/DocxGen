/**
 * AI fault injection for testing error scenarios.
 *
 * Fault modes:
 * - "always": every call for any owner triggers AiUnavailableError
 * - "once" (per ownerKey): the first call for that owner fails, subsequent calls proceed
 *
 * Usage:
 *   const fm = new AiFaultManager({ AI_FAULT: 'always' });
 *   if (fm.shouldFault(ownerKey)) throw new AiUnavailableError('injected');
 */
export class AiFaultManager {
  constructor(env = {}) {
    this.faultAlways = env.AI_FAULT === 'always';
    this.faultOnceOwners = new Set();
  }

  /**
   * Arm a one-time fault for a specific owner.
   * @param {string} ownerKey - e.g. "max:12345" or "web:sid-abc"
   */
  armOnce(ownerKey) {
    this.faultOnceOwners.add(ownerKey);
  }

  /**
   * Check if a fault should trigger for this owner.
   * If faultAlways is true → always true.
   * If the owner has been armed for once → true (and disarms automatically).
   * @param {string} ownerKey
   * @returns {boolean}
   */
  shouldFault(ownerKey) {
    if (this.faultAlways) return true;
    if (this.faultOnceOwners.has(ownerKey)) {
      this.faultOnceOwners.delete(ownerKey);
      return true;
    }
    return false;
  }
}
