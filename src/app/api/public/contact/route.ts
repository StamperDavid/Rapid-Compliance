/**
 * Public Contact Form API
 *
 * Captures contact form submissions, creates a CRM lead, and emails the
 * operator. No authentication required — this is a public endpoint.
 * Rate limited to prevent abuse.
 *
 * Lead creation: contact submissions ARE leads. Until May 11 2026 this route
 * only persisted a `contactSubmissions` record without creating a Lead,
 * which broke marketing-attribution downstream (BUDGET_STRATEGIST aggregates
 * leads by source field — submissions weren't visible). Now every contact
 * submission becomes a Lead with utm fields attached for attribution.
 *
 * @route POST /api/public/contact - Submit contact form
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { sendEmail } from '@/lib/email/email-service';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getSubCollection } from '@/lib/firebase/collections';
import { createLead } from '@/lib/crm/lead-service';
import type { CreateLeadInput } from '@/types/crm-entities';

const UtmMetadataSchema = z.object({
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  referrer: z.string().max(2000).optional(),
}).optional();

const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required').max(320),
  company: z.string().max(200).optional().default(''),
  message: z.string().min(1, 'Message is required').max(5000),
  metadata: UtmMetadataSchema,
});

function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) { return { firstName: parts[0] ?? trimmed, lastName: '' }; }
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitMiddleware(request, 'contact-form');
  if (rateLimitResult) { return rateLimitResult; }

  try {
    const body: unknown = await request.json();
    const parsed = ContactFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, company, message, metadata } = parsed.data;

    // Derive source from UTM params if present. Same convention as
    // /api/public/early-access and /api/public/forms/[formId].
    const utmSource = metadata?.utmSource?.trim() ?? undefined;
    const utmMedium = metadata?.utmMedium?.trim() ?? undefined;
    const utmCampaign = metadata?.utmCampaign?.trim() ?? undefined;
    const derivedSource = utmSource
      ? `${utmSource.toLowerCase()}${utmMedium ? `/${utmMedium.toLowerCase()}` : ''}`
      : 'contact_form';

    // Store the raw submission for record-keeping (legacy collection — other
    // ops dashboards read from it).
    let submissionId: string | null = null;
    if (adminDb) {
      const submissionsPath = getSubCollection('contactSubmissions');
      const submissionRef = await adminDb.collection(submissionsPath).add({
        name,
        email,
        company,
        message,
        submittedAt: FieldValue.serverTimestamp(),
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
        status: 'new',
        ...(utmSource ? { utmSource } : {}),
        ...(utmMedium ? { utmMedium } : {}),
        ...(utmCampaign ? { utmCampaign } : {}),
      });
      submissionId = submissionRef.id;
    }

    // Create the CRM lead. Public endpoint → no auth context → must use Admin SDK
    // per feedback_server_routes_must_use_admin_sdk.
    const { firstName, lastName } = splitName(name);
    const leadInput: CreateLeadInput = {
      firstName,
      lastName,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      ...(company.trim() ? { company: company.trim() } : {}),
      status: 'new',
      source: derivedSource,
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      acquisitionMethod: 'form',
      tags: ['contact-form'],
      customFields: {
        contactMessage: message,
        ...(metadata?.utmTerm ? { utmTerm: metadata.utmTerm } : {}),
        ...(metadata?.utmContent ? { utmContent: metadata.utmContent } : {}),
        ...(metadata?.referrer ? { firstReferrer: metadata.referrer } : {}),
        ...(submissionId ? { contactSubmissionId: submissionId } : {}),
      },
      updatedAt: new Date(),
    };

    let leadId: string | null = null;
    try {
      const lead = await createLead(leadInput, { autoEnrich: false });
      leadId = lead.id;
    } catch (leadErr) {
      // Don't fail the user-facing submission if lead creation hiccups — the
      // raw submission is already saved. Log loudly for operator follow-up.
      logger.warn('Contact form lead creation failed (submission still saved)', {
        email,
        submissionId,
        error: leadErr instanceof Error ? leadErr.message : String(leadErr),
      });
    }

    // Send notification email to platform owner
    const notificationHtml = `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(email)}</td></tr>
        ${company ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(company)}</td></tr>` : ''}
        <tr><td style="padding:8px;font-weight:bold;vertical-align:top;">Message</td><td style="padding:8px;white-space:pre-wrap;">${escapeHtml(message)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Source</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(derivedSource)}</td></tr>
        ${leadId ? `<tr><td style="padding:8px;font-weight:bold;">Lead ID</td><td style="padding:8px;font-family:monospace;">${escapeHtml(leadId)}</td></tr>` : ''}
      </table>
    `;

    const emailResult = await sendEmail({
      to: process.env.FROM_EMAIL ?? 'support@salesvelocity.ai',
      subject: `Contact Form: ${name}${company ? ` (${company})` : ''}`,
      html: notificationHtml,
      text: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nCompany: ${company || 'N/A'}\nSource: ${derivedSource}\nMessage: ${message}${leadId ? `\nLead ID: ${leadId}` : ''}`,
      replyTo: email,
    });

    if (!emailResult.success) {
      logger.warn('Contact form email failed to send, but submission was saved', {
        emailError: emailResult.error,
        contactEmail: email,
        leadId,
      });
    }

    logger.info('Contact form submitted', {
      email,
      company,
      source: derivedSource,
      leadId,
      emailSent: emailResult.success,
    });

    return NextResponse.json({ success: true, ...(leadId ? { leadId } : {}) });
  } catch (err) {
    logger.error('Contact form submission failed', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { error: 'Failed to process contact form submission' },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
