/**
 * Creative Studio — Characters
 * GET  /api/studio/characters — List characters
 * POST /api/studio/characters — Create a character
 *
 * Characters are stored in Firestore and represent reusable
 * identities (face, voice, outfit, style) for video and image generation.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { CreateCharacterSchema, type CharacterProfile } from '@/types/creative-studio';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const CHARACTERS_COLLECTION = getSubCollection('studio-characters');

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    // 2. Check Firestore
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    // 3. Query characters for this user
    const snapshot = await adminDb
      .collection(CHARACTERS_COLLECTION)
      .where('userId', '==', user.uid)
      .orderBy('updatedAt', 'desc')
      .get();

    const characters = snapshot.docs.map((doc) => doc.data() as CharacterProfile);

    logger.info('Studio characters GET: listed characters', {
      userId: user.uid,
      count: characters.length,
    });

    return NextResponse.json({
      success: true,
      data: characters,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio characters GET: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    // 2. Validate body
    const body: unknown = await request.json();
    const validated = CreateCharacterSchema.parse(body);

    // 3. Check Firestore
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    // 4. Create character document
    const docRef = adminDb.collection(CHARACTERS_COLLECTION).doc();
    const now = new Date().toISOString();

    const character: CharacterProfile & { userId: string } = {
      id: docRef.id,
      name: validated.name,
      slots: validated.slots,
      physicalDescription: validated.physicalDescription,
      voiceId: validated.voiceId,
      style: validated.style,
      hedraAvatarId: validated.hedraAvatarId,
      tags: validated.tags,
      userId: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(character);

    logger.info('Studio characters POST: created character', {
      characterId: docRef.id,
      userId: user.uid,
      name: validated.name,
    });

    return NextResponse.json({
      success: true,
      data: character,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio characters POST: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
