/**
 * AES-256-GCM Application Level Encryption (ALE)
 * SOC 2 Compliant encryption module for PII protection
 *
 * @module Encryption
 * @status FUNCTIONAL
 */

import * as crypto from 'crypto';
import { logger } from '@/lib/logger/logger';

// ============== Type Definitions ==============

export interface EncryptedField {
  ciphertext: string;  // base64 encoded
  iv: string;          // base64 encoded (12 bytes for GCM)
  tag: string;         // base64 encoded auth tag (16 bytes)
  version: number;     // key version for rotation
  algorithm: 'aes-256-gcm';
}

export interface EncryptionConfig {
  masterKey?: string;      // 32-byte key in hex or base64
  keyVersion?: number;     // Current key version
  enableDeterministic?: boolean;  // For searchable encryption
}

export interface KeyRotationResult {
  recordsProcessed: number;
  recordsUpdated: number;
  errors: string[];
}

// ============== Constants ==============

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM standard IV length
const TAG_LENGTH = 16; // GCM auth tag length
const KEY_LENGTH = 32; // 256 bits

// Environment variable for master key
const ENV_KEY_NAME = 'ENCRYPTION_MASTER_KEY';
const ENV_KEY_VERSION = 'ENCRYPTION_KEY_VERSION';

// ============== Key Management ==============

let cachedKey: Buffer | null = null;
let cachedKeyVersion: number = 1;

function getMasterKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const keyEnv = process.env[ENV_KEY_NAME];
  if (!keyEnv) {
    throw new Error(`${ENV_KEY_NAME} environment variable is not set. Generate a key with: openssl rand -hex 32`);
  }

  // Support both hex and base64 encoded keys
  let keyBuffer: Buffer;
  if (keyEnv.length === 64) {
    // Hex encoded (64 hex chars = 32 bytes)
    keyBuffer = Buffer.from(keyEnv, 'hex');
  } else {
    // Try base64
    keyBuffer = Buffer.from(keyEnv, 'base64');
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Invalid encryption key length. Expected ${KEY_LENGTH} bytes, got ${keyBuffer.length}`);
  }

  cachedKey = keyBuffer;

  // Get key version
  const versionEnv = process.env[ENV_KEY_VERSION];
  cachedKeyVersion = versionEnv ? parseInt(versionEnv, 10) : 1;

  return cachedKey;
}

function getKeyVersion(): number {
  return cachedKeyVersion;
}

/**
 * Generate a new encryption key (for setup/rotation)
 */
export function generateEncryptionKey(): string {
  // Use crypto module - available in Node.js
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

// ============== Core Encryption Functions ==============

/**
 * Encrypt a plaintext string using AES-256-GCM
 */
export function encryptField(plaintext: string): EncryptedField {
  if (!plaintext && plaintext !== '') {
    throw new Error('Cannot encrypt null or undefined value');
  }

    const key = getMasterKey();
  const version = getKeyVersion();

  // Generate random IV for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get authentication tag
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    version,
    algorithm: ALGORITHM,
  };
}

/**
 * Decrypt an encrypted field using AES-256-GCM
 */
export function decryptField(encrypted: EncryptedField): string {
  if (!encrypted?.ciphertext || !encrypted.iv || !encrypted.tag) {
    throw new Error('Invalid encrypted field structure');
  }

    const key = getMasterKey();

  // Parse components
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  // Validate IV length
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }

  // Validate tag length
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH}, got ${tag.length}`);
  }

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  // Set auth tag
  decipher.setAuthTag(tag);

  // Decrypt
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    // Auth tag verification failed - data may have been tampered with
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Decryption failed - possible data tampering', err, { file: 'encryption.ts' });
    throw new Error('Decryption failed: authentication tag verification failed');
  }
}

// ============== Deterministic Encryption ==============

/**
 * Encrypt with deterministic output (same input always produces same output)
 * WARNING: Less secure than randomized encryption. Only use for searchable fields.
 */
export function encryptDeterministic(plaintext: string): EncryptedField {
  if (!plaintext && plaintext !== '') {
    throw new Error('Cannot encrypt null or undefined value');
  }

    const key = getMasterKey();
  const version = getKeyVersion();

  // Derive IV from plaintext hash (deterministic)
  const ivBase = crypto.createHmac('sha256', key)
    .update(plaintext)
    .digest();
  const iv = ivBase.subarray(0, IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    version,
    algorithm: ALGORITHM,
  };
}

