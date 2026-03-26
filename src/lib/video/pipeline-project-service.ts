/**
 * Video Pipeline Project Service
 * Firestore CRUD for video pipeline projects (7-step production flow)
 *
 * Collection path: organizations/{PLATFORM_ID}/video_pipeline_projects/{projectId}
 *
 * Uses Admin SDK for server-side operations (API routes, Jasper tools).
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  PipelineBrief,
  PipelineProject,
  PipelineScene,
  PipelineStep,
  SceneGenerationResult,
  ProjectStatus,
  TransitionType,
  VideoType,
} from '@/types/video-pipeline';

// ============================================================================
// Firestore Document Shape
// ============================================================================

interface FirestorePipelineDoc {
  name: string;
  type: VideoType;
  currentStep: PipelineStep;
  brief: PipelineBrief;
  scenes: PipelineScene[];
  avatarId: string | null;
  avatarName: string | null;
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: string | null;
  generatedScenes: SceneGenerationResult[];
  finalVideoUrl: string | null;
  transitionType: TransitionType;
  status: ProjectStatus;
  createdAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
  createdBy: string;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_PATH = `organizations/${PLATFORM_ID}/video_pipeline_projects`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate project name from brief description (first 50 chars)
 */
function generateProjectName(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length <= 50) {
    return trimmed;
  }
  return `${trimmed.slice(0, 47)}...`;
}

/**
 * Convert Firestore Timestamp or FieldValue to ISO string
 */
function timestampToISO(timestamp: unknown): string {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

/**
 * Map a Firestore doc snapshot to a PipelineProject
 */
function docToProject(id: string, raw: FirebaseFirestore.DocumentData): PipelineProject {
  const data = raw as FirestorePipelineDoc;
  return {
    id,
    name: data.name ?? '',
    type: data.type ?? 'explainer',
    currentStep: data.currentStep ?? 'request',
    brief: data.brief ?? ({} as PipelineBrief),
    scenes: data.scenes ?? [],
    avatarId: data.avatarId ?? null,
    avatarName: data.avatarName ?? null,
    voiceId: data.voiceId ?? null,
    voiceName: data.voiceName ?? null,
    voiceProvider: (data.voiceProvider as PipelineProject['voiceProvider']) ?? null,
    generatedScenes: data.generatedScenes ?? [],
    finalVideoUrl: data.finalVideoUrl ?? null,
    transitionType: data.transitionType ?? 'cut',
    status: data.status ?? 'draft',
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt),
    createdBy: data.createdBy ?? '',
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new pipeline project
 */
export async function createProject(
  brief: PipelineBrief,
  createdBy: string
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const name = generateProjectName(brief.description);

    const projectData = {
      name,
      type: brief.videoType,
      currentStep: 'request' as const,
      brief,
      scenes: [],
      avatarId: null,
      avatarName: null,
      voiceId: null,
      voiceName: null,
      voiceProvider: null,
      generatedScenes: [],
      finalVideoUrl: null,
      transitionType: 'cut' as const,
      status: 'draft' as const,
      createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection(COLLECTION_PATH).add(projectData);

    logger.info('Pipeline project created', {
      projectId: docRef.id,
      name,
      file: 'pipeline-project-service.ts',
    });

    return { success: true, projectId: docRef.id };
  } catch (error) {
    logger.error('Failed to create pipeline project', error as Error, {
      file: 'pipeline-project-service.ts',
    });
    return { success: false, error: 'Failed to create project' };
  }
}

/**
 * Get a single project by ID
 */
export async function getProject(projectId: string): Promise<PipelineProject | null> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for getting project', { file: 'pipeline-project-service.ts' });
      return null;
    }

    const docSnap = await adminDb.collection(COLLECTION_PATH).doc(projectId).get();

    if (!docSnap.exists) {
      logger.warn('Project not found', { projectId, file: 'pipeline-project-service.ts' });
      return null;
    }

    const data = docSnap.data();
    if (!data) {
      return null;
    }
    return docToProject(docSnap.id, data);
  } catch (error) {
    logger.error('Failed to get pipeline project', error as Error, {
      projectId,
      file: 'pipeline-project-service.ts',
    });
    return null;
  }
}

/**
 * Update project fields
 */
export async function updateProject(
  projectId: string,
  updates: Partial<PipelineProject>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    // Remove fields that shouldn't be updated directly
    const { id: _id, createdAt: _createdAt, createdBy: _createdBy, ...safeUpdates } = updates;

    await adminDb.collection(COLLECTION_PATH).doc(projectId).update({
      ...safeUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Pipeline project updated', {
      projectId,
      file: 'pipeline-project-service.ts',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update pipeline project', error as Error, {
      projectId,
      file: 'pipeline-project-service.ts',
    });
    return { success: false, error: 'Failed to update project' };
  }
}

