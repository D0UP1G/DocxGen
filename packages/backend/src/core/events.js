import { EventEmitter } from 'node:events';

/**
 * Global event bus for cross-module communication.
 * Modules publish events (document.processed, document.failed)
 * without importing each other — the event emitter is the boundary.
 * Max 50 listeners to catch runaway subscriptions in development.
 */
export const events = new EventEmitter();
events.setMaxListeners(50);
