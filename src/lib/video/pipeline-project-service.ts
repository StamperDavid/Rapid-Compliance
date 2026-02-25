/**
 * Video Pipeline Project Service
 * Firestore CRUD for video pipeline projects (7-step production flow)
 *
 * Collection path: organizations/{PLATFORM_ID}/video_pipeline_projects/{projectId}
 */

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  PipelineBrief,
  PipelineProject,
  PipelineScene,
  SceneGenerationResult,
  PipelineStep,
  ProjectStatus,
  TransitionType,
  VideoType,
} from '@/types/video-pipeline';

// ============================================================================
// Firestore Document Type
// ============================================================================

interface FirestorePipelineProjectData {
  name: string;
  type: VideoType;
  currentStep: PipelineStep;
  brief: PipelineBrief;
  scenes: PipelineScene[];
  avatarId: string | null;
  avatarName: string | null;
  voiceId: string | null;
  voiceName: string | null;
  generatedScenes: SceneGenerationResult[];
  finalVideoUrl: string | null;
  transitionType: TransitionType;
  status: ProjectStatus;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  createdBy: string;
}

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
 * Convert Firestore Timestamp to ISO string
 */
function timestampToISO(timestamp: unknown): string {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
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
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const projectsRef = collection(db, 'organizations', PLATFORM_ID, 'video_pipeline_projects');
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
      generatedScenes: [],
      finalVideoUrl: null,
      transitionType: 'cut' as const,
      status: 'draft' as const,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(projectsRef, projectData);

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
    if (!db) {
      logger.warn('Database not available for getting project', { file: 'pipeline-project-service.ts' });
      return null;
    }

    const projectRef = doc(db, 'organizations', PLATFORM_ID, 'video_pipeline_projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      logger.warn('Project not found', { projectId, file: 'pipeline-project-service.ts' });
      return null;
    }

    const data = projectSnap.data() as FirestorePipelineProjectData;
    const project: PipelineProject = {
      id: projectSnap.id,
      name: data.name,
      type: data.type,
      currentStep: data.currentStep,
      brief: data.brief,
      scenes: data.scenes ?? [],
      avatarId: data.avatarId ?? null,
      avatarName: data.avatarName ?? null,
      voiceId: data.voiceId ?? null,
      voiceName: data.voiceName ?? null,
      generatedScenes: data.generatedScenes ?? [],
      finalVideoUrl: data.finalVideoUrl ?? null,
      transitionType: data.transitionType ?? 'cut',
      status: data.status,
      createdAt: timestampToISO(data.createdAt),
      updatedAt: timestampToISO(data.updatedAt),
      createdBy: data.createdBy,
    };

    return project;
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
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const projectRef = doc(db, 'organizations', PLATFORM_ID, 'video_pipeline_projects', projectId);

    // Remove fields that shouldn't be updated directly
    const { id: _id, createdAt: _createdAt, createdBy: _createdBy, ...safeUpdates } = updates;

    await updateDoc(projectRef, {
      ...safeUpdates,
      updatedAt: serverTimestamp(),
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
    if (!db) {
      logger.warn('Database not available for listing projects', { file: 'pipeline-project-service.ts' });
      return [];
    }

    const projectsRef = collection(db, 'organizations', PLATFORM_ID, 'video_pipeline_projects');
    const constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc')];

    if (userId) {
      constraints.push(where('createdBy', '==', userId));
    }

    if (statusFilter && statusFilter.length > 0) {
      constraints.push(where('status', 'in', statusFilter));
    }

    const q = query(projectsRef, ...constraints);

    const snapshot = await getDocs(q);
    const projects: PipelineProject[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as FirestorePipelineProjectData;
      return {
        id: docSnap.id,
        name: data.name,
        type: data.type,
        currentStep: data.currentStep,
        brief: data.brief,
        scenes: data.scenes ?? [],
        avatarId: data.avatarId ?? null,
        avatarName: data.avatarName ?? null,
        voiceId: data.voiceId ?? null,
        voiceName: data.voiceName ?? null,
        generatedScenes: data.generatedScenes ?? [],
        finalVideoUrl: data.finalVideoUrl ?? null,
        transitionType: data.transitionType ?? 'cut',
        status: data.status,
        createdAt: timestampToISO(data.createdAt),
        updatedAt: timestampToISO(data.updatedAt),
        createdBy: data.createdBy,
      };
    });

    return projects;
  } catch (error) {
    logger.error('Failed to list pipeline projects', error as Error, {
      file: 'pipeline-project-service.ts',
    });
    return [];
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
    if (!db) {
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
    if (!db) {
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
