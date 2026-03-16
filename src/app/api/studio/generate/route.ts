/**
 * Creative Studio — Generate
 * POST /api/studio/generate — Submit a generation request (image or video)
 *
 * This is the main endpoint for the Creative Studio. It validates input,
 * assembles a cinematic prompt from presets, dispatches to the appropriate
 * provider via the provider-router, records cost, and persists the
 * StudioGeneration document in Firestore.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { GenerationRequestSchema, type StudioGeneration } from '@/types/creative-studio';
import { routeGeneration } from '@/lib/ai/provider-router';
import { logGenerationCost } from '@/lib/ai/cost-tracker';
import { buildPromptFromPresets } from '@/lib/ai/cinematic-presets';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const GENERATIONS_COLLECTION = getSubCollection('studio-generations');

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    // 2. Validate body
    const body: unknown = await request.json();
    const validated = GenerationRequestSchema.parse(body);

    // 3. Build assembled prompt from presets
    const assembledPrompt = buildPromptFromPresets(validated.prompt, validated.presets);

    // 4. Resolve provider + model (routeGeneration does this internally but
    //    we need the values for the Firestore doc, so we track them from the result)
    const provider = validated.provider ?? 'fal';
    const model = validated.model ?? 'auto';

    // 5. Create StudioGeneration document in Firestore with status 'queued'
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    const docRef = adminDb.collection(GENERATIONS_COLLECTION).doc();
    const now = new Date().toISOString();

    const generationDoc: StudioGeneration = {
      id: docRef.id,
      userId: user.uid,
      prompt: validated.prompt,
      assembledPrompt,
      negativePrompt: validated.negativePrompt,
      type: validated.type,
      presets: validated.presets,
      provider,
      model,
      status: 'queued',
      cost: 0,
      campaignId: validated.campaignId,
      projectId: validated.projectId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(generationDoc);

    logger.info('Studio generate: queued generation', {
      generationId: docRef.id,
      userId: user.uid,
      type: validated.type,
      provider,
    });

    // 6. Update status to processing
    await docRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    // 7. Call routeGeneration — pass original prompt + presets; the router
    //    assembles the cinematic prompt internally and selects the provider
    let result;
    try {
      result = await routeGeneration(validated);
    } catch (genError: unknown) {
      // Mark as failed
      const errorMessage = genError instanceof Error ? genError.message : 'Generation failed';
      await docRef.update({
        status: 'failed',
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      });
      logger.error(
        'Studio generate: provider generation failed',
        genError instanceof Error ? genError : new Error(String(genError)),
        { generationId: docRef.id },
      );
      return NextResponse.json(
        { success: false, error: errorMessage, generationId: docRef.id },
        { status: 502 },
      );
    }

    // 8. Update Firestore doc with completed result
    const completedAt = new Date().toISOString();
    await docRef.update({
      status: 'completed',
      result,
      provider: result.provider,
      model: result.model,
      cost: result.cost,
      updatedAt: completedAt,
      completedAt,
    });

    // 9. Log cost
    await logGenerationCost({
      generationId: docRef.id,
      userId: user.uid,
      provider: result.provider,
      model: result.model,
      type: validated.type,
      cost: result.cost,
      campaignId: validated.campaignId,
    });

    logger.info('Studio generate: generation complete', {
      generationId: docRef.id,
      provider: result.provider,
      model: result.model,
      cost: result.cost,
    });

    // 10. Return the result
    return NextResponse.json({
      success: true,
      data: {
        generationId: docRef.id,
        ...result,
      },
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
      'Studio generate: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
