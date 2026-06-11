/**
 * Deterministic background removal — true image EDITING, not generation.
 *
 * Generative models redraw a logo when asked to "remove the background"; this does
 * the opposite. It takes the EXACT pixels of an existing image and punches out a
 * solid (white / near-white) background, leaving the artwork untouched.
 *
 * The key is a flood-fill FROM THE EDGES inward: only near-white pixels that are
 * connected to the image border are made transparent. White that is part of the
 * artwork (an interior highlight, white text inside a badge) is never touched,
 * because it isn't reachable from the border without crossing the artwork.
 */

import sharp from 'sharp';

export interface RemoveBackgroundOptions {
  /**
   * A pixel counts as "background" when each of its R/G/B channels is at least
   * this value (0-255). 235 catches pure white plus near-white plates (#F5F5F5).
   */
  whiteThreshold?: number;
  /**
   * Edges of the artwork are usually anti-aliased into the background (a light-grey
   * fringe). Pixels lighter than this that border a removed area get a partial alpha
   * so the cut-out has a clean edge instead of a white halo. Set 0 to disable.
   */
  featherThreshold?: number;
}

const DEFAULT_WHITE_THRESHOLD = 235;
const DEFAULT_FEATHER_THRESHOLD = 200;

/**
 * Strip the connected near-white background from an image and return a transparent
 * PNG buffer. The source artwork pixels are preserved exactly.
 */
export async function removeWhiteBackground(
  input: Buffer,
  options: RemoveBackgroundOptions = {},
): Promise<Buffer> {
  const whiteThreshold = options.whiteThreshold ?? DEFAULT_WHITE_THRESHOLD;
  const featherThreshold = options.featherThreshold ?? DEFAULT_FEATHER_THRESHOLD;

  // Decode to raw RGBA so we can walk pixels directly.
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) {
    // ensureAlpha guarantees 4; bail safely if a future sharp changes that.
    return sharp(input).png().toBuffer();
  }

  const pixelCount = width * height;
  const isBg = (idx: number): boolean => {
    const o = idx * 4;
    return data[o] >= whiteThreshold && data[o + 1] >= whiteThreshold && data[o + 2] >= whiteThreshold;
  };

  // Flood-fill from every border pixel that is near-white. An explicit stack keeps
  // us off the call stack for large images.
  const removed = new Uint8Array(pixelCount);
  const stack: number[] = [];
  const pushIfBg = (idx: number): void => {
    if (idx < 0 || idx >= pixelCount) { return; }
    if (removed[idx]) { return; }
    if (!isBg(idx)) { return; }
    removed[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBg(x); // top row
    pushIfBg((height - 1) * width + x); // bottom row
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBg(y * width); // left column
    pushIfBg(y * width + (width - 1)); // right column
  }

  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) { pushIfBg(idx - 1); }
    if (x < width - 1) { pushIfBg(idx + 1); }
    if (y > 0) { pushIfBg(idx - width); }
    if (y < height - 1) { pushIfBg(idx + width); }
  }

  // Apply: removed background → fully transparent.
  for (let idx = 0; idx < pixelCount; idx += 1) {
    if (removed[idx]) {
      data[idx * 4 + 3] = 0;
    }
  }

  // Feather: a kept pixel that is light AND borders a removed pixel gets a partial
  // alpha scaled by how dark it is — softening the anti-aliased fringe into a clean
  // edge instead of a white halo.
  if (featherThreshold > 0) {
    for (let idx = 0; idx < pixelCount; idx += 1) {
      if (removed[idx]) { continue; }
      const o = idx * 4;
      const minCh = Math.min(data[o], data[o + 1], data[o + 2]);
      if (minCh < featherThreshold) { continue; }
      const x = idx % width;
      const y = (idx - x) / width;
      const bordersRemoved =
        (x > 0 && removed[idx - 1]) ||
        (x < width - 1 && removed[idx + 1]) ||
        (y > 0 && removed[idx - width]) ||
        (y < height - 1 && removed[idx + width]);
      if (!bordersRemoved) { continue; }
      // 255 (pure white) → alpha 0; featherThreshold → alpha ~full. Linear ramp.
      const ratio = (255 - minCh) / (255 - featherThreshold);
      data[o + 3] = Math.round(Math.max(0, Math.min(1, ratio)) * data[o + 3]);
    }
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
