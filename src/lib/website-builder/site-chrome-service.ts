/**
 * Site Chrome — client service
 *
 * Loads the editable site chrome for the website-builder editor. If no
 * customisation has been saved yet (the common case today — persistence is
 * added by the editor/save agent), this returns `DEFAULT_SITE_CHROME`, which is
 * captured verbatim from the live site, so the editor renders identically to
 * production out of the box.
 *
 * `normalizeSiteChrome` deep-merges a stored (possibly partial / untrusted)
 * value onto the defaults so a sparse or stale record never produces a broken
 * render — and is exported so the save path can reuse the same shaping.
 */

import {
  DEFAULT_SITE_CHROME,
  type ChromeFooterColumn,
  type ChromeLink,
  type SiteChrome,
} from './site-chrome-types';

/** API route the stored chrome lives behind (added by the save-path agent). */
export const SITE_CHROME_API_PATH = '/api/website-builder/chrome';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeLinks(value: unknown, fallback: ChromeLink[]): ChromeLink[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const links = value.filter(isRecord).map((raw) => ({
    label: asString(raw.label, ''),
    url: asString(raw.url, ''),
  }));
  return links.length > 0 ? links : fallback;
}

function normalizeColumns(
  value: unknown,
  fallback: ChromeFooterColumn[],
): ChromeFooterColumn[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const columns = value.filter(isRecord).map((raw) => ({
    title: asString(raw.title, ''),
    links: normalizeLinks(raw.links, []),
  }));
  return columns.length > 0 ? columns : fallback;
}

/**
 * Deep-merge an untrusted stored value onto `DEFAULT_SITE_CHROME`. Any missing
 * or malformed branch falls back to the default so the renderer always receives
 * a complete, well-typed `SiteChrome`.
 */
export function normalizeSiteChrome(stored: unknown): SiteChrome {
  if (!isRecord(stored)) {
    return DEFAULT_SITE_CHROME;
  }

  const banner = isRecord(stored.banner) ? stored.banner : {};
  const header = isRecord(stored.header) ? stored.header : {};
  const footer = isRecord(stored.footer) ? stored.footer : {};

  return {
    banner: {
      enabled: asBoolean(banner.enabled, DEFAULT_SITE_CHROME.banner.enabled),
      text: asString(banner.text, DEFAULT_SITE_CHROME.banner.text),
      ctaLabel: asOptionalString(banner.ctaLabel) ?? DEFAULT_SITE_CHROME.banner.ctaLabel,
      ctaUrl: asOptionalString(banner.ctaUrl) ?? DEFAULT_SITE_CHROME.banner.ctaUrl,
    },
    header: {
      logoUrl: asString(header.logoUrl, DEFAULT_SITE_CHROME.header.logoUrl),
      links: normalizeLinks(header.links, DEFAULT_SITE_CHROME.header.links),
      ctaLabel: asOptionalString(header.ctaLabel) ?? DEFAULT_SITE_CHROME.header.ctaLabel,
      ctaUrl: asOptionalString(header.ctaUrl) ?? DEFAULT_SITE_CHROME.header.ctaUrl,
    },
    footer: {
      columns: normalizeColumns(footer.columns, DEFAULT_SITE_CHROME.footer.columns),
      copyright: asString(footer.copyright, DEFAULT_SITE_CHROME.footer.copyright),
    },
  };
}

/**
 * Load the editable site chrome for the editor.
 *
 * Attempts to read the saved chrome from the API; on any failure (route not yet
 * implemented, network error, malformed payload) it falls back to
 * `DEFAULT_SITE_CHROME`. Safe to call from the client.
 */
export async function loadSiteChrome(): Promise<SiteChrome> {
  if (typeof window === 'undefined') {
    return DEFAULT_SITE_CHROME;
  }

  try {
    const response = await fetch(SITE_CHROME_API_PATH, { method: 'GET' });
    if (!response.ok) {
      return DEFAULT_SITE_CHROME;
    }
    const payload: unknown = await response.json();
    // The route may wrap the chrome (e.g. `{ chrome: {...} }`) or return it bare.
    const candidate =
      isRecord(payload) && 'chrome' in payload ? payload.chrome : payload;
    return normalizeSiteChrome(candidate);
  } catch {
    return DEFAULT_SITE_CHROME;
  }
}
