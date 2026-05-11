/**
 * UTM tracking — captures campaign attribution parameters from public-page
 * URLs and persists them across navigation so they survive until conversion.
 *
 * Flow:
 *   1. User lands on any public page with `?utm_source=google_ads&utm_medium=cpc&...`
 *   2. PublicLayout calls `persistUtmsIfPresent()` on mount — writes the UTMs
 *      to sessionStorage if any are present in the URL.
 *   3. User browses other pages on the same site. sessionStorage survives.
 *   4. User submits a lead form (early-access, contact, etc.). The form
 *      calls `getTrackedUtms()` and POSTs them in the request body's metadata.
 *   5. Server route persists utmSource/utmMedium/utmCampaign on the resulting
 *      Lead. BUDGET_STRATEGIST reads aggregated leads-by-source to attribute
 *      conversions per platform.
 *
 * The Lead schema only supports utmSource/utmMedium/utmCampaign today. utmTerm
 * and utmContent are captured client-side for future use but not persisted.
 */

const STORAGE_KEY = 'sv_utm_v1';
const REFERRER_KEY = 'sv_referrer_v1';
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface TrackedUtms {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /** First-seen referrer when these UTMs were captured. */
  referrer?: string;
  /** Epoch ms when these UTMs were first captured. */
  capturedAt?: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readFromQueryString(search: string): TrackedUtms {
  const params = new URLSearchParams(search);
  const out: TrackedUtms = {};
  const utmSource = params.get('utm_source')?.trim();
  const utmMedium = params.get('utm_medium')?.trim();
  const utmCampaign = params.get('utm_campaign')?.trim();
  const utmTerm = params.get('utm_term')?.trim();
  const utmContent = params.get('utm_content')?.trim();
  if (utmSource) {out.utmSource = utmSource;}
  if (utmMedium) {out.utmMedium = utmMedium;}
  if (utmCampaign) {out.utmCampaign = utmCampaign;}
  if (utmTerm) {out.utmTerm = utmTerm;}
  if (utmContent) {out.utmContent = utmContent;}
  return out;
}

function hasAnyUtm(utms: TrackedUtms): boolean {
  return Boolean(
    utms.utmSource ?? utms.utmMedium ?? utms.utmCampaign ?? utms.utmTerm ?? utms.utmContent,
  );
}

function readFromStorage(): TrackedUtms | null {
  if (!isBrowser()) {return null;}
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {return null;}
    const parsed = JSON.parse(raw) as TrackedUtms;
    if (parsed.capturedAt && Date.now() - parsed.capturedAt > TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(utms: TrackedUtms): void {
  if (!isBrowser()) {return;}
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utms));
  } catch {
    // sessionStorage may be unavailable (private mode, quota). Silent fail —
    // UTMs lost but the form still works.
  }
}

/**
 * Call from PublicLayout on every public-page mount. If the current URL has
 * any UTM params, persist them to sessionStorage so they survive across page
 * navigation. First-write wins — once UTMs are captured, subsequent visits
 * without UTMs don't overwrite them.
 */
export function persistUtmsIfPresent(): void {
  if (!isBrowser()) {return;}
  const fromUrl = readFromQueryString(window.location.search);
  if (!hasAnyUtm(fromUrl)) {return;}

  // Already-stored UTMs win — preserve the original attribution.
  const existing = readFromStorage();
  if (existing && hasAnyUtm(existing)) {return;}

  const referrer = typeof document !== 'undefined' ? document.referrer || undefined : undefined;
  const toStore: TrackedUtms = {
    ...fromUrl,
    referrer,
    capturedAt: Date.now(),
  };
  writeToStorage(toStore);
  if (referrer && isBrowser()) {
    try {
      window.sessionStorage.setItem(REFERRER_KEY, referrer);
    } catch {
      // silent fail
    }
  }
}

/**
 * Return the current tracked UTMs. URL params win over sessionStorage so
 * that a fresh ad click overrides any prior session.
 */
export function getTrackedUtms(): TrackedUtms {
  if (!isBrowser()) {return {};}
  const fromUrl = readFromQueryString(window.location.search);
  if (hasAnyUtm(fromUrl)) {return fromUrl;}
  return readFromStorage() ?? {};
}

/**
 * Shape that public form endpoints expect in their request body's `metadata` field.
 * Server-side Zod schemas should validate against this shape.
 */
export interface UtmMetadataPayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
}

export function buildUtmMetadata(): UtmMetadataPayload | undefined {
  const utms = getTrackedUtms();
  if (!hasAnyUtm(utms)) {
    const referrer = isBrowser() ? document.referrer || undefined : undefined;
    return referrer ? { referrer } : undefined;
  }
  const payload: UtmMetadataPayload = { ...utms };
  if (!payload.referrer && isBrowser()) {
    payload.referrer = document.referrer || undefined;
  }
  return payload;
}

/**
 * Derive the `Lead.source` string from UTM params. Mirrors the convention used
 * by the dynamic forms endpoint at /api/public/forms/[formId] — keeps source
 * formatting consistent across every public lead-capture surface so BUDGET_STRATEGIST's
 * aggregation can group by source key.
 */
export function deriveLeadSource(metadata: UtmMetadataPayload | undefined, fallback = 'direct'): string {
  if (!metadata?.utmSource) {return fallback;}
  const source = metadata.utmSource.toLowerCase();
  const medium = metadata.utmMedium?.toLowerCase();
  return medium ? `${source}/${medium}` : source;
}

/**
 * Clear stored UTMs after a successful conversion. Optional — sessionStorage
 * also auto-clears when the browser tab closes.
 */
export function clearTrackedUtms(): void {
  if (!isBrowser()) {return;}
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(REFERRER_KEY);
  } catch {
    // silent fail
  }
}
