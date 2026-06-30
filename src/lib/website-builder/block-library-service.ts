/**
 * Block Library Service
 *
 * Loads the section/block library the website editor offers in its Block
 * Library panel, and saves operator-curated sections as reusable org-scoped
 * blocks.
 *
 * Two sources:
 *  - `premade`: the curated, code-shipped catalog (`PREMADE_BLOCKS`). Always
 *    available, no network call.
 *  - `saved`:   the org's own saved blocks, fetched from `GET /api/website/blocks`.
 *
 * This module is intentionally framework-agnostic: it never imports React or
 * any hook. The editor passes its authenticated `fetch` (Bearer token via
 * `useAuthFetch`) into the calls that need auth, so the service stays a plain
 * data layer that is trivial to unit-test.
 */

import type { PageSection } from '@/types/website';
import { PREMADE_BLOCKS, type BlockCategory, type SectionBlock } from './section-blocks';

/** Path of the saved-blocks API route (GET list / POST save). */
export const BLOCKS_API_PATH = '/api/website/blocks';

/**
 * A string-URL fetch — matches both the global `fetch` and the editor's
 * `useAuthFetch` result (which only accepts string URLs). The service only ever
 * calls with a string path, so this narrower shape is all it needs.
 */
export type FetchLike = (url: string, options?: RequestInit) => Promise<Response>;

interface SavedBlocksResponse {
  blocks?: unknown;
}

interface SaveBlockResponse {
  block?: unknown;
}

/**
 * Narrow an unknown value coming back from the API into a `SectionBlock`.
 * Returns `null` if the essential shape is missing, so a malformed saved doc
 * never crashes the editor.
 */
function toSectionBlock(value: unknown): SectionBlock | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { id, name, category, section } = record;

  if (typeof id !== 'string' || typeof name !== 'string' || typeof category !== 'string') {
    return null;
  }
  if (typeof section !== 'object' || section === null) {
    return null;
  }
  const sectionRecord = section as Record<string, unknown>;
  if (sectionRecord.type !== 'section' || !Array.isArray(sectionRecord.columns)) {
    return null;
  }

  return {
    id,
    name,
    category: category as BlockCategory,
    section: section as PageSection,
  };
}

/**
 * Load both block sources.
 *
 * `premade` always resolves from the in-bundle catalog. `saved` is fetched
 * over the network and is FAIL-SAFE: any error (network, auth, malformed body)
 * resolves `saved` to `[]` rather than throwing, so the Block Library always
 * opens.
 *
 * @param authFetch Optional authenticated fetch (Bearer) so saved blocks load
 *   for the signed-in operator. Defaults to the global `fetch`; callable as
 *   `loadBlocks()` when auth isn't wired.
 */
export async function loadBlocks(
  authFetch: FetchLike = fetch,
): Promise<{ premade: SectionBlock[]; saved: SectionBlock[] }> {
  const premade = PREMADE_BLOCKS;

  let saved: SectionBlock[] = [];
  try {
    const response = await authFetch(BLOCKS_API_PATH, { method: 'GET' });
    if (response.ok) {
      const body = (await response.json()) as SavedBlocksResponse;
      if (Array.isArray(body.blocks)) {
        saved = body.blocks
          .map(toSectionBlock)
          .filter((block): block is SectionBlock => block !== null);
      }
    }
  } catch {
    // Fail-safe: saved blocks are optional; never block the editor on them.
    saved = [];
  }

  return { premade, saved };
}

/**
 * Save a section as a reusable org-scoped block.
 *
 * @param input     The block to persist (name + category + the section itself).
 * @param authFetch The editor's authenticated fetch (Bearer via `useAuthFetch`).
 * @returns The persisted `SectionBlock` (with its server-generated id), or
 *   `null` on any failure.
 */
export async function saveBlock(
  input: { name: string; category: BlockCategory; section: PageSection },
  authFetch: FetchLike,
): Promise<SectionBlock | null> {
  try {
    const response = await authFetch(BLOCKS_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as SaveBlockResponse;
    return toSectionBlock(body.block);
  } catch {
    return null;
  }
}
