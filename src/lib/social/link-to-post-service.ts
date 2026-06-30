/**
 * Link / Article → Post Service
 *
 * Powers the composer's "Turn a link or article into a post" control. The
 * operator pastes an article URL OR the article text; the REAL per-platform
 * marketing specialist (Brand DNA baked into its Golden Master, Standing Rule
 * #1) drafts a brand-voiced post summarizing/promoting it.
 *
 * URL fetching is SSRF-guarded: only http(s) is allowed, and requests to
 * localhost / private / link-local / cloud-metadata hosts are blocked. Pasted
 * text is the simple, always-available path; if a URL fetch fails we ask the
 * operator to paste the text instead.
 *
 * Standing Rule #2: nothing here touches a Golden Master document.
 *
 * @module lib/social/link-to-post-service
 */

import { logger } from '@/lib/logger/logger';
import type { SocialPlatform } from '@/types/social';
import { extractPrimaryText, runSpecialistGenerate } from './composer-specialist';

const FILE = 'lib/social/link-to-post-service.ts';

/** Hard caps so a hostile/huge page can't exhaust memory or time. */
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000; // 2 MB of HTML is plenty for an article.
const MAX_EXTRACTED_CHARS = 12000; // What we actually hand the specialist.

export interface LinkToPostInput {
  platform: SocialPlatform;
  contentType: string;
  /** Either a URL to fetch, or pasted article text. Exactly one is used. */
  url?: string;
  articleText?: string;
  /** Optional operator steer, e.g. "focus on the pricing angle". */
  angle?: string;
}

export interface LinkToPostResult {
  text: string;
  /** Where the source text came from, for the UI to message honestly. */
  source: 'url' | 'pasted';
}

/** A user-facing error that should be shown verbatim (not a 500). */
export class LinkFetchError extends Error {}

// ─── SSRF-safe URL validation ───────────────────────────────────────────────

/** Quick check for an IPv4 dotted-quad in a private / reserved range. */
function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) { return false; }
  const octets = m.slice(1).map((n) => Number.parseInt(n, 10));
  if (octets.some((o) => o > 255)) { return true; } // malformed → treat as unsafe
  const [a, b] = octets;
  if (a === 10) { return true; }
  if (a === 127) { return true; } // loopback
  if (a === 0) { return true; }
  if (a === 169 && b === 254) { return true; } // link-local + cloud metadata
  if (a === 192 && b === 168) { return true; }
  if (a === 172 && b >= 16 && b <= 31) { return true; }
  if (a >= 224) { return true; } // multicast / reserved
  return false;
}

/** Block obvious private/loopback IPv6 + unspecified addresses. */
function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (h === '::1' || h === '::') { return true; }
  if (h.startsWith('fc') || h.startsWith('fd')) { return true; } // unique-local
  if (h.startsWith('fe80')) { return true; } // link-local
  if (h.startsWith('::ffff:')) {
    return isPrivateIpv4(h.replace('::ffff:', ''));
  }
  return false;
}

/**
 * Validate a URL is safe to fetch server-side. Throws LinkFetchError with a
 * plain-English reason on anything suspicious.
 */
function assertSafeUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new LinkFetchError("That doesn't look like a valid web address. Please check the link or paste the article text.");
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new LinkFetchError('Only http and https links can be fetched. Please paste the article text instead.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new LinkFetchError('That address points to a private/local host, which we don\'t fetch. Please paste the article text instead.');
  }

  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new LinkFetchError('That address points to a private network, which we don\'t fetch. Please paste the article text instead.');
  }

  return parsed;
}

// ─── HTML → text ────────────────────────────────────────────────────────────

