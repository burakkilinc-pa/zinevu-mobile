/**
 * RFC-4122 v4 UUID. Used for client_message_id idempotency keys — this doesn't
 * need cryptographic strength, only uniqueness, so Math.random is fine and keeps
 * us free of a native crypto dependency.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
