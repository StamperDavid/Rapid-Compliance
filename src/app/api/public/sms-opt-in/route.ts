export const dynamic = 'force-dynamic';

/**
 * POST /api/public/sms-opt-in
 *
 * Public SMS opt-in endpoint — no authentication required. Records a
 * CTIA-compliant express-written consent record in tcpa_consent so
 * the contact can later receive transactional/marketing SMS.
 *
 * Mirrors the document shape /api/onboarding/record-sms-consent uses
 * so checkTCPAConsent() reads them identically. The only difference
 * is no grantedByUserId (the opt-in is from a not-yet-registered
 * visitor) and source defaults to 'public_sms_opt_in_form'.
 *
 * Idempotent — same phone re-submitting just upserts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const RequestSchema = z
  .object({
    phoneNumber: z.string().min(7).max(32),
    email: z.string().email().optional(),
    name: z.string().min(1).max(120).optional(),
    // Two independent consent flags, mirroring Twilio's reference opt-in
    // form (marketing vs non-marketing). Defaulted to false for backward
    // compatibility with any caller that still posts the old payload —
    // those legacy callers will record a no-consent row, which is the
    // safe failure mode.
    consentMarketing: z.boolean().optional().default(false),
    consentTransactional: z.boolean().optional().default(false),
  })
  .refine((d) => d.consentMarketing || d.consentTransactional, {
    message:
      'At least one of consentMarketing or consentTransactional must be true.',
    path: ['consentMarketing'],
  });

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  // Default to +1 for 10-digit US numbers; otherwise just keep digits
  // with a leading + so it round-trips through Twilio cleanly.
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return `+${digits}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 },
    );
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

  const { phoneNumber, email, name, consentMarketing, consentTransactional } =
    parsed.data;
  const normalizedPhone = normalizePhone(phoneNumber);
  if (normalizedPhone.length < 8) {
    return NextResponse.json(
      { error: 'Phone number too short after normalization' },
      { status: 400 },
    );
  }

  const consentId = `${normalizedPhone}_sms`;
  const collectionPath = getSubCollection('tcpa_consent');

  const record = {
    phoneNumber: normalizedPhone,
    channel: 'sms' as const,
    consentGiven: true,
    consentType: 'express_written' as const,
    consentDate: new Date().toISOString(),
    source: 'public_sms_opt_in_form',
    email: email ?? null,
    name: name ?? null,
    // Per-category flags so downstream sending code can gate marketing vs
    // transactional traffic against the actual consent the user granted.
    consentMarketing,
    consentTransactional,
    consentCategories: [
      ...(consentTransactional ? ['account_notifications', 'customer_care'] : []),
      ...(consentMarketing ? ['marketing'] : []),
    ],
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent') ?? null,
  };

  try {
    await adminDb.collection(collectionPath).doc(consentId).set(record);
  } catch (err) {
    logger.error(
      'Failed to write public SMS opt-in',
      err instanceof Error ? err : new Error(String(err)),
      { phoneNumber: normalizedPhone },
    );
    return NextResponse.json(
      { error: 'Could not record consent. Please try again.' },
      { status: 500 },
    );
  }

  logger.info('Public SMS opt-in recorded', {
    phoneNumber: normalizedPhone,
    hasEmail: typeof email === 'string' && email.length > 0,
    hasName: typeof name === 'string' && name.length > 0,
    consentMarketing,
    consentTransactional,
  });

  return NextResponse.json({
    success: true,
    consentId,
    phoneNumber: normalizedPhone,
    channel: 'sms',
    consentDate: record.consentDate,
  });
}
