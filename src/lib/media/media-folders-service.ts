/**
 * Media Folders service — the library hierarchy (Brand ▸ Campaign ▸ Sub-campaign ▸ …).
 *
 * Folders nest via `parentFolderId` (any depth); a null/absent parent is a top-level
 * folder. Stored at organizations/{PLATFORM_ID}/mediaFolders/{id}. Assets reference a
 * folder via `folderId` (see media-library-service). Admin SDK (server-only).
 *
 * Deleting a folder REPARENTS its direct child folders + assets to the deleted
 * folder's parent (or to Unfiled when it was top-level) — nothing is orphaned or
 * cascade-deleted. Moving a folder is cycle-guarded (can't become its own descendant).
 */

import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  MediaFolder,
  MediaFolderCreateInput,
  MediaFolderUpdateInput,
} from '@/types/media-library';

const FOLDERS = getSubCollection('mediaFolders');
const MEDIA = getSubCollection('media');
const FILE = 'lib/media/media-folders-service.ts';

/** Firestore batch hard cap is 500 — chunk a bit under it. */
const BATCH_CHUNK = 450;

interface FolderDoc {
  name?: string;
  parentFolderId?: string | null;
  projectId?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

function ensureDb(): NonNullable<typeof adminDb> {
  if (!adminDb) {
    throw new Error('Admin Firestore not initialized — media folders service cannot run.');
  }
  return adminDb;
}

function rowToFolder(id: string, d: FolderDoc): MediaFolder {
  return {
    id,
    name: d.name ?? '',
    parentFolderId: d.parentFolderId ?? null,
    projectId: d.projectId ?? null,
    createdBy: d.createdBy ?? 'unknown',
    createdAt: d.createdAt ?? '',
    updatedAt: d.updatedAt ?? '',
  };
}

export async function createFolder(input: MediaFolderCreateInput): Promise<MediaFolder> {
  const db = ensureDb();
  const ref = db.collection(FOLDERS).doc();
  const now = new Date().toISOString();
  const record: MediaFolder = {
    id: ref.id,
    name: input.name.trim() || 'Untitled folder',
    parentFolderId: input.parentFolderId ?? null,
    projectId: input.projectId ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  logger.info('Media folder created', {
    file: FILE,
    id: ref.id,
    name: record.name,
    parent: record.parentFolderId,
  });
  return record;
}

/**
 * Return the folder that mirrors a video project, creating it (top-level) if it
 * doesn't exist yet. This is what makes generated assets AUTO-FILE: the first asset
 * created for a project makes its folder, the rest reuse it. The operator can later
 * drag this folder under a campaign. Best-effort caller-side; throws only on a hard
 * DB failure.
 */
export async function getOrCreateProjectFolder(projectId: string, projectName: string): Promise<string> {
  const db = ensureDb();
  const existing = await db.collection(FOLDERS).where('projectId', '==', projectId).limit(1).get();
  if (!existing.empty) {
    return existing.docs[0].id;
  }
  const folder = await createFolder({
    name: projectName.trim() || 'Project',
    parentFolderId: null,
    projectId,
    createdBy: 'system',
  });
  return folder.id;
}

export async function listFolders(): Promise<MediaFolder[]> {
  const db = ensureDb();
  const snap = await db.collection(FOLDERS).get();
  return snap.docs.map((d) => rowToFolder(d.id, d.data() as FolderDoc));
}

export async function getFolder(id: string): Promise<MediaFolder | null> {
  const db = ensureDb();
  const doc = await db.collection(FOLDERS).doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return rowToFolder(doc.id, doc.data() as FolderDoc);
}

/**
 * True if moving `folderId` under `candidateParentId` would create a cycle — i.e.
 * `candidateParentId` is `folderId` itself or one of its descendants. Walks UP from
 * the candidate parent looking for `folderId`.
 */
async function wouldCreateCycle(folderId: string, candidateParentId: string): Promise<boolean> {
  let current: string | null = candidateParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === folderId) {
      return true;
    }
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    const parent = await getFolder(current);
    current = parent?.parentFolderId ?? null;
  }
  return false;
}

export async function updateFolder(
  id: string,
  patch: MediaFolderUpdateInput,
): Promise<MediaFolder | null> {
  const db = ensureDb();
  const ref = db.collection(FOLDERS).doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof patch.name === 'string') {
    updates.name = patch.name.trim() || 'Untitled folder';
  }
  if ('parentFolderId' in patch) {
    const next = patch.parentFolderId ?? null;
    if (next) {
      if (next === id) {
        throw new Error('A folder cannot be its own parent.');
      }
      if (await wouldCreateCycle(id, next)) {
        throw new Error('Cannot move a folder into one of its own subfolders.');
      }
    }
    updates.parentFolderId = next;
  }

  await ref.update(updates);
  return getFolder(id);
}

/** Reparent a list of asset doc refs to `newFolderId` (or unfile when null), chunked. */
async function reparentAssets(
  db: NonNullable<typeof adminDb>,
  assetRefs: FirebaseFirestore.DocumentReference[],
  newFolderId: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < assetRefs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const ref of assetRefs.slice(i, i + BATCH_CHUNK)) {
      batch.update(
        ref,
        newFolderId
          ? { folderId: newFolderId, updatedAt: now }
          : { folderId: FieldValue.delete(), updatedAt: now },
      );
    }
    await batch.commit();
  }
}

/**
 * Delete a folder. Its direct child folders + direct assets are REPARENTED to the
 * deleted folder's parent (Unfiled when it was top-level). Returns false if missing.
 */
export async function deleteFolder(id: string): Promise<boolean> {
  const db = ensureDb();
  const ref = db.collection(FOLDERS).doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return false;
  }
  const parent = (doc.data() as FolderDoc).parentFolderId ?? null;
  const now = new Date().toISOString();

  // Reparent direct child folders to this folder's parent.
  const childFolders = await db.collection(FOLDERS).where('parentFolderId', '==', id).get();
  for (let i = 0; i < childFolders.docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const c of childFolders.docs.slice(i, i + BATCH_CHUNK)) {
      batch.update(c.ref, { parentFolderId: parent, updatedAt: now });
    }
    await batch.commit();
  }

  // Reparent direct assets to this folder's parent (or Unfiled).
  const childAssets = await db.collection(MEDIA).where('folderId', '==', id).get();
  await reparentAssets(db, childAssets.docs.map((a) => a.ref), parent);

  await ref.delete();
  logger.info('Media folder deleted (children reparented)', {
    file: FILE,
    id,
    reparentedTo: parent ?? 'unfiled',
    childFolders: childFolders.size,
    childAssets: childAssets.size,
  });
  return true;
}
