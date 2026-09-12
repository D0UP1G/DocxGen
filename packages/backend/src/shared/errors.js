/**
 * Shared error classes — used by both the monolith and the Document Service client.
 *
 * Re-exports from core/errors.js to provide a stable import path for
 * cross-cutting concerns (adapters, client, bot flow).
 *
 * Why a separate module: the core/errors.js is the canonical source.
 * This module exists so consumers can import from 'shared/errors.js'
 * without depending on the core module's internal structure.
 */

export { DomainError, AiUnavailableError, AiInvalidResponseError, DeliveryError } from '../core/errors.js';
