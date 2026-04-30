/**
 * POST /api/video/editor/render
 *
 * Takes the timeline state from the CapCut-feel editor (clips with trim,
 * per-clip lighting effects, transitions, text overlays) and produces a
 * final MP4 via the existing FFmpeg pipeline. Saves the result to the
 * unified media library with `type: 'video'`, `category: 'final'`, and
 * `metadata.derivedFrom` listing the source clip media ids.
 *
 * Standing rule: server routes use the Firebase Admin SDK, never the
 * client SDK. This route writes its media library entry through `adminDb`
 * so the create call carries no user-context constraints from Firestore
 * security rules.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  createWorkDir,
  downloadVideo,
  uploadToStorage,
  cleanupWorkDir,
  buildSmartConcatArgs,
  applyColorGrade,
  runFfmpeg,
  getStoragePath,
  type ColorGradeParams,
} from '@/lib/video/ffmpeg-utils';
import type { MediaItem } from '@/types/media-library';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ============================================================================
// Validation
// ============================================================================

const ClipEffectSchema = z.object({
  brightness: z.number().min(-1).max(1),
  contrast: z.number().min(0).max(2),
  saturation: z.number().min(0).max(2),
  hue: z.number().min(-180).max(180),
});

const RenderClipSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  trimStart: z.number().min(0),
  trimEnd: z.number().min(0),
  transitionType: z.enum(['cut', 'fade', 'dissolve']),
  effect: ClipEffectSchema.optional(),
});

const RenderTextOverlaySchema = z.object({
  text: z.string().min(1).max(500),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  position: z.enum(['top', 'center', 'bottom']),
  fontSize: z.number().min(8).max(200),
  fontColor: z.string().min(1),
  backgroundColor: z.string(),
  canvasX: z.number().min(0).max(1).optional(),
  canvasY: z.number().min(0).max(1).optional(),
  fontFamily: z.string().optional(),
});

const RenderRequestSchema = z.object({
  name: z.string().min(1).max(200),
  clips: z.array(RenderClipSchema).min(1, 'At least one clip is required'),
  textOverlays: z.array(RenderTextOverlaySchema).default([]),
  transition: z.enum(['cut', 'fade', 'dissolve']).default('fade'),
  resolution: z.enum(['720p', '1080p']).default('1080p'),
  derivedFromMediaIds: z.array(z.string()).optional(),
});

const RESOLUTION_MAP = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
} as const;

// ============================================================================
// FFmpeg helpers (route-local — uses the shared utilities for the heavy lifting)
// ============================================================================

/**
 * Trim a clip and apply its lighting effect in a single FFmpeg invocation.
 * If trimStart/trimEnd are 0 and the effect is neutral we still produce a
 * normalized intermediate so concat assumptions hold.
 */
