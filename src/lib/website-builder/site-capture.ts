/**
 * Faithful website-capture engine (Phase 1 of the clone rebuild).
 *
 * Renders a real page in headless Chromium and records every visible element's
 * VERBATIM direct text, curated computed styles, geometry, and assets into a
 * serializable {@link CaptureResult} tree. There is NO mapping to our page
 * model and NO AI here — this is a faithful, complete capture only.
 *
 * This module is a new, isolated capability. It intentionally does not import
 * from (or modify) the editor, renderer, migrate route, deep-scraper, or
 * site-migration-service — later phases consume the CaptureResult produced here.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'playwright-core';
import type { CaptureNode, CaptureResult } from './site-capture-types';

/** Register the stealth evasions once so captures also work on bot-blocking sites. */
let stealthRegistered = false;
function ensureStealth(): void {
  if (stealthRegistered) {return;}
  chromium.use(StealthPlugin());
  stealthRegistered = true;
}

/** What the in-page walk returns; identical shape to what we serialize out. */
interface EvalPayload {
  root: CaptureNode;
  fontFamilies: string[];
}

export interface CaptureOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  timeoutMs?: number;
  /** Max tree depth before children are dropped (guards pathological DOMs). */
  maxDepth?: number;
}

/**
 * Capture a URL faithfully: exact text + computed styles + geometry + assets.
 *
 * @throws Error with a clear message on navigation/timeout failure.
 */
