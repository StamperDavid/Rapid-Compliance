import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getForm, updateForm } from '@/lib/forms/form-service';
import { adminDb } from '@/lib/firebase/admin';
import type { FormFieldConfig, FormDefinition } from '@/lib/forms/types';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { getFormsCollection } from '@/lib/firebase/collections';
import { deleteWithSubcollections } from '@/lib/firebase/cascading-delete';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ formId: string }>;
}

// Helper to ensure adminDb is available
function getDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin is not initialized');
  }
  return adminDb;
}

const UpdateFormBodySchema = z.object({
  form: z.record(z.unknown()).optional(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    order: z.number(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
    validation: z.record(z.unknown()).optional(),
    options: z.array(z.unknown()).optional(),
  })).optional(),
});

/**
 * GET /api/forms/[formId]
 * Get a single form with its fields
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { formId } = await context.params;

    // Get form
    const form = await getForm(formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Get fields using Admin SDK
    const firestore = getDb();
    const fieldsPath = `${getFormsCollection()}/${formId}/fields`;
    const fieldsSnapshot = await firestore.collection(fieldsPath).orderBy('order', 'asc').get();
    const fields = fieldsSnapshot.docs.map((docSnap) => docSnap.data() as FormFieldConfig);

    return NextResponse.json({ form, fields });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch form';
    logger.error('Failed to fetch form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/forms/[formId]
 * Update a form and its fields
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { formId } = await context.params;
    const rawBody: unknown = await request.json();
    const parseResult = UpdateFormBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { form: formUpdates, fields } = parseResult.data;

    // Update form
    if (formUpdates) {
      await updateForm(formId, formUpdates as Partial<FormDefinition>);
    }

    // Update fields if provided
    if (fields && Array.isArray(fields)) {
      const firestore = getDb();
      const fieldsPath = `${getFormsCollection()}/${formId}/fields`;
      const batch = firestore.batch();

      // Delete existing fields
      const existingSnapshot = await firestore.collection(fieldsPath).get();
      existingSnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      // Add new fields
      fields.forEach((field) => {
        const fieldRef = firestore.collection(fieldsPath).doc(field.id);
        batch.set(fieldRef, {
          ...field,
          formId,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      // Update field count on form
      await updateForm(formId, {
        fieldCount: fields.length,
      });
    }

    // Get updated form
    const updatedForm = await getForm(formId);

    return NextResponse.json({ form: updatedForm, success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update form';
    logger.error('Failed to update form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[formId]
 * Delete a form and all its related data
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { formId } = await context.params;

    // MAJ-14: Check for existing submissions before delete
    const firestore = getDb();
    const submissionsPath = `${getFormsCollection()}/${formId}/submissions`;
    const submissionsSnapshot = await firestore.collection(submissionsPath).get();
    if (!submissionsSnapshot.empty) {
      return NextResponse.json(
        { error: `Cannot delete form: ${submissionsSnapshot.size} submission(s) exist. Archive or delete them first.` },
        { status: 409 }
      );
    }

    // Cascade-delete: removes fields, analytics, and views subcollections,
    // then the parent form document. Uses Admin SDK (not client SDK).
    const formDocPath = `${getFormsCollection()}/${formId}`;
    const { deletedSubDocs } = await deleteWithSubcollections(formDocPath, [
      'fields',
      'analytics',
      'views',
    ]);

    logger.info('Form cascade-deleted', { formId, deletedSubDocs });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete form';
    logger.error('Failed to delete form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
