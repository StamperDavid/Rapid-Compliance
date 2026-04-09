/**
 * Voice Collections API
 * GET  /api/audio/voice-collections — List all voice collections
 * POST /api/audio/voice-collections — Create a new voice collection
 * PUT  /api/audio/voice-collections — Update a voice collection (add/remove voices, rename)
 * DELETE /api/audio/voice-collections — Delete a voice collection
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const COLLECTION_PATH = getSubCollection('voice_collections');

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  voiceIds: z.array(z.string()).optional().default([]),
});

const UpdateCollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  voiceIds: z.array(z.string()).optional(),
});

const DeleteCollectionSchema = z.object({
  id: z.string().min(1),
});

// ─── GET: List all collections ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: true, collections: [] });
    }

    const snapshot = await adminDb
      .collection(COLLECTION_PATH)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const collections = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        description: (data.description as string) || '',
        voiceIds: (data.voiceIds as string[]) || [],
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null,
        updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, collections });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list voice collections', error instanceof Error ? error : new Error(msg), {
      file: 'audio/voice-collections/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── POST: Create a new collection ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const parsed = CreateCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const now = new Date();
    const docRef = await adminDb
      .collection(COLLECTION_PATH)
      .add({
        name: parsed.data.name,
        description: parsed.data.description,
        voiceIds: parsed.data.voiceIds,
        createdBy: authResult.user.uid,
        createdAt: now,
        updatedAt: now,
      });

    logger.info('Voice collection created', {
      id: docRef.id,
      name: parsed.data.name,
      voiceCount: parsed.data.voiceIds.length,
      file: 'audio/voice-collections/route.ts',
    });

    return NextResponse.json({
      success: true,
      collection: {
        id: docRef.id,
        name: parsed.data.name,
        description: parsed.data.description,
        voiceIds: parsed.data.voiceIds,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create voice collection', error instanceof Error ? error : new Error(msg), {
      file: 'audio/voice-collections/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── PUT: Update an existing collection ─────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { id, ...updates } = parsed.data;
    const docRef = adminDb.collection(COLLECTION_PATH).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) { updateData.name = updates.name; }
    if (updates.description !== undefined) { updateData.description = updates.description; }
    if (updates.voiceIds !== undefined) { updateData.voiceIds = updates.voiceIds; }

    await docRef.update(updateData);

    logger.info('Voice collection updated', {
      id,
      updates: Object.keys(updateData),
      file: 'audio/voice-collections/route.ts',
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update voice collection', error instanceof Error ? error : new Error(msg), {
      file: 'audio/voice-collections/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── DELETE: Remove a collection ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const parsed = DeleteCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const docRef = adminDb.collection(COLLECTION_PATH).doc(parsed.data.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Collection not found' },
        { status: 404 },
      );
    }

    await docRef.delete();

    logger.info('Voice collection deleted', {
      id: parsed.data.id,
      file: 'audio/voice-collections/route.ts',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete voice collection', error instanceof Error ? error : new Error(msg), {
      file: 'audio/voice-collections/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
