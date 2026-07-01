/**
 * Lightweight site discovery (Phase 0 of the clone workspace).
 *
 * Given a start URL, this fetches the page over plain HTTP and parses the HTML
 * with cheerio to enumerate the same-origin internal pages a user might want to
 * clone. There is NO headless browser here — discovery is intentionally cheap
 * and fast so the UI can list candidate pages the moment a URL is pasted. The
 * heavy, faithful capture happens later, per selected page, in the clone/run
 * route via `captureSite`.
 *
 * This module is isolated: it does not import from (or modify) the capture/map
 * engine, the editor, the renderer, or the legacy migrate/deep-scraper code.
 */

import * as cheerio from 'cheerio';

/** One discovered candidate page. */
export interface DiscoveredPage {
  /** Same-origin pathname (normalized, e.g. `/`, `/about`, `/pricing`). */
  path: string;
  /** Absolute URL of the page. */
  url: string;
  /** Best-effort page title (falls back to the path when unavailable). */
  title: string;
}

const DEFAULT_MAX_PAGES = 25;
/** Per-fetch timeout so a slow page never stalls discovery. */
const FETCH_TIMEOUT_MS = 8_000;
/** How many title fetches run at once. */
const TITLE_CONCURRENCY = 5;
/** Browser-like UA so bot-averse sites still serve the markup. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 SalesVelocityCloneBot/1.0';

/** File extensions that are assets/downloads, never HTML pages. */
const NON_PAGE_EXTENSIONS = new Set<string>([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.zip', '.rar', '.gz', '.tar', '.dmg', '.exe', '.mp4', '.webm', '.mov',
  '.mp3', '.wav', '.css', '.js', '.json', '.xml', '.rss', '.txt', '.doc',
  '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf',
]);

/** `fetch` with a hard timeout via AbortController. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** True when a pathname points at a downloadable asset rather than a page. */
function looksLikeAsset(pathname: string): boolean {
  const lastDot = pathname.lastIndexOf('.');
  if (lastDot === -1) {
    return false;
  }
  const ext = pathname.slice(lastDot).toLowerCase();
  return NON_PAGE_EXTENSIONS.has(ext);
}

/** Normalize a pathname for dedupe: strip a trailing slash (except root). */
function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '');
  }
  return pathname === '' ? '/' : pathname;
}

/**
 * Resolve an `<a href>` against the origin, returning a same-origin, page-like
 * absolute URL — or `null` if it should be skipped (off-origin, mailto:, tel:,
 * pure `#` anchor, javascript:, or an asset/download).
 */
function resolveInternalLink(href: string, origin: URL): URL | null {
  const raw = href.trim();
  if (raw === '') {
    return null;
  }
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    raw.startsWith('#')
  ) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(raw, origin);
  } catch {
    return null;
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    return null;
  }
  if (resolved.host !== origin.host) {
    return null;
  }
  if (looksLikeAsset(resolved.pathname)) {
    return null;
  }

  // Drop hash + search so anchors/tracking params don't create duplicate pages.
  resolved.hash = '';
  resolved.search = '';
  resolved.pathname = normalizePath(resolved.pathname);
  return resolved;
}

/** Best-effort title fetch for a single URL; falls back to the given path. */
async function fetchTitle(url: string, fallbackPath: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return fallbackPath;
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      return fallbackPath;
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    return title !== '' ? title : fallbackPath;
  } catch {
    return fallbackPath;
  }
}

/** Run `worker` over `items` with a bounded concurrency pool. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Discover same-origin pages reachable from `url`.
 *
 * The start URL is ALWAYS the first entry. Discovery is a single-page link
 * harvest (not a recursive crawl): it reads the anchors on the start page,
 * keeps same-origin page-like links, dedupes by pathname, caps at `maxPages`,
 * then fetches each page's `<title>` (bounded concurrency, per-page timeout).
 *
 * @throws Error with a clear message when the start URL cannot be fetched.
 */
export async function discoverPages(
  url: string,
  opts: { maxPages?: number } = {},
): Promise<DiscoveredPage[]> {
  const maxPages = Math.max(1, opts.maxPages ?? DEFAULT_MAX_PAGES);

  let startUrl: URL;
  try {
    startUrl = new URL(url);
  } catch {
    throw new Error(`discoverPages: invalid URL "${url}"`);
  }
  if (startUrl.protocol !== 'http:' && startUrl.protocol !== 'https:') {
    throw new Error(`discoverPages: only http(s) URLs are supported (got "${startUrl.protocol}")`);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(startUrl.href, FETCH_TIMEOUT_MS);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`discoverPages: failed to fetch "${startUrl.href}": ${reason}`);
  }
  if (!response.ok) {
    throw new Error(`discoverPages: "${startUrl.href}" responded ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // The start URL, normalized, is always first.
  const startPath = normalizePath(startUrl.pathname);
  const seen = new Map<string, URL>();
  const startCanonical = new URL(startUrl.href);
  startCanonical.hash = '';
  startCanonical.search = '';
  startCanonical.pathname = startPath;
  seen.set(startPath, startCanonical);

  $('a[href]').each((_i, el) => {
    if (seen.size >= maxPages) {
      return false; // stop iterating once capped
    }
    const href = $(el).attr('href');
    if (href === undefined) {
      return undefined;
    }
    const resolved = resolveInternalLink(href, startUrl);
    if (resolved === null) {
      return undefined;
    }
    if (!seen.has(resolved.pathname)) {
      seen.set(resolved.pathname, resolved);
    }
    return undefined;
  });

  const ordered = Array.from(seen.values()).slice(0, maxPages);

  const pages = await mapWithConcurrency(ordered, TITLE_CONCURRENCY, async (pageUrl) => {
    const path = pageUrl.pathname;
    const title = await fetchTitle(pageUrl.href, path);
    return { path, url: pageUrl.href, title };
  });

  return pages;
}
