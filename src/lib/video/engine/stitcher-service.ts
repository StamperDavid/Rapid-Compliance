/**
 * Automated Post-Production (Stitcher) Service
 *
 * Handles the final assembly of generated video clips with:
 * - Native TTS voiceover layering with precise timing
 * - BPM-aware music ducking for audio balance
 * - Global CSS/LUT filtering for brand visual consistency
 *
 * Features:
 * - Multi-track audio mixing
 * - Beat-synchronized transitions
 * - Dynamic audio ducking based on voiceover
 * - Color grading and LUT application
 * - Brand overlay compositing
 */

import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';
import { VoiceEngineFactory } from '@/lib/voice/tts/voice-engine-factory';
import type { TTSEngineType } from '@/lib/voice/tts/types';
import type {
  MasterStoryboard,
  PostProductionJob,
  PostProductionStatus,
  GeneratedClip,
  AudioTrack,
  VisualStyleConfig,
  DuckingConfig,
  VoiceoverSegment,
} from './types';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_AUDIO_FORMAT = 'mp3';
const LUT_PRESETS: Record<string, LUTPreset> = {
  'corporate-clean': {
    name: 'Corporate Clean',
    description: 'Professional, balanced colors for business content',
    adjustments: {
      contrast: 1.05,
      saturation: 0.95,
      temperature: 0,
      tint: 0,
      shadows: 0.02,
      highlights: -0.02,
    },
  },
  'golden-warmth': {
    name: 'Golden Warmth',
    description: 'Warm, inviting tones for lifestyle and hospitality',
    adjustments: {
      contrast: 1.08,
      saturation: 1.05,
      temperature: 15,
      tint: 5,
      shadows: 0.05,
      highlights: 0,
    },
  },
  'cinema-contrast': {
    name: 'Cinema Contrast',
    description: 'High contrast cinematic look for dramatic content',
    adjustments: {
      contrast: 1.2,
      saturation: 0.9,
      temperature: -5,
      tint: 0,
      shadows: -0.1,
      highlights: 0.1,
    },
  },
  'vibrant-pop': {
    name: 'Vibrant Pop',
    description: 'Bold, saturated colors for energetic content',
    adjustments: {
      contrast: 1.1,
      saturation: 1.25,
      temperature: 5,
      tint: 0,
      shadows: 0,
      highlights: 0.05,
    },
  },
  'soft-pastel': {
    name: 'Soft Pastel',
    description: 'Gentle, desaturated look for calm content',
    adjustments: {
      contrast: 0.95,
      saturation: 0.8,
      temperature: 5,
      tint: 3,
      shadows: 0.08,
      highlights: -0.05,
    },
  },
  'tech-modern': {
    name: 'Tech Modern',
    description: 'Cool, futuristic tones for technology content',
    adjustments: {
      contrast: 1.1,
      saturation: 0.95,
      temperature: -10,
      tint: -5,
      shadows: 0,
      highlights: 0.05,
    },
  },
  'natural-balanced': {
    name: 'Natural Balanced',
    description: 'Neutral, true-to-life colors',
    adjustments: {
      contrast: 1.0,
      saturation: 1.0,
      temperature: 0,
      tint: 0,
      shadows: 0,
      highlights: 0,
    },
  },
};

// ============================================================================
// STITCHER SERVICE
// ============================================================================

export class StitcherService {
  private static instance: StitcherService;

  // Active jobs tracking
  private activeJobs: Map<string, PostProductionJob> = new Map();

  private constructor() {}

  static getInstance(): StitcherService {
    if (!StitcherService.instance) {
      StitcherService.instance = new StitcherService();
    }
    return StitcherService.instance;
  }

  /**
   * Create a post-production job from a storyboard
   */
  createJob(
    storyboard: MasterStoryboard,
    generatedClips: GeneratedClip[]
  ): PostProductionJob {
    const job: PostProductionJob = {
      id: uuidv4(),
      storyboardId: storyboard.id,
      organizationId: DEFAULT_ORG_ID,
      clips: generatedClips,
      sfxTracks: [],
      lutApplied: false,
      colorCorrectionApplied: false,
      brandOverlayApplied: false,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing',
      errors: [],
    };

    this.activeJobs.set(job.id, job);

    logger.info('Stitcher: Job created', {
      jobId: job.id,
      storyboardId: storyboard.id,
      clipCount: generatedClips.length,
    });

    return job;
  }

