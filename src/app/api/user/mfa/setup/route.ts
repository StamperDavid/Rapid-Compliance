/**
 * POST /api/user/mfa/setup
 * MFA enrollment/management using TOTP (authenticator app — RFC 6238).
 *
 * Actions:
 *   generate — Produce a new TOTP secret and otpauth URI for QR-code display.
 *              The pending secret is stored in Firestore with a 10-minute TTL.
 *   verify   — Validate the 6-digit code against the pending secret, then
 *              persist the secret to the user profile and set mfaEnabled: true.
 *   disable  — Validate the code against the active secret, then remove it
 *              and set mfaEnabled: false.
 *
 * Rate limit: 10 requests per 15 minutes (brute-force protection).
 */

import { type NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limiter';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMA
// ============================================================================

const MfaSetupSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
  }),
  z.object({
    action: z.literal('verify'),
    code: z
      .string()
      .length(6, 'Code must be 6 digits')
      .regex(/^\d{6}$/, 'Code must be numeric'),
    secret: z.string().min(1, 'Secret is required'),
  }),
  z.object({
    action: z.literal('disable'),
    code: z
      .string()
      .length(6, 'Code must be 6 digits')
      .regex(/^\d{6}$/, 'Code must be numeric'),
  }),
]);

// ============================================================================
// TOTP HELPERS  (RFC 6238 / HOTP RFC 4226)
// ============================================================================

/**
 * Encode a Buffer into a Base32 string (RFC 4648, no padding needed for secrets).
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  return result;
}

/**
 * Decode a Base32 string into a Buffer, tolerating padding and case.
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = encoded.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) {
      continue;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/**
 * Compute a single TOTP code for the given secret and counter value.
 * Counter = floor(unixSeconds / timeStep).
 *
 * Buffer byte reads return `number | undefined` when accessed by index, so we
 * fall back to 0 on each access.  In practice the HMAC digest is always 20
 * bytes and the offset arithmetic keeps us in-bounds, but we must satisfy the
 * strict no-non-null-assertion ESLint rule without casting.
 */
function computeOTP(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();

  const lastByte = hmac[hmac.length - 1] ?? 0;
  const offset = lastByte & 0x0f;

  const b0 = hmac[offset] ?? 0;
  const b1 = hmac[offset + 1] ?? 0;
  const b2 = hmac[offset + 2] ?? 0;
  const b3 = hmac[offset + 3] ?? 0;

  const code =
    (((b0 & 0x7f) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff)) %
    1_000_000;

  return code.toString().padStart(6, '0');
}

const TOTP_STEP = 30; // seconds

/**
 * Verify a TOTP code using a sliding window of ±1 time-step to account
 * for clock drift between client and server.
 */
