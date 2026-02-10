/**
 * Token Encryption Service
 * Encrypts OAuth tokens before Firestore storage using AES-256-GCM
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from '@/lib/logger/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_SECRET or NEXTAUTH_SECRET must be set for token encryption');
  }
  return scryptSync(secret, 'oauth-token-salt', 32);
}

/**
 * Encrypt a plaintext token for storage
 * Returns format: iv:authTag:encrypted (all hex-encoded)
 */
export function encryptToken(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Token encryption failed', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt an encrypted token
 * Handles legacy unencrypted tokens gracefully
 */
export function decryptToken(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      // Legacy unencrypted token - return as-is for backward compatibility
      logger.warn('Found unencrypted token - returning as-is for backward compatibility');
      return encryptedData;
    }

    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Token decryption failed', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Check if a value appears to be encrypted (matches our format)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) {return false;}
  return parts.every(part => /^[0-9a-f]+$/.test(part ?? ''));
}
