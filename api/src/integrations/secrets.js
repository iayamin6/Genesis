import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
let cached;
function encryptionKey() {
  if (cached) return cached;
  if (process.env.CONNECTOR_ENCRYPTION_KEY) {
    cached = Buffer.from(process.env.CONNECTOR_ENCRYPTION_KEY, 'base64');
    if (cached.length !== 32)
      throw new Error('CONNECTOR_ENCRYPTION_KEY must encode exactly 32 bytes');
    return cached;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Connector encryption is not configured');
  const location = path.resolve(process.env.CONNECTOR_KEY_FILE || 'data/connector.key');
  fs.mkdirSync(path.dirname(location), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(location)) {
    try {
      fs.writeFileSync(location, crypto.randomBytes(32), { mode: 0o600, flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  cached = fs.readFileSync(location);
  if (cached.length !== 32) throw new Error('Invalid local connector encryption key');
  return cached;
}
export function seal(value) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}
export function unseal(value) {
  if (!value) return '';
  const [iv, tag, data] = value.split('.').map((x) => Buffer.from(x, 'base64'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
export const hashSecret = (value) => crypto.createHash('sha256').update(value).digest('hex');
