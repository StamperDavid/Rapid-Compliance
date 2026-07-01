/**
 * Faithful HTML reconstruction from a {@link CaptureNode} (Phase 2 of the clone
 * rebuild).
 *
 * `captureNodeToHtml` walks a captured element tree and emits a SELF-CONTAINED,
 * theme-independent HTML string: every element carries its own captured computed
 * styles INLINED as a `style=""` attribute, so the markup renders identically no
 * matter what CSS surrounds it. Text is reproduced VERBATIM (only `&`, `<`, `>`
 * escaped — never reworded, trimmed to empty, or translated). `<svg>` markup is
 * reproduced verbatim from `attrs.__svg`; `<img>`/`<a>` keep their absolute
 * `src`/`href`.
 *
 * SAFETY: `<script>`/`<style>`/`<link>` etc. are dropped and event-handler
 * (`on*`) attributes are never emitted, so the result is safe to inject. There
 * is NO AI here — this is a deterministic, verbatim reconstruction only. This
 * module is isolated and must not import from the editor/renderer/migrate code.
 */

import type { CaptureNode, CapturePseudo } from './site-capture-types';

/** HTML void elements — emitted self-closing with no children. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Non-visual / unsafe elements dropped entirely from the reconstruction. */
const DROP_TAGS = new Set([
  'script', 'noscript', 'template', 'style', 'link', 'meta', 'title', 'base', 'head',
]);

/**
 * Attribute allowlist. Everything visual/semantic is kept; `class`/`id`/`data-*`
 * are intentionally dropped (styles are inlined, so classes are dead weight and
 * could accidentally pull in ambient CSS), and `style`/`on*` are never trusted
 * from the capture.
 */
const KEEP_ATTRS = new Set([
  'href', 'src', 'srcset', 'alt', 'title', 'target', 'rel', 'type',
  'role', 'colspan', 'rowspan', 'width', 'height', 'loading', 'download',
]);

/** CSS-prefix property heads that need a leading dash after camel→kebab. */
const VENDOR_PREFIXES = ['webkit', 'moz', 'ms', 'o'];

/** Escape text for use as element content (not attribute values). */
function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape a string for use inside a double-quoted attribute value. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert a camelCased style key (`paddingTop`) to a CSS property (`padding-top`). */
function camelToKebab(prop: string): string {
  let kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  for (const p of VENDOR_PREFIXES) {
    if (kebab.startsWith(`${p}-`)) {
      kebab = `-${kebab}`;
      break;
    }
  }
  return kebab;
}

/** True when a colour string is fully transparent (so a gradient can show through). */
export function isTransparentColor(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  const v = value.trim().toLowerCase();
  return v === '' || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)';
}

