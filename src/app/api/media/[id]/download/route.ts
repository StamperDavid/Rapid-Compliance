/**
 * Media Asset Download Proxy.
 *
 * GET /api/media/[id]/download — stream one asset's bytes back to the browser
 * with an attachment header.
 *
 * Why a proxy: the library's download button used to `fetch(asset.url)` directly
 * against the Firebase Storage URL. Reading a cross-origin response body via
 * `fetch()` requires CORS headers the Storage bucket does not send by default, so
 * the fetch was rejected and the click silently did nothing. Fetching server-side
 * is not subject to browser CORS, so we pull the file here and re-serve it
 * same-origin — the download then always works, regardless of bucket CORS.
 *
 * Auth: requires a valid Firebase Bearer token (same as the rest of /api/media).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAsset } from '@/lib/media/media-library-service';

export const dynamic = 'force-dynamic';

/**
 * Build an RFC 6266-safe Content-Disposition value. HTTP headers are ByteStrings
 * (latin-1), so a non-ASCII character in the asset name (em-dash, emoji, accent)
 * THROWS when set as a header. We emit BOTH an ASCII-only `filename="..."` fallback
 * and a percent-encoded `filename*=UTF-8''...` that modern browsers prefer.
 */
function contentDisposition(name: string | null | undefined, id: string): string {
  const raw = name && name.trim().length > 0 ? name : id;
  const base = (raw.split('/').pop() ?? raw).replace(/["\r\n]/g, '').trim() || id;
  // ASCII fallback: replace anything outside printable ASCII (incl. em-dash, emoji).
  const ascii = base.replace(/[^\x20-\x7E]/g, '_') || id;
  const encoded = encodeURIComponent(base);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const asset = await getAsset(id);
    if (!asset?.url) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }

    // `no-store`: never run the file bytes through Next's data cache — binaries
    // over 2MB can't be cached anyway (it just logs a warning) and there's no
    // value in caching a one-shot download.
    const upstream = await fetch(asset.url, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      logger.warn('Media download upstream fetch failed', {
        file: 'api/media/[id]/download/route.ts',
        id,
        status: upstream.status,
      });
      return NextResponse.json(
        { success: false, error: 'Could not retrieve the file from storage' },
        { status: 502 },
      );
    }

    const contentType =
      (asset.mimeType && asset.mimeType.trim().length > 0 ? asset.mimeType : null) ??
      upstream.headers.get('content-type') ??
      'application/octet-stream';

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', contentDisposition(asset.name, asset.id));
    headers.set('Cache-Control', 'private, no-store');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Stream the upstream body straight through — no full-file buffering.
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    logger.error(
      'Failed to download media asset',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/media/[id]/download/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to download media asset' },
      { status: 500 },
    );
  }
}
