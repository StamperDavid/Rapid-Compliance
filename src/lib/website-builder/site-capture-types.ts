/**
 * Faithful website-capture types (Phase 1 of the clone rebuild).
 *
 * These describe a VERBATIM, serializable snapshot of a rendered page:
 * every visible element's exact text, computed styles, geometry, and assets.
 * There is NO mapping to our editable page model here and NO AI — later
 * phases turn a CaptureResult into editable blocks. This file is an isolated,
 * new capability and must not depend on the editor/renderer/migrate code.
 */

/** Bounding box in CSS pixels at the capture viewport. */
export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A captured CSS pseudo-element (::before / ::after) if it renders content. */
export interface CapturePseudo {
  content: string;
  styles: Record<string, string>;
}

/**
 * One captured DOM element. Text is the element's DIRECT text only, kept
 * VERBATIM (exact characters and spacing) — never trimmed to empty,
 * paraphrased, translated, or summarized.
 */
export interface CaptureNode {
  /** Lowercased tag name: 'div', 'h1', 'p', 'a', 'button', 'img', 'section', 'svg', ... */
  tag: string;
  /**
   * The concatenation of this element's DIRECT text nodes, VERBATIM.
   * Omitted when the element has no direct text (or only whitespace between
   * child elements). Preserved exactly when present, including leading/trailing
   * spaces that are visually significant.
   */
  text?: string;
  /**
   * Useful present attributes. `src`/`href` are resolved to ABSOLUTE URLs.
   * `class` is the raw class string. For `<svg>` the full markup is stored
   * under the synthetic key `__svg` so it can be reproduced faithfully later.
   */
  attrs: Record<string, string>;
  /** Curated computed styles as their COMPUTED string values. */
  styles: Record<string, string>;
  /** getBoundingClientRect at the capture viewport. */
  rect: CaptureRect;
  /** Child element captures (text-only and skipped nodes are not included). */
  children: CaptureNode[];
  /** Rendered ::before / ::after pseudo-elements, if present. */
  pseudo?: { before?: CapturePseudo; after?: CapturePseudo };
  /** True when this subtree hit the max-depth guard and children were dropped. */
  truncated?: boolean;
}

/** A complete faithful capture of one page. */
export interface CaptureResult {
  url: string;
  title: string;
  metaDescription?: string;
  viewport: { width: number; height: number };
  /** Distinct font-family values seen across the page (for later font loading). */
  fontFamilies: string[];
  /** The captured <body> tree. */
  root: CaptureNode;
  /** ISO timestamp — stamped by the caller, not computed inside the capture. */
  capturedAt: string;
}
