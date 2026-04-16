/**
 * API Route: Connect Bluesky Account
 *
 * POST /api/social/connect/bluesky
 * Validates credentials against the AT Protocol and stores a session in Firestore.
 *
 * Body: { identifier: string, password: string }
 *   - identifier: Bluesky handle (e.g. "user.bsky.social")
 *   - password: App password (created in Bluesky Settings > App Passwords)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { BlueskyCredentials, SocialAccountStatus } from '@/types/social';

export const dynamic = 'force-dynamic';

const SOCIAL_ACCOUNTS_COLLECTION = getSubCollection('social_accounts');

const connectBlueskySchema = z.object({
  identifier: z
    .string()
    .min(1, 'Bluesky handle is required')
    .regex(
      /^[a-zA-Z0-9._-]+(\.[a-zA-Z0-9._-]+)+$/,
      'Invalid Bluesky handle format (e.g. user.bsky.social)'
    ),
  password: z.string().min(1, 'App password is required'),
});

interface BlueskySessionResponse {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = connectBlueskySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { identifier, password } = validation.data;

    // Validate credentials against the AT Protocol
    let session: BlueskySessionResponse;
    try {
      const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.warn('Bluesky Connect: createSession failed', {
          status: String(response.status),
          error: errorBody,
        });
        return NextResponse.json(
          { success: false, error: 'Invalid handle or app password' },
          { status: 401 }
        );
      }

      session = (await response.json()) as BlueskySessionResponse;
    } catch (fetchError) {
      logger.error(
        'Bluesky Connect: Network error calling AT Protocol',
        fetchError instanceof Error ? fetchError : new Error(String(fetchError))
      );
      return NextResponse.json(
        { success: false, error: 'Could not reach Bluesky servers. Please try again.' },
        { status: 502 }
      );
    }

    // Build the credential object
    const credentials: BlueskyCredentials = {
      did: session.did,
      handle: session.handle,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    };

    // Store in Firestore
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const status: SocialAccountStatus = 'active';

    await AdminFirestoreService.set(
      SOCIAL_ACCOUNTS_COLLECTION,
      accountId,
      {
        id: accountId,
        platform: 'bluesky',
        accountName: session.handle,
        handle: session.handle,
        isDefault: false,
        status,
        credentials,
        addedAt: now,
        connectedBy: authResult.user.uid,
      },
      false
    );

    logger.info('Bluesky Connect: Account connected', {
      accountId,
      handle: session.handle,
      userId: authResult.user.uid,
    });

    return NextResponse.json({ success: true, handle: session.handle });
  } catch (error: unknown) {
    logger.error(
      'Bluesky Connect: POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: 'Failed to connect Bluesky account' },
      { status: 500 }
    );
  }
}
