/**
 * Section Shape Divider Catalog (Elementor-style)
 * -----------------------------------------------
 * Static, self-contained SVG path data for the built-in section dividers.
 * Every shape uses a `0 0 1200 120` viewBox and `preserveAspectRatio="none"` so
 * it stretches edge-to-edge regardless of the section width. Paths are plain
 * strings (no runtime generation) so they are SSR-safe and tree-shakeable.
 *
 * Authoring convention: every path is drawn so the SOLID FILL sits against the
 * TOP edge of the viewBox with the decorative boundary pointing DOWN. The
 * ResponsiveRenderer renders TOP dividers as-authored and rotates BOTTOM
 * dividers 180deg, so a single path serves both edges.
 *
 * The editor's ShapeDividerControl uses the same data to draw the picker tiles.
 */

import type { ShapeDividerType } from '@/types/website';

/** Geometry for one shape: a viewBox plus one or more `<path d>` strings. */
export interface ShapeDividerShape {
  label: string;
  viewBox: string;
  preserveAspectRatio?: string;
  /** Single-path shapes. Use `paths` for multi-layer shapes. */
  path: string;
  /** Optional extra layered paths (e.g. distant + near mountains). */
  paths?: string[];
}

/**
 * The 13 built-in shapes. Keyed by every `ShapeDividerType` except `'none'`.
 * Solid fill is against the top edge (y=0); the decorative edge points down.
 */
export const SHAPE_DIVIDERS: Record<Exclude<ShapeDividerType, 'none'>, ShapeDividerShape> = {
  wave: {
    label: 'Wave',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path: 'M0,0 L1200,0 L1200,60 C900,120 300,0 0,60 Z',
  },
  waves: {
    label: 'Waves',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,60 C1100,90 1000,30 900,60 C800,90 700,30 600,60 ' +
      'C500,90 400,30 300,60 C200,90 100,30 0,60 Z',
  },
  tilt: {
    label: 'Tilt',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path: 'M0,0 L1200,0 L0,120 Z',
  },
  triangle: {
    label: 'Triangle',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path: 'M0,0 L1200,0 L600,100 Z',
  },
  curve: {
    label: 'Curve',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path: 'M0,0 L1200,0 L1200,40 C800,120 400,120 0,40 Z',
  },
  arrow: {
    label: 'Arrow',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path: 'M0,0 L1200,0 L1200,40 L600,120 L0,40 Z',
  },
  mountains: {
    label: 'Mountains',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,60 L1040,25 L880,80 L700,20 L520,100 L360,30 ' +
      'L180,90 L0,40 Z',
    paths: [
      'M0,0 L1200,0 L1200,75 L1000,40 L760,95 L520,35 L300,90 L0,55 Z',
    ],
  },
  clouds: {
    label: 'Clouds',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,50 C1140,50 1130,82 1070,82 C1040,82 1025,66 995,66 ' +
      'C970,96 920,100 880,75 C840,104 770,100 740,66 C700,86 660,70 640,55 ' +
      'C560,55 540,90 470,80 C440,110 370,104 340,70 C300,90 240,80 210,55 ' +
      'C150,70 120,50 0,50 Z',
  },
  zigzag: {
    label: 'Zigzag',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,60 L1100,110 L1000,60 L900,110 L800,60 L700,110 ' +
      'L600,60 L500,110 L400,60 L300,110 L200,60 L100,110 L0,60 Z',
  },
  split: {
    label: 'Split',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,30 C1200,30 660,30 660,90 L660,120 L540,120 ' +
      'L540,90 C540,30 0,30 0,30 Z',
  },
  book: {
    label: 'Book',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path: 'M0,0 L1200,0 L1200,90 C1000,30 800,30 600,90 C400,30 200,30 0,90 Z',
  },
  drops: {
    label: 'Drops',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,40 C1160,40 1140,40 1135,40 C1135,90 1095,110 1055,90 ' +
      'C1025,75 1020,40 1020,40 L815,40 C815,90 775,110 735,90 C705,75 700,40 700,40 ' +
      'L495,40 C495,90 455,110 415,90 C385,75 380,40 380,40 L175,40 C175,90 135,110 95,90 ' +
      'C65,75 60,40 60,40 L0,40 Z',
  },
  pyramids: {
    label: 'Pyramids',
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    path:
      'M0,0 L1200,0 L1200,30 L0,30 Z M0,30 L150,120 L300,30 Z ' +
      'M300,30 L450,120 L600,30 Z M600,30 L750,120 L900,30 Z ' +
      'M900,30 L1050,120 L1200,30 Z',
  },
};

/** Human-readable labels keyed by type, including `'none'`. Handy for menus. */
export const SHAPE_DIVIDER_LABELS: Record<ShapeDividerType, string> = {
  none: 'None',
  wave: SHAPE_DIVIDERS.wave.label,
  waves: SHAPE_DIVIDERS.waves.label,
  tilt: SHAPE_DIVIDERS.tilt.label,
  triangle: SHAPE_DIVIDERS.triangle.label,
  curve: SHAPE_DIVIDERS.curve.label,
  arrow: SHAPE_DIVIDERS.arrow.label,
  mountains: SHAPE_DIVIDERS.mountains.label,
  clouds: SHAPE_DIVIDERS.clouds.label,
  zigzag: SHAPE_DIVIDERS.zigzag.label,
  split: SHAPE_DIVIDERS.split.label,
  book: SHAPE_DIVIDERS.book.label,
  drops: SHAPE_DIVIDERS.drops.label,
  pyramids: SHAPE_DIVIDERS.pyramids.label,
};

/** Ordered list of all real (non-`none`) shape types for building pickers. */
export const SHAPE_DIVIDER_TYPES: Array<Exclude<ShapeDividerType, 'none'>> = [
  'wave', 'waves', 'tilt', 'triangle', 'curve', 'arrow',
  'mountains', 'clouds', 'zigzag', 'split', 'book', 'drops', 'pyramids',
];
