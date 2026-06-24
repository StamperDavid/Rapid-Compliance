/**
 * Floor-plan camera GEOMETRY → perspective prompt language (ADDITIVE, pure).
 *
 * The shot doc's top-down BLOCKING diagram is the SPATIAL source of truth: it
 * places furniture/walls/windows (`FloorPlanElement[]`) and a numbered camera per
 * shot (`FloorPlanCamera`: position x/y, `facing`, `fovDegrees`, optional `route`).
 *
 * This module is the bridge that makes the blocking actually DRIVE every other shot
 * image: it translates a shot's camera node into concrete, PERSPECTIVE (eye-level,
 * never top-down) camera-direction language — where the camera sits in the room,
 * which compass direction it looks, how wide the lens reads (from the FOV), and
 * WHICH placed elements fall inside the camera's view cone (so the prompt names what
 * is actually in frame). The result is appended to the shot's generation prompt so
 * the still is rendered FROM that marked angle, inside the SAME locked room.
 *
 * HARD RULE (the bug this fixes): the top-down blocking image is NEVER fed as a
 * visual/style reference to the scene images — that would make them render top-down.
 * The blocking drives SPATIAL composition (this TEXT/geometry only); the VISUAL
 * anchor for consistency is a perspective room image (the environment hero).
 *
 * Coordinate + angle convention (matches `FloorPlanCanvas.tsx` exactly):
 *   - Stage is normalized [0,1]: x→right, y→down. Top of the map (low y) reads as
 *     the BACK of the room (deeper); bottom (high y) reads as the FRONT (nearer).
 *   - `facing` is in degrees, 0° = north (toward the top of the map), clockwise.
 *     Direction vector = (sin θ, −cos θ): 0°→up, 90°→right, 180°→down, 270°→left.
 *
 * No I/O, no generation — data only.
 */

import type {
  ShotPlan,
  ShotPlanShot,
  FloorPlanCamera,
  FloorPlanElement,
} from '@/types/shot-plan';

/** Default lens cone half-angle (full FOV ≈ a normal ~50mm look) when unspecified. */
const DEFAULT_FOV_DEGREES = 60;

/** Unit direction vector for a `facing` angle (0° = north/up, clockwise). */
function facingVector(facingDegrees: number): { dx: number; dy: number } {
  const rad = (facingDegrees * Math.PI) / 180;
  // Matches FloorPlanCanvas: x uses +sin, y uses −cos (screen y grows downward).
  return { dx: Math.sin(rad), dy: -Math.cos(rad) };
}

/**
 * Plain-language compass heading for a `facing` angle, snapped to the nearest of 8
 * points. Used to say which way the camera looks across the room ("the camera looks
 * toward the back-right of the room").
 */
function facingCompass(facingDegrees: number): string {
  // Normalize to [0,360).
  const a = ((facingDegrees % 360) + 360) % 360;
  const points = [
    'toward the back of the room',
    'toward the back-right of the room',
    'toward the right wall',
    'toward the front-right (toward the viewer)',
    'toward the front of the room (toward the viewer)',
    'toward the front-left (toward the viewer)',
    'toward the left wall',
    'toward the back-left of the room',
  ];
  const idx = Math.round(a / 45) % 8;
  return points[idx];
}

/** Coarse left/centre/right band for a normalized x. */
function horizontalBand(x: number): string {
  return x < 0.34 ? 'the left side' : x > 0.66 ? 'the right side' : 'the centre';
}

/** Coarse back/middle/front band for a normalized y (low y = back, high y = front). */
function depthBand(y: number): string {
  return y < 0.34 ? 'the back' : y > 0.66 ? 'the front' : 'the middle';
}

/**
 * Translate the lens cone half-FOV into a lens-breadth phrase. A narrow cone reads
 * as a tight/long lens; a wide cone as a wide-angle establishing look.
 */
function lensBreadth(fovDegrees: number): string {
  if (fovDegrees <= 30) {
    return 'a tight, long-lens framing that isolates the subject';
  }
  if (fovDegrees <= 55) {
    return 'a natural ~50mm framing';
  }
  if (fovDegrees <= 85) {
    return 'a moderately wide framing showing the subject and surrounding set';
  }
  return 'a wide-angle framing that takes in much of the room';
}

/**
 * Is element `el` inside camera `cam`'s view cone? True when the element is (a) in
 * FRONT of the camera (positive dot product with the facing vector) and (b) within
 * the half-FOV cone around the facing direction. The camera's own position is
 * excluded. This is what lets the prompt name the elements actually in frame.
 */
