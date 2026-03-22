/**
 * POST /api/user/delete-account
 * GDPR self-service account deletion.
 *
 * Flow:
 * 1. Rate-limit to 3 attempts per hour.
 * 2. Require a valid Firebase Bearer token.
 * 3. Validate the request body with Zod (password + typed confirmation phrase).
 * 4. Block account owners — they must transfer ownership first.
 * 5. Verify the password via the Firebase REST API.
 * 6. Delete the user's Firestore documents.
 * 7. Delete the Firebase Auth account.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMA
// ============================================================================

const DeleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to confirm account deletion'),
  confirmation: z.literal('DELETE MY ACCOUNT', {
    errorMap: () => ({ message: 'You must type DELETE MY ACCOUNT to confirm' }),
  }),
});

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 3 attempts per hour (high-value destructive action)
  const rateLimitResponse = await rateLimitMiddleware(request, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
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

  // Account owners cannot self-delete — they must transfer ownership first to
  // prevent orphaned organizations.
  if (user.role === 'owner') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Account owners cannot self-delete. Transfer ownership to another member first.',
      },
      { status: 403 }
    );
  }

  if (!user.email) {
    return NextResponse.json(
      { success: false, error: 'No email address associated with this account' },
      { status: 400 }
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

  const parsed = DeleteAccountSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  if (!adminAuth || !adminDb) {
    logger.error(
      'Firebase Admin services not initialized',
      new Error('adminAuth or adminDb is null'),
      { route: '/api/user/delete-account' }
    );
    return NextResponse.json(
      { success: false, error: 'Service unavailable' },
      { status: 503 }
    );
  }

  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    logger.error(
      'NEXT_PUBLIC_FIREBASE_API_KEY is not set',
      new Error('Missing Firebase API key'),
      { route: '/api/user/delete-account' }
    );
    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Re-authenticate the user — required before a destructive irreversible action.
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: parsed.data.password,
          returnSecureToken: false,
        }),
      }
    );

    if (!verifyResponse.ok) {
      logger.warn('Account deletion failed: password verification rejected', {
        userId: user.uid,
        route: '/api/user/delete-account',
      });
      return NextResponse.json(
        { success: false, error: 'Password verification failed' },
        { status: 401 }
      );
    }

    const userId = user.uid;

    // ── Firestore cleanup ──────────────────────────────────────────────────

    // 1. Platform sub-collection user profile
    const platformUsersPath = getSubCollection('users');
    await adminDb.collection(platformUsersPath).doc(userId).delete();

    // 2. Top-level users collection (legacy / dual-write path)
    const topLevelUserRef = adminDb.collection('users').doc(userId);
    const topLevelUserDoc = await topLevelUserRef.get();
    if (topLevelUserDoc.exists) {
      await topLevelUserRef.delete();
    }

    // 3. Subscription data
    const subscriptionsPath = getSubCollection('subscriptions');
    const subscriptionRef = adminDb.collection(subscriptionsPath).doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    if (subscriptionDoc.exists) {
      await subscriptionRef.delete();
    }

    // ── Firebase Auth account ──────────────────────────────────────────────
    await adminAuth.deleteUser(userId);

    logger.info('Account deleted (GDPR self-service)', {
      userId,
      email: user.email,
      route: '/api/user/delete-account',
    });

    return NextResponse.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: unknown) {
    logger.error(
      'Account deletion failed',
      error instanceof Error ? error : new Error(String(error)),
      { userId: user.uid, route: '/api/user/delete-account' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    );
  }
}
