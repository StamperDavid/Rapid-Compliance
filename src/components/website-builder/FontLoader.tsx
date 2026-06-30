/**
 * FontLoader — on-demand Google Fonts injection for the website builder editor.
 *
 * Renders nothing visible. It maintains a SINGLE managed `<link id="sv-google-fonts">`
 * stylesheet in `document.head` for the families passed in. Updating the family
 * list swaps that one link's href — links never stack, so loading only fonts
 * actually used on the page stays cheap.
 *
 * Also exports `ensureFontLoaded` — a tiny imperative helper the font picker uses
 * to lazily load an individual font for its live preview swatch.
 *
 * Editor-side only. The live published site loads fonts through its own renderer
 * (a separate, later step) — this component is for the editor surface.
 */

'use client';

import { useEffect, useRef } from 'react';
import { googleFontsHref } from '@/lib/website-builder/font-catalog';

type FamilyRequest = { family: string; weights?: number[] };

const MANAGED_LINK_ID = 'sv-google-fonts';

function normalize(families: FamilyRequest[] | string[]): FamilyRequest[] {
  return families.map((f) => (typeof f === 'string' ? { family: f } : f));
}

export function FontLoader({
  families,
}: {
  families: FamilyRequest[] | string[];
}): React.JSX.Element | null {
  const normalized = normalize(families);
  // Stable key so the effect only re-runs when the actual font set changes
  // (not on every render due to a fresh array identity).
  const familiesKey = normalized
    .map((f) => `${f.family.toLowerCase()}:${(f.weights ?? []).join(',')}`)
    .sort()
    .join('|');
  const normalizedRef = useRef(normalized);
  normalizedRef.current = normalized;

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const href = googleFontsHref(normalizedRef.current);
    const existing = document.getElementById(MANAGED_LINK_ID);
    const link = existing instanceof HTMLLinkElement ? existing : null;

    if (href === null) {
      if (link !== null) {
        link.remove();
      }
      return;
    }

    if (link === null) {
      const created = document.createElement('link');
      created.id = MANAGED_LINK_ID;
      created.rel = 'stylesheet';
      created.href = href;
      document.head.appendChild(created);
      return;
    }

    if (link.href !== href) {
      link.href = href;
    }
  }, [familiesKey]);

  return null;
}

// ---------------------------------------------------------------------------
// Imperative preview loader (used by the font picker)
// ---------------------------------------------------------------------------

const previewLoaded = new Set<string>();

/**
 * Append a one-off preview stylesheet for a single font so the picker can render
 * an option's name in its own face. Deduped by family; no-op for system/unknown
 * fonts (which need no network load) and SSR.
 */
export function ensureFontLoaded(family: string, weights?: number[]): void {
  if (typeof document === 'undefined') {
    return;
  }
  const key = family.toLowerCase();
  if (previewLoaded.has(key)) {
    return;
  }
  const href = googleFontsHref([{ family, weights }]);
  if (href === null) {
    // System or unknown font — nothing to fetch.
    previewLoaded.add(key);
    return;
  }
  previewLoaded.add(key);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.svFontPreview = family;
  link.href = href;
  document.head.appendChild(link);
}
