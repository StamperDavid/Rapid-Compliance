/**
 * GET/POST /api/seo/research
 *
 * Persist and retrieve SEO research results (domain analyses, strategies,
 * competitor discoveries, battlecards) so they survive page refreshes.
 *
 * GET  — List saved research, optionally filtered by type/domain/tags.
 * POST — Save a new research document.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { adminDb } from '@/lib/firebase/admin';
import { getSeoResearchCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { FieldValue } from 'firebase-admin/firestore';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const ResearchTypeEnum = z.enum([
  'domain_analysis',
  'strategy',
  'competitor_discovery',
  'battlecard',
]);

const SaveResearchSchema = z.object({
  type: ResearchTypeEnum,
  domain: z.string().min(1),
  data: z.record(z.unknown()),
  tags: z.array(z.string()).optional(),
});

const ListQuerySchema = z.object({
  type: ResearchTypeEnum.optional(),
  domain: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ── Types ───────────────────────────────────────────────────────────────────

interface SeoResearchDoc {
  id: string;
  type: z.infer<typeof ResearchTypeEnum>;
  domain: string;
  data: Record<string, unknown>;
  tags: string[];
  createdAt: FirebaseFirestore.Timestamp;
  createdBy: string;
}

// ── GET — list saved research ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!adminDb) {
    return errors.internal('Database not available');
  }

  try {
    const url = new URL(request.url);
    const parsed = ListQuerySchema.safeParse({
      type: url.searchParams.get('type') ?? undefined,
      domain: url.searchParams.get('domain') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid query' },
        { status: 400 },
      );
    }

    const { type, domain, limit: queryLimit } = parsed.data;
    const collectionPath = getSeoResearchCollection();
    let query: FirebaseFirestore.Query = adminDb.collection(collectionPath)
      .orderBy('createdAt', 'desc');

    if (type) {
      query = query.where('type', '==', type);
    }
    if (domain) {
      query = query.where('domain', '==', domain.toLowerCase());
    }

    query = query.limit(queryLimit ?? 50);

    const snap = await query.get();
    const results: SeoResearchDoc[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SeoResearchDoc, 'id'>),
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    logger.error('SEO research list error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to list SEO research', err instanceof Error ? err : undefined);
  }
}

// ── POST — save new research ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!adminDb) {
    return errors.internal('Database not available');
  }

  try {
    const body: unknown = await request.json();
    const parsed = SaveResearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const { type, domain, data, tags } = parsed.data;
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();

    const collectionPath = getSeoResearchCollection();
    const docRef = await adminDb.collection(collectionPath).add({
      type,
      domain: cleanDomain,
      data,
      tags: tags ?? [],
      createdAt: FieldValue.serverTimestamp(),
      createdBy: authResult.user.uid,
    });

    logger.info('SEO research saved', { type, domain: cleanDomain, docId: docRef.id });

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (err) {
    logger.error('SEO research save error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to save SEO research', err instanceof Error ? err : undefined);
  }
}