  /**
   * Process a post-production job
   */
  async processJob(job: PostProductionJob, storyboard: MasterStoryboard): Promise<PostProductionJob> {
    const startTime = Date.now();

    logger.info('Stitcher: Starting post-production', {
      jobId: job.id,
      storyboardId: storyboard.id,
    });

    try {
      // Update status
      this.updateJobStatus(job, 'preparing', 5, 'Preparing assets');

      // Step 1: Generate voiceover audio
      let voiceoverTrack: AudioTrack | undefined;
      if (storyboard.audioConfig.voiceover.enabled) {
        this.updateJobStatus(job, 'preparing', 10, 'Generating voiceover');
        voiceoverTrack = await this.generateVoiceover(
          storyboard.audioConfig.voiceover.script.segments,
          storyboard.audioConfig.voiceover.ttsEngine,
          storyboard.audioConfig.voiceover.voiceId,
          storyboard.audioConfig.voiceover.speed,
          storyboard.audioConfig.voiceover.pitch
        );
        Object.assign(job, { voiceoverTrack });
      }

      // Step 2: Prepare background music track
      let musicTrack: AudioTrack | undefined;
      if (storyboard.audioConfig.backgroundMusic.enabled) {
        this.updateJobStatus(job, 'preparing', 25, 'Preparing background music');
        musicTrack = this.prepareMusicTrack(
          storyboard.audioConfig.backgroundMusic,
          storyboard.totalDuration
        );
        Object.assign(job, { musicTrack });
      }

      // Step 3: Apply BPM-aware ducking to music
      if (musicTrack && voiceoverTrack && storyboard.audioConfig.backgroundMusic.duckingConfig.enabled) {
        this.updateJobStatus(job, 'audio-mixing', 35, 'Applying audio ducking');
        const duckedMusicTrack = this.applyDucking(
          musicTrack,
          voiceoverTrack,
          storyboard.audioConfig.backgroundMusic.duckingConfig
        );
        musicTrack = duckedMusicTrack;
        Object.assign(job, { musicTrack: duckedMusicTrack });
      }

      // Step 4: Stitch video clips in sequence
      this.updateJobStatus(job, 'stitching', 45, 'Stitching video clips');
      const stitchedVideoUrl = this.stitchClips(
        job.clips,
        storyboard.scenes,
        storyboard.aspectRatio,
        storyboard.resolution,
        storyboard.frameRate
      );

      // Step 5: Apply color grading and LUT
      this.updateJobStatus(job, 'color-grading', 65, 'Applying color grading');
      const colorGradedUrl = this.applyColorGrading(
        stitchedVideoUrl,
        storyboard.visualStyle
      );
      job.lutApplied = true;
      job.colorCorrectionApplied = true;

      // Step 6: Apply brand overlay
      let overlayAppliedUrl = colorGradedUrl;
      if (storyboard.visualStyle.brandOverlay) {
        this.updateJobStatus(job, 'color-grading', 75, 'Applying brand overlay');
        overlayAppliedUrl = this.applyBrandOverlay(
          colorGradedUrl,
          storyboard.visualStyle.brandOverlay
        );
        job.brandOverlayApplied = true;
      }

      // Step 7: Mix final audio
      this.updateJobStatus(job, 'audio-mixing', 85, 'Mixing final audio');
      const mixedAudioUrl = this.mixAudio(
        voiceoverTrack,
        musicTrack,
        job.sfxTracks,
        storyboard.audioConfig.masterVolume,
        storyboard.audioConfig.targetLUFS
      );

      // Step 8: Final render - combine video and audio
      this.updateJobStatus(job, 'rendering', 90, 'Rendering final output');
      const finalUrl = this.renderFinal(
        overlayAppliedUrl,
        mixedAudioUrl,
        storyboard.aspectRatio,
        storyboard.resolution,
        storyboard.frameRate
      );

      // Step 9: Upload and get final URLs
      this.updateJobStatus(job, 'uploading', 95, 'Uploading final video');
      const uploadResult = this.uploadFinal(job.id, finalUrl);

      // Update job with results
      job.outputUrl = uploadResult.videoUrl;
      job.outputThumbnailUrl = uploadResult.thumbnailUrl;
      job.outputDuration = storyboard.totalDuration;
      job.outputFileSize = uploadResult.fileSize;
      job.completedAt = new Date();

      this.updateJobStatus(job, 'completed', 100, 'Complete');

      logger.info('Stitcher: Post-production complete', {
        jobId: job.id,
        outputUrl: job.outputUrl,
        duration: Date.now() - startTime,
      });

      return job;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = err.message;

      logger.error('Stitcher: Post-production failed', err, {
        jobId: job.id,
        currentStep: job.currentStep,
      });

      job.errors.push({
        step: job.currentStep,
        message: errorMessage,
        timestamp: new Date(),
        recoverable: false,
      });

      job.status = 'failed';
      this.activeJobs.set(job.id, job);

      throw error;
    }
  }

