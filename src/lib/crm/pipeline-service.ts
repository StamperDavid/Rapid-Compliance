/**
 * Pipeline Service
 * Business logic layer for deal pipelines (each pipeline owns an ordered set
 * of stages). A selector on the deals board switches between pipelines and
 * deals carry a `pipelineId`.
 *
 * Migration safety: a default pipeline is lazily seeded with stages that
 * EXACTLY match the six original hardcoded deal stages, so pre-existing deals
 * (which have no `pipelineId`) keep rendering under the default pipeline.
 */

import { where } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

import {
  DEFAULT_PIPELINE_ID,
  DEFAULT_PIPELINE_STAGES,
  type Pipeline,
  type PipelineStage,
} from './pipeline-types';

export type { Pipeline, PipelineStage } from './pipeline-types';
export { DEFAULT_PIPELINE_ID, DEFAULT_PIPELINE_STAGES } from './pipeline-types';

const PIPELINES_COLLECTION = 'pipelines';

/**
 * Input accepted when creating a pipeline. Stages are normalized (order
 * re-derived from array position) before persisting.
 */
export interface CreatePipelineInput {
  name: string;
  stages: PipelineStage[];
}

/** Sort a copy of the stages by their `order` field (ascending). */
function sortStages(stages: PipelineStage[]): PipelineStage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

/**
 * Lazily seed (once) and return the default pipeline. Its stages match the
 * original six hardcoded deal stages so existing deals keep working.
 */
