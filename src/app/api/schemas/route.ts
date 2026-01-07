/**
 * Schema CRUD API - list/create schemas (server-side, admin SDK)
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildSchemaId(name: string) {
  const slug = slugify(name);
  return slug || `schema_${Date.now()}`;
}

function buildFieldId(key: string) {
  const slug = slugify(key || '');
  return slug ? `field_${slug}` : `field_${Date.now()}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId');

    if (!organizationId || !workspaceId) {
      return NextResponse.json(
        { error: 'organizationId and workspaceId are required' },
        { status: 400 }
      );
    }

    if (!adminDal) {
      return NextResponse.json(
        { error: 'Admin DAL not initialized' },
        { status: 500 }
      );
    }

    const dal = adminDal; // Type narrowing for callback
    const snapshot = await dal.safeQuery('ORGANIZATIONS', (ref) => {
      return dal.getWorkspaceCollection(organizationId, workspaceId, 'schemas')
        .where('status', '==', 'active');
    });

    const schemas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, schemas });
  } catch (error: any) {
    logger.error('[Schemas API][GET] Failed to list schemas', error, { route: '/api/schemas' });
    return NextResponse.json(
      { error: 'Failed to fetch schemas', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { organizationId, workspaceId, schema, userId } = body ?? {};

    if (!organizationId || !workspaceId || !schema?.name) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, and schema.name are required' },
        { status: 400 }
      );
    }

    const now = FieldValue.serverTimestamp();
    const schemaId = schema.id || buildSchemaId(schema.name);

    const fields = (schema.fields ?? []).map((field: any) => ({
      id: field.id || buildFieldId(field.key || field.label || 'field'),
      key: field.key || slugify(field.label || 'field'),
      label: field.label || field.key || 'Field',
      type: field.type || 'text',
      required: !!field.required,
      createdAt: now,
      updatedAt: now,
    }));

    const primaryFieldId = fields[0]?.id || 'field_name';

    const newSchema = {
      id: schemaId,
      organizationId,
      workspaceId,
      name: schema.name,
      pluralName: schema.pluralName || `${schema.name}s`,
      singularName: schema.singularName || schema.name,
      description: schema.description || '',
      icon: schema.icon || '📋',
      color: schema.color || '#3B82F6',
      fields: fields.length
        ? fields
        : [
            {
              id: 'field_name',
              key: 'name',
              label: 'Name',
              type: 'text',
              required: true,
              createdAt: now,
              updatedAt: now,
            },
          ],
      primaryFieldId,
      relations: [],
      permissions: schema.permissions || {
        create: ['admin', 'editor'],
        read: ['admin', 'editor', 'viewer'],
        update: ['admin', 'editor'],
        delete: ['admin'],
      },
      settings: schema.settings || {
        allowAttachments: true,
        allowComments: true,
        allowActivityLog: true,
        enableVersioning: false,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId || 'system',
      status: 'active',
      version: 1,
    };

    const schemasCollection = adminDal.getWorkspaceCollection(organizationId, workspaceId, 'schemas');
    await schemasCollection.doc(schemaId).set(newSchema);

    // Initialize entity collection metadata
    const entitiesCollection = adminDal.getWorkspaceCollection(organizationId, workspaceId, 'entities');
    const metadataRef = entitiesCollection.doc(schemaId).collection('_metadata').doc('info');

    await metadataRef.set({
      schemaId,
      createdAt: now,
      recordCount: 0,
    });

    return NextResponse.json({ success: true, schema: newSchema });
  } catch (error: any) {
    logger.error('[Schemas API][POST] Failed to create schema', error, { route: '/api/schemas' });
    return NextResponse.json(
      { error: 'Failed to create schema', details: error.message },
      { status: 500 }
    );
  }
}


