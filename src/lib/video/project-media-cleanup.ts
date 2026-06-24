/**
 * Project media cleanup — when a video project is deleted/scrapped, remove the media it
 * generated, while PROTECTING any image that belongs to a SAVED Character-Library
 * character. Deleting a project that merely USED a saved character (e.g. Velocity) must
 * never wipe that character; only the project's throwaway generations (invented-character
 * reference images, environment heroes, keyframes, clips) and its library folder go.
 *
 * Shared by BOTH delete paths — System A (`video_pipeline_projects`) and System B
 * (`videoProjects`) — so neither leaves orphaned images behind.
 */

import { listAssets, deleteAsset } from '@/lib/media/media-library-service';
import { listFolders, deleteFolder } from '@/lib/media/media-folders-service';
import { listAvatarProfiles, type AvatarProfile } from '@/lib/video/avatar-profile-service';
import { logger } from '@/lib/logger/logger';

const FILE = 'video/project-media-cleanup.ts';

/** Every image URL a saved character profile owns — these are NEVER deleted by a scrap. */
export function savedCharacterImageUrls(p: AvatarProfile): string[] {
  return [
    p.frontalImageUrl,
    ...(p.additionalImageUrls ?? []),
    p.fullBodyImageUrl ?? '',
    p.upperBodyImageUrl ?? '',
    ...(p.looks ?? []).flatMap((look) => look.imageUrls ?? []),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/** The set of all saved-character image URLs for an owner (the protected set). */
export async function collectProtectedCharacterUrls(userId: string): Promise<Set<string>> {
  const profiles = await listAvatarProfiles(userId, { ownOnly: true });
  const urls = new Set<string>();
  for (const p of profiles) {
    for (const u of savedCharacterImageUrls(p)) {
      urls.add(u);
    }
  }
  return urls;
}

export interface ProjectMediaCleanupResult {
  removed: number;
  skippedProtected: number;
  folderRemoved: boolean;
}

/**
 * Delete every media asset tied to `projectId` EXCEPT images owned by a saved character,
 * and remove the project's library folder. Best-effort: a single failed delete does not
 * abort the rest. `userId` owns the Character Library whose images are protected.
 */
export async function deleteProjectMedia(
  projectId: string,
  userId: string,
): Promise<ProjectMediaCleanupResult> {
  const protectedUrls = await collectProtectedCharacterUrls(userId);

  // High cap: a busy project can hold many stills/clips. (A paginated sweep can replace
  // this if a single project ever exceeds it — logged so a truncation is never silent.)
  const { assets } = await listAssets({ projectId, limit: 1000 });
  if (assets.length >= 1000) {
    logger.warn('[project-media-cleanup] hit the 1000-asset cap — some media may remain', {
      file: FILE,
      projectId,
    });
  }

  let skippedProtected = 0;
  const deletable = assets.filter((a) => {
    if (protectedUrls.has(a.url)) {
      skippedProtected += 1;
      return false;
    }
    return true;
  });

  const removed = (await Promise.all(deletable.map((a) => deleteAsset(a.id)))).filter(Boolean).length;

  const folders = await listFolders();
  const projectFolder = folders.find((f) => f.projectId === projectId);
  let folderRemoved = false;
  if (projectFolder) {
    await deleteFolder(projectFolder.id);
    folderRemoved = true;
  }

  logger.info('[project-media-cleanup] scrapped project media', {
    file: FILE,
    projectId,
    removed,
    skippedProtected,
    folderRemoved,
  });
  return { removed, skippedProtected, folderRemoved };
}
