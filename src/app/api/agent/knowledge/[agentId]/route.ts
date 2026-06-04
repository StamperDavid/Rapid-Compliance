import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { processKnowledgeBase } from '@/lib/agent/knowledge-processor';
import { transcribeAudioBuffer } from '@/lib/video/transcription-service';
import { indexKnowledgeBase } from '@/lib/agent/vector-search';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getAgentById } from '@/lib/agents/agent-registry';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { successResponse } from '@/lib/api/error-handler';
import { getSubCollection } from '@/lib/firebase/collections';
import type { KnowledgeBase, KnowledgeDocument } from '@/types/agent-memory';

export const dynamic = 'force-dynamic';

/**
 * PER-AGENT KNOWLEDGE BASE
 *
 * Each agent gets its OWN isolated knowledge base, stored at
 * knowledgeBase/{agentId} (canonical registry id, e.g. 'COPYWRITER'). Vectors
 * for the agent are tagged with agentId so retrieval never bleeds across agents.
 *
 *   GET    /api/agent/knowledge/[agentId]   → list this agent's KB contents
 *   POST   /api/agent/knowledge/[agentId]   → add files / URLs / FAQs / pasted text (merges)
 *   DELETE /api/agent/knowledge/[agentId]   → remove one item by { itemType, itemId }
 *
 * POST and DELETE re-index this agent's vectors only (indexKnowledgeBase(agentId)
 * deletes the agent's old embeddings first, so a re-index never leaves stale dupes).
 */

const FILE = 'api/agent/knowledge/[agentId]/route.ts';

/** Asset role tags so "example work" is distinguishable from reference material in the UI. */
type AssetType = 'document' | 'example' | 'reference';
const ASSET_TYPES: readonly AssetType[] = ['document', 'example', 'reference'];

interface ParsedUpload {
  files: File[];
  urls: string[];
  faqs: string | null;
  pastedText: string | null;
  pastedTitle: string | null;
  assetType: AssetType;
}

function parseAssetType(raw: FormDataEntryValue | null): AssetType {
  return typeof raw === 'string' && (ASSET_TYPES as readonly string[]).includes(raw)
    ? (raw as AssetType)
    : 'document';
}

/** Audio/video files are transcribed to text via Deepgram, not parsed as documents. */
const MEDIA_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4a', 'mp3', 'wav', 'aac', 'ogg', 'mkv', 'avi'];
function isMediaFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MEDIA_EXTENSIONS.includes(ext);
}

function parseUrlsArray(urlsJson: FormDataEntryValue | null): string[] {
  if (typeof urlsJson !== 'string' || urlsJson.length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(urlsJson);
    return Array.isArray(parsed) ? parsed.filter((i): i is string => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

function parseUpload(formData: FormData): ParsedUpload {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  const faqs = formData.get('faqs');
  const pastedText = formData.get('pastedText');
  const pastedTitle = formData.get('pastedTitle');
  return {
    files,
    urls: parseUrlsArray(formData.get('urls')),
    faqs: typeof faqs === 'string' && faqs.trim().length > 0 ? faqs : null,
    pastedText: typeof pastedText === 'string' && pastedText.trim().length > 0 ? pastedText : null,
    pastedTitle: typeof pastedTitle === 'string' && pastedTitle.trim().length > 0 ? pastedTitle : null,
    assetType: parseAssetType(formData.get('assetType')),
  };
}

/** Resolve + validate the agent id from the route, or return a 404 response. */
function resolveAgentId(agentId: string): string | NextResponse {
  const trimmed = agentId.trim();
  if (trimmed.length === 0 || !getAgentById(trimmed)) {
    return errors.notFound(`Unknown agent '${agentId}'`);
  }
  return trimmed;
}

async function loadAgentKB(agentId: string): Promise<KnowledgeBase> {
  const existing = await AdminFirestoreService.get<KnowledgeBase>(
    getSubCollection('knowledgeBase'),
    agentId,
  );
  return existing ?? { documents: [], urls: [], faqs: [] };
}

// ── GET: list this agent's knowledge ────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { agentId: rawId } = await params;
    const resolved = resolveAgentId(rawId);
    if (resolved instanceof NextResponse) { return resolved; }
    const agentId = resolved;

    const kb = await loadAgentKB(agentId);
    const agent = getAgentById(agentId);

    return successResponse({
      agentId,
      agentName: agent?.name ?? agentId,
      documents: kb.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        type: d.type,
        assetType: (d.metadata?.assetType as AssetType | undefined) ?? 'document',
        uploadedAt: d.uploadedAt,
        chars: d.extractedContent.length,
      })),
      urls: kb.urls.map((u) => ({ id: u.id, url: u.url, title: u.title ?? u.url, addedAt: u.addedAt })),
      faqs: kb.faqs.map((f) => ({ id: f.id, question: f.question, category: f.category ?? null })),
      counts: {
        documents: kb.documents.length,
        urls: kb.urls.length,
        faqs: kb.faqs.length,
      },
    });
  } catch (error) {
    logger.error('Per-agent knowledge GET failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return errors.internal('Failed to load agent knowledge', error instanceof Error ? error : undefined);
  }
}

