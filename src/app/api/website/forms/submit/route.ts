/**
 * Public Website Form Submission API
 *
 * Handles submissions from form widgets rendered on PUBLISHED websites
 * (contact-form, newsletter, custom-form). No authentication required — these
 * are live-site visitors. Rate limited + honeypot + timing checks for abuse.
 *
 * Every submission is persisted to the `websiteFormSubmissions` collection so
 * no data is ever silently lost. When the originating widget has `saveToCRM`
 * set and an email is present, a CRM lead is also created (reusing the same
 * `createLead` service the contact + custom-form routes use), so website form
 * fills flow into the pipeline and marketing attribution.
 *
 * @route POST /api/website/forms/submit - Submit a website form widget
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getSubCollection } from '@/lib/firebase/collections';
import { createLead } from '@/lib/crm/lead-service';
import type { CreateLeadInput } from '@/types/crm-entities';

const MetadataSchema = z
  .object({
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmTerm: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
    referrer: z.string().max(2000).optional(),
  })
  .optional();

const SubmitSchema = z.object({
  widgetType: z.enum(['contact-form', 'newsletter', 'custom-form']),
  widgetId: z.string().max(200).optional(),
  pagePath: z.string().max(2000).optional(),
  saveToCRM: z.boolean().optional().default(false),
  // Submitted values keyed by field name. Values are primitives only.
  fields: z.record(
    z.string().max(200),
    z.union([z.string().max(10000), z.number(), z.boolean()])
  ),
  metadata: MetadataSchema,
  // Anti-abuse fields (not persisted)
  _honeypot: z.string().optional(),
  _loadedAt: z.number().optional(),
});

/** Encode HTML special chars so stored values render as text, never markup. */
function sanitizeString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeValue(value: string | number | boolean): string | number | boolean {
  return typeof value === 'string' ? sanitizeString(value) : value;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Find the email value among submitted fields (by key or by value shape). */
function findEmail(fields: Record<string, string | number | boolean>): string | undefined {
  const byKey = fields['email'] ?? fields['Email'] ?? fields['emailAddress'];
  if (typeof byKey === 'string' && EMAIL_RE.test(byKey.trim())) {
    return byKey.trim().toLowerCase();
  }
  for (const value of Object.values(fields)) {
    if (typeof value === 'string' && EMAIL_RE.test(value.trim())) {
      return value.trim().toLowerCase();
    }
  }
  return undefined;
}

function pickString(
  fields: Record<string, string | number | boolean>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? trimmed, lastName: '' };
  }
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitMiddleware(request, '/api/website/forms/submit');
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = SubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { widgetType, widgetId, pagePath, saveToCRM, fields, metadata, _honeypot, _loadedAt } =
      parsed.data;

    // Anti-abuse: honeypot field filled = bot. Return success so the bot
    // doesn't learn it was blocked, but persist nothing.
    if (_honeypot && _honeypot.trim() !== '') {
      logger.warn('Website form submission blocked: honeypot triggered', { widgetType, pagePath });
      return NextResponse.json({ success: true });
    }

    // Anti-abuse: submitted < 1.5s after the form loaded = almost certainly a bot.
    if (typeof _loadedAt === 'number' && Date.now() - _loadedAt < 1500) {
      logger.warn('Website form submission blocked: submitted too fast', { widgetType, pagePath });
      return NextResponse.json({ success: true });
    }

    // Sanitize every submitted value before storage.
    const sanitizedFields: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(fields)) {
      sanitizedFields[sanitizeString(key)] = sanitizeValue(value);
    }

    const cleanStr = (value?: string): string | undefined => {
      const trimmed = value?.trim();
      if (trimmed === undefined || trimmed === '') {
        return undefined;
      }
      return trimmed;
    };
    const utmSource = cleanStr(metadata?.utmSource);
    const utmMedium = cleanStr(metadata?.utmMedium);
    const utmCampaign = cleanStr(metadata?.utmCampaign);
    const derivedSource = utmSource
      ? `${utmSource.toLowerCase()}${utmMedium ? `/${utmMedium.toLowerCase()}` : ''}`
      : `website_${widgetType}`;

    // Persist the raw submission. Public endpoint → must use Admin SDK.
    let submissionId: string | null = null;
    if (adminDb) {
      const submissionsPath = getSubCollection('websiteFormSubmissions');
      const submissionRef = await adminDb.collection(submissionsPath).add({
        widgetType,
        ...(widgetId ? { widgetId } : {}),
        ...(pagePath ? { pagePath } : {}),
        fields: sanitizedFields,
        savedToCRM: saveToCRM,
        status: 'new',
        submittedAt: FieldValue.serverTimestamp(),
        ip:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          'unknown',
        ...(utmSource ? { utmSource } : {}),
        ...(utmMedium ? { utmMedium } : {}),
        ...(utmCampaign ? { utmCampaign } : {}),
      });
      submissionId = submissionRef.id;
    } else {
      logger.error(
        'Website form submission could not be persisted: adminDb not configured',
        new Error('adminDb unavailable'),
        { widgetType }
      );
      return NextResponse.json(
        { error: 'We could not save your submission right now. Please try again shortly.' },
        { status: 503 }
      );
    }

    // Create a CRM lead only when the widget opted in AND we have an email.
    let leadId: string | null = null;
    const email = findEmail(sanitizedFields);
    if (saveToCRM && email) {
      try {
        const rawName = pickString(sanitizedFields, ['name', 'fullName', 'Name']);
        const { firstName, lastName } = rawName
          ? splitName(rawName)
          : {
              firstName: pickString(sanitizedFields, ['firstName', 'first_name']) ?? 'Website',
              lastName: pickString(sanitizedFields, ['lastName', 'last_name']) ?? 'Visitor',
            };
        const company = pickString(sanitizedFields, ['company', 'companyName', 'organization']);
        const phone = pickString(sanitizedFields, ['phone', 'phoneNumber', 'tel']);
        const message = pickString(sanitizedFields, ['message', 'comments', 'notes']);

        const leadInput: CreateLeadInput = {
          firstName,
          lastName,
          name: rawName ?? `${firstName} ${lastName}`.trim(),
          email,
          ...(company ? { company } : {}),
          ...(phone ? { phone } : {}),
          status: 'new',
          source: derivedSource,
          ...(utmSource ? { utmSource } : {}),
          ...(utmMedium ? { utmMedium } : {}),
          ...(utmCampaign ? { utmCampaign } : {}),
          acquisitionMethod: 'form',
          tags: [`website-${widgetType}`],
          customFields: {
            ...(message ? { contactMessage: message } : {}),
            ...(pagePath ? { sourcePage: pagePath } : {}),
            ...(metadata?.utmTerm ? { utmTerm: metadata.utmTerm } : {}),
            ...(metadata?.utmContent ? { utmContent: metadata.utmContent } : {}),
            ...(metadata?.referrer ? { firstReferrer: metadata.referrer } : {}),
            ...(submissionId ? { websiteFormSubmissionId: submissionId } : {}),
          },
          updatedAt: new Date(),
        };

        const lead = await createLead(leadInput, { autoEnrich: false, useAdminSdk: true });
        leadId = lead.id;

        // Backfill the lead id onto the stored submission for traceability.
        if (submissionId) {
          await adminDb
            .collection(getSubCollection('websiteFormSubmissions'))
            .doc(submissionId)
            .update({ leadId });
        }
      } catch (leadErr) {
        // Never fail the visitor-facing submission if lead creation hiccups —
        // the raw submission is already saved. Log loudly for follow-up.
        logger.warn('Website form lead creation failed (submission still saved)', {
          widgetType,
          submissionId,
          error: leadErr instanceof Error ? leadErr.message : String(leadErr),
        });
      }
    }

    logger.info('Website form submitted', {
      widgetType,
      submissionId,
      leadId,
      savedToCRM: saveToCRM,
      source: derivedSource,
    });

    return NextResponse.json({ success: true, ...(leadId ? { leadId } : {}) });
  } catch (err) {
    logger.error(
      'Website form submission failed',
      err instanceof Error ? err : new Error(String(err))
    );
    return NextResponse.json(
      { error: 'Something went wrong submitting the form. Please try again.' },
      { status: 500 }
    );
  }
}