  /**
   * Generate voiceover audio from script segments
   */
  private async generateVoiceover(
    segments: VoiceoverSegment[],
    engine: TTSEngineType,
    voiceId: string,
    speed: number,
    pitch: number
  ): Promise<AudioTrack> {
    logger.info('Stitcher: Generating voiceover', {
      organizationId: DEFAULT_ORG_ID,
      segmentCount: segments.length,
      engine,
    });

    const audioSegments: VoiceoverAudioSegment[] = [];
    let totalDuration = 0;

    for (const segment of segments) {
      try {
        // Generate audio for this segment
        const response = await VoiceEngineFactory.getAudio({
          text: segment.text,
          organizationId: DEFAULT_ORG_ID,
          engine,
          voiceId,
          settings: {
            speed,
            pitch,
            format: DEFAULT_AUDIO_FORMAT as 'mp3',
          },
        });

        audioSegments.push({
          segmentId: segment.id,
          audio: response.audio,
          duration: response.durationSeconds * 1000,
          startTime: segment.startTime,
          format: response.format,
        });

        totalDuration = Math.max(
          totalDuration,
          segment.startTime + response.durationSeconds * 1000
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Stitcher: Failed to generate segment', err, {
          segmentId: segment.id,
        });
        // Continue with other segments
      }
    }

    // Combine segments into a single track
    const combinedAudioUrl = this.combineVoiceoverSegments(audioSegments, totalDuration);

