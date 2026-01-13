import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
import type { FormFieldConfig } from '@/lib/forms/types';

// Helper to ensure db is available
function getDb() {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  return db;
}

/**
 * GET /api/workspace/[orgId]/forms/[formId]
 * Get a single form with its fields
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string; formId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = workspaceIdParam || 'default';

    // Get form
    const form = await getForm(params.orgId, workspaceId, params.formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Get fields
    const firestore = getDb();
    const fieldsPath = `organizations/${params.orgId}/workspaces/${workspaceId}/forms/${params.formId}/fields`;
    const fieldsRef = collection(firestore, fieldsPath);
    const fieldsQuery = query(fieldsRef, orderBy('order', 'asc'));
    const fieldsSnapshot = await getDocs(fieldsQuery);
    const fields = fieldsSnapshot.docs.map((doc) => doc.data() as FormFieldConfig);

    return NextResponse.json({ form, fields });
  } catch (error: unknown) {
    console.error('Failed to fetch form:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch form';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/workspace/[orgId]/forms/[formId]
 * Update a form and its fields
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { orgId: string; formId: string } }
) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'default';
    const { form: formUpdates, fields } = body;

    // Update form
    if (formUpdates) {
      await updateForm(params.orgId, workspaceId, params.formId, formUpdates);
    }

    // Update fields if provided
    if (fields && Array.isArray(fields)) {
      const firestore = getDb();
      const fieldsPath = `organizations/${params.orgId}/workspaces/${workspaceId}/forms/${params.formId}/fields`;
      const batch = writeBatch(firestore);

      // Delete existing fields
      const existingFieldsRef = collection(firestore, fieldsPath);
      const existingSnapshot = await getDocs(existingFieldsRef);
      existingSnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      // Add new fields
      fields.forEach((field: FormFieldConfig) => {
        const fieldRef = doc(firestore, fieldsPath, field.id);
        batch.set(fieldRef, {
          ...field,
          formId: params.formId,
          organizationId: params.orgId,
          workspaceId,
          updatedAt: new Date(),
        });
      });

      await batch.commit();

      // Update field count on form
      await updateForm(params.orgId, workspaceId, params.formId, {
        fieldCount: fields.length,
      });
    }

    // Get updated form
    const updatedForm = await getForm(params.orgId, workspaceId, params.formId);

    return NextResponse.json({ form: updatedForm, success: true });
  } catch (error: unknown) {
    console.error('Failed to update form:', error);
    const message = error instanceof Error ? error.message : 'Failed to update form';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/workspace/[orgId]/forms/[formId]
 * Delete a form and all its related data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string; formId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = workspaceIdParam || 'default';

    await deleteForm(params.orgId, workspaceId, params.formId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to delete form:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete form';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
