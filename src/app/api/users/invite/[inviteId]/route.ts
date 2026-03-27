/**
 * GET  /api/users/invite/[inviteId] — Validate an invite token (public, no auth)
 * POST /api/users/invite/[inviteId] — Accept an invite (requires the new user's Firebase UID)
 *
 * The GET endpoint is intentionally public so unauthenticated visitors can
 * land on the invite page and see who invited them and what role they'll get.
 *
 * The POST endpoint is called after the client has created a Firebase Auth
 * account.  It atomically:
 *   1. Marks the invite as accepted
 *   2. Writes the user profile with the invited role
 *   3. Adds the user to the org's member list
 *   4. Sets Firebase Auth custom claims
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { FieldValue } from 'firebase-admin/firestore';
import type { AccountRole } from '@/types/unified-rbac';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/users/invite/[inviteId]';
const invitesCol = `organizations/${PLATFORM_ID}/invites`;

// ============================================================================
// GET — Public invite validation
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
): Promise<NextResponse> {
  const { inviteId } = await params;

  if (!adminDb) {
    return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const snap = await adminDb.collection(invitesCol).doc(inviteId).get();

    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found or has already been used.' },
        { status: 404 },
      );
    }

    const data = snap.data() as {
      email: string;
      role: AccountRole;
      status: string;
      expiresAt: string;
      invitedByEmail: string | null;
    };

    if (data.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This invitation has already been accepted.' },
        { status: 410 },
      );
    }

    if (new Date(data.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This invitation has expired. Please ask the admin to resend.' },
        { status: 410 },
      );
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: inviteId,
        email: data.email,
        role: data.role,
        invitedByEmail: data.invitedByEmail,
        expiresAt: data.expiresAt,
      },
    });
  } catch (err) {
    logger.error('Failed to validate invite', err instanceof Error ? err : new Error(String(err)), {
      inviteId,
      route: ROUTE,
    });
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

// ============================================================================
// POST — Accept invite (called after Firebase Auth account creation)
// ============================================================================

const AcceptSchema = z.object({
  uid: z.string().min(1, 'Firebase UID is required'),
  displayName: z.string().min(1, 'Display name is required'),
  companyName: z.string().min(1, 'Company name is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
): Promise<NextResponse> {
  const { inviteId } = await params;

  if (!adminDb || !adminAuth) {
    return NextResponse.json({ success: false, error: 'Server services unavailable' }, { status: 503 });
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = AcceptSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { uid, displayName, companyName } = parsed.data;

  try {
    // ---- Validate invite ----
    const inviteRef = adminDb.collection(invitesCol).doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return NextResponse.json({ success: false, error: 'Invitation not found.' }, { status: 404 });
    }

    const invite = inviteSnap.data() as {
      email: string;
      role: AccountRole;
      status: string;
      expiresAt: string;
      invitedBy: string;
      invitedByEmail: string | null;
    };

    if (invite.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Invitation already used.' }, { status: 410 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, error: 'Invitation expired.' }, { status: 410 });
    }

    // ---- Verify the Firebase Auth user exists and email matches ----
    const authUser = await adminAuth.getUser(uid);
    if (authUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Account email does not match the invitation.' },
        { status: 403 },
      );
    }

    // ---- Atomic batch: accept invite + create user profile + add to org ----
    const batch = adminDb.batch();

    // 1. Mark invite as accepted
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedBy: uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });

    // 2. Create user profile with invited role
    const userRef = adminDb.collection('users').doc(uid);
    batch.set(userRef, {
      email: invite.email,
      displayName,
      fullName: displayName,
      phoneNumber: null,
      organizations: [PLATFORM_ID],
      defaultOrganization: PLATFORM_ID,
      companyName,
      role: invite.role,
      status: 'active',
      emailVerified: authUser.emailVerified,
      inviteId,
      invitedBy: invite.invitedBy,
      joinedVia: 'invite',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Add to org members
    const orgRef = adminDb.collection('organizations').doc(PLATFORM_ID);
    batch.update(orgRef, {
      members: FieldValue.arrayUnion(uid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // ---- Set Firebase Auth custom claims ----
    const isAdmin = invite.role === 'owner' || invite.role === 'admin';
    await adminAuth.setCustomUserClaims(uid, {
      role: invite.role,
      admin: isAdmin,
    });

    logger.info('Invite accepted', {
      inviteId,
      uid,
      role: invite.role,
      invitedBy: invite.invitedBy,
      route: ROUTE,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted. Welcome to SalesVelocity.ai!',
      role: invite.role,
    });
  } catch (err) {
    logger.error('Failed to accept invite', err instanceof Error ? err : new Error(String(err)), {
      inviteId,
      uid,
      route: ROUTE,
    });
    return NextResponse.json({ success: false, error: 'Failed to accept invitation.' }, { status: 500 });
  }
}
