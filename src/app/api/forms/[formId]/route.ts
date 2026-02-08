import { type NextRequest, NextResponse } from 'next/server';
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
import { PLATFORM_ID } from '@/lib/constants/platform';

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
  workspaceId: z.string().optional(),
  form: z.record(z.unknown()).optional(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    order: z.number(),
  }).passthrough()).optional(),
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
    const { formId } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = workspaceIdParam ?? 'default';

    // Get form
    const form = await getForm(workspaceId, formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Get fields
    const firestore = getDb();
    const fieldsPath = `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/forms/${formId}/fields`;
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
    const { formId } = await context.params;
    const rawBody: unknown = await request.json();
    const parseResult = UpdateFormBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { workspaceId: workspaceIdInput, form: formUpdates, fields } = parseResult.data;
    const workspaceId = workspaceIdInput ?? 'default';

    // Update form
    if (formUpdates) {
      await updateForm(workspaceId, formId, formUpdates as Partial<FormDefinition>);
    }

    // Update fields if provided
    if (fields && Array.isArray(fields)) {
      const firestore = getDb();
      const fieldsPath = `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/forms/${formId}/fields`;
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
          workspaceId,
          updatedAt: new Date(),
        });
      });

      await batch.commit();

      // Update field count on form
      await updateForm(workspaceId, formId, {
        fieldCount: fields.length,
      });
    }

    // Get updated form
    const updatedForm = await getForm(workspaceId, formId);

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
    const { formId } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = workspaceIdParam ?? 'default';

    await deleteForm(workspaceId, formId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete form';
    logger.error('Failed to delete form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