function elementInView(cam: FloorPlanCamera, el: FloorPlanElement, fovDegrees: number): boolean {
  const { dx, dy } = facingVector(cam.facing);
  const ex = el.x - cam.x;
  const ey = el.y - cam.y;
  const dist = Math.hypot(ex, ey);
  if (dist < 1e-4) {
    return false; // element sits on the camera — not "in front".
  }
  // Normalized direction to the element.
  const nx = ex / dist;
  const ny = ey / dist;
  // Cosine of the angle between facing and the element direction.
  const cos = dx * nx + dy * ny;
  if (cos <= 0) {
    return false; // behind the camera.
  }
  const halfFovCos = Math.cos((Math.min(fovDegrees, 179) / 2) * (Math.PI / 180));
  return cos >= halfFovCos;
}

/** Net-direction motion language for a polyline route, or '' (mirrors the mapping helper). */
function describeRoute(route: FloorPlanCamera['route']): string {
  if (!route || route.length < 2) {
    return '';
  }
  const a = route[0];
  const b = route[route.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const moves: string[] = [];
  if (Math.abs(dx) > 0.12) {
    moves.push(dx > 0 ? 'panning left to right' : 'panning right to left');
  }
  if (Math.abs(dy) > 0.12) {
    // low y = back, so moving to lower y = pushing deeper; higher y = pulling toward viewer.
    moves.push(dy < 0 ? 'pushing deeper into the room' : 'pulling toward the front');
  }
  return moves.join(' while ');
}

/**
 * The full perspective camera-direction sentence for a shot, derived from its
 * floor-plan camera node + the elements in its view cone. Returns '' when the plan
 * has no floor plan or no camera node for this shot (then the caller falls back to
 * the coarser blocking text / plain prose). The returned text ALWAYS asserts a
 * perspective, eye-level viewpoint and explicitly forbids a top-down/overhead look,
 * because the camera geometry came from a top-down map and we must not let the model
 * echo that overhead framing.
 */
export function describeShotCameraGeometry(plan: ShotPlan, shot: ShotPlanShot): string {
  const fp = plan.floorPlan;
  if (!fp) {
    return '';
  }
  const cam = fp.cameras.find((c) => c.shotId === shot.id);
  if (!cam) {
    return '';
  }
  const fov = cam.fovDegrees ?? DEFAULT_FOV_DEGREES;

  const parts: string[] = [];

  // 1. Eye-level perspective guard FIRST — this is the anti-top-down anchor.
  parts.push(
    'Shot from a normal eye-level camera INSIDE the room (a regular perspective view, ' +
      'NOT a top-down or overhead or bird\'s-eye view)',
  );

  // 2. Where the camera sits + which way it looks + lens breadth.
  parts.push(
    `the camera stands at ${horizontalBand(cam.x)} toward ${depthBand(cam.y)} of the room, ` +
      `looking ${facingCompass(cam.facing)}, ${lensBreadth(fov)}`,
  );

  // 3. Camera move along its route, if any.
  const route = describeRoute(cam.route);
  if (route) {
    parts.push(`the camera is ${route}`);
  }

  // 4. Which placed set elements are IN FRAME (named so the room stays consistent).
  //    Skip the actors here (cast identity is anchored separately); name the fixed
  //    set pieces / objects / entries that pin the room's furniture & architecture.
  const inFrame = fp.elements
    .filter((el) => el.kind !== 'actor')
    .filter((el) => elementInView(cam, el, fov))
    .map((el) => el.label.trim())
    .filter((label) => label.length > 0);
  if (inFrame.length > 0) {
    const named = [...new Set(inFrame)].slice(0, 8).join(', ');
    parts.push(`in frame from this angle: ${named} — keep these in the SAME positions as the established room`);
  }

  return parts.join('; ');
}

/**
 * A short SET-CONSISTENCY clause asserting that the room must match the established
 * (locked) environment — same walls, windows, furniture, in the same places — and
 * that ONLY the camera angle changes between shots. Woven into every shot still so
 * the model keeps the location fixed even when the camera moves around it.
 */
export const SET_CONSISTENCY_CLAUSE =
  'This is the SAME location as the other shots: keep the walls, windows, doors, and ' +
  'furniture identical and in the same places — only the camera angle changes. Do not ' +
  'add, remove, or rearrange furniture or architecture.';