function verifyTOTP(secretBase32: string, code: string, windowSteps = 1): boolean {
  const currentStep = Math.floor(Date.now() / 1000 / TOTP_STEP);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    if (computeOTP(secretBase32, currentStep + delta) === code) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// FIRESTORE PATHS
// ============================================================================

/** Pending (unverified) secrets — TTL-controlled documents. */
const mfaPendingPath = getSubCollection('mfaPending');

/** Verified MFA secrets live under the user profile collection. */
const usersPath = getSubCollection('users');

// 10-minute TTL for pending secrets
const PENDING_TTL_MS = 10 * 60 * 1000;

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 10 attempts per 15 minutes
  const rateLimitResponse = await rateLimitMiddleware(request, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return new NextResponse(rateLimitResponse.body, {
      status: rateLimitResponse.status,
      headers: rateLimitResponse.headers,
    });
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { user } = authResult;

  if (!adminDb) {
    logger.error(
      'Firebase Admin Firestore not initialized',
      new Error('adminDb is null'),
      { route: '/api/user/mfa/setup' }
    );
    return NextResponse.json(
      { success: false, error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const parsed = MfaSetupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const body = parsed.data;

  // --------------------------------------------------------------------------
  // ACTION: generate
  // --------------------------------------------------------------------------
  if (body.action === 'generate') {
    // Delete any existing pending secret for this user first
    await adminDb.collection(mfaPendingPath).doc(user.uid).delete();

    // Generate a cryptographically random 20-byte secret
    const secretBuffer = crypto.randomBytes(20);
    const secret = base32Encode(secretBuffer);

    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

    await adminDb.collection(mfaPendingPath).doc(user.uid).set({
      secret,
      userId: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt.toISOString(),
    });

    const accountLabel = encodeURIComponent(`SalesVelocity.ai:${user.email ?? user.uid}`);
    const issuer = encodeURIComponent('SalesVelocity.ai');
    const otpauthUri =
      `otpauth://totp/${accountLabel}` +
      `?secret=${secret}` +
      `&issuer=${issuer}` +
      `&algorithm=SHA1` +
      `&digits=6` +
      `&period=${TOTP_STEP}`;

    logger.info('MFA secret generated', { userId: user.uid, route: '/api/user/mfa/setup' });

    return NextResponse.json({ success: true, secret, otpauthUri });
  }

  // --------------------------------------------------------------------------
  // ACTION: verify
  // --------------------------------------------------------------------------
  if (body.action === 'verify') {
    const pendingDoc = await adminDb.collection(mfaPendingPath).doc(user.uid).get();

    if (!pendingDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'No pending MFA setup found. Please generate a new secret.' },
        { status: 400 }
      );
    }

    interface PendingMfaDoc {
      secret: string;
      expiresAt: string;
    }

    const pending = pendingDoc.data() as PendingMfaDoc;

    // Check TTL
    if (new Date(pending.expiresAt) < new Date()) {
      await adminDb.collection(mfaPendingPath).doc(user.uid).delete();
      return NextResponse.json(
        { success: false, error: 'MFA setup session expired. Please start again.' },
        { status: 400 }
      );
    }

    // The client echoes back the secret it received from the generate step.
    // Verify it matches what we stored (prevents secret substitution attacks).
    if (pending.secret !== body.secret) {
      return NextResponse.json(
        { success: false, error: 'Secret mismatch. Please generate a new secret.' },
        { status: 400 }
      );
    }

    if (!verifyTOTP(pending.secret, body.code)) {
      logger.warn('MFA verify: invalid code', { userId: user.uid, route: '/api/user/mfa/setup' });
      return NextResponse.json(
        { success: false, error: 'Invalid code. Please check your authenticator app and try again.' },
        { status: 400 }
      );
    }

    // Code is valid — persist the secret and enable MFA
    await adminDb.collection(usersPath).doc(user.uid).set(
      {
        mfaEnabled: true,
        mfaSecret: pending.secret,
        mfaEnabledAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Remove the pending document
    await adminDb.collection(mfaPendingPath).doc(user.uid).delete();

    logger.info('MFA enabled', { userId: user.uid, route: '/api/user/mfa/setup' });

    return NextResponse.json({ success: true, message: 'MFA has been enabled on your account.' });
  }

  // --------------------------------------------------------------------------
  // ACTION: disable
  // --------------------------------------------------------------------------
  // body.action === 'disable'
  const userDoc = await adminDb.collection(usersPath).doc(user.uid).get();

  if (!userDoc.exists) {
    return NextResponse.json(
      { success: false, error: 'User profile not found.' },
      { status: 404 }
    );
  }

  interface UserMfaDoc {
    mfaEnabled?: boolean;
    mfaSecret?: string;
  }

  const userData = userDoc.data() as UserMfaDoc;

  if (!userData.mfaEnabled || !userData.mfaSecret) {
    return NextResponse.json(
      { success: false, error: 'MFA is not currently enabled on your account.' },
      { status: 400 }
    );
  }

  if (!verifyTOTP(userData.mfaSecret, body.code)) {
    logger.warn('MFA disable: invalid code', { userId: user.uid, route: '/api/user/mfa/setup' });
    return NextResponse.json(
      { success: false, error: 'Invalid code. Please check your authenticator app and try again.' },
      { status: 400 }
    );
  }

  await adminDb.collection(usersPath).doc(user.uid).set(
    {
      mfaEnabled: false,
      mfaSecret: FieldValue.delete(),
      mfaDisabledAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info('MFA disabled', { userId: user.uid, route: '/api/user/mfa/setup' });

  return NextResponse.json({ success: true, message: 'MFA has been disabled on your account.' });
}
