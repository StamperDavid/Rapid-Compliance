/**
 * POST /api/user/password-change
 * Allows authenticated users to change their own password.
 *
 * Flow:
 * 1. Rate-limit to 5 attempts per 15 minutes (brute-force protection).
 * 2. Require a valid Firebase Bearer token.
 * 3. Validate the request body with Zod.
 * 4. Verify the current password via the Firebase REST API (re-authentication).
 * 5. If verified, update the password via the Firebase Admin SDK.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminAuth } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMA
// ============================================================================

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 5 attempts per 15 minutes (brute-force / credential-stuffing protection)
  const rateLimitResponse = await rateLimitMiddleware(request, {
    limit: 5,
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

  const parsed = PasswordChangeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (!adminAuth) {
    logger.error(
      'Firebase Admin Auth not initialized',
      new Error('adminAuth is null'),
      { route: '/api/user/password-change' }
    );
    return NextResponse.json(
      { success: false, error: 'Auth service unavailable' },
      { status: 503 }
    );
  }

  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    logger.error(
      'NEXT_PUBLIC_FIREBASE_API_KEY is not set',
      new Error('Missing Firebase API key'),
      { route: '/api/user/password-change' }
    );
    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Re-authenticate the user with their current password via the Firebase REST API.
    // This is the standard way to verify the current password server-side without
    // requiring the client to re-sign in — the Admin SDK cannot check passwords directly.
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: currentPassword,
          returnSecureToken: false,
        }),
      }
    );

    if (!verifyResponse.ok) {
      logger.warn('Password change failed: current password incorrect', {
        userId: user.uid,
        route: '/api/user/password-change',
      });
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Current password confirmed — update to the new password via Admin SDK.
    await adminAuth.updateUser(user.uid, { password: newPassword });

    logger.info('Password changed successfully', {
      userId: user.uid,
      route: '/api/user/password-change',
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error: unknown) {
    logger.error(
      'Password change failed',
      error instanceof Error ? error : new Error(String(error)),
      { userId: user.uid, route: '/api/user/password-change' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to change password. Please try again.' },
      { status: 500 }
    );
  }
}