export async function captureSite(
  url: string,
  opts: CaptureOptions = {},
): Promise<CaptureResult> {
  const viewportWidth = opts.viewportWidth ?? 1440;
  const viewportHeight = opts.viewportHeight ?? 900;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const maxDepth = opts.maxDepth ?? 30;

  ensureStealth();

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // Some TS runners (tsx/esbuild `keepNames`) inject a `__name(fn, name)`
    // helper into the source of functions passed to `page.evaluate`. That
    // helper does not exist in the browser, so shim it as an identity fn
    // before any navigation. Passed as a raw string so it is not transpiled.
    await page.addInitScript(
      'window.__name = window.__name || function (fn) { return fn; };',
    );

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`captureSite: failed to load "${url}": ${reason}`);
    }

    // Scroll the full height to trigger lazy-loaded content, then settle.
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let y = 0;
        const step = window.innerHeight;
        const timer = window.setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          if (y >= document.body.scrollHeight) {
            window.clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    // Wait for fonts + a brief network settle after lazy loads.
    await page.evaluate(async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
    });
    await page.waitForTimeout(500);
    try {
      await page.waitForLoadState('networkidle', { timeout: 5_000 });
    } catch {
      // Best-effort settle; some pages poll forever. Proceed with what we have.
    }

    const title = await page.title();
    const metaDescription =
      (await page
        .locator('meta[name="description"]')
        .first()
        .getAttribute('content')
        .catch(() => null)) ?? undefined;

    const payload = await page.evaluate<EvalPayload, number>((maxDepthArg) => {
      // ---- Everything below runs INSIDE the page (browser context). ----

      const STYLE_PROPS: string[] = [
        'display', 'position', 'top', 'left', 'right', 'bottom', 'z-index',
        'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
        'grid-template-columns', 'grid-template-rows',
        'color', 'background-color', 'background-image', 'background-size',
        'background-position', 'background-repeat',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
        'opacity',
        'width', 'height', 'max-width', 'min-width', 'max-height', 'min-height',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'border-top-width', 'border-top-style', 'border-top-color',
        'border-right-width', 'border-right-style', 'border-right-color',
        'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
        'border-left-width', 'border-left-style', 'border-left-color',
        'border-radius', 'box-shadow', 'transform', 'object-fit', 'overflow',
      ];

      // Values that are universal defaults / visual no-ops — dropped to keep size sane.
      const DEFAULT_NOISE = new Set<string>([
        '', 'none', 'normal', 'auto', '0px', '0s',
        'rgba(0, 0, 0, 0)', 'transparent',
      ]);

      const ATTR_KEYS = ['href', 'src', 'alt', 'aria-label', 'type', 'role', 'id'];
      const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template']);

      const fontFamilies = new Set<string>();

      const toCamel = (s: string): string =>
        s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

      const absoluteUrl = (value: string): string => {
        try {
          return new URL(value, document.baseURI).href;
        } catch {
          return value;
        }
      };

      const directText = (el: Element): string => {
        let out = '';
        el.childNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            out += n.textContent ?? '';
          }
        });
        return out;
      };

      const collectStyles = (
        cs: CSSStyleDeclaration,
      ): Record<string, string> => {
        const styles: Record<string, string> = {};
        for (const prop of STYLE_PROPS) {
          const raw = cs.getPropertyValue(prop).trim();
          // `text-decoration` must survive even when it's `none`: the UA default
          // for <a>/<u>/<ins> is UNDERLINE, so dropping a computed `none` lets the
          // underline reappear on cloned links. Keep it unless it's truly empty.
          const keepEvenIfDefault = prop === 'text-decoration';
          if (raw === '' || (!keepEvenIfDefault && DEFAULT_NOISE.has(raw))) {continue;}
          styles[toCamel(prop)] = raw;
        }
        const ff = cs.getPropertyValue('font-family').trim();
        if (ff) {fontFamilies.add(ff);}
        return styles;
      };

      const collectPseudo = (
        el: Element,
        which: '::before' | '::after',
      ): { content: string; styles: Record<string, string> } | undefined => {
        const cs = window.getComputedStyle(el, which);
        const content = cs.getPropertyValue('content');
        if (!content || content === 'none' || content === 'normal') {return undefined;}
        const styles: Record<string, string> = {};
        for (const prop of [
          'color', 'background-color', 'background-image', 'font-size',
          'font-weight', 'width', 'height', 'display', 'position',
        ]) {
          const raw = cs.getPropertyValue(prop).trim();
          if (DEFAULT_NOISE.has(raw)) {continue;}
          styles[toCamel(prop)] = raw;
        }
        return { content, styles };
      };

      const shouldSkip = (el: Element, cs: CSSStyleDeclaration, rect: DOMRect): boolean => {
        const tag = el.tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) {return true;}
        if (cs.display === 'none') {return true;}
        if (cs.visibility === 'hidden') {return true;}
        const hasText = directText(el).trim().length > 0;
        const zeroArea = rect.width === 0 && rect.height === 0;
        if (zeroArea && !hasText) {return true;}
        return false;
      };

      const build = (el: Element, depth: number): CaptureNode | null => {
        const tag = el.tagName.toLowerCase();
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        if (shouldSkip(el, cs, rect)) {return null;}

        const attrs: Record<string, string> = {};
        for (const key of ATTR_KEYS) {
          const v = el.getAttribute(key);
          if (v === null) {continue;}
          attrs[key] = key === 'href' || key === 'src' ? absoluteUrl(v) : v;
        }
        // srcset can carry the real image; capture the first candidate absolute.
        const srcset = el.getAttribute('srcset');
        if (srcset && !attrs.src) {
          const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
          if (first) {attrs.src = absoluteUrl(first);}
        }
        const cls = el.getAttribute('class');
        if (cls) {attrs.class = cls;}

        const node: CaptureNode = {
          tag,
          attrs,
          styles: collectStyles(cs),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          children: [],
        };

        // Direct text, VERBATIM (untrimmed), only when it carries real content.
        const dt = directText(el);
        if (dt.trim().length > 0) {node.text = dt;}

        const before = collectPseudo(el, '::before');
        const after = collectPseudo(el, '::after');
        if (before || after) {
          node.pseudo = {};
          if (before) {node.pseudo.before = before;}
          if (after) {node.pseudo.after = after;}
        }

        // <svg>: store faithful markup, do not recurse into its internals.
        if (tag === 'svg') {
          node.attrs.__svg = el.outerHTML;
          return node;
        }

        if (depth >= maxDepthArg) {
          if (el.children.length > 0) {node.truncated = true;}
          return node;
        }

        for (const child of Array.from(el.children)) {
          const built = build(child, depth + 1);
          if (built) {node.children.push(built);}
        }
        return node;
      };

      const root =
        build(document.body, 0) ??
        {
          tag: 'body',
          attrs: {},
          styles: {},
          rect: { x: 0, y: 0, width: 0, height: 0 },
          children: [],
        };

      return { root, fontFamilies: Array.from(fontFamilies) };
    }, maxDepth);

    return {
      url: page.url(),
      title,
      metaDescription,
      viewport: { width: viewportWidth, height: viewportHeight },
      fontFamilies: payload.fontFamilies,
      root: payload.root,
      capturedAt: '', // stamped by the caller; kept deterministic here.
    };
  } finally {
    if (browser) {await browser.close();}
  }
}
