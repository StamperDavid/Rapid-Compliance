/**
 * Public Form API
 *
 * Public endpoint for fetching published forms and submitting responses.
 * No authentication required for public forms.
 *
 * @route GET /api/public/forms/[formId] - Fetch form for rendering
 * @route POST /api/public/forms/[formId] - Submit form response
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { db } from '@/lib/firebase/config';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { z } from 'zod';
import type {
  FormDefinition,
  FormFieldConfig,
  FormSubmission,
  FieldResponse,
} from '@/lib/forms/types';

/**
 * Sanitize a string value to prevent stored XSS.
 * Encodes HTML special characters so they render as text, not markup.
 */
function sanitizeString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Recursively sanitize a form field value.
 */
function sanitizeFormValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeFormValue);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  // Reject objects/complex types — form fields should be primitives or arrays
  return String(value);
}

const formSubmissionSchema = z.object({
  responses: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  captchaToken: z.string().optional(),
  _honeypot: z.string().optional(),
  _loadedAt: z.number().optional(),
});

// ============================================================================
// GET - Fetch Published Form
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    // Rate limiting to prevent scraping and DoS
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/public/forms/get');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { formId } = await params;

    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    let form: FormDefinition | null = null;
    let fields: FormFieldConfig[] = [];

    const formRef = doc(
      db,
      'organizations',
      PLATFORM_ID,
      'workspaces',
      'default',
      'forms',
      formId
    );
    const formSnap = await getDoc(formRef);

    if (formSnap.exists()) {
      form = { id: formSnap.id, ...formSnap.data() } as FormDefinition;

      // Fetch fields
      const fieldsRef = collection(
        db,
        'organizations',
        PLATFORM_ID,
        'workspaces',
        'default',
        'forms',
        formId,
        'fields'
      );
      const fieldsQuery = query(fieldsRef, orderBy('pageIndex'), orderBy('order'));
      const fieldsSnap = await getDocs(fieldsQuery);
      fields = fieldsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FormFieldConfig[];
    }

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check if form is published and public
    if (form.status !== 'published') {
      return NextResponse.json(
        { error: 'This form is not published' },
        { status: 403 }
      );
    }

    if (!form.publicAccess) {
      return NextResponse.json(
        { error: 'This form is not publicly accessible' },
        { status: 403 }
      );
    }

    // Increment view count
    const formRefForUpdate = doc(
      db,
      'organizations',
      PLATFORM_ID,
      'workspaces',
      'default',
      'forms',
      formId
    );
    await updateDoc(formRefForUpdate, {
      viewCount: increment(1),
    });

    // Return public form data (exclude sensitive settings)
    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        pages: form.pages,
        settings: {
          submitButtonText: form.settings.submitButtonText,
          showProgressBar: form.settings.showProgressBar,
          showPageNumbers: form.settings.showPageNumbers,
          confirmationType: form.settings.confirmationType,
          confirmationMessage: form.settings.confirmationMessage,
          redirectUrl: form.settings.redirectUrl,
          showBranding: form.settings.showBranding,
          enableCaptcha: form.settings.enableCaptcha,
          metaTitle: form.settings.metaTitle,
          metaDescription: form.settings.metaDescription,
        },
        behavior: {
          showThankYouPage: form.behavior.showThankYouPage,
          thankYouMessage: form.behavior.thankYouMessage,
        },
      },
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        name: f.name,
        placeholder: f.placeholder,
        helpText: f.helpText,
        defaultValue: f.defaultValue,
        order: f.order,
        pageIndex: f.pageIndex,
        width: f.width,
        options: f.options,
        validation: f.validation,
        conditionalLogic: f.conditionalLogic,
      })),
    });
  } catch (error) {
    logger.error('Error fetching public form', error instanceof Error ? error : new Error(String(error)), { file: 'public/forms/[formId]/route.ts' });
    return NextResponse.json(
      { error: 'Failed to fetch form' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Submit Form Response
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    // Rate limiting for spam prevention
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/public/forms/submit');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { formId } = await params;
    const rawBody: unknown = await request.json();
    const parseResult = formSubmissionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid submission data', details: parseResult.error.errors },
        { status: 400 }
      );
    }
    const body = parseResult.data;

    // Spam prevention: honeypot field check
    if (body._honeypot) {
      logger.warn('Form submission blocked: honeypot triggered', { formId });
      // Return success to not alert the bot
      return NextResponse.json({ success: true, submissionId: 'ok' });
    }

    // Spam prevention: timing check (form loaded < 2s ago = likely bot)
    if (body._loadedAt && (Date.now() - body._loadedAt) < 2000) {
      logger.warn('Form submission blocked: too fast', { formId });
      return NextResponse.json({ success: true, submissionId: 'ok' });
    }

    const { responses, metadata } = body;

    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    let form: FormDefinition | null = null;
    let fields: FormFieldConfig[] = [];

    const formRef = doc(
      db,
      'organizations',
      PLATFORM_ID,
      'workspaces',
      'default',
      'forms',
      formId
    );
    const formSnap = await getDoc(formRef);

    if (formSnap.exists()) {
      form = { id: formSnap.id, ...formSnap.data() } as FormDefinition;

      // Fetch fields for validation
      const fieldsRef = collection(
        db,
        'organizations',
        PLATFORM_ID,
        'workspaces',
        'default',
        'forms',
        formId,
        'fields'
      );
      const fieldsSnap = await getDocs(fieldsRef);
      fields = fieldsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FormFieldConfig[];
    }

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (form.status !== 'published' || !form.publicAccess) {
      return NextResponse.json(
        { error: 'Form is not accepting submissions' },
        { status: 403 }
      );
    }

    // CAPTCHA verification when enabled
    if (form.settings.enableCaptcha) {
      const captchaToken = body.captchaToken;
      if (!captchaToken) {
        return NextResponse.json(
          { error: 'CAPTCHA verification required' },
          { status: 400 }
        );
      }

      const captchaSecret = process.env.RECAPTCHA_SECRET_KEY;
      if (captchaSecret) {
        try {
          const captchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${captchaSecret}&response=${captchaToken}`,
          });
          const captchaResult = await captchaResponse.json() as { success: boolean; score?: number };
          if (!captchaResult.success || (captchaResult.score !== undefined && captchaResult.score < 0.5)) {
            return NextResponse.json(
              { error: 'CAPTCHA verification failed' },
              { status: 400 }
            );
          }
        } catch (captchaError) {
          logger.warn('CAPTCHA verification request failed', {
            formId,
            error: captchaError instanceof Error ? captchaError.message : String(captchaError),
          });
          // Fail open only if the verification service itself is down
        }
      } else {
        logger.warn('CAPTCHA enabled but RECAPTCHA_SECRET_KEY not configured', { formId });
      }
    }

    // Validate required fields
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.validation?.required && !responses[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    // Build field responses with XSS sanitization
    const fieldResponses: FieldResponse[] = Object.entries(responses)
      .filter(([fieldName]) => {
        // Only accept responses for known fields to prevent injection of arbitrary data
        return fields.some((f) => f.name === fieldName);
      })
      .map(([fieldName, value]) => {
        const field = fields.find((f) => f.name === fieldName);
        const sanitizedValue = sanitizeFormValue(value);
        return {
          fieldId: field?.id ?? fieldName,
          fieldName,
          fieldType: field?.type ?? 'text',
          value: sanitizedValue,
          displayValue: String(sanitizedValue),
        };
      });

    // Generate confirmation number
    const confirmationNumber = `SUB-${Date.now().toString(36).toUpperCase()}`;

    // Create submission
    const submission: Omit<FormSubmission, 'id'> = {
      formId,
      formVersion: form.version,
      workspaceId: 'default',
      status: 'completed',
      responses: fieldResponses,
      confirmationNumber,
      isPartial: false,
      metadata: {
        sessionId: metadata?.sessionId as string | undefined,
        ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? 'unknown',
        source: (metadata?.source as string | undefined) ?? 'direct',
        referrer: request.headers.get('referer') ?? undefined,
        utmSource: metadata?.utmSource as string | undefined,
        utmMedium: metadata?.utmMedium as string | undefined,
        utmCampaign: metadata?.utmCampaign as string | undefined,
      },
      submittedAt: serverTimestamp() as FormSubmission['submittedAt'],
    };

    // Save submission
    const submissionsRef = collection(
      db,
      'organizations',
      PLATFORM_ID,
      'workspaces',
      'default',
      'forms',
      formId,
      'submissions'
    );
    const submissionDoc = await addDoc(submissionsRef, submission);

    // Update form submission count
    const formRefForSubmissionCount = doc(
      db,
      'organizations',
      PLATFORM_ID,
      'workspaces',
      'default',
      'forms',
      formId
    );
    await updateDoc(formRefForSubmissionCount, {
      submissionCount: increment(1),
    });

    // Attribution: Auto-create lead from form submission if email is present
    const emailField = fieldResponses.find(
      (r) => r.fieldType === 'email' || r.fieldName === 'email'
    );
    if (emailField?.value && typeof emailField.value === 'string') {
      try {
        const { createLead } = await import('@/lib/crm/lead-service');
        const firstNameField = fieldResponses.find(
          (r) => r.fieldName === 'firstName' || r.fieldName === 'first_name' || r.fieldName === 'name'
        );
        const lastNameField = fieldResponses.find(
          (r) => r.fieldName === 'lastName' || r.fieldName === 'last_name'
        );
        const companyField = fieldResponses.find(
          (r) => r.fieldName === 'company' || r.fieldName === 'companyName'
        );
        const phoneField = fieldResponses.find(
          (r) => r.fieldType === 'phone' || r.fieldName === 'phone'
        );

        const utmSource = (metadata?.utmSource as string | undefined) ?? undefined;
        const utmMedium = (metadata?.utmMedium as string | undefined) ?? undefined;
        const utmCampaign = (metadata?.utmCampaign as string | undefined) ?? undefined;
        const sourceValue = utmSource
          ? `${utmSource}${utmMedium ? `/${utmMedium}` : ''}`
          : (metadata?.source as string | undefined) ?? 'form';

        await createLead(
          {
            firstName: (firstNameField?.value as string) ?? 'Unknown',
            lastName: (lastNameField?.value as string) ?? '',
            email: emailField.value,
            phone: (phoneField?.value as string) ?? undefined,
            company: (companyField?.value as string) ?? undefined,
            status: 'new',
            source: sourceValue,
            formId,
            formSubmissionId: submissionDoc.id,
            utmSource,
            utmMedium,
            utmCampaign,
          },
          'default',
          { autoEnrich: true }
        );
        logger.info('Lead auto-created from form submission', {
          formId,
          submissionId: submissionDoc.id,
          source: sourceValue,
        });
      } catch (leadError) {
        // Don't fail form submission if lead creation fails
        logger.warn('Failed to auto-create lead from form submission', {
          formId,
          error: leadError instanceof Error ? leadError.message : String(leadError),
        });
      }
    }

    return NextResponse.json({
      success: true,
      submissionId: submissionDoc.id,
      confirmationNumber,
      confirmationMessage:
        form.settings.confirmationMessage ?? 'Thank you for your submission!',
      redirectUrl: form.settings.redirectUrl,
    });
  } catch (error) {
    logger.error('Error submitting form', error instanceof Error ? error : new Error(String(error)), { file: 'public/forms/[formId]/route.ts' });
    return NextResponse.json(
      { error: 'Failed to submit form' },
      { status: 500 }
    );
  }
}
