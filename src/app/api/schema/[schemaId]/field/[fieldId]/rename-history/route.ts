/**
 * Field Rename History API
 * Get rename history and rollback fields
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { FieldRenameManager } from '@/lib/schema/field-rename-manager';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { SchemaField } from '@/types/schema';
import { getSchemasCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

interface SchemaData {
  fields?: SchemaField[];
  [key: string]: unknown;
}

const PostRollbackSchema = z.object({
  toVersion: z.number().int().nonnegative(),
  userId: z.string().min(1),
});

/**
 * GET /api/schema/[schemaId]/field/[fieldId]/rename-history
 * Get rename history for a field
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string; fieldId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const params = await context.params;

    // Get schema
    const schemaRef = adminDal.getNestedDocRef(
      `${getSchemasCollection()}/{schemaId}`,
      { schemaId: params.schemaId }
    );
    const schemaDoc = await schemaRef.get();
    
    if (!schemaDoc.exists) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      );
    }
    
    const schema = schemaDoc.data() as SchemaData | undefined;

    // Find field
    const field = schema?.fields?.find((f: SchemaField) => f.id === params.fieldId);

    if (!field) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    // Get rename history
    const history = FieldRenameManager.getRenameHistory(field);
    const timeline = FieldRenameManager.getRenameTimeline(field);
    const aliases = FieldRenameManager.getAllAliases(field);

    return NextResponse.json({
      success: true,
      field: {
        id: field.id,
        currentKey: field.key,
        currentLabel: field.label,
      },
      history,
      timeline,
      aliases,
    });
    
  } catch (error: unknown) {
    logger.error('[Rename History API] GET failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to get rename history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schema/[schemaId]/field/[fieldId]/rename-history
 * Rollback field to previous name
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string; fieldId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const params = await context.params;
    const rawBody: unknown = await request.json();
    const parsed = PostRollbackSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { toVersion, userId } = parsed.data;

    // Rollback field
    await FieldRenameManager.rollbackField(
      params.schemaId,
      params.fieldId,
      toVersion,
      userId
    );
    
    return NextResponse.json({
      success: true,
      message: `Field rolled back to version ${toVersion}`,
    });
    
  } catch (error: unknown) {
    logger.error('[Rename History API] POST failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to rollback field' },
      { status: 500 }
    );
  }
}