/** True when a background-image value is a CSS gradient function. */
export function isGradient(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return /(^|\s)(repeating-)?(linear|radial|conic)-gradient\(/i.test(value);
}

/**
 * Build the `style=""` value for a node. `extraDecls` are raw `prop:value`
 * strings appended after the captured declarations (e.g. gradient-text clipping,
 * or a root width reset). Present keys are emitted verbatim; empty values are
 * skipped.
 */
function buildInlineStyle(
  styles: Record<string, string>,
  extraDecls: string[],
  omitKeys: Set<string>,
): string {
  const decls: string[] = [];
  for (const [key, value] of Object.entries(styles)) {
    if (value === undefined || value === null || value === '' || omitKeys.has(key)) {
      continue;
    }
    decls.push(`${camelToKebab(key)}:${value}`);
  }
  for (const raw of extraDecls) {
    decls.push(raw);
  }
  return decls.join(';');
}

/** Render a captured ::before / ::after pseudo-element as a styled inline span. */
function renderPseudo(pseudo: CapturePseudo | undefined): string {
  if (!pseudo) {
    return '';
  }
  let content = pseudo.content.trim();
  if (content === '' || content === 'none' || content === 'normal') {
    return '';
  }
  // Computed `content` is quoted (e.g. `"→"`); unwrap the outer quotes verbatim.
  if (
    (content.startsWith('"') && content.endsWith('"')) ||
    (content.startsWith("'") && content.endsWith("'"))
  ) {
    content = content.slice(1, -1);
  }
  if (content === '') {
    return '';
  }
  const style = buildInlineStyle(pseudo.styles ?? {}, [], new Set());
  const styleAttr = style !== '' ? ` style="${escapeAttr(style)}"` : '';
  return `<span${styleAttr}>${escapeHtmlText(content)}</span>`;
}

/** Options that only affect the root node of a reconstruction. */
export interface CaptureHtmlOptions {
  /**
   * When true, the ROOT node's fixed pixel `width` is replaced with `100%` and
   * its fixed `height` is dropped, so a captured full-width band fills whatever
   * container it renders in (and can grow if content reflows) instead of being
   * pinned to the capture viewport width. Nested nodes are always verbatim.
   */
  fluidRoot?: boolean;
}

/** Build the opening tag (with inlined styles + safe attributes) for a node. */
function openTag(node: CaptureNode, isRoot: boolean, options: CaptureHtmlOptions): string {
  const extraDecls: string[] = [];
  const omitKeys = new Set<string>();

  // Gradient TEXT reconstruction: the capture records the gradient as
  // `background-image` but omits `background-clip:text` / transparent fill (not
  // in the curated key set). When a text-bearing node has a gradient background
  // and no opaque colour, re-apply the clip so the glyphs show the gradient —
  // best-effort fidelity for `bg-clip-text text-transparent` headings.
  const hasDirectText = typeof node.text === 'string' && node.text.trim() !== '';
  if (hasDirectText && isGradient(node.styles.backgroundImage) && isTransparentColor(node.styles.color)) {
    extraDecls.push('-webkit-background-clip:text');
    extraDecls.push('background-clip:text');
    extraDecls.push('-webkit-text-fill-color:transparent');
    extraDecls.push('color:transparent');
    omitKeys.add('color');
  }

  if (isRoot && options.fluidRoot) {
    omitKeys.add('width');
    omitKeys.add('height');
    extraDecls.push('width:100%');
  }

  const style = buildInlineStyle(node.styles, extraDecls, omitKeys);

  let attrsStr = '';
  for (const [name, value] of Object.entries(node.attrs)) {
    if (!KEEP_ATTRS.has(name)) {
      continue;
    }
    if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
      continue;
    }
    attrsStr += ` ${name}="${escapeAttr(value)}"`;
  }

  const styleAttr = style !== '' ? ` style="${escapeAttr(style)}"` : '';
  return `<${node.tag}${styleAttr}${attrsStr}>`;
}

/** Recursive emitter. */
function emitNode(node: CaptureNode, isRoot: boolean, options: CaptureHtmlOptions): string {
  const tag = node.tag.toLowerCase();

  if (DROP_TAGS.has(tag)) {
    return '';
  }

  // SVG: reproduce the full captured markup verbatim (it carries its own
  // attributes + geometry; `currentColor` resolves against the inherited inline
  // `color`). Strip any handlers/scripts defensively.
  if (tag === 'svg') {
    const svg = node.attrs.__svg;
    if (typeof svg === 'string' && svg.trim() !== '') {
      return sanitizeCapturedHtml(svg);
    }
    // Fall through to generic handling if the markup wasn't captured.
  }

  const open = openTag(node, isRoot, options);

  if (VOID_TAGS.has(tag)) {
    // Re-emit as self-closing; void elements carry no text/children.
    return open.replace(/>$/, ' />');
  }

  const before = renderPseudo(node.pseudo?.before);
  const after = renderPseudo(node.pseudo?.after);
  const text = typeof node.text === 'string' ? escapeHtmlText(node.text) : '';
  const childrenHtml = node.children.map((child) => emitNode(child, false, options)).join('');

  return `${open}${before}${text}${childrenHtml}${after}</${tag}>`;
}

/**
 * Reconstruct faithful, self-contained HTML for a captured element subtree.
 * Every element inlines its captured computed styles; text is verbatim.
 */
export function captureNodeToHtml(node: CaptureNode, options: CaptureHtmlOptions = {}): string {
  return emitNode(node, true, options);
}

/**
 * Light, STYLE-PRESERVING sanitizer for reconstructed HTML. Strips `<script>`
 * blocks and `on*` event-handler attributes and neutralises `javascript:` URLs,
 * while preserving inline `style` attributes and all structural/visual markup.
 * (The full editor `SafeHtml` sanitizer strips inline styles, which would
 * destroy the very fidelity this pipeline exists to reproduce — hence this
 * minimal pass instead.)
 */
export function sanitizeCapturedHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
}