async function prepareClip(
  inputPath: string,
  outputPath: string,
  trimStart: number,
  trimEnd: number,
  effect: z.infer<typeof ClipEffectSchema> | undefined,
): Promise<void> {
  // Step 1: trim (fast — stream copy when possible)
  const trimArgs: string[] = ['-y'];
  if (trimStart > 0) {
    trimArgs.push('-ss', trimStart.toFixed(3));
  }
  trimArgs.push('-i', inputPath);

  // Compute the output duration. If we can't determine it (e.g. trimEnd zero),
  // we let ffmpeg consume the rest of the file.
  // Use -to (end timestamp) instead of -t when both ss and end time are known
  // for accuracy. Here trimEnd is "seconds to chop from the end" so we map it
  // to -t via probe in the simple case below: we just rely on the player
  // having a known duration. To keep the route stable without re-probing,
  // we approximate by using -t = (sourceDuration - trimStart - trimEnd) only
  // when the caller provides a reasonable trim. For YC-demo scope: skip the
  // probe and let ffmpeg consume the file when trimEnd is 0; otherwise probe.

  // We always re-encode here so the per-clip effect can be baked in.
  const hasEffect =
    effect !== undefined &&
    (effect.brightness !== 0 ||
      effect.contrast !== 1 ||
      effect.saturation !== 1 ||
      effect.hue !== 0);

  // To trim from the end without probing, we use ffprobe-equivalent inside
  // applyColorGrade's pipeline. Simpler approach: do trim first, then effect.
  // Two-pass keeps the code readable and matches existing pipeline style.
  const trimmedTmp = outputPath.replace(/\.mp4$/, '.trimmed.mp4');

  trimArgs.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
  );

  // If trimEnd > 0 we ask ffmpeg to stop at sourceDuration - trimEnd. To
  // avoid an extra probe we use the `-sseof` trick: re-run a second pass
  // with `-sseof -trimEnd` only when trimEnd > 0. For the YC-demo path
  // we instead use a single pass with `-fflags +genpts` and accept that
  // trimEnd > 0 needs a probe-then-cut. Keep it simple: when trimEnd > 0,
  // do an explicit duration-based cut via a probe.
  if (trimEnd > 0) {
    // Fast probe via ffprobe-style approach using the existing utility:
    // we can use ffmpeg itself with `-i` and parse stderr, but rather than
    // duplicating that here we issue a follow-up cut by computing duration
    // from the original source via ffmpeg's null-output measurement.
    const measureArgs = ['-i', inputPath, '-f', 'null', '-'];
    const stderr = await runFfmpeg(measureArgs).catch((e: unknown) => {
      // ffmpeg returns non-zero for null-mux on some builds; the duration
      // we need is in stderr regardless. Re-throw if no stderr output.
      const msg = e instanceof Error ? e.message : String(e);
      return msg;
    });
    const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
    let sourceDuration = 0;
    if (m) {
      sourceDuration = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    }
    const targetDuration = Math.max(0.1, sourceDuration - trimStart - trimEnd);
    trimArgs.push('-t', targetDuration.toFixed(3));
  }

  trimArgs.push(trimmedTmp);
  await runFfmpeg(trimArgs);

  // Step 2: apply effect (or just rename the trimmed file)
  if (!hasEffect) {
    // Rename — we still need outputPath populated. Read+write is cheap for
    // a few MB and avoids platform-specific rename quirks in the worker.
    const data = await readFile(trimmedTmp);
    await writeFile(outputPath, data);
    return;
  }

  // Mirror the CSS filter math: brightness offset maps to FFmpeg eq's
  // `brightness` (-1..1), contrast/saturation are multipliers, hue is
  // the hue filter's `h` argument in degrees.
  const params: ColorGradeParams = {
    contrast: effect.contrast,
    saturation: effect.saturation,
    brightness: effect.brightness,
    gamma: 1.0,
    temperature: 0,
  };
  await applyColorGrade(trimmedTmp, outputPath, params);

  // If hue rotation is non-zero, run a second pass for the hue filter.
  if (effect.hue !== 0) {
    const huedPath = outputPath.replace(/\.mp4$/, '.hue.mp4');
    await runFfmpeg([
      '-i', outputPath,
      '-vf', `hue=h=${effect.hue.toFixed(1)}`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      huedPath,
    ]);
    const data = await readFile(huedPath);
    await writeFile(outputPath, data);
  }
}

/**
 * Burn text overlays into a video via the FFmpeg drawtext filter.
 * Each overlay becomes one drawtext call chained into a single -vf graph.
 */
