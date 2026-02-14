/**
 * Public Unsubscribe API
 * GET /api/public/unsubscribe - Render unsubscribe confirmation page
 * POST /api/public/unsubscribe - Process email unsubscribe requests
 *
 * This is a public endpoint (no auth required) because recipients
 * clicking unsubscribe links are not logged-in users.
 *
 * CAN-SPAM Compliance:
 * - Unsubscribe requests must be honored within 10 business days
 * - No authentication required for unsubscribe
 * - Success response regardless of email existence (privacy)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

// Schema for POST body (contactId-based format)
const unsubscribeSchema = z.object({
  contactId: z.string().min(1, 'contactId is required'),
  emailId: z.string().optional(),
  org: z.string().min(1, 'org is required'),
});

// Schema for GET query params (email/token format or contactId format)
const unsubscribeQuerySchema = z.object({
  email: z.string().email().optional(),
  token: z.string().optional(),
  contact: z.string().optional(),
  org: z.string().optional(),
});

// ============================================================================
// GET - Render Unsubscribe Confirmation Page
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for public endpoint
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/public/unsubscribe/get');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      email: searchParams.get('email') ?? undefined,
      token: searchParams.get('token') ?? undefined,
      contact: searchParams.get('contact') ?? undefined,
      org: searchParams.get('org') ?? undefined,
    };

    const parsed = unsubscribeQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return new NextResponse(
        generateErrorHtml('Invalid unsubscribe link. Please contact support.'),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    const { email, token, contact, org } = parsed.data;

    // Validate that we have either email+token OR contact+org
    if ((!email || !token) && (!contact || !org)) {
      return new NextResponse(
        generateErrorHtml('Invalid unsubscribe link. Please contact support.'),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Render confirmation page with unsubscribe form
    const html = generateUnsubscribeHtml(email, token, contact, org);

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: unknown) {
    logger.error('Unsubscribe GET error',
      error instanceof Error ? error : new Error(String(error)));
    return new NextResponse(
      generateErrorHtml('An error occurred. Please try again later.'),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

// ============================================================================
// POST - Process Unsubscribe Request
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Strict rate limiting for public endpoint
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/public/unsubscribe/post');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const rawBody: unknown = await request.json();
    const parsed = unsubscribeSchema.safeParse(rawBody);
    if (!parsed.success) {
      // Try parsing as email/token format
      const emailTokenSchema = z.object({
        email: z.string().email('Valid email is required'),
        token: z.string().min(1, 'token is required'),
      });
      const emailTokenParsed = emailTokenSchema.safeParse(rawBody);
      if (!emailTokenParsed.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      // Process email/token format
      const { email, token } = emailTokenParsed.data;
      return await processEmailTokenUnsubscribe(email, token);
    }

    const { contactId, emailId, org } = parsed.data;

    // Verify org matches our platform
    if (org !== PLATFORM_ID) {
      // Don't leak whether org exists - return success for privacy
      logger.warn('Unsubscribe attempt with invalid org', { org, contactId });
      return NextResponse.json({ success: true });
    }

    return await processContactIdUnsubscribe(contactId, emailId);
  } catch (error: unknown) {
    logger.error('Unsubscribe API error',
      error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 },
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process unsubscribe using email/token format
 * For privacy/security: always return success, even if email not found
 */