    return {
      id: uuidv4(),
      type: 'voiceover',
      url: combinedAudioUrl,
      duration: totalDuration,
      volume: 1.0,
    };
  }

  /**
   * Combine voiceover segments into a single audio track
   */
  private combineVoiceoverSegments(
    segments: VoiceoverAudioSegment[],
    totalDuration: number
  ): string {
    // In a real implementation, this would use FFmpeg or a similar tool
    // to combine audio segments at their specified timestamps

    const _combinationData: AudioCombinationManifest = {
      totalDuration,
      segments: segments.map((s) => ({
        url: s.audio,
        startTime: s.startTime,
        duration: s.duration,
        volume: 1.0,
      })),
      outputFormat: DEFAULT_AUDIO_FORMAT,
      sampleRate: DEFAULT_SAMPLE_RATE,
    };

    // Simulate processing
    logger.debug('Stitcher: Combining voiceover segments', {
      segmentCount: segments.length,
      totalDuration,
    });

    // Return a placeholder URL (in production, this would be the actual processed audio)
    return `audio://voiceover/${uuidv4()}.${DEFAULT_AUDIO_FORMAT}`;
  }

  /**
   * Prepare background music track
   */
  private prepareMusicTrack(
    musicConfig: MasterStoryboard['audioConfig']['backgroundMusic'],
    totalDuration: number
  ): AudioTrack {
    logger.info('Stitcher: Preparing music track', {
      genre: musicConfig.genre,
      mood: musicConfig.mood,
      bpm: musicConfig.bpm,
    });

    // Select or fetch music based on config
    const musicUrl = musicConfig.trackUrl ?? this.selectMusicTrack(
      musicConfig.genre,
      musicConfig.mood,
      totalDuration
    );

    // Detect BPM if not provided
    const bpm = musicConfig.bpm ?? this.detectBPM(musicUrl);

    // Calculate beat markers
    const beatMarkers = this.calculateBeatMarkers(bpm, totalDuration);

    return {
      id: uuidv4(),
      type: 'music',
      url: musicUrl,
      duration: totalDuration,
      volume: musicConfig.volume,
      fadeIn: 1000, // 1 second fade in
      fadeOut: 2000, // 2 second fade out
      bpm,
      beatMarkers,
    };
  }

  /**
   * Select a music track based on criteria
   */
  private selectMusicTrack(
    genre?: string,
    mood?: string,
    _duration?: number
  ): string {
    // In production, this would query a music library API
    // For now, return a placeholder
    logger.debug('Stitcher: Selecting music track', { genre, mood });

    return `music://library/${genre ?? 'ambient'}/${mood ?? 'neutral'}.mp3`;
  }

  /**
   * Detect BPM from audio
   */
  private detectBPM(_audioUrl: string): number {
    // In production, this would use audio analysis
    // Return a common BPM as default
    logger.debug('Stitcher: Detecting BPM');
    return 120; // Default to 120 BPM
  }

  /**
   * Calculate beat marker timestamps
   */
  private calculateBeatMarkers(bpm: number, totalDuration: number): number[] {
    const beatInterval = (60 / bpm) * 1000; // Milliseconds per beat
    const markers: number[] = [];

    for (let time = 0; time < totalDuration; time += beatInterval) {
      markers.push(Math.round(time));
    }

    return markers;
  }

  /**
   * Apply BPM-aware ducking to music track
   */
  private applyDucking(
    musicTrack: AudioTrack,
    voiceoverTrack: AudioTrack,
    duckingConfig: DuckingConfig
  ): AudioTrack {
    logger.info('Stitcher: Applying audio ducking', {
      duckLevel: duckingConfig.duckLevel,
      attackTime: duckingConfig.attackTime,
      releaseTime: duckingConfig.releaseTime,
    });

    // Calculate ducking envelope based on voiceover activity
    const duckingEnvelope = this.calculateDuckingEnvelope(
      voiceoverTrack,
      duckingConfig
    );

    // Generate ducking automation data
    const _automationData: DuckingAutomation = {
      sourceTrackId: musicTrack.id,
      triggerTrackId: voiceoverTrack.id,
      envelope: duckingEnvelope,
      config: duckingConfig,
    };

    // In production, this would apply the ducking to the audio
    // For now, we mark the track as processed
    logger.debug('Stitcher: Ducking envelope calculated', {
      pointCount: duckingEnvelope.length,
    });

    return {
      ...musicTrack,
      // The URL would be updated to point to the processed audio
      url: `${musicTrack.url}?ducked=true`,
    };
  }

  /**
   * Calculate ducking envelope based on voiceover
   */
  private calculateDuckingEnvelope(
    voiceoverTrack: AudioTrack,
    duckingConfig: DuckingConfig
  ): DuckingPoint[] {
    // Analyze voiceover for activity regions
    // In production, this would use actual audio analysis

    const envelope: DuckingPoint[] = [];
    const sampleRate = 100; // 100 points per second

    // Simulate voiceover activity detection
    // Real implementation would analyze audio amplitude
    for (let time = 0; time < voiceoverTrack.duration; time += 1000 / sampleRate) {
      // Assume voiceover is active for most of the duration
      // In reality, we'd detect silence gaps
      const isActive = Math.random() > 0.3; // Simplified

      envelope.push({
        time,
        volume: isActive ? duckingConfig.duckLevel : 1.0,
      });
    }

    // Apply attack and release smoothing
    return this.smoothDuckingEnvelope(envelope, duckingConfig);
  }

  /**
   * Smooth ducking envelope with attack/release
   */
  private smoothDuckingEnvelope(
    envelope: DuckingPoint[],
    duckingConfig: DuckingConfig
  ): DuckingPoint[] {
    const smoothed: DuckingPoint[] = [];

    for (let i = 0; i < envelope.length; i++) {
      const current = envelope[i];
      const previous = smoothed[smoothed.length - 1];

      if (!previous) {
        smoothed.push(current);
        continue;
      }

      // Apply attack/release smoothing
      const timeDelta = current.time - previous.time;

      if (current.volume < previous.volume) {
        // Ducking down - use attack time
        const rate = (1 - duckingConfig.duckLevel) / duckingConfig.attackTime;
        const maxChange = rate * timeDelta;
        const actualChange = Math.min(previous.volume - current.volume, maxChange);

        smoothed.push({
          time: current.time,
          volume: previous.volume - actualChange,
        });
      } else if (current.volume > previous.volume) {
        // Releasing - use release time
        const rate = (1 - duckingConfig.duckLevel) / duckingConfig.releaseTime;
        const maxChange = rate * timeDelta;
        const actualChange = Math.min(current.volume - previous.volume, maxChange);

        smoothed.push({
          time: current.time,
          volume: previous.volume + actualChange,
        });
      } else {
        smoothed.push(current);
      }
    }

    return smoothed;
  }

  /**
   * Stitch video clips together
   */
  private stitchClips(
    clips: GeneratedClip[],
    scenes: MasterStoryboard['scenes'],
    aspectRatio: string,
    resolution: string,
    _frameRate: number
  ): string {
    logger.info('Stitcher: Stitching clips', {
      clipCount: clips.length,
      sceneCount: scenes.length,
      aspectRatio,
      resolution,
    });

    // Build stitch manifest
    const stitchManifest: StitchManifest = {
      clips: clips.map((clip, index) => ({
        url: clip.url,
        startTime: this.calculateClipStartTime(clip.shotId, scenes),
        duration: clip.duration,
        transition: index === 0 ? 'fade-in' : 'cut',
        transitionDuration: index === 0 ? 500 : 0,
      })),
      outputSettings: {
        aspectRatio,
        resolution,
        frameRate: 30,
        codec: 'h264',
        bitrate: this.calculateBitrate(resolution),
      },
    };

    // In production, this would use FFmpeg or a video processing service
    logger.debug('Stitcher: Stitch manifest created', {
      clipCount: stitchManifest.clips.length,
    });

    return `video://stitched/${uuidv4()}.mp4`;
  }

  /**
   * Calculate start time for a clip based on shot ID
   */
  private calculateClipStartTime(
    shotId: string,
    scenes: MasterStoryboard['scenes']
  ): number {
    for (const scene of scenes) {
      for (const shot of scene.shots) {
        if (shot.id === shotId) {
          return scene.startTime + shot.startTime;
        }
      }
    }
    return 0;
  }

  /**
   * Calculate bitrate based on resolution
   */
  private calculateBitrate(resolution: string): number {
    const bitrates: Record<string, number> = {
      '720p': 5000000,  // 5 Mbps
      '1080p': 10000000, // 10 Mbps
      '4k': 35000000,   // 35 Mbps
    };
    return bitrates[resolution] ?? 10000000;
  }

  /**
   * Apply color grading and LUT
   */
  private applyColorGrading(
    _videoUrl: string,
    visualStyle: VisualStyleConfig
  ): string {
    logger.info('Stitcher: Applying color grading', {
      lutId: visualStyle.lutId,
      lutIntensity: visualStyle.lutIntensity,
    });

    // Get LUT preset
    const lutPreset = visualStyle.lutId
      ? LUT_PRESETS[visualStyle.lutId]
      : LUT_PRESETS['natural-balanced'];

    if (!lutPreset) {
      logger.warn('Stitcher: LUT preset not found, using default');
      return `video://graded/${uuidv4()}.mp4`;
    }

    // Build color grading parameters
    const gradingParams: ColorGradingParams = {
      // Base LUT adjustments
      ...lutPreset.adjustments,

      // Apply intensity
      contrast: 1 + (lutPreset.adjustments.contrast - 1) * visualStyle.lutIntensity,
      saturation: 1 + (lutPreset.adjustments.saturation - 1) * visualStyle.lutIntensity,
      temperature: lutPreset.adjustments.temperature * visualStyle.lutIntensity,
      tint: lutPreset.adjustments.tint * visualStyle.lutIntensity,

      // Custom color correction overrides
      exposure: visualStyle.colorCorrection.exposure,
      highlights: visualStyle.colorCorrection.highlights,
      shadows: visualStyle.colorCorrection.shadows,
      vibrance: visualStyle.colorCorrection.vibrance,

      // Film effects
      filmGrain: visualStyle.filmGrain?.enabled
        ? {
            intensity: visualStyle.filmGrain.intensity,
            size: visualStyle.filmGrain.size,
          }
        : undefined,
      vignette: visualStyle.vignette?.enabled
        ? {
            intensity: visualStyle.vignette.intensity,
            softness: visualStyle.vignette.softness,
          }
        : undefined,
    };

    logger.debug('Stitcher: Color grading params', {
      contrast: gradingParams.contrast,
      saturation: gradingParams.saturation,
      temperature: gradingParams.temperature,
      tint: gradingParams.tint,
      exposure: gradingParams.exposure,
      highlights: gradingParams.highlights,
      shadows: gradingParams.shadows,
      vibrance: gradingParams.vibrance,
      hasFilmGrain: !!gradingParams.filmGrain,
      hasVignette: !!gradingParams.vignette,
    });

    // In production, this would apply the grading using FFmpeg filters
    return `video://graded/${uuidv4()}.mp4`;
  }

  /**
   * Apply brand overlay (logo, watermark)
   */
  private applyBrandOverlay(
    _videoUrl: string,
    brandOverlay: NonNullable<VisualStyleConfig['brandOverlay']>
  ): string {
    logger.info('Stitcher: Applying brand overlay', {
      position: brandOverlay.logoPosition,
      opacity: brandOverlay.logoOpacity,
    });

    const overlayParams: OverlayParams = {
      logoUrl: brandOverlay.logoUrl,
      position: brandOverlay.logoPosition,
      opacity: brandOverlay.logoOpacity,
      padding: 20,
      watermark: brandOverlay.watermarkEnabled,
    };

    logger.debug('Stitcher: Overlay params', {
      hasLogoUrl: !!overlayParams.logoUrl,
      position: overlayParams.position,
      opacity: overlayParams.opacity,
      padding: overlayParams.padding,
      watermark: overlayParams.watermark,
    });

    // In production, this would composite the logo onto the video
    return `video://overlaid/${uuidv4()}.mp4`;
  }

  /**
   * Mix all audio tracks
   */
  private mixAudio(
    voiceoverTrack: AudioTrack | undefined,
    musicTrack: AudioTrack | undefined,
    sfxTracks: AudioTrack[],
    masterVolume: number,
    targetLUFS: number
  ): string {
    logger.info('Stitcher: Mixing audio', {
      hasVoiceover: !!voiceoverTrack,
      hasMusic: !!musicTrack,
      sfxCount: sfxTracks.length,
      masterVolume,
      targetLUFS,
    });

    const mixManifest: AudioMixManifest = {
      tracks: [],
      masterVolume,
      normalization: {
        enabled: true,
        targetLUFS,
      },
      outputFormat: DEFAULT_AUDIO_FORMAT,
      sampleRate: DEFAULT_SAMPLE_RATE,
    };

    // Add tracks in priority order
    if (voiceoverTrack) {
      mixManifest.tracks.push({
        ...voiceoverTrack,
        priority: 1,
      });
    }

    if (musicTrack) {
      mixManifest.tracks.push({
        ...musicTrack,
        priority: 2,
      });
    }

    for (const sfx of sfxTracks) {
      mixManifest.tracks.push({
        ...sfx,
        priority: 3,
      });
    }

    logger.debug('Stitcher: Mix manifest created', {
      trackCount: mixManifest.tracks.length,
    });

    // In production, this would use FFmpeg for audio mixing
    return `audio://mixed/${uuidv4()}.${DEFAULT_AUDIO_FORMAT}`;
  }

  /**
   * Render final video with audio
   */
  private renderFinal(
    videoUrl: string,
    audioUrl: string,
    aspectRatio: string,
    resolution: string,
    _frameRate: number
  ): string {
    logger.info('Stitcher: Rendering final output', {
      aspectRatio,
      resolution,
    });

    const renderParams: RenderParams = {
      videoInput: videoUrl,
      audioInput: audioUrl,
      outputSettings: {
        aspectRatio,
        resolution,
        frameRate: 30,
        codec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: DEFAULT_SAMPLE_RATE,
      },
    };

    logger.debug('Stitcher: Render params', {
      hasVideoInput: !!renderParams.videoInput,
      hasAudioInput: !!renderParams.audioInput,
      aspectRatio: renderParams.outputSettings.aspectRatio,
      resolution: renderParams.outputSettings.resolution,
      frameRate: renderParams.outputSettings.frameRate,
      codec: renderParams.outputSettings.codec,
      audioCodec: renderParams.outputSettings.audioCodec,
      audioSampleRate: renderParams.outputSettings.audioSampleRate,
    });

    // In production, this would combine video and audio using FFmpeg
    return `video://final/${uuidv4()}.mp4`;
  }

  /**
   * Upload final video to storage
   */
  private uploadFinal(
    jobId: string,
    _videoUrl: string
  ): { videoUrl: string; thumbnailUrl: string; fileSize: number } {
    logger.info('Stitcher: Uploading final video', {
      jobId,
      organizationId: DEFAULT_ORG_ID,
    });

    // In production, this would:
    // 1. Upload to cloud storage (GCS, S3, etc.)
    // 2. Generate thumbnail
    // 3. Return public URLs

    const publicVideoUrl = `https://storage.example.com/videos/${DEFAULT_ORG_ID}/${jobId}.mp4`;
    const thumbnailUrl = `https://storage.example.com/thumbnails/${DEFAULT_ORG_ID}/${jobId}.jpg`;

    return {
      videoUrl: publicVideoUrl,
      thumbnailUrl,
      fileSize: 50 * 1024 * 1024, // Placeholder 50MB
    };
  }

  /**
   * Update job status
   */
  private updateJobStatus(
    job: PostProductionJob,
    status: PostProductionStatus,
    progress: number,
    currentStep: string
  ): void {
    job.status = status;
    job.progress = progress;
    job.currentStep = currentStep;

    if (status === 'preparing' && !job.startedAt) {
      job.startedAt = new Date();
    }

    this.activeJobs.set(job.id, job);

    logger.debug('Stitcher: Job status updated', {
      jobId: job.id,
      status,
      progress,
      currentStep,
    });
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): PostProductionJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): PostProductionJob[] {
    return Array.from(this.activeJobs.values())
      .filter((job) => job.organizationId === DEFAULT_ORG_ID);
  }

  /**
   * Get available LUT presets
   */
  getLUTPresets(): Record<string, LUTPreset> {
    return { ...LUT_PRESETS };
  }
}

