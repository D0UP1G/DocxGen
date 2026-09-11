/**
 * Bot button payload codec.
 *
 * Telegram-style inline keyboard buttons carry a JSON payload limited to 64 bytes.
 * We encode action objects as compact JSON: { a: string, v?: string, r: number }
 *   a = action name (e.g. "type", "template", "continue")
 *   v = value (e.g. "memo", "classic")
 *   r = state_version (rejects stale button presses)
 */

const MAX_LEN = 64;

/**
 * Encode an action object into a JSON string.
 * @param {{ a: string, v?: string, r: number }} obj
 * @returns {string}
 * @throws {Error} if encoded length exceeds 64 characters
 */
export function encode(obj) {
  const str = JSON.stringify(obj);
  if (str.length > MAX_LEN) {
    throw new Error(`Payload too long: ${str.length} > ${MAX_LEN}`);
  }
  return str;
}

/**
 * Decode a JSON string back to an action object.
 * @param {string} str
 * @returns {{ a: string, v?: string, r: number } | null}  null if invalid
 */
export function decode(str) {
  try {
    const obj = JSON.parse(str);
    // Must have action name 'a' as a string
    return obj && typeof obj.a === 'string' ? obj : null;
  } catch {
    return null;
  }
}
