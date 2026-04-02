/**
 * Jasper Golden Master Loader
 *
 * Loads Jasper's active Golden Master from Firestore for the orchestrator chat route.
 * Uses an in-memory cache with 60s TTL to avoid Firestore reads on every request.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const FILE = 'jasper-golden-master.ts';

const CACHE_TTL_MS = 60_000; // 60 seconds

export interface JasperGoldenMasterData {
  id: string;
  systemPrompt: string;
  agentPersona?: {
    name?: string;
    tone?: string;
    greeting?: string;
    objectives?: string[];
    [key: string]: unknown;
  };
  behaviorConfig?: Record<string, unknown>;
  knowledgeBase?: {
    corrections?: string[];
    preferences?: string[];
    [key: string]: unknown;
  };
  trainingScore?: number;
  version?: string;
  isActive: boolean;
}

/**
 * Typed representation of a goldenMasters Firestore document.
 * All fields are optional because Firestore documents may be partial.
 */
interface FirestoreGMDocument {
  agentType?: string;
  isActive?: boolean;
  systemPrompt?: string;
  agentPersona?: {
    name?: string;
    tone?: string;
    greeting?: string;
    objectives?: string[];
    [key: string]: unknown;
  };
  behaviorConfig?: Record<string, unknown>;
  knowledgeBase?: {
    corrections?: string[];
    preferences?: string[];
    [key: string]: unknown;
  };
  trainingScore?: number;
  version?: string;
}

// In-memory cache — stored as a const object with mutable properties so the
// rule `require-atomic-updates` is satisfied (property mutation, not reassignment).
const gmCache = {
  data: null as JasperGoldenMasterData | null,
  timestamp: 0,
};

/**
 * Get the active Jasper Golden Master.
 * Returns null if no GM exists (fallback to ad-hoc prompt).
 */
export async function getActiveJasperGoldenMaster(): Promise<JasperGoldenMasterData | null> {
  // Return cached if still fresh
  if (gmCache.data !== null && (Date.now() - gmCache.timestamp) < CACHE_TTL_MS) {
    logger.info('[Jasper GM] Cache HIT — using cached GM', {
      file: FILE,
      gmId: gmCache.data.id,
      version: gmCache.data.version,
      promptLength: gmCache.data.systemPrompt.length,
      cacheAgeMs: Date.now() - gmCache.timestamp,
    });
    return gmCache.data;
  }
  logger.info('[Jasper GM] Cache MISS — querying Firestore', { file: FILE });

  if (!adminDb) {
    logger.warn('[Jasper GM] Admin DB not initialized, falling back to ad-hoc prompt', { file: FILE });
    return null;
  }

  try {
    const collectionPath = getSubCollection('goldenMasters');
    const snapshot = await adminDb
      .collection(collectionPath)
      .where('agentType', '==', 'orchestrator')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      logger.info('[Jasper GM] No active orchestrator GM found, using ad-hoc prompt', { file: FILE });
      Object.assign(gmCache, { data: null, timestamp: Date.now() });
      return null;
    }

    const doc = snapshot.docs[0];
    const raw = doc.data() as FirestoreGMDocument;

    const loaded: JasperGoldenMasterData = {
      id: doc.id,
      systemPrompt: raw.systemPrompt ?? '',
      agentPersona: raw.agentPersona,
      behaviorConfig: raw.behaviorConfig,
      knowledgeBase: raw.knowledgeBase,
      trainingScore: raw.trainingScore,
      version: raw.version,
      isActive: true,
    };

    Object.assign(gmCache, { data: loaded, timestamp: Date.now() });

    logger.info('[Jasper GM] Loaded active Golden Master from Firestore', {
      file: FILE,
      gmId: doc.id,
      version: raw.version,
      promptLength: loaded.systemPrompt.length,
      hasPersona: Boolean(raw.agentPersona),
      hasBehaviorConfig: Boolean(raw.behaviorConfig),
      hasKnowledgeBase: Boolean(raw.knowledgeBase),
    });

    return loaded;
  } catch (error) {
    logger.error(
      '[Jasper GM] Failed to load Golden Master',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return null;
  }
}

/**
 * Invalidate the cache (e.g., after deploying a new GM).
 */
export function invalidateJasperGMCache(): void {
  gmCache.data = null;
  gmCache.timestamp = 0;
}