// ── POST: add knowledge (merges into the agent's existing KB) ────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/knowledge/upload');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { agentId: rawId } = await params;
    const resolved = resolveAgentId(rawId);
    if (resolved instanceof NextResponse) { return resolved; }
    const agentId = resolved;

    const upload = parseUpload(await request.formData());

    if (
      upload.files.length === 0 &&
      upload.urls.length === 0 &&
      !upload.faqs &&
      !upload.pastedText
    ) {
      return errors.badRequest('Nothing to upload — provide at least one file, URL, FAQ, or pasted text.');
    }

    // Split audio/video off — Deepgram transcribes those to text; everything
    // else (PDF/Word/Excel/text) goes through the document/URL/FAQ processor.
    const mediaFiles = upload.files.filter((f) => isMediaFile(f.name));
    const docFiles = upload.files.filter((f) => !isMediaFile(f.name));

    // Build KB entries from the non-media inputs (files / urls / faqs).
    const fresh = await processKnowledgeBase({
      uploadedFiles: docFiles,
      urls: upload.urls,
      faqs: upload.faqs ?? undefined,
    });

    // Tag uploaded documents with the chosen asset role (document/example/reference).
    fresh.documents = fresh.documents.map((d) => ({
      ...d,
      metadata: { ...(d.metadata ?? {}), assetType: upload.assetType },
    }));

    // Transcribe each audio/video file and store the transcript as a text document.
    let transcribed = 0;
    let mediaFailed = 0;
    for (const media of mediaFiles) {
      try {
        const buffer = Buffer.from(await media.arrayBuffer());
        const result = await transcribeAudioBuffer(buffer);
        if (result && result.transcript.trim().length > 0) {
          fresh.documents.push({
            id: `doc_av_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            filename: media.name,
            type: 'text',
            uploadedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
            extractedContent: result.transcript,
            metadata: {
              assetType: upload.assetType,
              source: 'video-transcript',
              durationSeconds: result.durationSeconds,
            },
          });
          transcribed += 1;
        } else {
          // Null = Deepgram key missing or no speech found. Don't fail the whole
          // upload; report it so the operator knows the video didn't land.
          mediaFailed += 1;
        }
      } catch (mediaErr) {
        mediaFailed += 1;
        logger.warn('Media transcription failed', {
          file: FILE,
          agentId,
          name: media.name,
          error: mediaErr instanceof Error ? mediaErr.message : String(mediaErr),
        });
      }
    }

    // Pasted text → a plain-text document so it gets embedded like any other doc.
    if (upload.pastedText) {
      const pasted: KnowledgeDocument = {
        id: `doc_paste_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        filename: upload.pastedTitle ?? 'Pasted note',
        type: 'text',
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        extractedContent: upload.pastedText,
        metadata: { assetType: upload.assetType, source: 'pasted' },
      };
      fresh.documents.push(pasted);
    }

    // Merge with whatever the agent already has.
    const existing = await loadAgentKB(agentId);
    const merged: KnowledgeBase = {
      ...existing,
      documents: [...existing.documents, ...fresh.documents],
      urls: [...existing.urls, ...fresh.urls],
      faqs: [...existing.faqs, ...fresh.faqs],
    };

    await AdminFirestoreService.set(
      getSubCollection('knowledgeBase'),
      agentId,
      { ...merged, agentId, updatedAt: new Date().toISOString() },
      false,
    );

    // Re-embed this agent's KB (clears its old vectors first).
    try {
      await indexKnowledgeBase(agentId);
    } catch (indexError) {
      logger.warn('Per-agent re-index failed (content saved, search may lag)', {
        file: FILE,
        agentId,
        error: indexError instanceof Error ? indexError.message : String(indexError),
      });
    }

    return successResponse({
      agentId,
      added: {
        documents: fresh.documents.length,
        urls: fresh.urls.length,
        faqs: fresh.faqs.length,
      },
      media: { transcribed, failed: mediaFailed },
      counts: {
        documents: merged.documents.length,
        urls: merged.urls.length,
        faqs: merged.faqs.length,
      },
    });
  } catch (error) {
    logger.error('Per-agent knowledge POST failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return errors.internal('Failed to add agent knowledge', error instanceof Error ? error : undefined);
  }
}

// ── DELETE: remove one item from the agent's KB ─────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { agentId: rawId } = await params;
    const resolved = resolveAgentId(rawId);
    if (resolved instanceof NextResponse) { return resolved; }
    const agentId = resolved;

    const body = (await request.json().catch(() => null)) as
      | { itemType?: string; itemId?: string }
      | null;
    const itemType = body?.itemType;
    const itemId = body?.itemId;
    if (
      (itemType !== 'document' && itemType !== 'url' && itemType !== 'faq') ||
      typeof itemId !== 'string' ||
      itemId.length === 0
    ) {
      return errors.badRequest('Provide itemType ("document" | "url" | "faq") and itemId.');
    }

    const kb = await loadAgentKB(agentId);
    const before =
      itemType === 'document' ? kb.documents.length : itemType === 'url' ? kb.urls.length : kb.faqs.length;

    if (itemType === 'document') {
      kb.documents = kb.documents.filter((d) => d.id !== itemId);
    } else if (itemType === 'url') {
      kb.urls = kb.urls.filter((u) => u.id !== itemId);
    } else {
      kb.faqs = kb.faqs.filter((f) => f.id !== itemId);
    }

    const after =
      itemType === 'document' ? kb.documents.length : itemType === 'url' ? kb.urls.length : kb.faqs.length;
    if (after === before) {
      return errors.notFound(`No ${itemType} with id '${itemId}' in this agent's knowledge.`);
    }

    await AdminFirestoreService.set(
      getSubCollection('knowledgeBase'),
      agentId,
      { ...kb, agentId, updatedAt: new Date().toISOString() },
      false,
    );

    try {
      await indexKnowledgeBase(agentId);
    } catch (indexError) {
      logger.warn('Per-agent re-index after delete failed', {
        file: FILE,
        agentId,
        error: indexError instanceof Error ? indexError.message : String(indexError),
      });
    }

    return successResponse({
      agentId,
      removed: { itemType, itemId },
      counts: { documents: kb.documents.length, urls: kb.urls.length, faqs: kb.faqs.length },
    });
  } catch (error) {
    logger.error('Per-agent knowledge DELETE failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return errors.internal('Failed to delete agent knowledge', error instanceof Error ? error : undefined);
  }
}
