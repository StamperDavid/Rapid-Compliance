/**
 * POST /api/users/invite
 * Send an email invitation to a new team member.
 *
 * Auth requirements:
 *   - Must be authenticated.
 *   - Role must be owner, admin, or manager (members cannot invite).
 *
 * Role-hierarchy constraints:
 *   - manager  → can only invite 'member'
 *   - admin    → can invite 'member' or 'manager'
 *   - owner    → can invite any role ('member', 'manager', 'admin')
 *
 * Rate limit: 20 invites per hour.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/email-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limiter';
import { FieldValue } from 'firebase-admin/firestore';
import type { AccountRole } from '@/types/unified-rbac';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMA
// ============================================================================

const AccountRoleSchema = z.enum(['owner', 'admin', 'manager', 'member']);

const InviteSchema = z.object({
  email: z.string().email('A valid email address is required'),
  role: AccountRoleSchema,
});

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

/**
 * Returns the set of roles that the inviting user is allowed to assign.
 * This prevents privilege escalation (e.g. a manager granting admin access).
 */
function allowedInviteRoles(inviterRole: AccountRole): AccountRole[] {
  switch (inviterRole) {
    case 'owner':
      return ['admin', 'manager', 'member'];
    case 'admin':
      return ['manager', 'member'];
    case 'manager':
      return ['member'];
    default:
      return [];
  }
}

// ============================================================================
// HTML ESCAPING
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// FIRESTORE PATHS
// ============================================================================

const invitesPath = `organizations/${PLATFORM_ID}/invites`;
const usersPath = `organizations/${PLATFORM_ID}/users`;

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 20 invites per hour
  const rateLimitResponse = await rateLimitMiddleware(request, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return new NextResponse(rateLimitResponse.body, {
      status: rateLimitResponse.status,
      headers: rateLimitResponse.headers,
    });
  }

  // Only owner, admin, and manager can send invites
  const authResult = await requireRole(request, ['owner', 'admin', 'manager']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { user } = authResult;

  if (!adminDb) {
    logger.error(
      'Firebase Admin Firestore not initialized',
      new Error('adminDb is null'),
      { route: '/api/users/invite' }
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

  const parsed = InviteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { email: invitedEmail, role: invitedRole } = parsed.data;

  // --------------------------------------------------------------------------
  // Role hierarchy enforcement
  // --------------------------------------------------------------------------
  if (!user.role) {
    return NextResponse.json(
      { success: false, error: 'Your account role could not be determined.' },
      { status: 403 }
    );
  }

  const permittedRoles = allowedInviteRoles(user.role);
  if (!permittedRoles.includes(invitedRole)) {
    logger.warn('Invite blocked: role escalation attempt', {
      inviterUid: user.uid,
      inviterRole: user.role,
      requestedRole: invitedRole,
      route: '/api/users/invite',
    });
    return NextResponse.json(
      {
        success: false,
        error: `Your role (${user.role}) is not allowed to invite users with the '${invitedRole}' role.`,
      },
      { status: 403 }
    );
  }

  // --------------------------------------------------------------------------
  // Duplicate check — reject if a user or pending invite already exists
  // --------------------------------------------------------------------------
  const existingUsersSnap = await adminDb
    .collection(usersPath)
    .where('email', '==', invitedEmail)
    .limit(1)
    .get();

  if (!existingUsersSnap.empty) {
    return NextResponse.json(
      { success: false, error: 'A user with that email address already exists.' },
      { status: 409 }
    );
  }

  const existingInviteSnap = await adminDb
    .collection(invitesPath)
    .where('email', '==', invitedEmail)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!existingInviteSnap.empty) {
    return NextResponse.json(
      { success: false, error: 'A pending invitation for that email address already exists.' },
      { status: 409 }
    );
  }

  // --------------------------------------------------------------------------
  // Create invite record
  // --------------------------------------------------------------------------
  const inviteRef = adminDb.collection(invitesPath).doc();
  const inviteId = inviteRef.id;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const inviteRecord = {
    id: inviteId,
    email: invitedEmail,
    role: invitedRole,
    invitedBy: user.uid,
    invitedByEmail: user.email ?? null,
    status: 'pending' as const,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt.toISOString(),
  };

  await inviteRef.set(inviteRecord);

  logger.info('Invite record created', {
    inviteId,
    invitedEmail,
    invitedRole,
    invitedByUid: user.uid,
    route: '/api/users/invite',
  });

  // --------------------------------------------------------------------------
  // Send invitation email
  // --------------------------------------------------------------------------
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rapidcompliance.us';
  const signupUrl = `${appUrl}/signup?invite=${inviteId}`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to SalesVelocity.ai</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f14;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#1a1a24;border-radius:12px;overflow:hidden;border:1px solid #2a2a3a;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #2a2a3a;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">SalesVelocity.ai</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#ffffff;">You've been invited</h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#a0a0b8;">
                ${user.email ? `<strong style="color:#ffffff;">${escapeHtml(user.email)}</strong> has invited you` : 'You have been invited'} to join the SalesVelocity.ai team as a <strong style="color:#ffffff;">${escapeHtml(invitedRole)}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#6b6b8a;">
                This invitation expires in 7 days.
              </p>
              <a
                href="${signupUrl}"
                style="display:inline-block;padding:12px 28px;background-color:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.1px;"
              >
                Accept Invitation
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a3a;">
              <p style="margin:0;font-size:12px;color:#6b6b8a;line-height:1.5;">
                If you weren't expecting this invitation, you can safely ignore this email.
                This link will expire on ${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const emailResult = await sendEmail({
    to: invitedEmail,
    subject: "You've been invited to SalesVelocity.ai",
    html: emailHtml,
  });

  if (!emailResult.success) {
    // The invite record is already persisted — surface the email failure
    // as a warning so the caller knows to follow up manually.
    logger.warn('Invite email delivery failed', {
      inviteId,
      invitedEmail,
      emailError: emailResult.error,
      route: '/api/users/invite',
    });

    return NextResponse.json(
      {
        success: true,
        warning: 'Invite created but email delivery failed. Please check your email provider settings.',
        invite: {
          id: inviteId,
          email: invitedEmail,
          role: invitedRole,
          status: 'pending',
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 207 }
    );
  }

  logger.info('Invite email sent', {
    inviteId,
    invitedEmail,
    messageId: emailResult.messageId,
    route: '/api/users/invite',
  });

  return NextResponse.json(
    {
      success: true,
      message: `Invitation sent to ${invitedEmail}.`,
      invite: {
        id: inviteId,
        email: invitedEmail,
        role: invitedRole,
        status: 'pending',
        expiresAt: expiresAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
