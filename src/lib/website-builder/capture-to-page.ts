/**
 * Deterministic capture → editable Page mapper (Phase 2 of the clone rebuild).
 *
 * `captureToPage` turns a {@link CaptureResult} into a real {@link Page} in our
 * editor model, FIDELITY FIRST:
 *
 *  - The captured body tree is split into top-level horizontal BANDS (sections).
 *  - Each band is reproduced by a single `captured-html` widget whose
 *    `data.html` is the self-contained, verbatim reconstruction from
 *    {@link captureNodeToHtml} — so the page looks byte-identical to the source
 *    regardless of the surrounding theme.
 *  - Where a band is trivially a SINGLE clean leaf (one heading / paragraph /
 *    button / link / image), it is instead decomposed into the matching native
 *    widget with styles translated from the captured computed values — but ONLY
 *    when that stays perfectly faithful. Anything richer stays a captured block.
 *
 * There is NO AI here — text is copied VERBATIM, never reworded. This module is
 * isolated (it consumes the capture + emits our Page type) and must not import
 * from the editor/renderer/migrate code.
 */

import type { CaptureNode, CaptureResult } from './site-capture-types';
import type {
  Page,
  PageColumn,
  PageSection,
  Spacing,
  Widget,
  WidgetStyle,
} from '@/types/website';
import { captureNodeToHtml, isGradient, isTransparentColor } from './capture-to-html';

/** Area of a node's bounding box (used to pick the main content wrapper). */
function nodeArea(node: CaptureNode): number {
  return Math.max(0, node.rect.width) * Math.max(0, node.rect.height);
}

/** True when a node has a visible own background (colour or gradient/image). */
function hasOwnBackground(styles: Record<string, string>): boolean {
  if (!isTransparentColor(styles.backgroundColor)) {
    return true;
  }
  const bg = styles.backgroundImage;
  return typeof bg === 'string' && bg !== 'none' && bg.trim() !== '';
}

/** True when a node has a visible border on any edge. */
function hasVisibleBorder(styles: Record<string, string>): boolean {
  for (const edge of ['Top', 'Right', 'Bottom', 'Left'] as const) {
    const width = styles[`border${edge}Width`];
    const style = styles[`border${edge}Style`];
    if (width && width !== '0px' && style && style !== 'none') {
      return true;
    }
  }
  return false;
}

/**
 * Whether a node renders anything visible on its own. Used ONLY to decide which
 * top-level nodes count as sections — never to prune inside a captured block
 * (those are reproduced verbatim).
 */
function isVisibleNode(node: CaptureNode): boolean {
  const s = node.styles;
  if (s.display === 'none') {
    return false;
  }
  if (s.visibility === 'hidden') {
    return false;
  }
  const r = node.rect;
  // Fully off-screen (e.g. an accessibility skip-link parked at x:-9999).
  if (r.x + r.width <= -1000) {
    return false;
  }
  const hasText = typeof node.text === 'string' && node.text.trim() !== '';
  const hasVisibleChildren = node.children.some((c) => c.rect.width > 0 && c.rect.height > 0);
  // An empty box with no text, no children, and no own paint renders nothing.
  if (!hasText && !hasVisibleChildren && node.children.length === 0 && !hasOwnBackground(s) && !hasVisibleBorder(s)) {
    return false;
  }
  return true;
}

/**
 * Descend from the captured `<body>` to the real page content wrapper: the
 * largest visible child, then through any redundant single full-size wrappers.
 */
function pickContentRoot(body: CaptureNode): CaptureNode {
  const visible = body.children.filter(isVisibleNode);
  if (visible.length === 0) {
    return body;
  }
  let root = visible.reduce((best, node) => (nodeArea(node) > nodeArea(best) ? node : best));
  for (let guard = 0; guard < 20; guard += 1) {
    const kids = root.children.filter(isVisibleNode);
    if (kids.length === 1 && nodeArea(kids[0]) >= 0.9 * nodeArea(root)) {
      root = kids[0];
      continue;
    }
    break;
  }
  return root;
}

/**
 * Whether a wrapper (like `<main>`) is a pure layout container that simply
 * stacks full-width bands — in which case its children ARE the sections and it
 * contributes no band of its own. Semantic bands (nav/header/footer) and any
 * node that paints its own background are never flattened.
 */
function shouldFlatten(node: CaptureNode): boolean {
  const kids = node.children.filter(isVisibleNode);
  if (kids.length < 2) {
    return false;
  }
  if (node.tag === 'nav' || node.tag === 'header' || node.tag === 'footer') {
    return false;
  }
  if (hasOwnBackground(node.styles) || hasVisibleBorder(node.styles)) {
    return false;
  }
  if (node.tag === 'main') {
    return true;
  }
  const width = node.rect.width || 1;
  const fullWidthKids = kids.filter((k) => k.rect.width >= 0.85 * width).length;
  return fullWidthKids >= Math.ceil(kids.length * 0.6);
}