export async function getOrCreateDefaultPipeline(): Promise<Pipeline> {
  try {
    const existing = await AdminFirestoreService.get<Pipeline>(
      getSubCollection(PIPELINES_COLLECTION),
      DEFAULT_PIPELINE_ID
    );
    if (existing) {
      return existing;
    }

    const now = new Date();
    const pipeline: Pipeline = {
      id: DEFAULT_PIPELINE_ID,
      name: 'Sales Pipeline',
      stages: sortStages(DEFAULT_PIPELINE_STAGES),
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(
      getSubCollection(PIPELINES_COLLECTION),
      DEFAULT_PIPELINE_ID,
      pipeline,
      false
    );

    logger.info('Default pipeline seeded', { pipelineId: DEFAULT_PIPELINE_ID });
    return pipeline;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get or create default pipeline', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to load the default pipeline: ${message}`);
  }
}

/**
 * List every pipeline, default first. Guarantees the default pipeline exists.
 */
export async function listPipelines(): Promise<Pipeline[]> {
  try {
    // Ensure the default exists before listing so the board always has at
    // least one pipeline to render.
    await getOrCreateDefaultPipeline();

    const pipelines = await AdminFirestoreService.getAll<Pipeline>(
      getSubCollection(PIPELINES_COLLECTION)
    );

    pipelines.sort((a, b) => {
      if (a.isDefault && !b.isDefault) { return -1; }
      if (!a.isDefault && b.isDefault) { return 1; }
      return a.name.localeCompare(b.name);
    });

    return pipelines;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list pipelines', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to list pipelines: ${message}`);
  }
}

/** Get a single pipeline by id (null if missing). */
export async function getPipeline(pipelineId: string): Promise<Pipeline | null> {
  try {
    return await AdminFirestoreService.get<Pipeline>(
      getSubCollection(PIPELINES_COLLECTION),
      pipelineId
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get pipeline', error instanceof Error ? error : new Error(String(error)), { pipelineId });
    throw new Error(`Failed to load pipeline: ${message}`);
  }
}

/**
 * Resolve the pipeline a deal belongs to, falling back to the default when the
 * deal has no `pipelineId` or its pipeline no longer exists. Existing deals
 * MUST keep resolving to the default so the board never breaks.
 */
export async function getPipelineForDeal(pipelineId?: string): Promise<Pipeline> {
  if (pipelineId && pipelineId !== DEFAULT_PIPELINE_ID) {
    const pipeline = await getPipeline(pipelineId);
    if (pipeline) {
      return pipeline;
    }
  }
  return getOrCreateDefaultPipeline();
}

/**
 * Create a new (non-default) pipeline. Stage `order` is re-derived from array
 * position so callers can simply pass stages in display order.
 */
export async function createPipeline(input: CreatePipelineInput): Promise<Pipeline> {
  try {
    const name = input.name.trim();
    if (name === '') {
      throw new Error('Please give the pipeline a name.');
    }
    if (!input.stages || input.stages.length === 0) {
      throw new Error('A pipeline needs at least one stage.');
    }

    const seenKeys = new Set<string>();
    const normalizedStages: PipelineStage[] = input.stages.map((stage, index) => {
      const key = stage.key.trim();
      const label = stage.label.trim();
      if (key === '') {
        throw new Error('Every stage needs a key.');
      }
      if (label === '') {
        throw new Error('Every stage needs a name.');
      }
      if (seenKeys.has(key)) {
        throw new Error(`Two stages share the key "${key}". Stage keys must be unique.`);
      }
      seenKeys.add(key);
      return {
        key,
        label,
        order: index,
        probability: stage.probability,
        type: stage.type ?? 'open',
      };
    });

    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date();
    const pipeline: Pipeline = {
      id: pipelineId,
      name,
      stages: normalizedStages,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(
      getSubCollection(PIPELINES_COLLECTION),
      pipelineId,
      pipeline,
      false
    );

    logger.info('Pipeline created', { pipelineId, stageCount: normalizedStages.length });
    return pipeline;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create pipeline', error instanceof Error ? error : new Error(String(error)));
    throw new Error(message);
  }
}

/**
 * Update a pipeline's name and/or stages. The default flag cannot be changed
 * here. Stage `order` is re-derived from array position when stages are given.
 */
export async function updatePipeline(
  pipelineId: string,
  updates: { name?: string; stages?: PipelineStage[] }
): Promise<Pipeline> {
  try {
    const existing = await getPipeline(pipelineId);
    if (!existing) {
      throw new Error('That pipeline no longer exists.');
    }

    const patch: { name?: string; stages?: PipelineStage[]; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (name === '') {
        throw new Error('Please give the pipeline a name.');
      }
      patch.name = name;
    }

    if (updates.stages !== undefined) {
      if (updates.stages.length === 0) {
        throw new Error('A pipeline needs at least one stage.');
      }
      const seenKeys = new Set<string>();
      patch.stages = updates.stages.map((stage, index) => {
        const key = stage.key.trim();
        const label = stage.label.trim();
        if (key === '') {
          throw new Error('Every stage needs a key.');
        }
        if (label === '') {
          throw new Error('Every stage needs a name.');
        }
        if (seenKeys.has(key)) {
          throw new Error(`Two stages share the key "${key}". Stage keys must be unique.`);
        }
        seenKeys.add(key);
        return {
          key,
          label,
          order: index,
          probability: stage.probability,
          type: stage.type ?? 'open',
        };
      });
    }

    await AdminFirestoreService.update(
      getSubCollection(PIPELINES_COLLECTION),
      pipelineId,
      patch
    );

    const updated = await getPipeline(pipelineId);
    if (!updated) {
      throw new Error('Pipeline not found after update.');
    }
    logger.info('Pipeline updated', { pipelineId, fields: Object.keys(updates) });
    return updated;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update pipeline', error instanceof Error ? error : new Error(String(error)), { pipelineId });
    throw new Error(message);
  }
}

/**
 * Count deals assigned to a pipeline. Used to guard deletion. Deals with no
 * `pipelineId` belong to the default pipeline, so they only block the default
 * (which is already un-deletable for being the default).
 */
async function countDealsInPipeline(pipelineId: string): Promise<number> {
  const deals = await AdminFirestoreService.getAll(
    getSubCollection('deals'),
    [where('pipelineId', '==', pipelineId)]
  );
  return deals.length;
}

/**
 * Delete a pipeline. Blocked (with a plain-English error) when it is the
 * default pipeline or when deals are still assigned to it.
 */
export async function deletePipeline(pipelineId: string): Promise<void> {
  try {
    const pipeline = await getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error('That pipeline no longer exists.');
    }
    if (pipeline.isDefault || pipelineId === DEFAULT_PIPELINE_ID) {
      throw new Error('You can’t delete the default pipeline.');
    }

    const dealCount = await countDealsInPipeline(pipelineId);
    if (dealCount > 0) {
      throw new Error(
        `This pipeline still has ${dealCount} deal${dealCount === 1 ? '' : 's'} in it. Move or delete those deals first, then you can remove the pipeline.`
      );
    }

    await AdminFirestoreService.delete(
      getSubCollection(PIPELINES_COLLECTION),
      pipelineId
    );

    logger.info('Pipeline deleted', { pipelineId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete pipeline', error instanceof Error ? error : new Error(String(error)), { pipelineId });
    throw new Error(message);
  }
}
