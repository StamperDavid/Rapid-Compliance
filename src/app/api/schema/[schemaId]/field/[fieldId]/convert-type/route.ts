/**
 * Field Type Conversion API - SERVER SIDE (Admin SDK Only)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldTypeConverterServer } from '@/lib/schema/server/field-type-converter-server';
import type { FieldType, SchemaField } from '@/types/schema';

export const dynamic = 'force-dynamic';

interface ConversionRequestBody {
  fieldKey: string;
  oldType: FieldType;
  newType: FieldType;
}

interface SchemaData {
  name: string;
  fields: SchemaField[];
  [key: string]: unknown;
}

/**
 * GET /api/schema/[schemaId]/field/[fieldId]/convert-type
 * Generate type conversion preview
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string; fieldId: string }> }
) {
  try {
    const params = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const oldType = searchParams.get('oldType') as FieldType;
    const newType = searchParams.get('newType') as FieldType;
    const fieldKey = searchParams.get('fieldKey');

    if (!oldType || !newType || !fieldKey) {
      return NextResponse.json(
        { error: 'oldType, newType, and fieldKey are required' },
        { status: 400 }
      );
    }

    // Check if safe conversion
    const isSafe = FieldTypeConverterServer.isSafeConversion(oldType, newType);

    // Generate preview using SERVER version (admin SDK)
    const preview = await FieldTypeConverterServer.generateConversionPreview(
      params.schemaId,
      fieldKey,
      oldType,
      newType,
      10 // sample size
    );
    
    return NextResponse.json({
      success: true,
      isSafe,
      preview: preview.preview,
      totalRecords: preview.totalRecords,
      estimatedSuccess: preview.estimatedSuccess,
      estimatedFailures: preview.estimatedFailures,
      successRate: preview.totalRecords > 0
        ? Math.round((preview.estimatedSuccess / preview.totalRecords) * 100)
        : 0,
    });
    
  } catch (error: unknown) {
    logger.error('[Type Conversion API] GET failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to generate conversion preview' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schema/[schemaId]/field/[fieldId]/convert-type
 * Execute field type conversion on all records
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string; fieldId: string }> }
) {
  try {
    const params = await context.params;
    const body = (await request.json()) as ConversionRequestBody;
    const { fieldKey, oldType, newType } = body;

    // Validate required fields
    if (!fieldKey || !oldType || !newType) {
      return NextResponse.json(
        { error: 'Missing required fields: fieldKey, oldType, newType' },
        { status: 400 }
      );
    }

    if (!adminDal) {
      return NextResponse.json(
        { error: 'Admin DAL not initialized' },
        { status: 500 }
      );
    }

    logger.info('[Type Conversion] Starting conversion', {
      schemaId: params.schemaId,
      fieldId: params.fieldId,
      fieldKey,
      oldType,
      newType,
      file: 'route.ts'
    });

    // Import admin SDK and helpers
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getOrgSubCollection } = await import('@/lib/firebase/collections');
    const db = getFirestore();

    // Get schema to get schema name (using environment-aware paths)
    const schemasPath = getOrgSubCollection('schemas');
    const schemaRef = db.collection(schemasPath).doc(params.schemaId);

    const schemaDoc = await schemaRef.get();

    if (!schemaDoc.exists) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      );
    }

    const schemaData = schemaDoc.data() as SchemaData | undefined;
    const schemaName = schemaData?.name;

    if (!schemaName) {
      return NextResponse.json(
        { error: 'Schema name not found' },
        { status: 400 }
      );
    }

    // Get all records (using environment-aware paths for entities)
    const entitiesPath = getOrgSubCollection('entities');
    const recordsPath = adminDal.getSubColPath('records');
    const recordsRef = db.collection(`${entitiesPath}/${schemaName}/${recordsPath}`);
    
    const snapshot = await recordsRef.get();
    
    logger.info('[Type Conversion] Found records to convert', {
      totalRecords: snapshot.size,
      file: 'route.ts'
    });
    
    // Process records in batches (Firestore limit: 500 operations per batch)
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;
    const failedRecords: { id: string; error: string }[] = [];
    
    // Split records into batches
    const allDocs = snapshot.docs;
    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      const batchDocs = allDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      
      for (const doc of batchDocs) {
        const data = doc.data() as Record<string, unknown>;
        const oldValue = data[fieldKey];
        const conversion = FieldTypeConverterServer.convertValue(oldValue, oldType, newType);
        
        if (conversion.success) {
          // conversion.value is any from external library, safely assign it
          const updateData: Record<string, unknown> = { [fieldKey]: conversion.value };
          batch.update(doc.ref, updateData);
          successCount++;
        } else {
          failureCount++;
          failedRecords.push({
            id: doc.id,
            error:(conversion.message !== '' && conversion.message != null) ? conversion.message : 'Conversion failed'
          });
        }
      }
      
      // Commit batch
      await batch.commit();
      
      logger.info('[Type Conversion] Batch committed', {
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        batchSize: batchDocs.length,
        file: 'route.ts'
      });
    }
    
    // Update field type in schema metadata
    const updatedFields = schemaData?.fields.map((f: SchemaField) =>
      f.id === params.fieldId ? { ...f, type: newType } : f
    );
    
    await schemaRef.update({ 
      fields: updatedFields,
      updatedAt: new Date().toISOString()
    });
    
    logger.info('[Type Conversion] Conversion complete', {
      successCount,
      failureCount,
      totalRecords: snapshot.size,
      file: 'route.ts'
    });
    
    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      totalRecords: snapshot.size,
      failedRecords: failedRecords.slice(0, 10), // Return first 10 failures
    });
    
  } catch (error: unknown) {
    logger.error('[Type Conversion] Execution failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      {
        error: 'Conversion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
