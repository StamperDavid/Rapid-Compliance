/**
 * FFmpeg Utilities
 * Shared helpers for video processing: compositing, color grading, audio mixing.
 *
 * FFmpeg binary resolution strategy:
 *   1. Local dev: @ffmpeg-installer/ffmpeg or ffmpeg-static (npm packages)
 *   2. Vercel serverless: downloads static ffmpeg binary to /tmp on cold start
 */

import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, chmod } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger/logger';
import { adminStorage } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// FFmpeg Binary
// ============================================================================

/**
 * Static Linux x64 ffmpeg binary — raw binary, no extraction needed.
 * The eugeneware/ffmpeg-static GitHub releases provide platform-specific binaries
 * as direct downloads. ~80 MB, cached in /tmp between Vercel invocations.
 */
const FFMPEG_STATIC_URL = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64';
const FFMPEG_TMP_PATH = '/tmp/ffmpeg';

/** Promise-based lock to prevent concurrent downloads of the same binary. */
let downloadPromise: Promise<string> | null = null;

/**
 * Ensure ffmpeg binary is available and return its path.
 *
 * On local dev (Windows/Mac), uses npm packages.
 * On Vercel serverless (Linux), downloads a static binary to /tmp and caches it.
 */
export async function ensureFfmpeg(): Promise<string> {
  // Try npm packages first (works on local dev)
  const localPath = tryLocalFfmpeg();
  if (localPath) { return localPath; }

  // On Vercel / Linux serverless — check /tmp cache
  if (existsSync(FFMPEG_TMP_PATH)) {
    logger.info('FFmpeg binary found in /tmp cache', { path: FFMPEG_TMP_PATH, file: 'ffmpeg-utils.ts' });
    return FFMPEG_TMP_PATH;
  }

  // Download to /tmp (with concurrency guard)
  downloadPromise ??= downloadFfmpegBinary();
  return downloadPromise;
}

/**
 * Synchronous attempt to find ffmpeg via npm packages.
 * Returns the path if found, null otherwise.
 */
function tryLocalFfmpeg(): string | null {
  // Try ffmpeg-static
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static') as string;
    if (staticPath && existsSync(staticPath)) {
      logger.info('FFmpeg resolved via ffmpeg-static', { path: staticPath, file: 'ffmpeg-utils.ts' });
      return staticPath;
    }
  } catch { /* not available */ }

  // Try @ffmpeg-installer/ffmpeg
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require('@ffmpeg-installer/ffmpeg') as { path: string };
    if (installer.path && existsSync(installer.path)) {
      logger.info('FFmpeg resolved via @ffmpeg-installer', { path: installer.path, file: 'ffmpeg-utils.ts' });
      return installer.path;
    }
  } catch { /* not available */ }

  return null;
}

/**
 * Download a static ffmpeg binary to /tmp.
 * Downloads a raw binary file (no tar/extraction needed) from GitHub releases.
 */