/**
 * List all projects, optionally filtered by userId and/or status
 */
export async function listProjects(
  userId?: string,
  statusFilter?: ProjectStatus[]
): Promise<PipelineProject[]> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for listing projects', { file: 'pipeline-project-service.ts' });
      return [];
    }

    let q: FirebaseFirestore.Query = adminDb.collection(COLLECTION_PATH)
      .orderBy('updatedAt', 'desc');

    if (userId) {
      q = q.where('createdBy', '==', userId);
    }

    if (statusFilter && statusFilter.length > 0) {
      q = q.where('status', 'in', statusFilter);
    }

    const snapshot = await q.get();
    return snapshot.docs.map((docSnap) => docToProject(docSnap.id, docSnap.data()));
  } catch (error) {
    logger.error('Failed to list pipeline projects', error as Error, {
      file: 'pipeline-project-service.ts',
    });
    return [];
  }
}

/**
 * Delete a project by ID
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    if (!adminDb) {
      return false;
    }

    // 1. Delete orphaned scene preview images
    const previewsCol = `organizations/${PLATFORM_ID}/scene_previews`;
    const previewSnap = await adminDb.collection(previewsCol)
      .where('projectId', '==', projectId)
      .get();

    if (!previewSnap.empty) {
      const batch = adminDb.batch();
      for (const doc of previewSnap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      logger.info('Deleted scene previews for project', { projectId, count: previewSnap.size });
    }

    // 2. Delete video files from Firebase Storage (best-effort)
    try {
      const { admin } = await import('@/lib/firebase-admin');
      const bucket = admin.storage().bucket();
      const prefix = `organizations/${PLATFORM_ID}/videos/${projectId}/`;
      const [files] = await bucket.getFiles({ prefix });
      if (files.length > 0) {
        await Promise.all(files.map(file => file.delete().catch(() => null)));
        logger.info('Deleted video storage files for project', { projectId, count: files.length });
      }
    } catch (storageErr) {
      // Storage cleanup is best-effort — don't fail the entire delete
      logger.warn('Failed to clean up storage files for project', {
        projectId,
        error: storageErr instanceof Error ? storageErr.message : String(storageErr),
      });
    }

    // 3. Delete the project document itself
    await adminDb.collection(COLLECTION_PATH).doc(projectId).delete();

    logger.info('Pipeline project deleted (with cascade)', {
      projectId,
      file: 'pipeline-project-service.ts',
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete pipeline project', error as Error, {
      projectId,
      file: 'pipeline-project-service.ts',
    });
    return false;
  }
}

/**
 * Update a single scene's generation status within a project
 */
export async function updateSceneStatus(
  projectId: string,
  sceneId: string,
  result: SceneGenerationResult
): Promise<void> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for updating scene status', { file: 'pipeline-project-service.ts' });
      return;
    }

    const project = await getProject(projectId);
    if (!project) {
      logger.warn('Project not found for scene update', { projectId, sceneId, file: 'pipeline-project-service.ts' });
      return;
    }

    // Update or add the scene result
    const existingIndex = project.generatedScenes.findIndex((s) => s.sceneId === sceneId);
    const updatedScenes = [...project.generatedScenes];

    if (existingIndex >= 0) {
      updatedScenes[existingIndex] = result;
    } else {
      updatedScenes.push(result);
    }

    await updateProject(projectId, {
      generatedScenes: updatedScenes,
    });

    logger.info('Scene status updated', {
      projectId,
      sceneId,
      status: result.status,
      file: 'pipeline-project-service.ts',
    });
  } catch (error) {
    logger.error('Failed to update scene status', error as Error, {
      projectId,
      sceneId,
      file: 'pipeline-project-service.ts',
    });
  }
}

/**
 * Save approved storyboard state and advance to generation step
 */
export async function saveApprovedStoryboard(
  projectId: string,
  scenes: PipelineScene[],
  avatarId: string,
  avatarName: string,
  voiceId: string,
  voiceName: string
): Promise<void> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for saving storyboard', { file: 'pipeline-project-service.ts' });
      return;
    }

    await updateProject(projectId, {
      scenes,
      avatarId,
      avatarName,
      voiceId,
      voiceName,
      currentStep: 'generation',
      status: 'approved',
    });

    logger.info('Storyboard approved and saved', {
      projectId,
      sceneCount: scenes.length,
      avatarId,
      voiceId,
      file: 'pipeline-project-service.ts',
    });
  } catch (error) {
    logger.error('Failed to save approved storyboard', error as Error, {
      projectId,
      file: 'pipeline-project-service.ts',
    });
  }
}
