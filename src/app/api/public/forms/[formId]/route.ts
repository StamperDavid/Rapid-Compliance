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
import type {
  FormDefinition,
  FormFieldConfig,
  FormSubmission,
  FieldResponse,
} from '@/lib/forms/types';

// ============================================================================
// GET - Fetch Published Form
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
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
    console.error('Error fetching public form:', error);
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
    const { formId } = await params;
    const body = await request.json() as {
      responses: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };
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

    // Build field responses
    const fieldResponses: FieldResponse[] = Object.entries(responses).map(
      ([fieldName, value]) => {
        const field = fields.find((f) => f.name === fieldName);
        return {
          fieldId: field?.id ?? fieldName,
          fieldName,
          fieldType: field?.type ?? 'text',
          value,
          displayValue: String(value),
        };
      }
    );

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
      'workspaces',
      'default',
      'forms',
      formId
    );
    await updateDoc(formRefForSubmissionCount, {
      submissionCount: increment(1),
    });

    return NextResponse.json({
      success: true,
      submissionId: submissionDoc.id,
      confirmationNumber,
      confirmationMessage:
        form.settings.confirmationMessage ?? 'Thank you for your submission!',
      redirectUrl: form.settings.redirectUrl,
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    return NextResponse.json(
      { error: 'Failed to submit form' },
      { status: 500 }
    );
  }
}