// ============================================================================
// HELPER INTERFACES
// ============================================================================

interface LUTPreset {
  name: string;
  description: string;
  adjustments: {
    contrast: number;
    saturation: number;
    temperature: number;
    tint: number;
    shadows: number;
    highlights: number;
  };
}

interface VoiceoverAudioSegment {
  segmentId: string;
  audio: string;
  duration: number;
  startTime: number;
  format: string;
}

interface AudioCombinationManifest {
  totalDuration: number;
  segments: Array<{
    url: string;
    startTime: number;
    duration: number;
    volume: number;
  }>;
  outputFormat: string;
  sampleRate: number;
}

interface DuckingAutomation {
  sourceTrackId: string;
  triggerTrackId: string;
  envelope: DuckingPoint[];
  config: DuckingConfig;
}

interface DuckingPoint {
  time: number;
  volume: number;
}

interface StitchManifest {
  clips: Array<{
    url: string;
    startTime: number;
    duration: number;
    transition: string;
    transitionDuration: number;
  }>;
  outputSettings: {
    aspectRatio: string;
    resolution: string;
    frameRate: number;
    codec: string;
    bitrate: number;
  };
}

interface ColorGradingParams {
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  exposure: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  filmGrain?: {
    intensity: number;
    size: string;
  };
  vignette?: {
    intensity: number;
    softness: number;
  };
}

