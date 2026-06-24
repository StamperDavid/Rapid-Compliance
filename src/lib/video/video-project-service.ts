/**
 * Video Project Service — Firestore CRUD for the multi-document envelope.
 *
 * Collection: organizations/{PLATFORM_ID}/videoProjects/{projectId}
 *
 * Server-side only (Admin SDK). A project embeds its ordered Shot Docs (each a
 * full `ShotPlan`) in one document — realistic projects are a handful of docs, so
 * this stays well under the Firestore 1 MB document limit; a doc-subcollection
 * split is the escape hatch if a project ever grows huge (logged, not silent).
 *
 * `status` is always DERIVED from the docs' generation state via
 * `deriveProjectStatus` on every write, so it can never drift out of sync.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  type VideoProject,
  type VideoProjectBuild,
  type VideoProjectCreator,
  VideoProjectSchema,
  deriveProjectStatus,
} from '@/types/video-project';
import type { ShotPlan } from '@/types/shot-plan';

const FILE = 'video/video-project-service.ts';
const COLLECTION = getSubCollection('videoProjects');

/** ~900 KB — warn before the hard 1 MB Firestore document limit so a large project is visible, not a silent write failure. */
const DOC_SIZE_WARN_BYTES = 900_000;

function ensureDb() {
  if (!adminDb) {
    throw new Error('Video Project Service: Firebase Admin not initialized.');
  }
  return adminDb;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Resolve a uid into a displayable creator record. Reads the top-level `users`
 * doc (same collection api-auth reads) for a display name + email; on any miss
 * it degrades to the uid so a project is always attributable, never blank.
 */
async function resolveCreator(uid: string): Promise<VideoProjectCreator> {
  const fallback: VideoProjectCreator = { uid, name: uid, email: null };
  try {
    const snap = await ensureDb().collection('users').doc(uid).get();
    if (!snap.exists) {
      return fallback;
    }
    const data = snap.data() ?? {};
    const email = typeof data.email === 'string' && data.email.trim().length > 0 ? data.email.trim() : null;
    const displayName =
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName.trim()
        : typeof data.name === 'string' && data.name.trim().length > 0
          ? data.name.trim()
          : null;
    return { uid, name: displayName ?? email ?? uid, email };
  } catch {
    return fallback;
  }
}

/** Re-derive `status` + bump `updatedAt`, then validate the whole project. */
function normalize(project: VideoProject): VideoProject {
  const withStatus: VideoProject = {
    ...project,
    status: deriveProjectStatus(project),
    updatedAt: isoNow(),
  };
  // Validate before persisting so a malformed project is rejected, not stored.
  return VideoProjectSchema.parse(withStatus);
}

/** Persist a project (validated, status re-derived). Warns if it nears the doc-size limit. */
async function persist(project: VideoProject): Promise<VideoProject> {
  const normalized = normalize(project);
  const approxBytes = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
  if (approxBytes > DOC_SIZE_WARN_BYTES) {
    logger.warn('[video-project] project document is large — nearing Firestore 1MB limit', {
      file: FILE,
      projectId: normalized.id,
      approxBytes,
      docs: normalized.docs.length,
    });
  }
  await ensureDb().collection(COLLECTION).doc(normalized.id).set(normalized);
  return normalized;
}

// ============================================================================
// CRUD
// ============================================================================

export interface CreateVideoProjectInput {
  title: string;
  brief: string;
  docs?: ShotPlan[];
  /** Seed background-build progress (Content Manager fast-handoff path). */
  build?: VideoProjectBuild;
  /** uid of the creator — resolved to a display name + email and stamped on the project. */
  createdByUid?: string;
}

/** Create a new project (starts in 'planning'; status re-derives once docs land). */
export async function createVideoProject(input: CreateVideoProjectInput): Promise<VideoProject> {
  const now = isoNow();
  const creator = input.createdByUid?.trim() ? await resolveCreator(input.createdByUid.trim()) : null;
  const project: VideoProject = {
    id: `vproj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim() || 'Untitled Project',
    brief: input.brief,
    ...(creator ? { createdBy: creator } : {}),
    docs: input.docs ?? [],
    ...(input.build ? { build: input.build } : {}),
    status: 'planning',
    createdAt: now,
    updatedAt: now,
  };
  const saved = await persist(project);
  logger.info('[video-project] created', { file: FILE, projectId: saved.id, docs: saved.docs.length });
  return saved;
}

/**
 * Append ONE freshly-authored doc to a project, returning the persisted project. Used by
 * the background build so each doc appears on the review page the moment it is rendered,
 * instead of all-or-nothing at the end. Status re-derives (first doc flips 'planning'→'review').
 */
export async function appendProjectDoc(projectId: string, doc: ShotPlan): Promise<VideoProject> {
  const project = await getVideoProject(projectId);
  if (!project) {
    throw new Error(`appendProjectDoc: project not found: ${projectId}`);
  }
  return persist({ ...project, docs: [...project.docs, doc] });
}

/** Update ONLY the background-build progress field, returning the persisted project. */
export async function setProjectBuild(
  projectId: string,
  build: VideoProjectBuild,
): Promise<VideoProject> {
  const project = await getVideoProject(projectId);
  if (!project) {
    throw new Error(`setProjectBuild: project not found: ${projectId}`);
  }
  return persist({ ...project, build });
}

/** Update only the project title (used once segmentation produces a better one). */
export async function setProjectTitle(projectId: string, title: string): Promise<VideoProject> {
  const project = await getVideoProject(projectId);
  if (!project) {
    throw new Error(`setProjectTitle: project not found: ${projectId}`);
  }
  return persist({ ...project, title: title.trim() || project.title });
}

/** Fetch one project, validated. Returns null when missing. */
export async function getVideoProject(projectId: string): Promise<VideoProject | null> {
  const snap = await ensureDb().collection(COLLECTION).doc(projectId).get();
  if (!snap.exists) {
    return null;
  }
  const parsed = VideoProjectSchema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) {
    logger.error('[video-project] stored project failed validation', undefined, {
      file: FILE,
      projectId,
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
    return null;
  }
  return parsed.data;
}

/** Lightweight summary for a project list (no embedded docs payload). */
export interface VideoProjectSummary {
  id: string;
  title: string;
  status: VideoProject['status'];
  docCount: number;
  docsWithVideo: number;
  finalVideoUrl: string | null;
  /** Who created the project (absent on legacy projects). */
  createdBy: VideoProjectCreator | null;
  updatedAt: string;
}

/** List all projects as summaries, newest first. */
export async function listVideoProjects(): Promise<VideoProjectSummary[]> {
  const snap = await ensureDb().collection(COLLECTION).orderBy('updatedAt', 'desc').get();
  const out: VideoProjectSummary[] = [];
  for (const doc of snap.docs) {
    const parsed = VideoProjectSchema.safeParse({ id: doc.id, ...doc.data() });
    if (!parsed.success) {
      continue;
    }
    const p = parsed.data;
    out.push({
      id: p.id,
      title: p.title,
      status: p.status,
      docCount: p.docs.length,
      docsWithVideo: p.docs.filter((d) => Boolean(d.finalVideoUrl)).length,
      finalVideoUrl: p.finalVideoUrl ?? null,
      createdBy: p.createdBy ?? null,
      updatedAt: p.updatedAt,
    });
  }
  return out;
}

/** Persist a whole project (status re-derived). */
export async function saveVideoProject(project: VideoProject): Promise<VideoProject> {
  return persist(project);
}

/**
 * Replace ONE doc in a project by its id, returning the persisted project. Used
 * after a per-doc edit OR a per-doc video generation (the new doc carries the
 * freshly-set `finalVideoUrl`). Re-derives project status so reaching the last
 * doc's video flips the project to 'assembled' automatically.
 */
export async function replaceProjectDoc(projectId: string, doc: ShotPlan): Promise<VideoProject> {
  const project = await getVideoProject(projectId);
  if (!project) {
    throw new Error(`replaceProjectDoc: project not found: ${projectId}`);
  }
  const idx = project.docs.findIndex((d) => d.id === doc.id);
  if (idx === -1) {
    throw new Error(`replaceProjectDoc: doc "${doc.id}" not in project "${projectId}"`);
  }
  const docs = [...project.docs];
  docs[idx] = doc;
  return persist({ ...project, docs });
}

/** Delete a project. */
export async function deleteVideoProject(projectId: string): Promise<void> {
  await ensureDb().collection(COLLECTION).doc(projectId).delete();
  logger.info('[video-project] deleted', { file: FILE, projectId });
}