/** Collect the top-level section nodes (flattening pure layout wrappers once). */
function collectSectionNodes(contentRoot: CaptureNode): CaptureNode[] {
  const out: CaptureNode[] = [];
  for (const child of contentRoot.children) {
    if (!isVisibleNode(child)) {
      continue;
    }
    if (shouldFlatten(child)) {
      for (const grand of child.children) {
        if (isVisibleNode(grand)) {
          out.push(grand);
        }
      }
    } else {
      out.push(child);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Style translation (captured computed styles → WidgetStyle) for decomposition
// ---------------------------------------------------------------------------

/** Build a Spacing from `${prefix}Top/Right/Bottom/Left` captured values. */
function spacingFrom(styles: Record<string, string>, prefix: string): Spacing | undefined {
  const top = styles[`${prefix}Top`];
  const right = styles[`${prefix}Right`];
  const bottom = styles[`${prefix}Bottom`];
  const left = styles[`${prefix}Left`];
  if (!top && !right && !bottom && !left) {
    return undefined;
  }
  const spacing: Spacing = {};
  if (top) {
    spacing.top = top;
  }
  if (right) {
    spacing.right = right;
  }
  if (bottom) {
    spacing.bottom = bottom;
  }
  if (left) {
    spacing.left = left;
  }
  return spacing;
}

function mapTextAlign(value: string | undefined): WidgetStyle['textAlign'] {
  switch (value) {
    case 'start':
    case 'left':
      return 'left';
    case 'end':
    case 'right':
      return 'right';
    case 'center':
      return 'center';
    case 'justify':
      return 'justify';
    default:
      return undefined;
  }
}

function mapTextTransform(value: string | undefined): WidgetStyle['textTransform'] {
  switch (value) {
    case 'uppercase':
      return 'uppercase';
    case 'lowercase':
      return 'lowercase';
    case 'capitalize':
      return 'capitalize';
    default:
      return undefined;
  }
}

/** Translate the subset of captured computed styles that map cleanly to WidgetStyle. */
function translateStyles(styles: Record<string, string>): WidgetStyle {
  const ws: WidgetStyle = {};

  if (styles.color && !isTransparentColor(styles.color)) {
    ws.color = styles.color;
  }
  if (styles.backgroundColor && !isTransparentColor(styles.backgroundColor)) {
    ws.backgroundColor = styles.backgroundColor;
  }
  if (styles.backgroundImage && styles.backgroundImage !== 'none') {
    ws.backgroundImage = styles.backgroundImage;
  }
  if (styles.fontFamily) {
    ws.fontFamily = styles.fontFamily;
  }
  if (styles.fontSize) {
    ws.fontSize = styles.fontSize;
  }
  if (styles.fontWeight) {
    ws.fontWeight = styles.fontWeight;
  }
  if (styles.lineHeight && styles.lineHeight !== 'normal') {
    ws.lineHeight = styles.lineHeight;
  }
  if (styles.letterSpacing && styles.letterSpacing !== 'normal') {
    ws.letterSpacing = styles.letterSpacing;
  }
  const textAlign = mapTextAlign(styles.textAlign);
  if (textAlign) {
    ws.textAlign = textAlign;
  }
  const textTransform = mapTextTransform(styles.textTransform);
  if (textTransform) {
    ws.textTransform = textTransform;
  }
  const padding = spacingFrom(styles, 'padding');
  if (padding) {
    ws.padding = padding;
  }
  const margin = spacingFrom(styles, 'margin');
  if (margin) {
    ws.margin = margin;
  }
  if (styles.borderRadius && styles.borderRadius !== '0px') {
    ws.borderRadius = styles.borderRadius;
  }
  if (styles.boxShadow && styles.boxShadow !== 'none') {
    ws.boxShadow = styles.boxShadow;
  }
  if (styles.maxWidth && styles.maxWidth !== 'none') {
    ws.maxWidth = styles.maxWidth;
  }
  const borderWidth = styles.borderTopWidth;
  if (borderWidth && borderWidth !== '0px' && styles.borderTopStyle && styles.borderTopStyle !== 'none') {
    ws.border = `${borderWidth} ${styles.borderTopStyle} ${styles.borderTopColor ?? 'currentColor'}`;
  }

  // Gradient text: preserve the gradient as a real text gradient so decomposed
  // headings still paint their glyphs (best-effort; the capture omits the clip).
  if (isGradient(styles.backgroundImage) && isTransparentColor(styles.color)) {
    delete ws.backgroundImage;
    delete ws.color;
  }

  return ws;
}

// ---------------------------------------------------------------------------
// Conservative single-leaf decomposition
// ---------------------------------------------------------------------------

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const TEXT_TAGS = new Set(['p', 'span', 'div', 'label', 'li', 'figcaption', 'blockquote', 'strong', 'em']);

/** Turn a clean text/image leaf into the matching native widget. */
function leafToWidget(node: CaptureNode, id: string): Widget | null {
  const style = translateStyles(node.styles);
  const tag = node.tag.toLowerCase();
  const text = typeof node.text === 'string' ? node.text : '';

  if (tag === 'img') {
    const src = node.attrs.src;
    if (!src) {
      return null;
    }
    return { id, type: 'image', data: { src, alt: node.attrs.alt ?? '' }, style };
  }
  if (text.trim() === '') {
    return null;
  }
  if (HEADING_TAGS.has(tag)) {
    return { id, type: 'heading', data: { text, level: Number(tag.slice(1)) }, style };
  }
  if (tag === 'a') {
    return { id, type: 'link', data: { text, url: node.attrs.href ?? '#' }, style };
  }
  if (tag === 'button') {
    return { id, type: 'button', data: { text, url: node.attrs.href ?? '' }, style };
  }
  if (TEXT_TAGS.has(tag)) {
    return { id, type: 'text', data: { content: text }, style };
  }
  return null;
}

/**
 * Try to reduce a section to ONE native widget. We descend single-child
 * wrappers (that carry no text of their own) until we reach a leaf that is a
 * clean, self-contained text/image element. Anything with multiple visible
 * children, or text mixed with element children, is too rich to decompose
 * faithfully → the caller keeps it as a captured block.
 */
function tryDecomposeSingleLeaf(section: CaptureNode, id: string): Widget | null {
  let cur = section;
  for (let guard = 0; guard < 25; guard += 1) {
    const kids = cur.children.filter(isVisibleNode);
    const hasText = typeof cur.text === 'string' && cur.text.trim() !== '';
    if (hasText) {
      // Text mixed with element children can't be a single clean leaf.
      return kids.length === 0 ? leafToWidget(cur, id) : null;
    }
    if (cur.tag.toLowerCase() === 'img') {
      return leafToWidget(cur, id);
    }
    if (kids.length === 1) {
      cur = kids[0];
      continue;
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Derive a URL-path slug from the captured page URL. */
function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    return path === '' ? 'home' : path.replace(/\//g, '-');
  } catch {
    return 'home';
  }
}

export interface CaptureToPageResult {
  page: Page;
  /** How many sections were decomposed into native widgets. */
  decomposedSections: number;
  /** How many sections were kept as faithful `captured-html` blocks. */
  capturedSections: number;
  /**
   * The faithful reconstructed HTML for EVERY top-level section, in order
   * (independent of whether the section was decomposed) — for building a
   * standalone full-page preview.
   */
  sectionsHtml: string[];
}

/**
 * Map a faithful capture into an editable Page. Returns the Page plus a small
 * summary of the decomposed-vs-captured split (handy for tooling/reports).
 */
export function captureToPageDetailed(
  capture: CaptureResult,
  opts: { title?: string; slug?: string } = {},
): CaptureToPageResult {
  const contentRoot = pickContentRoot(capture.root);
  const sectionNodes = collectSectionNodes(contentRoot);

  let decomposedSections = 0;
  let capturedSections = 0;
  const sectionsHtml: string[] = [];

  const content: PageSection[] = sectionNodes.map((node, index) => {
    const widgetId = `widget_${index + 1}_1_1`;
    let widget: Widget;

    // Always keep the faithful reconstruction on hand for a full-page preview.
    const faithfulHtml = captureNodeToHtml(node, { fluidRoot: true });
    sectionsHtml.push(faithfulHtml);

    const decomposed = tryDecomposeSingleLeaf(node, widgetId);
    if (decomposed) {
      widget = decomposed;
      decomposedSections += 1;
    } else {
      widget = { id: widgetId, type: 'captured-html', data: { html: faithfulHtml } };
      capturedSections += 1;
    }

    const column: PageColumn = {
      id: `col_${index + 1}_1`,
      width: 100,
      widgets: [widget],
    };

    // The captured-html widget already carries the FULL band (its own width,
    // padding, background). So the section wrapper must add nothing: no
    // max-width clamp, no padding, transparent background.
    const section: PageSection = {
      id: `section_${index + 1}`,
      type: 'section',
      columns: [column],
      fullWidth: true,
      maxWidth: 100000,
      padding: { top: '0', right: '0', bottom: '0', left: '0' },
      backgroundColor: 'transparent',
    };
    return section;
  });

  const now = new Date().toISOString();
  const title = opts.title ?? capture.title ?? 'Cloned Page';
  const slug = opts.slug ?? slugFromUrl(capture.url);

  const page: Page = {
    id: `clone_${slug}`,
    slug,
    title,
    content,
    seo: {
      metaTitle: title,
      metaDescription: capture.metaDescription,
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: 'clone-import',
    lastEditedBy: 'clone-import',
  };

  return { page, decomposedSections, capturedSections, sectionsHtml };
}

/** Map a faithful capture into an editable Page. */
export function captureToPage(
  capture: CaptureResult,
  opts: { title?: string; slug?: string } = {},
): Page {
  return captureToPageDetailed(capture, opts).page;
}
