/**
 * Shared payload codec — encode/decode for bot button payloads.
 *
 * Re-exports from bot/payload.js to provide a stable import path for
 * cross-cutting concerns (adapters, client).
 *
 * Why a separate module: the bot/payload.js is the canonical source.
 * This module exists so adapters and other consumers can import from
 * 'shared/payload.js' without depending on the bot module's internal structure.
 */

export { encode, decode } from '../bot/payload.js';
