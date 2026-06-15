/**
 * Video engine provider router (Stage 1)
 *
 * Resolves a `VideoEngineId` to its concrete `VideoEngineProvider`. fal
 * (Seedance) is the sole video engine.
 */

import type { VideoEngineId } from '@/types/video-pipeline';
import { FalSeedanceProvider } from './fal-seedance-provider';
import type { VideoEngineProvider } from './types';

// Single shared instance — providers are stateless aside from the in-memory
// fal handle store, which must be shared across calls so getStatus can resolve.
const falProvider = new FalSeedanceProvider();

export function getVideoEngineProvider(engineId: VideoEngineId): VideoEngineProvider {
  switch (engineId) {
    case 'fal':
      return falProvider;
    default: {
      // Exhaustiveness guard: if VideoEngineId gains a member, this fails to compile.
      const _exhaustive: never = engineId;
      throw new Error(`Unknown video engine: ${String(_exhaustive)}`);
    }
  }
}

export type {
  VideoEngineProvider,
  VideoGenerateRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  TenantContext,
} from './types';