/** Strip a fetched HTML document down to readable plain text. */
function htmlToText(html: string): string {
  return html
    // Drop non-content elements wholesale.
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Block-level tags → newlines so paragraphs survive.
    .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remaining tags → gone.
    .replace(/<[^>]+>/g, ' ')
    // Decode the few entities that matter for readability.
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Collapse whitespace.
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Max redirect hops to follow (each one re-validated against the SSRF rules). */
const MAX_REDIRECTS = 5;

/**
 * Fetch a URL safely and return extracted article text. Throws LinkFetchError.
 *
 * Redirects are followed MANUALLY so every hop's target is re-validated with
 * assertSafeUrl — otherwise a public URL could 30x-redirect to an internal host
 * (e.g. the cloud-metadata endpoint), bypassing the initial host check (SSRF).
 */
async function fetchArticleText(rawUrl: string): Promise<string> {
  let currentUrl = assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response | null = null;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      let r: Response;
      try {
        r = await fetch(currentUrl.toString(), {
          method: 'GET',
          // Manual: we re-validate each redirect target ourselves below.
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            // A real UA — many sites 403 the default fetch agent.
            'User-Agent': 'Mozilla/5.0 (compatible; SalesVelocityBot/1.0; +https://salesvelocity.ai/bot)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
      } catch (err) {
        logger.warn('[LinkToPost] URL fetch failed', { file: FILE, url: currentUrl.hostname });
        if (err instanceof Error && err.name === 'AbortError') {
          throw new LinkFetchError('That page took too long to load. Please paste the article text instead.');
        }
        throw new LinkFetchError("We couldn't reach that link. Please check it or paste the article text instead.");
      }

      // Follow redirects ourselves, re-validating each target host (blocks a
      // public → internal redirect SSRF bypass).
      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get('location');
        if (!location) {
          throw new LinkFetchError("We couldn't reach that link. Please check it or paste the article text instead.");
        }
        let next: URL;
        try {
          next = new URL(location, currentUrl);
        } catch {
          throw new LinkFetchError("That link redirects somewhere we can't read. Please paste the article text instead.");
        }
        currentUrl = assertSafeUrl(next.toString()); // throws LinkFetchError if the hop is unsafe
        continue;
      }

      res = r;
      break;
    }
  } finally {
    clearTimeout(timer);
  }

  if (!res) {
    throw new LinkFetchError('That link redirected too many times. Please paste the article text instead.');
  }

  if (!res.ok) {
    throw new LinkFetchError(`That link returned an error (HTTP ${res.status}). Please paste the article text instead.`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('html') && !contentType.includes('text')) {
    throw new LinkFetchError("That link isn't a readable article page. Please paste the article text instead.");
  }

  // Read with a byte cap.
  const buf = await res.arrayBuffer();
  const sliced = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
  const html = new TextDecoder('utf-8', { fatal: false }).decode(sliced);

  const text = htmlToText(html);
  if (text.length < 80) {
    throw new LinkFetchError("We couldn't pull readable text from that page. Please paste the article text instead.");
  }
  return text.slice(0, MAX_EXTRACTED_CHARS);
}

// ─── Topic brief ────────────────────────────────────────────────────────────

function buildTopic(articleText: string, angle: string | undefined, fromUrl: string | undefined): string {
  const lines: string[] = [
    'Write a single social post that promotes / summarizes the article below for our audience.',
    'Capture the most interesting, valuable hook — do not just restate the headline. Stay in the brand voice and keep it natural for this platform.',
  ];
  if (fromUrl) {
    lines.push(`The article lives at: ${fromUrl} (you may reference that it links out, but do not invent a different URL).`);
  }
  if (angle && angle.trim().length > 0) {
    lines.push(`Angle the operator wants emphasized: ${angle.trim()}`);
  }
  lines.push('Return the post as the primary post text.', '', 'ARTICLE SOURCE TEXT:', '"""', articleText, '"""');
  return lines.join('\n');
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function runLinkToPost(input: LinkToPostInput): Promise<LinkToPostResult> {
  let articleText: string;
  let source: 'url' | 'pasted';

  if (input.articleText && input.articleText.trim().length > 0) {
    articleText = input.articleText.trim().slice(0, MAX_EXTRACTED_CHARS);
    source = 'pasted';
  } else if (input.url && input.url.trim().length > 0) {
    articleText = await fetchArticleText(input.url.trim());
    source = 'url';
  } else {
    throw new LinkFetchError('Paste an article URL or the article text to turn it into a post.');
  }

  const data = await runSpecialistGenerate({
    platform: input.platform,
    contentType: input.contentType,
    from: 'COMPOSER_LINK',
    topic: buildTopic(articleText, input.angle, source === 'url' ? input.url?.trim() : undefined),
  });

  const text = extractPrimaryText(data).trim();
  if (!text) {
    throw new Error('The specialist returned a response we could not turn into post text. Please try again.');
  }

  return { text, source };
}
