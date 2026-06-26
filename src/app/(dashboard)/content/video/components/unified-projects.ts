/**
 * ONE source of truth for "the operator's video projects" — merges BOTH project
 * stores (the classic Studio pipeline AND the shot-doc VideoProjects) into a single
 * tagged list. Every project surface (the Studio "Load Project" popup AND the Video
 * Projects cards page) imports THIS, so they can never disagree again. Each row knows
 * its `system`, so a click opens the right surface and delete hits the right endpoint.
 */

export interface UnifiedProjectRow {
  id: string;
  name: string;
  /** 'studio' = classic pipeline (loads into the Studio editor); 'project' = shot-doc VideoProject (opens its review page). */
  system: 'studio' | 'project';
  status: string;
  /** docCount (shot-doc) or sceneCount (studio). */
  sceneCount: number;
  hasVideo: boolean;
  updatedAt: string;
  createdByName: string | null;
  finalVideoUrl: string | null;
}

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Fetch BOTH stores and merge into one newest-first list. A store that fails is skipped. */
export async function fetchUnifiedVideoProjects(authFetch: AuthFetch): Promise<UnifiedProjectRow[]> {
  const [studioRes, docRes] = await Promise.all([
    authFetch('/api/video/project/list').catch(() => null),
    authFetch('/api/video-project').catch(() => null),
  ]);

  const rows: UnifiedProjectRow[] = [];

  if (studioRes?.ok) {
    const data = (await studioRes.json()) as {
      success: boolean;
      projects?: Array<{ id: string; name: string; status: string; sceneCount: number; hasVideo: boolean; updatedAt: string }>;
    };
    if (data.success && data.projects) {
      for (const p of data.projects) {
        rows.push({
          id: p.id, name: p.name, system: 'studio', status: p.status,
          sceneCount: p.sceneCount, hasVideo: p.hasVideo, updatedAt: p.updatedAt,
          createdByName: null, finalVideoUrl: null,
        });
      }
    }
  }

  if (docRes?.ok) {
    const data = (await docRes.json()) as {
      success: boolean;
      projects?: Array<{ id: string; title: string; status: string; docCount: number; docsWithVideo: number; finalVideoUrl?: string; createdBy?: { name: string } | null; updatedAt: string }>;
    };
    if (data.success && data.projects) {
      for (const p of data.projects) {
        rows.push({
          id: p.id, name: p.title, system: 'project', status: p.status,
          sceneCount: p.docCount, hasVideo: p.docsWithVideo > 0, updatedAt: p.updatedAt,
          createdByName: p.createdBy?.name ?? null, finalVideoUrl: p.finalVideoUrl ?? null,
        });
      }
    }
  }

  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return rows;
}

/** Where a click opens this project — the correct surface for its store. */
export function videoProjectOpenPath(row: Pick<UnifiedProjectRow, 'id' | 'system'>): string {
  return row.system === 'project'
    ? `/content/video/projects/${row.id}`
    : `/content/video?load=${row.id}`;
}

/** The delete endpoint for this project's store. */
export function videoProjectDeleteEndpoint(row: Pick<UnifiedProjectRow, 'id' | 'system'>): string {
  return row.system === 'project'
    ? `/api/video-project/${row.id}`
    : `/api/video/project/${row.id}`;
}
