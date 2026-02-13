/**
 * API Route: Social Accounts Management
 *
 * GET    /api/social/accounts           → List all social accounts
 * POST   /api/social/accounts           → Add a new social account
 * PUT    /api/social/accounts?id={id}   → Update an existing account
 * DELETE /api/social/accounts?id={id}   → Remove an account
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { SocialAccountService } from '@/lib/social/social-account-service';
import type { SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const twitterCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  bearerToken: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
});

const linkedInCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  orgId: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
});

const addAccountSchema = z.object({
  platform: z.enum(['twitter', 'linkedin']),
  accountName: z.string().min(1, 'Account name is required'),
  handle: z.string().min(1, 'Handle is required'),
  profileImageUrl: z.string().url().optional(),
  isDefault: z.boolean().optional().default(false),
  credentials: z.union([twitterCredentialsSchema, linkedInCredentialsSchema]),
});

const updateAccountSchema = z.object({
  accountName: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  profileImageUrl: z.string().url().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['active', 'disconnected', 'expired']).optional(),
  credentials: z.union([twitterCredentialsSchema, linkedInCredentialsSchema]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/accounts');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as SocialPlatform | null;

    const accounts = await SocialAccountService.listAccounts(platform ?? undefined);

    // Strip credentials from response for security
    const safeAccounts = accounts.map(({ credentials: _creds, ...rest }) => rest);

    return NextResponse.json({ success: true, accounts: safeAccounts });
  } catch (error: unknown) {
    logger.error('Accounts API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to list accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/accounts');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = addAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const account = await SocialAccountService.addAccount({
      platform: data.platform,
      accountName: data.accountName,
      handle: data.handle,
      profileImageUrl: data.profileImageUrl,
      isDefault: data.isDefault,
      status: 'active',
      credentials: data.credentials,
    });

    // Strip credentials from response
    const { credentials: _creds, ...safeAccount } = account;

    logger.info('Accounts API: Account added', { accountId: account.id, platform: data.platform });

    return NextResponse.json({ success: true, account: safeAccount });
  } catch (error: unknown) {
    logger.error('Accounts API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to add account' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/accounts');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required (pass as ?id=)' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();
    const validation = updateAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updated = await SocialAccountService.updateAccount(accountId, validation.data);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    const { credentials: _creds, ...safeAccount } = updated;

    return NextResponse.json({ success: true, account: safeAccount });
  } catch (error: unknown) {
    logger.error('Accounts API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/accounts');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required (pass as ?id=)' },
        { status: 400 }
      );
    }

    const removed = await SocialAccountService.removeAccount(accountId);

    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'Failed to remove account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Accounts API: DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to remove account' },
      { status: 500 }
    );
  }
}