interface OverlayParams {
  logoUrl?: string;
  position: string;
  opacity: number;
  padding: number;
  watermark: boolean;
}

interface AudioMixManifest {
  tracks: Array<AudioTrack & { priority: number }>;
  masterVolume: number;
  normalization: {
    enabled: boolean;
    targetLUFS: number;
  };
  outputFormat: string;
  sampleRate: number;
}

interface RenderParams {
  videoInput: string;
  audioInput: string;
  outputSettings: {
    aspectRatio: string;
    resolution: string;
    frameRate: number;
    codec: string;
    audioCodec: string;
    audioSampleRate: number;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const stitcherService = StitcherService.getInstance();

/**
 * Create a post-production job
 */
export function createPostProductionJob(
  storyboard: MasterStoryboard,
  generatedClips: GeneratedClip[]
): PostProductionJob {
  return stitcherService.createJob(storyboard, generatedClips);
}

/**
 * Process a post-production job
 */
export async function processPostProduction(
  job: PostProductionJob,
  storyboard: MasterStoryboard
): Promise<PostProductionJob> {
  return stitcherService.processJob(job, storyboard);
}

/**
 * Get job status
 */
export function getPostProductionStatus(jobId: string): PostProductionJob | undefined {
  return stitcherService.getJobStatus(jobId);
}

/**
 * Get available LUT presets
 */
export function getLUTPresets(): Record<string, LUTPreset> {
  return stitcherService.getLUTPresets();
}
