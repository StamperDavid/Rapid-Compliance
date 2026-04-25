/**
 * POST /api/onboarding/record-sms-consent
 *
 * Records CTIA-compliant SMS opt-in consent for a freshly-created user.
 * Called by the onboarding account page after successful auth + batch
 * commit, when the user explicitly checked the SMS opt-in box on the
 * industry page.
 *
 * Writes via adminDb (bypasses Firestore rules). Mirrors the document
 * shape recordConsent() in tcpa-service.ts produces, so downstream
 * checkTCPAConsent() reads them identically.
 *
 * Idempotent — same phone+channel pair just upserts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const RequestSchema = z.object({
  phoneNumber: z.string().min(7).max(32),
  // The industry page collects "express_written" consent (explicit checkbox
  // with full CTIA disclosure). Other types are reserved for future paths.
  consentType: z.enum(['express_written', 'express_oral', 'implied']).default('express_written'),
  source: z.string().min(2).max(120).default('onboarding_signup'),
});

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminDb || !adminAuth) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 },
    );
  }

  // Authenticate the caller — must be a signed-in user. The onboarding
  // page calls this immediately after createUserWithEmailAndPassword
  // resolves, so a valid ID token is available.
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    userId = decoded.uid;
  } catch (err) {
    logger.warn('[record-sms-consent] Invalid token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { phoneNumber, consentType, source } = parsed.data;
  const normalizedPhone = normalizePhone(phoneNumber);
  if (normalizedPhone.length < 7) {
    return NextResponse.json({ error: 'Phone number too short after normalization' }, { status: 400 });
  }

  const consentId = `${normalizedPhone}_sms`;
  const collectionPath = getSubCollection('tcpa_consent');

  const record = {
    phoneNumber: normalizedPhone,
    channel: 'sms' as const,
    consentGiven: true,
    consentType,
    consentDate: new Date().toISOString(),
    source,
    grantedByUserId: userId,
  };

  await adminDb.collection(collectionPath).doc(consentId).set(record);

  logger.info('SMS consent recorded via onboarding', {
    userId,
    phoneNumber: normalizedPhone,
    consentType,
    source,
  });

  return NextResponse.json({
    success: true,
    consentId,
    phoneNumber: normalizedPhone,
    channel: 'sms',
    consentDate: record.consentDate,
  });
}
