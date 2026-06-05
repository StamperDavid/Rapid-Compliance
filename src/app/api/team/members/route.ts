/**
 * GET /api/team/members — List team members for dropdowns / pickers.
 *
 * Any authenticated teammate can read this (NOT admin-only) — it powers
 * assignee dropdowns, @mention pickers, lead-routing selectors, etc.
 *
 * Reads the canonical roster the same way GET /api/admin/users does: the
 * top-level `users` collection via adminDal.safeQuery('USERS', ...), filtering
 * out AI agent service accounts and soft-removed users.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/team/members';

/**
 * Raw Firestore user document data (all fields optional as stored in DB).
 */
interface FirestoreUserData {
  readonly email?: string;
  readonly name?: string;
  readonly displayName?: string;
  readonly fullName?: string;
  readonly role?: string;
  readonly status?: string;
}

/**
 * Team member shape returned to the client.
 */
interface TeamMember {
  readonly uid: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

/**
 * Derive a human-friendly name with sensible fallbacks:
 * name -> displayName -> fullName -> email-prefix -> 'Unknown'.
 */
function resolveName(data: FirestoreUserData): string {
  const email = data.email ?? '';
  const emailPrefix = email.includes('@') ? email.split('@')[0] : email;
  return (
    data.name ??
    data.displayName ??
    data.fullName ??
    (emailPrefix !== '' ? emailPrefix : undefined) ??
    'Unknown'
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Any authenticated teammate may read the roster (not admin-only).
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    if (!adminDal) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 },
      );
    }

    // Read the canonical roster the same way GET /api/admin/users does.
    const usersSnapshot = await adminDal.safeQuery('USERS', (ref) => {
      return ref.limit(500);
    });

    const members: TeamMember[] = usersSnapshot.docs
      .filter((doc) => {
        const id = doc.id;
        const data = doc.data() as FirestoreUserData;
        // Exclude AI agent service accounts.
        const isAgent =
          id.startsWith('agent_') ||
          (data.email ?? '').startsWith('agent_') ||
          (data.email ?? '').includes('@ai-agent.');
        // Exclude soft-deleted users.
        const isRemoved = data.status === 'removed';
        return !isAgent && !isRemoved;
      })
      .map((doc) => {
        const data = doc.data() as FirestoreUserData;
        return {
          uid: doc.id,
          name: resolveName(data),
          email: data.email ?? '',
          role: data.role ?? 'member',
        };
      });

    members.sort((a, b) => a.name.localeCompare(b.name));

    logger.info('Team members fetched', {
      route: ROUTE,
      requestedBy: authResult.user.email,
      count: members.length,
    });

    return NextResponse.json({ success: true, members });
  } catch (error: unknown) {
    logger.error(
      'Team members fetch error',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team members' },
      { status: 500 },
    );
  }
}
