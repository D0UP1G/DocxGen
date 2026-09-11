import crypto from 'node:crypto';
export function randomIdFor(key) { const value = crypto.createHash('sha256').update(String(key)).digest().readUInt32BE(0); return (value % 2147483646) + 1; }