async function processEmailTokenUnsubscribe(email: string, _token: string): Promise<NextResponse> {
  try {
    // Find contact by email
    const { where } = await import('firebase/firestore');
    const contactPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/contacts`;
    const contacts = await FirestoreService.getAll(contactPath, [
      where('email', '==', email.toLowerCase()),
    ]);

    if (contacts.length > 0 && typeof contacts[0] === 'object' && contacts[0] !== null && 'id' in contacts[0]) {
      const contact = contacts[0] as { id: string };
      const contactId = contact.id;

      // Process the unsubscribe
      await processContactIdUnsubscribe(contactId, undefined);
    } else {
      // Contact not found - still log the attempt and return success (privacy)
      logger.info('Unsubscribe attempt for unknown email (privacy preserved)', {
        emailDomain: email.split('@')[1] ?? 'unknown',
      });
    }

    // Always return success to not leak whether email exists
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error processing email/token unsubscribe',
      error instanceof Error ? error : new Error(String(error)));
    // Return success anyway for privacy
    return NextResponse.json({ success: true });
  }
}

/**
 * Process unsubscribe using contactId
 */
async function processContactIdUnsubscribe(contactId: string, emailId: string | undefined): Promise<NextResponse> {
  try {

    // Record the unsubscribe in the suppression list
    const suppressionId = `unsub_${contactId}_${Date.now()}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/suppressions`,
      suppressionId,
      {
        id: suppressionId,
        contactId,
        emailId: emailId ?? null,
        reason: 'unsubscribe',
        channel: 'email',
        unsubscribedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      false,
    );

    // Update contact preferences if the contact exists
    try {
      const contactPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/contacts`;
      const existingContact: unknown = await FirestoreService.get(contactPath, contactId);
      if (existingContact && typeof existingContact === 'object') {
        await FirestoreService.set(
          contactPath,
          contactId,
          {
            ...(existingContact as Record<string, unknown>),
            emailOptOut: true,
            emailOptOutDate: new Date().toISOString(),
            unsubscribed: true,
            unsubscribedAt: new Date().toISOString(),
          },
          false,
        );
      }
    } catch {
      // Contact may not exist in CRM - suppression record is the primary source of truth
      logger.debug('Contact not found for unsubscribe, suppression recorded', { contactId });
    }

    // Unenroll from active sequences
    try {
      const { where } = await import('firebase/firestore');

      // Find prospects matching this contact
      const prospects = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/prospects`,
        [where('contactId', '==', contactId)],
      );

      for (const prospect of prospects) {
        if (typeof prospect === 'object' && prospect !== null && 'id' in prospect) {
          const prospectId = String((prospect as { id: string }).id);

          const enrollments = await FirestoreService.getAll(
            `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/enrollments`,
            [
              where('prospectId', '==', prospectId),
              where('status', '==', 'active'),
            ],
          );

          for (const enrollment of enrollments) {
            if (typeof enrollment === 'object' && enrollment !== null && 'id' in enrollment) {
              const enrollmentId = String((enrollment as { id: string }).id);
              await FirestoreService.set(
                `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/enrollments`,
                enrollmentId,
                {
                  ...(enrollment as Record<string, unknown>),
                  status: 'unsubscribed',
                  unsubscribedAt: new Date().toISOString(),
                },
                false,
              );
            }
          }
        }
      }
    } catch (error) {
      // Don't fail the unsubscribe if sequence unenrollment fails
      logger.error('Error unenrolling from sequences during unsubscribe',
        error instanceof Error ? error : new Error(String(error)));
    }

    logger.info('Contact unsubscribed', { contactId, emailId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error processing contactId unsubscribe',
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================================================
// HTML Template Functions
// ============================================================================

/**
 * Generate unsubscribe confirmation page HTML
 */
function generateUnsubscribeHtml(
  email: string | undefined,
  token: string | undefined,
  contact: string | undefined,
  org: string | undefined
): string {
  const displayEmail = email ? sanitizeHtml(email) : 'your email';
  const formData = email && token
    ? `{"email": "${sanitizeJs(email)}", "token": "${sanitizeJs(token)}"}`
    : `{"contactId": "${sanitizeJs(contact ?? '')}", "org": "${sanitizeJs(org ?? '')}"}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - SalesVelocity.ai</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .email {
      color: #667eea;
      font-weight: 600;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
    }
    button:hover { background: #5568d3; transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }
    .success {
      display: none;
      padding: 16px;
      background: #d1fae5;
      color: #065f46;
      border-radius: 8px;
      margin-top: 24px;
    }
    .error {
      display: none;
      padding: 16px;
      background: #fee2e2;
      color: #991b1b;
      border-radius: 8px;
      margin-top: 24px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unsubscribe from Emails</h1>
    <p>
      We're sorry to see you go. Click the button below to unsubscribe
      <span class="email">${displayEmail}</span> from all future marketing emails.
    </p>
    <button id="unsubscribe-btn" onclick="handleUnsubscribe()">
      Unsubscribe Me
    </button>
    <div id="success" class="success">
      You have been successfully unsubscribed. You will no longer receive marketing emails from us.
    </div>
    <div id="error" class="error">
      An error occurred. Please try again or contact support.
    </div>
    <div class="footer">
      SalesVelocity.ai &middot; CAN-SPAM Compliant
    </div>
  </div>
  <script>
    async function handleUnsubscribe() {
      const btn = document.getElementById('unsubscribe-btn');
      const success = document.getElementById('success');
      const error = document.getElementById('error');

      btn.disabled = true;
      btn.textContent = 'Processing...';
      success.style.display = 'none';
      error.style.display = 'none';

      try {
        const response = await fetch('/api/public/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(${formData})
        });

        const data = await response.json();

        if (response.ok && data.success) {
          success.style.display = 'block';
          btn.style.display = 'none';
        } else {
          error.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Unsubscribe Me';
        }
      } catch (err) {
        error.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Unsubscribe Me';
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Generate error page HTML
 */
function generateErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - SalesVelocity.ai</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #dc2626;
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Error</h1>
    <p>${sanitizeHtml(message)}</p>
  </div>
</body>
</html>`;
}

/**
 * Sanitize HTML to prevent XSS
 */
function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize JavaScript string literals
 */
function sanitizeJs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