async function downloadFfmpegBinary(): Promise<string> {
  logger.info('Downloading static ffmpeg binary to /tmp...', { url: FFMPEG_STATIC_URL, file: 'ffmpeg-utils.ts' });
  const startMs = Date.now();

  try {
    const response = await fetch(FFMPEG_STATIC_URL, { redirect: 'follow' });
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ffmpeg: ${response.status} ${response.statusText}`);
    }

    // Write the raw binary directly to /tmp/ffmpeg — no extraction needed
    const fileStream = createWriteStream(FFMPEG_TMP_PATH);
    await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);

    // Make executable
    await chmod(FFMPEG_TMP_PATH, 0o755);

    const elapsed = Date.now() - startMs;
    logger.info('FFmpeg binary downloaded and ready', {
      path: FFMPEG_TMP_PATH,
      elapsedMs: elapsed,
      file: 'ffmpeg-utils.ts',
    });

    return FFMPEG_TMP_PATH;
  } catch (error) {
    downloadPromise = null; // Allow retry on next call
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to download ffmpeg binary', error instanceof Error ? error : new Error(msg), {
      file: 'ffmpeg-utils.ts',
    });
    throw new Error(`Could not obtain ffmpeg binary: ${msg}`);
  }
}

/**
 * Synchronous path getter for backward compatibility.
 * Checks /tmp cache and local npm packages. Throws if not found.
 * Use ensureFfmpeg() for the async version that can download.
 */
export function getFfmpegPath(): string {
  // Check /tmp cache first (set by ensureFfmpeg)
  if (existsSync(FFMPEG_TMP_PATH)) {
    return FFMPEG_TMP_PATH;
  }

  const localPath = tryLocalFfmpeg();
  if (localPath) { return localPath; }

  throw new Error(
    'FFmpeg binary not found. Call ensureFfmpeg() first to download it, or install ffmpeg-static locally.'
  );
}

/**
 * Get the ffprobe binary path (if available).
 * Returns null on serverless environments where ffprobe isn't installed.
 */
export function getFfprobePath(): string | null {
  // ffprobe is not available on Vercel serverless — always use ffmpeg-based probing
  return null;
}

// ============================================================================
// Process Execution
// ============================================================================

/**
 * Run ffmpeg with the given arguments, returning stderr output.
 * Captures full stderr and includes the last 1 000 chars in the error message
 * so Vercel logs always show what went wrong without needing a separate debug run.
 */
export async function runFfmpeg(args: string[], timeoutMs = 300_000): Promise<string> {
  const ffmpegPath = await ensureFfmpeg();

  logger.info('Spawning FFmpeg', {
    binary: ffmpegPath,
    argCount: args.length,
    timeoutMs,
    file: 'ffmpeg-utils.ts',
  });

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg timed out after ${timeoutMs}ms. Last stderr: ${stderr.slice(-500)}`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        logger.info('FFmpeg finished successfully', { file: 'ffmpeg-utils.ts' });
        resolve(stderr);
      } else {
        const tail = stderr.slice(-1000);
        logger.error('FFmpeg exited with non-zero code', new Error(`code ${String(code)}`), {
          code,
          stderrTail: tail,
          file: 'ffmpeg-utils.ts',
        });
        reject(new Error(`ffmpeg exited with code ${String(code)}: ${tail}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      logger.error('FFmpeg spawn error', err, { binary: ffmpegPath, file: 'ffmpeg-utils.ts' });
      reject(new Error(`ffmpeg spawn error (binary: ${ffmpegPath}): ${err.message}`));
    });
  });
}

// ============================================================================
// Video Probing
// ============================================================================

export interface VideoProbeResult {
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
}

/**
 * Probe a video file for duration, resolution, etc.
 * Uses ffprobe if available, falls back to ffmpeg stderr parsing.
 */
export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const ffprobePath = getFfprobePath();

  if (ffprobePath) {
    return probeWithFfprobe(ffprobePath, filePath);
  }

  // Fallback: parse ffmpeg stderr
  return probeWithFfmpeg(filePath);
}

async function probeWithFfprobe(ffprobePath: string, filePath: string): Promise<VideoProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const proc = spawn(ffprobePath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }

      try {
        const data = JSON.parse(stdout) as {
          format?: { duration?: string };
          streams?: Array<{
            codec_type?: string;
            codec_name?: string;
            width?: number;
            height?: number;
            r_frame_rate?: string;
          }>;
        };

        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        const audioStream = data.streams?.find((s) => s.codec_type === 'audio');

        const fpsStr = videoStream?.r_frame_rate ?? '30/1';
        const [num, den] = fpsStr.split('/').map(Number);
        const fps = den ? num / den : 30;

        resolve({
          duration: parseFloat(data.format?.duration ?? '0'),
          width: videoStream?.width ?? 1920,
          height: videoStream?.height ?? 1080,
          fps: Math.round(fps),
          codec: videoStream?.codec_name ?? 'h264',
          hasAudio: audioStream !== undefined,
        });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe spawn error: ${err.message}`));
    });
  });
}

