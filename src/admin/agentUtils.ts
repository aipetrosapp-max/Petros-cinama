import crypto from 'crypto';

/** Small shared util for the admin agent (kept separate to avoid heavy imports). */
export function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}