// ============== Field-Level Encryption Helpers ==============

/**
 * Check if a value is an encrypted field
 */
export function isEncryptedField(value: unknown): value is EncryptedField {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ciphertext === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.tag === 'string' &&
    typeof obj.version === 'number' &&
    obj.algorithm === 'aes-256-gcm'
  );
}

/**
 * Encrypt specified PII fields in a record
 */
export function encryptPII<T extends Record<string, unknown>>(
  record: T,
  piiFields: (keyof T)[]
): T {
  const result = { ...record };

  for (const field of piiFields) {
    const value = result[field];

    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Skip already encrypted fields
    if (isEncryptedField(value)) {
      continue;
    }

    // Convert to string and encrypt
    const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
    result[field] = encryptField(plaintext) as T[keyof T];
  }

  return result;
}

/**
 * Decrypt specified PII fields in a record
 */
export function decryptPII<T extends Record<string, unknown>>(
  record: T,
  piiFields: (keyof T)[]
): T {
  const result = { ...record };

  for (const field of piiFields) {
    const value = result[field];

    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Only decrypt encrypted fields
    if (!isEncryptedField(value)) {
      continue;
    }

    try {
      const decrypted = decryptField(value);

      // Try to parse as JSON (in case original was object)
      try {
        result[field] = JSON.parse(decrypted) as T[keyof T];
      } catch {
        result[field] = decrypted as T[keyof T];
      }
    } catch (error) {
      logger.warn(`Failed to decrypt field ${String(field)}`, { error: error instanceof Error ? error.message : String(error) });
      // Keep encrypted value on failure
    }
  }

  return result;
}

// ============== Batch Operations ==============

/**
 * Encrypt multiple records
 */
export function encryptRecords<T extends Record<string, unknown>>(
  records: T[],
  piiFields: (keyof T)[]
): T[] {
  return records.map(record => encryptPII(record, piiFields));
}

/**
 * Decrypt multiple records
 */
export function decryptRecords<T extends Record<string, unknown>>(
  records: T[],
  piiFields: (keyof T)[]
): T[] {
  return records.map(record => decryptPII(record, piiFields));
}

// ============== Key Rotation ==============

/**
 * Re-encrypt a field with the current key (for key rotation)
 */
export function reencryptField(encrypted: EncryptedField): EncryptedField {
  const plaintext = decryptField(encrypted);
  return encryptField(plaintext);
}

/**
 * Re-encrypt all PII fields in a record with the current key
 */
export function reencryptRecord<T extends Record<string, unknown>>(
  record: T,
  piiFields: (keyof T)[]
): { record: T; updated: boolean } {
  const currentVersion = getKeyVersion();
  let updated = false;
  const result = { ...record };

  for (const field of piiFields) {
    const value = result[field];

    if (!isEncryptedField(value)) {
      continue;
    }

    // Only re-encrypt if using an older key version
    if (value.version < currentVersion) {
      try {
        result[field] = reencryptField(value) as T[keyof T];
        updated = true;
      } catch (error) {
        logger.warn(`Failed to re-encrypt field ${String(field)}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return { record: result, updated };
}

// ============== Utility Functions ==============

/**
 * Hash a value for indexing (non-reversible)
 */
export function hashForIndex(value: string): string {
    const key = getMasterKey();

  return crypto.createHmac('sha256', key)
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * Validate encryption configuration
 */
export function validateEncryptionSetup(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env[ENV_KEY_NAME]) {
    errors.push(`${ENV_KEY_NAME} environment variable is not set`);
  } else {
    try {
      getMasterKey();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Clear cached keys (for testing or key rotation)
 */
export function clearKeyCache(): void {
  cachedKey = null;
  cachedKeyVersion = 1;
}

// ============== Lead & Contact PII Fields ==============

export const LEAD_PII_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
] as const;

export const CONTACT_PII_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'zipCode',
  'country',
] as const;

export const DEAL_PII_FIELDS = [
  'contactName',
  'contactEmail',
  'contactPhone',
] as const;
