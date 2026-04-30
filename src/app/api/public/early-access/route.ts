/**
 * Public Early-Access Signup API
 *
 * Captures pre-launch interest as marketing leads.
 * Submissions land in the standard `leads` collection so they show up in
 * `/entities/leads` and can be worked like any other CRM lead.
 *
 * No authentication required — this is a public endpoint.
 * Rate limited via the shared rateLimitMiddleware.
 *
 * @route POST /api/public/early-access - Submit early-access signup
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { sendEmail } from '@/lib/email/email-service';
import { createLead } from '@/lib/crm/lead-service';
import type { CreateLeadInput } from '@/types/crm-entities';

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

const EarlyAccessSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required').max(320),
  company: z.string().max(200).optional().default(''),
  role: z.string().max(100).optional().default(''),
  useCase: z.string().max(2000).optional().default(''),
  referralSource: z.string().max(200).optional().default(''),
  // Honeypot — must be empty. Bots tend to fill every field.
  website: z.string().max(0).optional().default(''),
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Split a free-form name into firstName / lastName for the Lead schema.
 * The Lead type requires both. If the user supplied a single token,
 * mirror it into lastName as a placeholder so downstream UI shows the full name.
 */
function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? trimmed, lastName: '' };
  }
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function buildNotes(useCase: string, referralSource: string): string {
  const lines: string[] = [];
  if (useCase.trim()) {
    lines.push('Problem they want to solve:');
    lines.push(useCase.trim());
  }
  if (referralSource.trim()) {
    if (lines.length > 0) { lines.push(''); }
    lines.push(`Referral source: ${referralSource.trim()}`);
  }
  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// Route
// ----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Rate limit: same bucket pattern as the contact form.
  const rateLimitResult = await rateLimitMiddleware(request, 'early-access');
  if (rateLimitResult) { return rateLimitResult; }

  try {
    const body: unknown = await request.json();
    const parsed = EarlyAccessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, company, role, useCase, referralSource, website } = parsed.data;

    // Honeypot trip — silently 200 so bots don't learn the field exists.
    if (website && website.length > 0) {
      logger.warn('Early-access honeypot tripped', { email, ip: request.headers.get('x-forwarded-for') ?? 'unknown' });
      return NextResponse.json({ success: true });
    }

    const { firstName, lastName } = splitName(name);
    const notesText = buildNotes(useCase, referralSource);

    // Build the lead. Auto-enrichment is disabled — this is a self-submitted
    // signup, not a scraped record, and the operator hasn't approved running
    // enrichment APIs against marketing leads yet.
    //
    // The Lead type does not have a top-level `notes` field; the operator-
    // facing notes ride along inside `customFields.notes` (where the entity
    // table renderer surfaces them). The raw useCase / referralSource are
    // stored as discrete custom fields so they remain queryable.
    const leadInput: CreateLeadInput = {
      firstName,
      lastName,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      ...(company.trim() ? { company: company.trim() } : {}),
      ...(role.trim() ? { title: role.trim() } : {}),
      status: 'new',
      source: 'early_access_signup',
      acquisitionMethod: 'form',
      tags: ['early-access', 'pre-launch'],
      customFields: {
        notes: notesText,
        useCase: useCase.trim(),
        referralSource: referralSource.trim(),
      },
      updatedAt: new Date(),
    };

    // Public endpoint — no auth context, so the Admin SDK must perform the
    // Firestore write. Per `feedback_server_routes_must_use_admin_sdk`, the
    // client SDK silently fails Firestore rules when there is no request.auth.
    const lead = await createLead(leadInput, { autoEnrich: false, useAdminSdk: true });

    // Notification email to the operator. Best-effort — never block on it.
    const html = `
      <h2>New Early-Access Signup</h2>
      <p>A new lead just joined the SalesVelocity.ai early-access list.</p>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(email)}</td></tr>
        ${company ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(company)}</td></tr>` : ''}
        ${role ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Role</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(role)}</td></tr>` : ''}
        ${useCase ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;vertical-align:top;">Problem to solve</td><td style="padding:8px;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(useCase)}</td></tr>` : ''}
        ${referralSource ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">How they heard about us</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(referralSource)}</td></tr>` : ''}
        <tr><td style="padding:8px;font-weight:bold;">Lead ID</td><td style="padding:8px;font-family:monospace;">${escapeHtml(lead.id)}</td></tr>
      </table>
      <p style="margin-top:16px;color:#666;font-size:13px;">View this lead in the dashboard at <a href="https://salesvelocity.ai/entities/leads">/entities/leads</a>.</p>
    `;

    const textBody = [
      'New early-access signup:',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || 'N/A'}`,
      `Role: ${role || 'N/A'}`,
      '',
      useCase ? `Problem to solve:\n${useCase}` : 'Problem to solve: N/A',
      '',
      `Referral source: ${referralSource || 'N/A'}`,
      '',
      `Lead ID: ${lead.id}`,
    ].join('\n');

    const emailResult = await sendEmail({
      to: 'dstamper@salesvelocity.ai',
      subject: `Early Access: ${name}${company ? ` (${company})` : ''}`,
      html,
      text: textBody,
      replyTo: email,
    });

    if (!emailResult.success) {
      logger.warn('Early-access notification email failed (lead still saved)', {
        emailError: emailResult.error,
        leadId: lead.id,
      });
    }

    logger.info('Early-access signup captured', {
      leadId: lead.id,
      email,
      company: company || undefined,
      emailSent: emailResult.success,
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (err) {
    logger.error(
      'Early-access signup failed',
      err instanceof Error ? err : new Error(String(err))
    );
    return NextResponse.json(
      { error: 'Failed to process early-access signup' },
      { status: 500 }
    );
  }
}