async function probeWithFfmpeg(filePath: string): Promise<VideoProbeResult> {
  try {
    const ffmpegBin = await ensureFfmpeg();
    // Run ffmpeg with -i to get media info (exits with code 1 but outputs info to stderr)
    const stderr = await new Promise<string>((resolve) => {
      const ffmpegPath = ffmpegBin;
      const proc = spawn(ffmpegPath, ['-i', filePath, '-f', 'null', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.on('close', () => {
        resolve(output);
      });

      proc.on('error', () => {
        resolve(output);
      });
    });

    // Parse duration: "Duration: 00:00:15.50"
    const durMatch = stderr.match(/Duration:\s+(\d+):(\d+):(\d+)\.(\d+)/);
    const duration = durMatch
      ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100
      : 0;

    // Parse video stream: "Stream #0:0: Video: h264, ..., 1920x1080, ..."
    const videoMatch = stderr.match(/Stream.*Video:\s*(\w+).*?(\d{2,5})x(\d{2,5}).*?(\d+(?:\.\d+)?)\s*fps/);
    const width = videoMatch ? parseInt(videoMatch[2]) : 1920;
    const height = videoMatch ? parseInt(videoMatch[3]) : 1080;
    const fps = videoMatch ? Math.round(parseFloat(videoMatch[4])) : 30;
    const codec = videoMatch ? videoMatch[1] : 'h264';

    const hasAudio = /Stream.*Audio:/.test(stderr);

    return { duration, width, height, fps, codec, hasAudio };
  } catch {
    // Return sensible defaults if probing fails
    return { duration: 0, width: 1920, height: 1080, fps: 30, codec: 'h264', hasAudio: false };
  }
}

// ============================================================================
// File I/O
// ============================================================================

/**
 * Create a temporary working directory
 */
export async function createWorkDir(prefix = 'video'): Promise<string> {
  const workDir = join(tmpdir(), `${prefix}-${randomUUID().slice(0, 8)}`);
  await mkdir(workDir, { recursive: true });
  return workDir;
}

/**
 * Download a video file, handling auth headers for provider-specific URLs.
 * Enforces a 30-second timeout via AbortController so a stalled Hedra URL
 * does not silently block the entire assembly job.
 */
export async function downloadVideo(
  url: string,
  destPath: string,
  timeoutMs = 30_000,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { redirect: 'follow', signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Download timed out or failed for ${url}: ${message}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
}

/**
 * Upload a file to Firebase Storage and return a signed URL
 */
export async function uploadToStorage(
  filePath: string,
  storagePath: string,
  contentType = 'video/mp4',
  expiryDays = 7,
): Promise<string> {
  if (!adminStorage) {
    throw new Error(
      'Firebase Storage is not initialized. ' +
      'Check that FIREBASE_SERVICE_ACCOUNT_KEY (or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY) ' +
      'are set in Vercel environment variables and that the Firebase Admin SDK initialized without errors.',
    );
  }

  const bucket = adminStorage.bucket();

  await bucket.upload(filePath, {
    destination: storagePath,
    metadata: {
      contentType,
      metadata: {
        processedAt: new Date().toISOString(),
      },
    },
  });

  const file = bucket.file(storagePath);
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}

/**
 * Clean up temp files (best-effort, non-blocking)
 */
export async function cleanupFiles(...paths: string[]): Promise<void> {
  for (const p of paths) {
    await unlink(p).catch(() => { /* ignore */ });
  }
}

/**
 * Clean up a working directory and all files in it
 */
export async function cleanupWorkDir(workDir: string): Promise<void> {
  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(workDir);
    for (const f of files) {
      await unlink(join(workDir, f)).catch(() => { /* ignore */ });
    }
    const { rmdir } = await import('fs/promises');
    await rmdir(workDir).catch(() => { /* ignore */ });
  } catch {
    // Best-effort cleanup
  }
}

// ============================================================================
// Compositing
// ============================================================================

/**
 * Chroma key composite: overlay green screen avatar on background video.
 * Uses FFmpeg colorkey filter to remove #00FF00 green background.
 *
 * @param avatarPath - Path to avatar video with green background
 * @param backgroundPath - Path to AI-generated background video
 * @param outputPath - Path for composited output
 * @param options - Compositing options
 */
export async function chromaKeyComposite(
  avatarPath: string,
  backgroundPath: string,
  outputPath: string,
  options?: {
    similarity?: number; // 0.0-1.0, lower = stricter key (default 0.3)
    blend?: number; // 0.0-1.0, edge softness (default 0.08)
    outputWidth?: number;
    outputHeight?: number;
  },
): Promise<string> {
  const similarity = options?.similarity ?? 0.3;
  const blend = options?.blend ?? 0.08;
  const width = options?.outputWidth ?? 1920;
  const height = options?.outputHeight ?? 1080;

  // Filter chain:
  // 1. Scale background to target resolution
  // 2. Scale avatar to target resolution
  // 3. Apply colorkey to avatar (remove green)
  // 4. Overlay keyed avatar on background
  // 5. Include audio from avatar video (which has the voiceover)
  const filterComplex = [
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg]`,
    `[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,colorkey=0x00FF00:${similarity}:${blend}[avatar]`,
    `[bg][avatar]overlay=0:0:format=auto[outv]`,
  ].join(';');

  const args = [
    '-i', backgroundPath,
    '-i', avatarPath,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '1:a?', // Audio from avatar video (voiceover)
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest', // Match duration to shorter input
    '-y',
    outputPath,
  ];

  const stderr = await runFfmpeg(args);

  logger.info('Chroma key composite complete', {
    outputPath,
    file: 'ffmpeg-utils.ts',
  });

  return stderr;
}

// ============================================================================
// Color Grading
// ============================================================================

export interface ColorGradeParams {
  contrast: number; // multiplier (1.0 = no change)
  saturation: number; // multiplier (1.0 = no change)
  brightness: number; // offset (-1.0 to 1.0)
  gamma: number; // gamma (1.0 = no change)
  temperature: number; // color temp shift (-100 to 100)
}

export const COLOR_GRADE_PRESETS: Record<string, ColorGradeParams> = {
  'corporate-clean': { contrast: 1.05, saturation: 0.95, brightness: 0.02, gamma: 1.0, temperature: 0 },
  'golden-warmth': { contrast: 1.08, saturation: 1.05, brightness: 0.03, gamma: 0.95, temperature: 15 },
  'cinema-contrast': { contrast: 1.2, saturation: 0.9, brightness: -0.05, gamma: 0.9, temperature: -5 },
  'vibrant-pop': { contrast: 1.1, saturation: 1.25, brightness: 0.02, gamma: 1.0, temperature: 5 },
  'soft-pastel': { contrast: 0.95, saturation: 0.8, brightness: 0.05, gamma: 1.05, temperature: 5 },
  'tech-modern': { contrast: 1.1, saturation: 0.85, brightness: 0, gamma: 1.0, temperature: -10 },
};

/**
 * Apply color grading to a video using FFmpeg eq and colorbalance filters
 */
export async function applyColorGrade(
  inputPath: string,
  outputPath: string,
  preset: string | ColorGradeParams,
): Promise<string> {
  const params = typeof preset === 'string'
    ? COLOR_GRADE_PRESETS[preset] ?? COLOR_GRADE_PRESETS['corporate-clean']
    : preset;

  // Build eq filter for contrast, brightness, saturation, gamma
  const eqFilter = `eq=contrast=${params.contrast}:brightness=${params.brightness}:saturation=${params.saturation}:gamma=${params.gamma}`;

  // Build colorbalance filter for temperature (warm = +red +green -blue, cool = -red -green +blue)
  const tempNorm = params.temperature / 100;
  const rs = tempNorm > 0 ? tempNorm * 0.3 : 0;
  const gs = tempNorm > 0 ? tempNorm * 0.1 : 0;
  const bs = tempNorm < 0 ? Math.abs(tempNorm) * 0.3 : 0;
  const colorBalance = `colorbalance=rs=${rs}:gs=${gs}:bs=${-bs}:rm=${rs * 0.5}:gm=${gs * 0.5}:bm=${-bs * 0.5}`;

  const filterComplex = `[0:v]${eqFilter},${colorBalance}[outv]`;

  const args = [
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];

  return runFfmpeg(args);
}

// ============================================================================
// Audio Mixing
// ============================================================================

/**
 * Mix background music with video audio, with ducking when voice is present.
 * Uses sidechaincompress for automatic ducking and loudnorm for LUFS normalization.
 *
 * @param videoPath - Input video with voiceover audio
 * @param musicPath - Background music file
 * @param outputPath - Output path for mixed result
 * @param options - Mix options
 */
export async function mixAudioWithDucking(
  videoPath: string,
  musicPath: string,
  outputPath: string,
  options?: {
    musicVolume?: number; // 0.0-1.0 (default 0.15)
    duckingThreshold?: number; // dB threshold for ducking (default -20)
    duckingRatio?: number; // compression ratio (default 8)
    targetLUFS?: number; // target loudness (default -14)
  },
): Promise<string> {
  const musicVol = options?.musicVolume ?? 0.15;
  const threshold = options?.duckingThreshold ?? -20;
  const ratio = options?.duckingRatio ?? 8;
  const targetLUFS = options?.targetLUFS ?? -14;

  // Filter chain:
  // 1. Extract video audio as voice track
  // 2. Scale music volume
  // 3. Sidechain compress music using voice as key signal (auto-ducking)
  // 4. Mix voice + ducked music
  // 5. Normalize to target LUFS
  const filterComplex = [
    `[0:a]aformat=fltp:44100:stereo[voice]`,
    `[1:a]aformat=fltp:44100:stereo,volume=${musicVol}[music]`,
    `[music][voice]sidechaincompress=threshold=${threshold}dB:ratio=${ratio}:attack=50:release=300[ducked]`,
    `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=2[mixed]`,
    `[mixed]loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11[outa]`,
  ].join(';');

  const args = [
    '-i', videoPath,
    '-i', musicPath,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[outa]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    '-y',
    outputPath,
  ];

  return runFfmpeg(args);
}

// ============================================================================
// Text Overlay
// ============================================================================

/**
 * Add text overlay to video using FFmpeg drawtext filter
 */
export async function addTextOverlay(
  inputPath: string,
  outputPath: string,
  overlays: Array<{
    text: string;
    position: 'top' | 'bottom' | 'center';
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
    startTime: number;
    endTime: number;
  }>,
): Promise<string> {
  if (overlays.length === 0) {
    // No overlays, just copy
    const args = ['-i', inputPath, '-c', 'copy', '-y', outputPath];
    return runFfmpeg(args);
  }

  // Build drawtext filter chain
  const textFilters = overlays.map((o) => {
    const size = o.fontSize ?? 48;
    const color = o.fontColor ?? 'white';
    const bgColor = o.backgroundColor ?? 'black@0.5';

    // Position mapping
    const yExpr = o.position === 'top' ? '50'
      : o.position === 'bottom' ? '(h-th-50)'
      : '(h-th)/2';

    // Escape special characters for FFmpeg drawtext
    const escapedText = o.text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/:/g, '\\:')
      .replace(/%/g, '%%');

    return `drawtext=text='${escapedText}':fontsize=${size}:fontcolor=${color}:x=(w-tw)/2:y=${yExpr}:box=1:boxcolor=${bgColor}:boxborderw=10:enable='between(t,${o.startTime},${o.endTime})'`;
  });

  const filterComplex = `[0:v]${textFilters.join(',')}[outv]`;

  const args = [
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];

  return runFfmpeg(args);
}

// ============================================================================
// Watermark
// ============================================================================

/**
 * Add a brand watermark/logo overlay to video
 */
export async function addWatermark(
  inputPath: string,
  watermarkPath: string,
  outputPath: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
  opacity = 0.7,
  scale = 0.1, // 10% of video width
): Promise<string> {
  const posMap = {
    'top-left': 'x=20:y=20',
    'top-right': 'x=W-w-20:y=20',
    'bottom-left': 'x=20:y=H-h-20',
    'bottom-right': 'x=W-w-20:y=H-h-20',
  };

  const filterComplex = [
    `[1:v]scale=iw*${scale}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm]`,
    `[0:v][wm]overlay=${posMap[position]}[outv]`,
  ].join(';');

  const args = [
    '-i', inputPath,
    '-i', watermarkPath,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];

  return runFfmpeg(args);
}

// ============================================================================
// Assembly (Improved)
// ============================================================================

/**
 * Build ffmpeg args for concatenation with proper dynamic xfade offsets.
 * Probes each clip for actual duration instead of using hardcoded offsets.
 */
export async function buildSmartConcatArgs(
  inputPaths: string[],
  outputPath: string,
  transitionType: 'cut' | 'fade' | 'dissolve',
  outputWidth = 1920,
  outputHeight = 1080,
  crf = 18,
): Promise<string[]> {
  const filterParts: string[] = [];
  const args: string[] = [];

  // Add inputs and scale/normalize each
  for (let i = 0; i < inputPaths.length; i++) {
    args.push('-i', inputPaths[i]);
    filterParts.push(
      `[${i}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`
    );
  }

  if (transitionType === 'cut' || inputPaths.length === 1) {
    // Simple concat
    const concatInputs = inputPaths.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=0[outv]`);
  } else {
    // Probe each clip for actual duration to compute correct xfade offsets
    const durations: number[] = [];
    for (const path of inputPaths) {
      const info = await probeVideo(path);
      durations.push(info.duration);
    }

    const fadeDuration = 0.5;
    const xfadeType = transitionType === 'dissolve' ? 'dissolve' : 'fade';

    if (inputPaths.length === 2) {
      const offset = Math.max(0, durations[0] - fadeDuration);
      filterParts.push(
        `[v0][v1]xfade=transition=${xfadeType}:duration=${fadeDuration}:offset=${offset.toFixed(2)}[outv]`
      );
    } else {
      // Chain xfade filters for 3+ clips
      let cumulativeOffset = 0;
      let prevLabel = 'v0';

      for (let i = 1; i < inputPaths.length; i++) {
        cumulativeOffset += durations[i - 1] - fadeDuration;
        const outLabel = i === inputPaths.length - 1 ? 'outv' : `xf${i}`;
        filterParts.push(
          `[${prevLabel}][v${i}]xfade=transition=${xfadeType}:duration=${fadeDuration}:offset=${Math.max(0, cumulativeOffset).toFixed(2)}[${outLabel}]`
        );
        prevLabel = outLabel;
      }
    }
  }

  args.push(
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(crf),
    '-movflags', '+faststart',
    '-y',
    outputPath,
  );

  return args;
}

/**
 * Get Firebase Storage path for a processed video
 */
export function getStoragePath(projectId: string, type: string): string {
  return `organizations/${PLATFORM_ID}/videos/${projectId}/${type}_${Date.now()}.mp4`;
}