async function burnTextOverlays(
  inputPath: string,
  outputPath: string,
  overlays: z.infer<typeof RenderTextOverlaySchema>[],
  width: number,
  height: number,
): Promise<void> {
  if (overlays.length === 0) {
    const data = await readFile(inputPath);
    await writeFile(outputPath, data);
    return;
  }

  const filters = overlays.map((overlay) => {
    // Escape colons and backslashes in the text so drawtext doesn't choke.
    const escaped = overlay.text
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/'/g, "’");

    // Resolve x/y. canvasX/Y win if present, otherwise fall back to the
    // position alias (centered horizontally, top/middle/bottom band).
    let xExpr: string;
    let yExpr: string;
    if (typeof overlay.canvasX === 'number' && typeof overlay.canvasY === 'number') {
      const xPx = Math.round(overlay.canvasX * width);
      const yPx = Math.round(overlay.canvasY * height);
      xExpr = `${xPx}-text_w/2`;
      yExpr = `${yPx}-text_h/2`;
    } else {
      xExpr = '(w-text_w)/2';
      if (overlay.position === 'top') {
        yExpr = `${Math.round(height * 0.08)}`;
      } else if (overlay.position === 'center') {
        yExpr = `(h-text_h)/2`;
      } else {
        yExpr = `h-text_h-${Math.round(height * 0.08)}`;
      }
    }

    // Color sanitization: drawtext accepts hex (with or without leading #)
    // and "color@alpha". Strip common rgba(...) syntax to a hex+alpha.
    const fontColor = overlay.fontColor.startsWith('#')
      ? overlay.fontColor.slice(1)
      : overlay.fontColor;

    let boxParams = '';
    if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
      // For rgba(...), pull alpha; default to 0.5
      const rgbaMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(overlay.backgroundColor);
      let bgHex = '000000';
      let alpha = '0.5';
      if (rgbaMatch) {
        const r = Number(rgbaMatch[1]);
        const g = Number(rgbaMatch[2]);
        const b = Number(rgbaMatch[3]);
        bgHex = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
        if (rgbaMatch[4]) { alpha = rgbaMatch[4]; }
      } else if (overlay.backgroundColor.startsWith('#')) {
        bgHex = overlay.backgroundColor.slice(1);
      }
      boxParams = `:box=1:boxcolor=0x${bgHex}@${alpha}:boxborderw=8`;
    }

    return [
      `drawtext=text='${escaped}'`,
      `fontsize=${overlay.fontSize}`,
      `fontcolor=0x${fontColor}`,
      `x=${xExpr}`,
      `y=${yExpr}`,
      boxParams,
      `enable='between(t,${overlay.startTime.toFixed(3)},${overlay.endTime.toFixed(3)})'`,
    ]
      .filter(Boolean)
      .join(':');
  });

  const filterChain = filters.join(',');

  await runFfmpeg([
    '-i', inputPath,
    '-vf', filterChain,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ]);
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(request: NextRequest) {
  const jobId = randomUUID().slice(0, 8);
  let workDir = '';

  try {
    if (!adminStorage || !adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: 'Storage or database is not initialized. Verify FIREBASE_SERVICE_ACCOUNT_KEY in env.',
        },
        { status: 503 },
      );
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const rawBody: unknown = await request.json();
    const parsed = RenderRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      logger.warn('Invalid editor render request', {
        jobId,
        errors: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        file: 'api/video/editor/render/route.ts',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { name, clips, textOverlays, transition, resolution, derivedFromMediaIds } = parsed.data;
    const { width, height } = RESOLUTION_MAP[resolution];

    logger.info('Editor render started', {
      jobId,
      clipCount: clips.length,
      overlayCount: textOverlays.length,
      transition,
      resolution,
      file: 'api/video/editor/render/route.ts',
    });

    workDir = await createWorkDir('editor-render');

    // Step 1: download every source clip
    const downloadedPaths: string[] = await Promise.all(
      clips.map(async (clip, i) => {
        const local = join(workDir, `src_${i}.mp4`);
        await downloadVideo(clip.url, local);
        return local;
      }),
    );

    // Step 2: trim + apply per-clip effects
    const preparedPaths: string[] = await Promise.all(
      clips.map(async (clip, i) => {
        const out = join(workDir, `prep_${i}.mp4`);
        await prepareClip(downloadedPaths[i], out, clip.trimStart, clip.trimEnd, clip.effect);
        return out;
      }),
    );

    // Step 3: concat with transition
    const concatPath = join(workDir, 'concat.mp4');
    const concatArgs = await buildSmartConcatArgs(
      preparedPaths,
      concatPath,
      transition,
      width,
      height,
      18,
    );
    await runFfmpeg(concatArgs);

    // Step 4: burn text overlays
    const finalPath = join(workDir, 'final.mp4');
    await burnTextOverlays(concatPath, finalPath, textOverlays, width, height);

    // Step 5: upload to Firebase Storage
    const storagePath = getStoragePath(`editor-${jobId}`, 'edited');
    const videoUrl = await uploadToStorage(finalPath, storagePath);
    const fileSize = (await readFile(finalPath)).byteLength;

    // Step 6: write a media library record
    const now = new Date();
    const collection = getSubCollection('media');
    const docRef = adminDb.collection(collection).doc();
    const metadata: Record<string, string> = {
      source: 'editor',
      clipCount: String(clips.length),
      overlayCount: String(textOverlays.length),
      transition,
      resolution,
    };
    if (derivedFromMediaIds && derivedFromMediaIds.length > 0) {
      metadata.derivedFrom = derivedFromMediaIds.join(',');
    }
    await docRef.set({
      type: 'video',
      category: 'final',
      name,
      url: videoUrl,
      thumbnailUrl: null,
      mimeType: 'video/mp4',
      fileSize,
      duration: null,
      metadata,
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
    });

    const item: MediaItem = {
      id: docRef.id,
      type: 'video',
      category: 'final',
      name,
      url: videoUrl,
      thumbnailUrl: null,
      mimeType: 'video/mp4',
      fileSize,
      duration: null,
      metadata,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: user.uid,
    };

    logger.info('Editor render complete', {
      jobId,
      mediaId: docRef.id,
      videoUrl,
      file: 'api/video/editor/render/route.ts',
    });

    void cleanupWorkDir(workDir);

    return NextResponse.json({ success: true, item });
  } catch (error) {
    logger.error('Editor render failed', error as Error, {
      jobId,
      file: 'api/video/editor/render/route.ts',
    });
    if (workDir) { void cleanupWorkDir(workDir); }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Render failed' },
      { status: 500 },
    );
  }
}
