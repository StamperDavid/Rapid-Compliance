/**
 * Contact Draft Email API
 *
 * POST /api/crm/contacts/[contactId]/draft-email
 *
 * AI-forward CRM action (benchmark: Reevo). Loads a contact and its recent
 * activity timeline, then asks the real email-writer engine to draft a
 * personalized outreach email (subject + body) grounded in that context.
 *
 * No hardcoded email text — the engine calls the LLM via the unified AI service.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getContact } from '@/lib/crm/contact-service';
import { getActivities } from '@/lib/crm/activity-service';
import { generateSalesEmail } from '@/lib/email-writer/server';
import type { EmailType } from '@/lib/email-writer/email-templates';
import { logger } from '@/lib/logger/logger';

/**
 * Resolve the contact's display name from the available name fields.
 */
function resolveContactName(contact: {
  name?: string;
  firstName?: string;
  lastName?: string;
}): string | undefined {
  if (typeof contact.name === 'string' && contact.name.trim() !== '') {
    return contact.name.trim();
  }
  const parts = [contact.firstName, contact.lastName]
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .map((p) => p.trim());
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Build a short, plain-English summary of recent activity to feed the engine
 * as additional drafting context.
 */
function summarizeActivities(
  activities: Array<{ type: string; subject?: string; summary?: string; body?: string }>
): string {
  if (activities.length === 0) {
    return 'No prior recorded activity with this contact — treat this as a first-touch outreach.';
  }

  const lines = activities.slice(0, 8).map((a) => {
    const detail =
      (typeof a.subject === 'string' && a.subject.trim() !== '' && a.subject) ||
      (typeof a.summary === 'string' && a.summary.trim() !== '' && a.summary) ||
      (typeof a.body === 'string' && a.body.trim() !== '' && a.body) ||
      '';
    const readableType = a.type.replace(/_/g, ' ');
    return detail !== '' ? `- ${readableType}: ${detail}` : `- ${readableType}`;
  });

  return `Recent activity history with this contact (most recent first):\n${lines.join('\n')}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;
    const { contactId } = await params;

    logger.info('Drafting AI email for contact', { contactId, userId: user.uid });

    // 1. Load the contact
    const contact = await getContact(contactId);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found.' },
        { status: 404 }
      );
    }

    // 2. Load recent activity for grounding context
    const activityResult = await getActivities(
      { entityType: 'contact', entityId: contactId },
      { pageSize: 20 }
    );
    const activitySummary = summarizeActivities(activityResult.data);

    // 3. Pick a sensible email type from recent activity: a first-touch gets an
    //    introduction; a contact we've engaged before gets a follow-up.
    const emailType: EmailType =
      activityResult.data.length > 0 ? 'follow-up' : 'intro';

    // 4. Call the REAL email-writer engine (LLM-backed)
    const result = await generateSalesEmail({
      userId: user.uid,
      emailType,
      recipientName: resolveContactName(contact),
      recipientEmail: contact.email,
      recipientTitle: contact.title,
      companyName: contact.company,
      tone: 'consultative',
      length: 'medium',
      customInstructions: activitySummary,
    });

    if (!result.success || !result.email) {
      logger.warn('Email engine failed to draft contact email', {
        contactId,
        error: result.error,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ??
            'The AI was unable to draft an email. Please try again in a moment.',
        },
        { status: 502 }
      );
    }

    // Prefer the plain-text body for an editable draft; fall back to HTML body.
    const body =
      result.email.bodyPlain.trim() !== ''
        ? result.email.bodyPlain
        : result.email.body;

    return NextResponse.json({
      success: true,
      subject: result.email.subject,
      body,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to draft contact email', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Something went wrong while drafting the email. Please try again.',
      },
      { status: 500 }
    );
  }
}
