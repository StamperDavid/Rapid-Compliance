import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getForm, updateForm, deleteForm } from '@/lib/forms/form-service';
import {
  collection,
  getDocs,
  query,
  orderBy,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { FormFieldConfig, FormDefinition } from '@/lib/forms/types';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ formId: string }>;
}

// Helper to ensure db is available
function getDb() {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  return db;
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

    // Get fields
    const firestore = getDb();
    const fieldsPath = `${getSubCollection('workspaces')}/default/forms/${formId}/fields`;
    const fieldsRef = collection(firestore, fieldsPath);
    const fieldsQuery = query(fieldsRef, orderBy('order', 'asc'));
    const fieldsSnapshot = await getDocs(fieldsQuery);
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
      const fieldsPath = `${getSubCollection('workspaces')}/default/forms/${formId}/fields`;
      const batch = writeBatch(firestore);

      // Delete existing fields
      const existingFieldsRef = collection(firestore, fieldsPath);
      const existingSnapshot = await getDocs(existingFieldsRef);
      existingSnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      // Add new fields
      fields.forEach((field) => {
        const fieldRef = doc(firestore, fieldsPath, field.id);
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
    const submissionsPath = `${getSubCollection('workspaces')}/default/forms/${formId}/submissions`;
    const submissionsRef = collection(firestore, submissionsPath);
    const submissionsSnapshot = await getDocs(submissionsRef);
    if (!submissionsSnapshot.empty) {
      return NextResponse.json(
        { error: `Cannot delete form: ${submissionsSnapshot.size} submission(s) exist. Archive or delete them first.` },
        { status: 409 }
      );
    }

    await deleteForm(formId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete form';
    logger.error('Failed to delete form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
