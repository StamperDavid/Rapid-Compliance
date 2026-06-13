/**
 * Video engine provider router (Stage 1)
 *
 * Resolves a `VideoEngineId` to its concrete `VideoEngineProvider`. ADDITIVE:
 * nothing in the app calls this yet — call sites are migrated onto it in a
 * later, separately-reviewed stage as part of the Hedra removal.
 *
 * 'hedra' intentionally THROWS: Hedra is being removed entirely. The throw is a
 * loud signal during the migration that any newly-wired call site must use fal.
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
    case 'hedra':
      throw new Error('Hedra is being removed — use fal');
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
