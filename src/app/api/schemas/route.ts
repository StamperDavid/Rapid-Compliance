/**
 * Schema CRUD API - list/create schemas (server-side, admin SDK)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// Type Interfaces
interface SchemaField {
  id?: string;
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  createdAt?: FirebaseFirestore.FieldValue;
  updatedAt?: FirebaseFirestore.FieldValue;
}

interface SchemaPermissions {
  create: string[];
  read: string[];
  update: string[];
  delete: string[];
}

interface SchemaSettings {
  allowAttachments: boolean;
  allowComments: boolean;
  allowActivityLog: boolean;
  enableVersioning: boolean;
}

const SchemaFieldInputSchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  type: z.string().optional(),
  required: z.boolean().optional(),
});

const SchemaPermissionsInputSchema = z.object({
  create: z.array(z.string()),
  read: z.array(z.string()),
  update: z.array(z.string()),
  delete: z.array(z.string()),
});

const SchemaSettingsInputSchema = z.object({
  allowAttachments: z.boolean(),
  allowComments: z.boolean(),
  allowActivityLog: z.boolean(),
  enableVersioning: z.boolean(),
});

const PostSchemasSchema = z.object({
  schema: z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    pluralName: z.string().optional(),
    singularName: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    fields: z.array(SchemaFieldInputSchema).optional(),
    permissions: SchemaPermissionsInputSchema.optional(),
    settings: SchemaSettingsInputSchema.optional(),
  }),
  userId: z.string().optional(),
});

interface ProcessedSchemaField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
}

interface NewSchema {
  id: string;
  name: string;
  pluralName: string;
  singularName: string;
  description: string;
  icon: string;
  color: string;
  fields: ProcessedSchemaField[];
  primaryFieldId: string;
  relations: unknown[];
  permissions: SchemaPermissions;
  settings: SchemaSettings;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  createdBy: string;
  status: string;
  version: number;
}

interface ErrorWithMessage {
  message: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'An unknown error occurred';
}

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

    const dal = adminDal; // Type narrowing for callback
    const snapshot = await dal.safeQuery('ORGANIZATIONS', (_ref) => {
      return dal.getPlatformCollection('schemas')
        .where('status', '==', 'active');
    });

    const schemas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, schemas });
  } catch (error: unknown) {
    logger.error('[Schemas API][GET] Failed to list schemas', error instanceof Error ? error : new Error(String(error)), { route: '/api/schemas' });
    return NextResponse.json(
      { error: 'Failed to fetch schemas', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const rawBody: unknown = await request.json();
    const parsedBody = PostSchemasSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsedBody.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { schema, userId } = parsedBody.data;

    const now = FieldValue.serverTimestamp();
    const schemaId: string = schema.id ?? buildSchemaId(schema.name);

    const fields: ProcessedSchemaField[] = (schema.fields ?? []).map((field: SchemaField): ProcessedSchemaField => ({
      id: field.id ?? buildFieldId((field.key ?? field.label ?? 'field')),
      key: field.key ?? slugify((field.label ?? 'field')),
      label: (field.label ?? field.key ?? 'Field'),
      type: (field.type ?? 'text'),
      required: !!field.required,
      createdAt: now,
      updatedAt: now,
    }));

    const firstFieldId: string | undefined = fields[0]?.id;
    const primaryFieldId: string = (firstFieldId !== '' && firstFieldId != null) ? firstFieldId : 'field_name';

    const newSchema: NewSchema = {
      id: schemaId,
      name: schema.name,
      pluralName: (schema.pluralName !== '' && schema.pluralName != null) ? schema.pluralName : `${schema.name}s`,
      singularName: schema.singularName ?? schema.name,
      description: schema.description ?? '',
      icon: (schema.icon !== '' && schema.icon != null) ? schema.icon : '📋',
      color: (schema.color !== '' && schema.color != null) ? schema.color : '#3B82F6',
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
      permissions: schema.permissions ?? {
        create: ['admin', 'editor'],
        read: ['admin', 'editor', 'viewer'],
        update: ['admin', 'editor'],
        delete: ['admin'],
      },
      settings: schema.settings ?? {
        allowAttachments: true,
        allowComments: true,
        allowActivityLog: true,
        enableVersioning: false,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: (userId !== '' && userId != null) ? userId : 'system',
      status: 'active',
      version: 1,
    };

    const schemasCollection = adminDal.getPlatformCollection('schemas');
    await schemasCollection.doc(schemaId).set(newSchema);

    // Initialize entity collection metadata
    const entitiesCollection = adminDal.getPlatformCollection('entities');
    const metadataRef = entitiesCollection.doc(schemaId).collection('_metadata').doc('info');

    await metadataRef.set({
      schemaId,
      createdAt: now,
      recordCount: 0,
    });

    return NextResponse.json({ success: true, schema: newSchema });
  } catch (error: unknown) {
    logger.error('[Schemas API][POST] Failed to create schema', error instanceof Error ? error : new Error(String(error)), { route: '/api/schemas' });
    return NextResponse.json(
      { error: 'Failed to create schema', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
