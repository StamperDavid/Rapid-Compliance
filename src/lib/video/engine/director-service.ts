/**
 * Director Service
 *
 * The 'Director' converts Brand DNA + Trend Reports into a Master Storyboard JSON.
 * Uses AI to generate cinematic shot sequences with precise timing markers.
 *
 * Features:
 * - Intelligent scene composition based on brand identity
 * - Shot type selection based on message objectives
 * - Camera motion planning for visual interest
 * - High-fidelity visual prompts for video models
 * - Millisecond-accurate audio timing markers
 * - Trend-aware creative decisions
 */

import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
  MasterStoryboard,
  StoryboardScene,
  StoryboardShot,
  DirectorRequest,
  DirectorResponse,
  BrandDNASnapshot,
  SiteMimicryStyleGuide,
  ShotType,
  CameraMotion,
  VisualPrompt,
  AudioTimingMarker,
  VoiceoverScript,
  VoiceoverSegment,
  AudioConfiguration,
  VisualStyleConfig,
  LightingStyle,
  TransitionType,
} from './types';

// ============================================================================
// CONSTANTS & MAPPINGS
// ============================================================================

/**
 * Shot type recommendations by message objective
 */
const SHOT_RECOMMENDATIONS: Record<DirectorRequest['brief']['objective'], ShotType[]> = {
  awareness: ['wide', 'extreme-wide', 'aerial', 'tracking'],
  consideration: ['medium', 'medium-close-up', 'over-the-shoulder', 'insert'],
  conversion: ['close-up', 'medium-close-up', 'insert', 'point-of-view'],
  retention: ['medium', 'close-up', 'medium-wide', 'tracking'],
};

/**
 * Camera motion pairings by shot type
 */
const CAMERA_MOTION_PAIRINGS: Record<ShotType, CameraMotion[]> = {
  'extreme-close-up': ['static', 'dolly-in', 'rack-focus'],
  'close-up': ['static', 'push-in', 'dolly-in', 'handheld'],
  'medium-close-up': ['static', 'push-in', 'tracking', 'orbit'],
  'medium': ['static', 'tracking', 'pan-left', 'pan-right', 'dolly-in'],
  'medium-wide': ['tracking', 'dolly-out', 'steadicam', 'crane-up'],
  'wide': ['pan-left', 'pan-right', 'crane-up', 'tracking', 'static'],
  'extreme-wide': ['aerial', 'crane-down', 'tracking', 'static'],
  'over-the-shoulder': ['static', 'push-in', 'rack-focus'],
  'point-of-view': ['handheld', 'tracking', 'steadicam'],
  'aerial': ['tracking', 'crane-down', 'orbit', 'static'],
  'low-angle': ['static', 'tilt-up', 'push-in', 'tracking'],
  'high-angle': ['static', 'tilt-down', 'crane-down'],
  'dutch-angle': ['static', 'tracking', 'handheld'],
  'insert': ['static', 'dolly-in', 'rack-focus', 'push-in'],
  'tracking': ['tracking', 'steadicam', 'handheld', 'dolly-in'],
};

/**
 * Pacing to timing multipliers
 */
const _PACING_MULTIPLIERS: Record<string, number> = {
  slow: 1.4,
  medium: 1.0,
  fast: 0.7,
  dynamic: 0.85,
};

/**
 * Platform optimal durations (seconds)
 */
const PLATFORM_DURATIONS: Record<string, { min: number; optimal: number; max: number }> = {
  youtube: { min: 30, optimal: 60, max: 180 },
  tiktok: { min: 15, optimal: 30, max: 60 },
  instagram: { min: 15, optimal: 30, max: 90 },
  linkedin: { min: 30, optimal: 60, max: 120 },
  website: { min: 30, optimal: 90, max: 180 },
};

/**
 * Mood to lighting style mapping
 */
const MOOD_LIGHTING: Record<string, LightingStyle[]> = {
  professional: ['studio', 'soft', 'natural'],
  warm: ['golden-hour', 'soft', 'natural'],
  dramatic: ['dramatic', 'low-key', 'rim-light'],
  energetic: ['high-key', 'neon', 'hard'],
  calm: ['soft', 'natural', 'golden-hour'],
  innovative: ['cinematic', 'backlit', 'rim-light'],
  trustworthy: ['natural', 'soft', 'studio'],
};

// ============================================================================
// DIRECTOR SERVICE CLASS
// ============================================================================

export class DirectorService {
  private static instance: DirectorService;

  private constructor() {}

  static getInstance(): DirectorService {
    if (!DirectorService.instance) {
      DirectorService.instance = new DirectorService();
    }
    return DirectorService.instance;
  }

  /**
   * Generate a Master Storyboard from brand DNA and creative brief
   */
  generateStoryboard(request: DirectorRequest): DirectorResponse {
    const startTime = Date.now();

    logger.info('Director: Starting storyboard generation', {
      objective: request.brief.objective,
      platform: request.brief.targetPlatform,
      maxDuration: request.constraints.maxDuration,
    });

    try {
      // Step 1: Analyze inputs and determine creative direction
      const creativeAnalysis = this.analyzeCreativeInputs(request);

      // Step 2: Generate voiceover script and timing
      const voiceoverScript = this.generateVoiceoverScript(
        request.voiceoverScript ?? request.brief.message,
        request.brandDNA,
        request.constraints.maxDuration
      );

      // Step 3: Calculate scene structure
      const sceneStructure = this.calculateSceneStructure(
        voiceoverScript,
        request.constraints.maxDuration,
        creativeAnalysis.pacing
      );

      // Step 4: Generate shots for each scene
      const scenes = this.generateScenes(
        sceneStructure,
        voiceoverScript,
        request,
        creativeAnalysis
      );

      // Step 5: Build audio configuration
      const audioConfig = this.buildAudioConfiguration(
        voiceoverScript,
        request,
        creativeAnalysis
      );

      // Step 6: Build visual style configuration
      const visualStyle = this.buildVisualStyleConfig(
        request.brandDNA,
        request.styleGuide,
        creativeAnalysis
      );

      // Step 7: Assemble master storyboard
      const storyboard: MasterStoryboard = {
        id: uuidv4(),
        projectId: request.projectId,
        title: `${request.brief.objective} - ${request.brief.targetPlatform}`,
        description: request.brief.message,
        version: 1,
        brandDNASnapshot: request.brandDNA,
        trendReportId: request.trendReport?.id,
        styleGuideId: request.styleGuide?.id,
        scenes,
        totalDuration: this.calculateTotalDuration(scenes),
        aspectRatio: request.constraints.aspectRatio,
        resolution: request.constraints.resolution,
        frameRate: 30,
        audioConfig,
        visualStyle,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 8: Calculate costs
      const estimatedCost = this.calculateEstimatedCost(storyboard);

      // Step 9: Generate warnings and suggestions
      const { warnings, suggestions } = this.analyzeStoryboard(storyboard, request);

      logger.info('Director: Storyboard generation complete', {
        storyboardId: storyboard.id,
        sceneCount: scenes.length,
        totalShots: scenes.reduce((acc, s) => acc + s.shots.length, 0),
        totalDuration: storyboard.totalDuration,
        durationMs: Date.now() - startTime,
      });

      return {
        storyboard,
        estimatedCost,
        estimatedDuration: Math.ceil(scenes.reduce((acc, s) => acc + s.shots.length, 0) * 2.5),
        warnings,
        suggestions,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Director: Storyboard generation failed', err);
      throw err;
    }
  }

  /**
   * Analyze creative inputs to determine overall direction
   */
  private analyzeCreativeInputs(request: DirectorRequest): CreativeAnalysis {
    const { brandDNA, trendReport, styleGuide, brief, creativeDirection } = request;

    // Determine mood from brand tone
    const mood = this.determineMood(brandDNA.toneOfVoice, creativeDirection?.mood);

    // Determine pacing from objective and platform
    const pacing = this.determinePacing(
      brief.objective,
      brief.targetPlatform,
      creativeDirection?.pacing
    );

    // Get recommended shot types
    let recommendedShots = SHOT_RECOMMENDATIONS[brief.objective];
    if (trendReport?.recommendedShotTypes) {
      recommendedShots = this.mergeRecommendations(
        recommendedShots,
        trendReport.recommendedShotTypes
      );
    }

    // Determine lighting style
    const lightingStyles = MOOD_LIGHTING[mood] || MOOD_LIGHTING['professional'];

    // Extract color palette
    const colorPalette = this.extractColorPalette(brandDNA, styleGuide);

    return {
      mood,
      pacing,
      recommendedShots,
      lightingStyles,
      colorPalette,
      visualStyle: creativeDirection?.visualStyle ?? this.deriveVisualStyle(brandDNA),
      platformOptimizations: PLATFORM_DURATIONS[brief.targetPlatform],
    };
  }

  /**
   * Generate or process voiceover script with timing
   */
  private generateVoiceoverScript(
    scriptOrMessage: string,
    brandDNA: BrandDNASnapshot,
    _maxDuration: number
  ): VoiceoverScript {
    // Estimate words per second (average speaking rate)
    const wordsPerSecond = 2.5;
    const maxWords = Math.floor(_maxDuration * wordsPerSecond);

    // Process the script
    const script = this.processScript(scriptOrMessage, brandDNA, maxWords);

    // Split into segments based on natural breaks
    const segments = this.splitIntoSegments(script, _maxDuration);

    return {
      fullScript: script,
      segments,
    };
  }

  /**
   * Process script with brand voice
   */
  private processScript(
    scriptOrMessage: string,
    brandDNA: BrandDNASnapshot,
    maxWords: number
  ): string {
    let script = scriptOrMessage;

    // Ensure key phrases are included
    for (const phrase of brandDNA.keyPhrases.slice(0, 3)) {
      if (!script.toLowerCase().includes(phrase.toLowerCase())) {
        // Find natural place to insert
        const sentences = script.split('. ');
        if (sentences.length > 2) {
          sentences.splice(1, 0, phrase);
          script = sentences.join('. ');
        }
      }
    }

    // Remove avoided phrases
    for (const phrase of brandDNA.avoidPhrases) {
      const regex = new RegExp(phrase, 'gi');
      script = script.replace(regex, '');
    }

    // Trim to max words if needed
    const words = script.split(/\s+/);
    if (words.length > maxWords) {
      script = `${words.slice(0, maxWords).join(' ')  }...`;
    }

    return script.trim();
  }

  /**
   * Split script into timed segments
   */
  private splitIntoSegments(script: string, _maxDuration: number): VoiceoverSegment[] {
    const sentences = script.match(/[^.!?]+[.!?]+/g) ?? [script];
    const segments: VoiceoverSegment[] = [];

    const wordsPerSecond = 2.5;
    let currentTime = 500; // Start 500ms in
    let currentScene = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const wordCount = sentence.split(/\s+/).length;
      const duration = Math.ceil((wordCount / wordsPerSecond) * 1000);

      // Find emphasis words (first word of sentence, numbers, capitalized words)
      const emphasis = this.findEmphasisWords(sentence);

      segments.push({
        id: uuidv4(),
        text: sentence,
        sceneId: `scene-${currentScene}`,
        startTime: currentTime,
        estimatedDuration: duration,
        emphasis,
        pacing: 'normal',
      });

      currentTime += duration + 300; // Add 300ms gap between sentences

      // Move to next scene every 2-3 sentences
      if ((i + 1) % 2 === 0) {
        currentScene++;
      }
    }

    return segments;
  }

  /**
   * Find words to emphasize in a sentence
   */
  private findEmphasisWords(sentence: string): string[] {
    const emphasis: string[] = [];
    const words = sentence.split(/\s+/);

    for (const word of words) {
      // Numbers and prices
      if (/\d+/.test(word)) {
        emphasis.push(word);
      }
      // All caps words (except common acronyms)
      else if (word.length > 2 && word === word.toUpperCase() && !/^(THE|AND|FOR|BUT|OR)$/.test(word)) {
        emphasis.push(word);
      }
      // Power words
      else if (/^(free|new|now|today|exclusive|limited|save|discover|transform|unlock)$/i.test(word)) {
        emphasis.push(word);
      }
    }

    return emphasis;
  }

  /**
   * Calculate scene structure based on voiceover
   */
  private calculateSceneStructure(
    voiceover: VoiceoverScript,
    _maxDuration: number,
    _pacing: string
  ): SceneStructure[] {
    const scenes: SceneStructure[] = [];
    const segments = voiceover.segments;

    // Group segments into scenes
    const sceneGroups = new Map<string, VoiceoverSegment[]>();
    for (const segment of segments) {
      const existing = sceneGroups.get(segment.sceneId) ?? [];
      existing.push(segment);
      sceneGroups.set(segment.sceneId, existing);
    }

    let sceneIndex = 0;
    for (const [sceneId, sceneSegments] of sceneGroups) {
      const startTime = sceneSegments[0].startTime;
      const endTime =
        sceneSegments[sceneSegments.length - 1].startTime +
        sceneSegments[sceneSegments.length - 1].estimatedDuration;

      scenes.push({
        id: sceneId,
        index: sceneIndex,
        startTime,
        duration: endTime - startTime + 500, // Add buffer
        segments: sceneSegments,
        shotsNeeded: Math.ceil((endTime - startTime) / 4000), // Roughly 4 second shots
      });

      sceneIndex++;
    }

    // Add intro scene if not present
    if (scenes.length > 0 && scenes[0].startTime > 1000) {
      scenes.unshift({
        id: 'scene-intro',
        index: -1,
        startTime: 0,
        duration: scenes[0].startTime,
        segments: [],
        shotsNeeded: 1,
      });
    }

    // Add outro scene
    const lastScene = scenes[scenes.length - 1];
    const endTime = lastScene.startTime + lastScene.duration;
    if (endTime < _maxDuration * 1000 - 2000) {
      scenes.push({
        id: 'scene-outro',
        index: scenes.length,
        startTime: endTime,
        duration: Math.min(3000, _maxDuration * 1000 - endTime),
        segments: [],
        shotsNeeded: 1,
      });
    }

    return scenes;
  }

  /**
   * Generate scenes with shots and visual prompts
   */
  private generateScenes(
    sceneStructure: SceneStructure[],
    voiceover: VoiceoverScript,
    request: DirectorRequest,
    analysis: CreativeAnalysis
  ): StoryboardScene[] {
    const scenes: StoryboardScene[] = [];

    for (const structure of sceneStructure) {
      const isIntro = structure.id === 'scene-intro';
      const isOutro = structure.id === 'scene-outro';

      // Determine scene name and description
      const sceneName = isIntro
        ? 'Opening'
        : isOutro
        ? 'Call to Action'
        : `Scene ${structure.index + 1}`;

      const sceneDescription = isIntro
        ? 'Brand introduction and hook'
        : isOutro
        ? 'Final call to action and branding'
        : structure.segments.map((s) => s.text).join(' ');

      // Generate shots for this scene
      const shots = this.generateShotsForScene(
        structure,
        request,
        analysis,
        isIntro,
        isOutro
      );

      // Determine music intensity based on scene position
      const musicIntensity = isIntro
        ? 'low'
        : isOutro
        ? 'high'
        : structure.index === Math.floor(sceneStructure.length / 2)
        ? 'high'
        : 'medium';

      // Determine transition
      const transitionOut = isOutro
        ? 'fade-out'
        : structure.index === 0
        ? 'dissolve'
        : this.selectTransition(analysis.pacing);

      scenes.push({
        id: structure.id,
        sceneNumber: structure.index + 1,
        name: sceneName,
        description: sceneDescription,
        shots,
        startTime: structure.startTime,
        duration: structure.duration,
        musicIntensity: musicIntensity,
        transitionOut,
        transitionDuration: 500,
      });
    }

    return scenes;
  }

  /**
   * Generate shots for a specific scene
   */
  private generateShotsForScene(
    structure: SceneStructure,
    request: DirectorRequest,
    analysis: CreativeAnalysis,
    isIntro: boolean,
    isOutro: boolean
  ): StoryboardShot[] {
    const shots: StoryboardShot[] = [];
    const shotDuration = Math.floor(structure.duration / structure.shotsNeeded);

    for (let i = 0; i < structure.shotsNeeded; i++) {
      const shotStartTime = i * shotDuration;

      // Select shot type based on context
      const shotType = this.selectShotType(
        analysis.recommendedShots,
        i,
        structure.shotsNeeded,
        isIntro,
        isOutro
      );

      // Select camera motion
      const cameraMotion = this.selectCameraMotion(shotType, analysis.pacing, i === 0);

      // Get relevant voiceover segment for this shot
      const relevantSegment = structure.segments.find(
        (s) =>
          s.startTime >= structure.startTime + shotStartTime &&
          s.startTime < structure.startTime + shotStartTime + shotDuration
      );

      // Generate visual prompt
      const visualPrompt = this.generateVisualPrompt(
        shotType,
        cameraMotion,
        request,
        analysis,
        relevantSegment,
        isIntro,
        isOutro
      );

      // Generate audio timing markers
      const audioTiming = this.generateAudioTimingMarkers(
        structure.segments,
        shotStartTime,
        shotDuration
      );

      shots.push({
        id: uuidv4(),
        shotNumber: i + 1,
        shotType,
        cameraMotion,
        visualPrompt,
        startTime: shotStartTime,
        duration: shotDuration,
        audioTiming,
        transitionIn: i === 0 ? 'cut' : undefined,
        transitionOut: i === structure.shotsNeeded - 1 ? undefined : 'cut',
        generationStatus: 'pending',
        generationAttempts: 0,
      });
    }

    return shots;
  }

  /**
   * Select appropriate shot type
   */
  private selectShotType(
    recommended: ShotType[],
    index: number,
    total: number,
    isIntro: boolean,
    isOutro: boolean
  ): ShotType {
    if (isIntro) {
      return 'wide'; // Opening with establishing shot
    }

    if (isOutro) {
      return 'medium-close-up'; // CTA with face/product focus
    }

    // Vary shot types throughout
    const position = index / total;

    if (position < 0.3) {
      // Early shots - wider
      return recommended.find((s) => ['wide', 'medium-wide', 'medium'].includes(s)) ?? 'medium';
    } else if (position < 0.7) {
      // Middle shots - mixed
      return recommended[index % recommended.length];
    } else {
      // Late shots - closer
      return (
        recommended.find((s) => ['close-up', 'medium-close-up', 'insert'].includes(s)) ??
        'medium-close-up'
      );
    }
  }

  /**
   * Select camera motion for shot
   */
  private selectCameraMotion(
    shotType: ShotType,
    pacing: string,
    isFirstShot: boolean
  ): CameraMotion {
    const options = CAMERA_MOTION_PAIRINGS[shotType] || ['static'];

    // First shot often static or slow
    if (isFirstShot) {
      return options.includes('static') ? 'static' : options[0];
    }

    // Fast pacing prefers movement
    if (pacing === 'fast') {
      const moving = options.filter((m) => m !== 'static');
      return moving.length > 0 ? moving[Math.floor(Math.random() * moving.length)] : options[0];
    }

    // Random selection with slight bias toward static for slow pacing
    if (pacing === 'slow' && Math.random() > 0.6) {
      return 'static';
    }

    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Generate high-fidelity visual prompt
   */
  private generateVisualPrompt(
    shotType: ShotType,
    cameraMotion: CameraMotion,
    request: DirectorRequest,
    analysis: CreativeAnalysis,
    segment?: VoiceoverSegment,
    isIntro?: boolean,
    isOutro?: boolean
  ): VisualPrompt {
    const { brandDNA, brief } = request;

    // Determine main subject
    let mainSubject: string;
    if (isIntro) {
      mainSubject = `${brandDNA.industry} professional environment showcasing ${brandDNA.uniqueValue}`;
    } else if (isOutro) {
      mainSubject = `Brand logo and call-to-action for ${brief.callToAction ?? 'engagement'}`;
    } else {
      mainSubject = this.deriveSubjectFromSegment(segment, brandDNA);
    }

    // Determine action
    const action = this.deriveAction(cameraMotion, segment, isIntro, isOutro);

    // Determine environment
    const environment = this.deriveEnvironment(brandDNA, analysis.visualStyle);

    // Select lighting
    const lighting =
      analysis.lightingStyles[Math.floor(Math.random() * analysis.lightingStyles.length)];

    // Build color grading description
    const colorGrading = this.buildColorGradingDescription(analysis.colorPalette, analysis.mood);

    // Compile the full prompt
    const compiledPrompt = this.compilePrompt({
      shotType,
      cameraMotion,
      mainSubject,
      action,
      environment,
      mood: analysis.mood,
      lighting,
      colorGrading,
      brandElements: brandDNA.keyPhrases.slice(0, 2),
    });

    // Build negative prompt
    const negativePrompt = this.buildNegativePrompt(brandDNA);

    return {
      mainSubject,
      action,
      environment,
      mood: analysis.mood,
      lighting,
      colorGrading,
      depthOfField: shotType.includes('close') ? 'shallow' : 'medium',
      motionBlur: cameraMotion === 'static' ? 'none' : 'subtle',
      brandElements: analysis.colorPalette.slice(0, 3),
      compiledPrompt,
      negativePrompt,
    };
  }

  /**
   * Compile the full visual prompt
   */
  private compilePrompt(params: {
    shotType: ShotType;
    cameraMotion: CameraMotion;
    mainSubject: string;
    action: string;
    environment: string;
    mood: string;
    lighting: LightingStyle;
    colorGrading: string;
    brandElements: string[];
  }): string {
    const parts = [
      // Technical specs first
      `${params.shotType.replace(/-/g, ' ')} shot`,
      params.cameraMotion !== 'static' ? `with ${params.cameraMotion.replace(/-/g, ' ')}` : '',

      // Subject and action
      params.mainSubject,
      params.action,

      // Environment
      `in ${params.environment}`,

      // Style and mood
      `${params.mood} mood`,
      `${params.lighting.replace(/-/g, ' ')} lighting`,

      // Color
      params.colorGrading,

      // Quality modifiers
      'cinematic quality',
      '4K resolution',
      'professional color grading',
      'photorealistic',
    ];

    return parts.filter(Boolean).join(', ');
  }

  /**
   * Build negative prompt to avoid unwanted elements
   */
  private buildNegativePrompt(brandDNA: BrandDNASnapshot): string {
    const baseNegatives = [
      'low quality',
      'blurry',
      'distorted',
      'amateur',
      'watermark',
      'text overlay',
      'stock footage look',
      'oversaturated',
      'underexposed',
      'grainy',
      'artifacts',
    ];

    // Add brand-specific negatives
    const brandNegatives = brandDNA.avoidPhrases
      .filter((p) => p.length < 20)
      .slice(0, 5);

    return [...baseNegatives, ...brandNegatives].join(', ');
  }

  /**
   * Generate audio timing markers for a shot
   */
  private generateAudioTimingMarkers(
    segments: VoiceoverSegment[],
    shotStartTime: number,
    shotDuration: number
  ): AudioTimingMarker[] {
    const markers: AudioTimingMarker[] = [];
    const shotEndTime = shotStartTime + shotDuration;

    for (const segment of segments) {
      // Check if segment overlaps with this shot
      const segmentEnd = segment.startTime + segment.estimatedDuration;

      if (segment.startTime < shotEndTime && segmentEnd > shotStartTime) {
        // Add voiceover start marker
        if (segment.startTime >= shotStartTime && segment.startTime < shotEndTime) {
          markers.push({
            id: uuidv4(),
            type: 'voiceover-start',
            timestamp: segment.startTime - shotStartTime,
            duration: segment.estimatedDuration,
            content: segment.text,
            syncInstruction: 'Ensure visual interest peaks at voiceover start',
            priority: 'critical',
          });
        }

        // Add emphasis markers for key words
        for (const word of segment.emphasis) {
          const wordIndex = segment.text.toLowerCase().indexOf(word.toLowerCase());
          if (wordIndex >= 0) {
            const wordTimestamp =
              segment.startTime +
              Math.floor((wordIndex / segment.text.length) * segment.estimatedDuration);

            if (wordTimestamp >= shotStartTime && wordTimestamp < shotEndTime) {
              markers.push({
                id: uuidv4(),
                type: 'voiceover-emphasis',
                timestamp: wordTimestamp - shotStartTime,
                content: word,
                syncInstruction: `Visual emphasis for "${word}" - consider zoom or focus shift`,
                priority: 'preferred',
              });
            }
          }
        }

        // Add voiceover end marker
        if (segmentEnd > shotStartTime && segmentEnd <= shotEndTime) {
          markers.push({
            id: uuidv4(),
            type: 'voiceover-end',
            timestamp: segmentEnd - shotStartTime,
            syncInstruction: 'Visual can resolve or transition',
            priority: 'optional',
          });
        }
      }
    }

    // Add beat markers for music sync (approximate)
    const beatInterval = 500; // Assuming ~120 BPM
    for (let t = beatInterval; t < shotDuration; t += beatInterval) {
      markers.push({
        id: uuidv4(),
        type: 'music-beat',
        timestamp: t,
        syncInstruction: 'Potential cut point or motion accent',
        priority: 'optional',
      });
    }

    return markers.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Build audio configuration
   */
  private buildAudioConfiguration(
    voiceover: VoiceoverScript,
    request: DirectorRequest,
    analysis: CreativeAnalysis
  ): AudioConfiguration {
    return {
      voiceover: {
        enabled: true,
        ttsEngine: 'native',
        voiceId: 'aria', // Default to Aria
        speed: analysis.pacing === 'fast' ? 1.1 : analysis.pacing === 'slow' ? 0.9 : 1.0,
        pitch: 0,
        script: voiceover,
      },
      backgroundMusic: {
        enabled: true,
        genre: this.selectMusicGenre(analysis.mood, request.brief.targetPlatform),
        mood: analysis.mood,
        volume: 0.3,
        duckingConfig: {
          enabled: true,
          duckOnVoiceover: true,
          duckLevel: 0.2, // Reduce to 20% during voiceover
          attackTime: 100,
          releaseTime: 500,
          threshold: -20,
        },
      },
      soundEffects: {
        enabled: true,
        effects: [],
      },
      masterVolume: 0.9,
      normalizeLoudness: true,
      targetLUFS: -14, // Standard for streaming
    };
  }

  /**
   * Build visual style configuration
   */
  private buildVisualStyleConfig(
    brandDNA: BrandDNASnapshot,
    styleGuide?: SiteMimicryStyleGuide,
    analysis?: CreativeAnalysis
  ): VisualStyleConfig {
    // Extract colors from style guide or brand DNA
    const _primaryColor = styleGuide?.colorPalette.primary ?? brandDNA.primaryColor ?? '#1a1a1a';
    const _secondaryColor = styleGuide?.colorPalette.secondary ?? brandDNA.secondaryColor ?? '#ffffff';

    // Determine LUT based on mood
    const lutId = this.selectLUT(analysis?.mood ?? 'professional');

    return {
      lutId,
      lutIntensity: 0.7,
      colorCorrection: {
        exposure: 0,
        contrast: 0.1,
        saturation: 1.05,
        temperature: 0,
        tint: 0,
        highlights: 0,
        shadows: 0.05,
        vibrance: 0.1,
      },
      brandOverlay: {
        logoUrl: brandDNA.primaryColor ? undefined : undefined, // Would come from brand assets
        logoPosition: 'bottom-right',
        logoOpacity: 0.8,
        watermarkEnabled: false,
      },
      filmGrain: {
        enabled: analysis?.mood === 'dramatic' || analysis?.mood === 'innovative',
        intensity: 0.1,
        size: 'fine',
      },
      vignette: {
        enabled: true,
        intensity: 0.15,
        softness: 0.8,
      },
    };
  }

  /**
   * Select appropriate LUT based on mood
   */
  private selectLUT(mood: string): string {
    const lutMap: Record<string, string> = {
      professional: 'corporate-clean',
      warm: 'golden-warmth',
      dramatic: 'cinema-contrast',
      energetic: 'vibrant-pop',
      calm: 'soft-pastel',
      innovative: 'tech-modern',
      trustworthy: 'natural-balanced',
    };

    return lutMap[mood] || 'corporate-clean';
  }

  /**
   * Calculate total duration of storyboard
   */
  private calculateTotalDuration(scenes: StoryboardScene[]): number {
    if (scenes.length === 0) {return 0;}

    const lastScene = scenes[scenes.length - 1];
    return lastScene.startTime + lastScene.duration + lastScene.transitionDuration;
  }

  /**
   * Calculate estimated cost
   */
  private calculateEstimatedCost(storyboard: MasterStoryboard): DirectorResponse['estimatedCost'] {
    const totalShots = storyboard.scenes.reduce((acc, s) => acc + s.shots.length, 0);
    const _totalDurationSeconds = storyboard.totalDuration / 1000;

    // Rough estimates
    const videoGenerationCredits = totalShots * 10; // 10 credits per shot
    const ttsCost = Math.ceil(storyboard.audioConfig.voiceover.script.fullScript.length / 1000) * 0.5;
    const musicCost = 5; // Flat rate for royalty-free

    return {
      videoGeneration: videoGenerationCredits,
      ttsGeneration: ttsCost,
      musicLicensing: musicCost,
      total: videoGenerationCredits + ttsCost + musicCost,
      currency: 'credits',
    };
  }

  /**
   * Analyze storyboard for warnings and suggestions
   */
  private analyzeStoryboard(
    storyboard: MasterStoryboard,
    request: DirectorRequest
  ): { warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check duration
    const durationSeconds = storyboard.totalDuration / 1000;
    const platformLimits = PLATFORM_DURATIONS[request.brief.targetPlatform];

    if (durationSeconds < platformLimits.min) {
      warnings.push(
        `Video duration (${durationSeconds}s) is below recommended minimum for ${request.brief.targetPlatform} (${platformLimits.min}s)`
      );
    }

    if (durationSeconds > platformLimits.max) {
      warnings.push(
        `Video duration (${durationSeconds}s) exceeds recommended maximum for ${request.brief.targetPlatform} (${platformLimits.max}s)`
      );
    }

    // Check shot variety
    const shotTypes = new Set(storyboard.scenes.flatMap((s) => s.shots.map((shot) => shot.shotType)));
    if (shotTypes.size < 3) {
      suggestions.push('Consider adding more shot variety for visual interest');
    }

    // Check for CTA
    if (!request.brief.callToAction) {
      suggestions.push('Adding a clear call-to-action could improve conversion');
    }

    // Check voiceover coverage
    const voiceoverDuration = storyboard.audioConfig.voiceover.script.segments.reduce(
      (acc, s) => acc + s.estimatedDuration,
      0
    );
    const coverage = voiceoverDuration / storyboard.totalDuration;

    if (coverage < 0.5) {
      suggestions.push('Consider adding more voiceover content for engagement');
    }

    if (coverage > 0.9) {
      suggestions.push('Consider adding breathing room in the script for visual moments');
    }

    return { warnings, suggestions };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private determineMood(toneOfVoice: string, explicitMood?: string): string {
    if (explicitMood) {return explicitMood;}

    const toneToMood: Record<string, string> = {
      warm: 'warm',
      professional: 'professional',
      direct: 'energetic',
      friendly: 'warm',
      formal: 'professional',
      casual: 'calm',
    };

    return toneToMood[toneOfVoice] || 'professional';
  }

  private determinePacing(
    objective: string,
    platform: string,
    explicitPacing?: string
  ): string {
    if (explicitPacing) {return explicitPacing;}

    // Platform influences pacing
    if (platform === 'tiktok' || platform === 'instagram') {
      return 'fast';
    }

    // Objective influences pacing
    if (objective === 'awareness') {return 'medium';}
    if (objective === 'conversion') {return 'dynamic';}

    return 'medium';
  }

  private mergeRecommendations(base: ShotType[], trending: ShotType[]): ShotType[] {
    const merged = new Set([...base, ...trending]);
    return Array.from(merged).slice(0, 6);
  }

  private extractColorPalette(
    brandDNA: BrandDNASnapshot,
    styleGuide?: SiteMimicryStyleGuide
  ): string[] {
    const colors: string[] = [];

    if (styleGuide?.colorPalette) {
      colors.push(
        styleGuide.colorPalette.primary,
        styleGuide.colorPalette.secondary,
        styleGuide.colorPalette.accent
      );
    }

    if (brandDNA.primaryColor) {
      colors.push(brandDNA.primaryColor);
    }

    if (brandDNA.secondaryColor) {
      colors.push(brandDNA.secondaryColor);
    }

    return colors.filter(Boolean);
  }

  private deriveVisualStyle(brandDNA: BrandDNASnapshot): string {
    const industryStyles: Record<string, string> = {
      technology: 'modern and sleek',
      finance: 'professional and trustworthy',
      healthcare: 'clean and caring',
      retail: 'vibrant and engaging',
      education: 'friendly and approachable',
      manufacturing: 'industrial and precise',
    };

    return industryStyles[brandDNA.industry.toLowerCase()] || 'professional and polished';
  }

  private deriveSubjectFromSegment(
    segment: VoiceoverSegment | undefined,
    brandDNA: BrandDNASnapshot
  ): string {
    if (!segment) {
      return `Professional showcasing ${brandDNA.uniqueValue}`;
    }

    // Extract key nouns from the segment
    const text = segment.text.toLowerCase();

    // Check for product/service mentions
    if (text.includes('product') || text.includes('service')) {
      return 'Product demonstration with professional presenter';
    }

    if (text.includes('team') || text.includes('people')) {
      return 'Diverse professional team in collaborative environment';
    }

    if (text.includes('result') || text.includes('success')) {
      return 'Success visualization with charts and happy customers';
    }

    return `Professional environment representing ${brandDNA.industry}`;
  }

  private deriveAction(
    cameraMotion: CameraMotion,
    segment?: VoiceoverSegment,
    isIntro?: boolean,
    isOutro?: boolean
  ): string {
    if (isIntro) {return 'revealing the brand and setting the scene';}
    if (isOutro) {return 'presenting final call to action with brand logo';}

    const motionActions: Record<string, string> = {
      static: 'steady focus on subject',
      'pan-left': 'scanning across the scene',
      'pan-right': 'revealing elements left to right',
      'dolly-in': 'moving closer to subject',
      'dolly-out': 'pulling back to reveal context',
      tracking: 'following subject movement',
      'push-in': 'emphasizing key detail',
      orbit: 'circling around subject',
    };

    return motionActions[cameraMotion] || 'capturing the moment';
  }

  private deriveEnvironment(brandDNA: BrandDNASnapshot, _visualStyle: string): string {
    const industryEnvironments: Record<string, string[]> = {
      technology: ['modern office space', 'sleek tech lab', 'minimalist studio'],
      finance: ['executive boardroom', 'modern financial center', 'prestigious office'],
      healthcare: ['clean medical facility', 'warm clinic environment', 'research lab'],
      retail: ['stylish showroom', 'vibrant store interior', 'lifestyle setting'],
      education: ['inspiring classroom', 'modern campus', 'collaborative learning space'],
    };

    const environments = industryEnvironments[brandDNA.industry.toLowerCase()] || [
      'professional environment',
      'modern workspace',
    ];

    return environments[Math.floor(Math.random() * environments.length)];
  }

  private buildColorGradingDescription(colorPalette: string[], mood: string): string {
    if (colorPalette.length === 0) {
      return 'balanced natural color grading';
    }

    const moodGrading: Record<string, string> = {
      warm: 'warm golden tones',
      professional: 'clean neutral tones',
      dramatic: 'high contrast cinematic look',
      energetic: 'vibrant saturated colors',
      calm: 'soft muted palette',
      innovative: 'cool tech-forward tones',
    };

    const baseGrading = moodGrading[mood] || 'balanced professional grading';

    if (colorPalette[0]) {
      return `${baseGrading} with ${colorPalette[0]} accents`;
    }

    return baseGrading;
  }

  private selectMusicGenre(mood: string, _platform: string): string {
    const moodGenres: Record<string, string[]> = {
      warm: ['acoustic', 'soft pop', 'folk'],
      professional: ['corporate', 'ambient', 'light electronic'],
      dramatic: ['cinematic', 'orchestral', 'epic'],
      energetic: ['upbeat pop', 'electronic', 'indie rock'],
      calm: ['ambient', 'lo-fi', 'chillout'],
      innovative: ['electronic', 'synth', 'modern'],
    };

    const genres = moodGenres[mood] || ['corporate', 'ambient'];
    return genres[Math.floor(Math.random() * genres.length)];
  }

  private selectTransition(pacing: string): TransitionType {
    if (pacing === 'fast') {
      return Math.random() > 0.5 ? 'cut' : 'whip-transition';
    }

    if (pacing === 'slow') {
      return Math.random() > 0.5 ? 'dissolve' : 'cut';
    }

    const transitions: TransitionType[] = ['cut', 'dissolve', 'cut', 'cut'];
    return transitions[Math.floor(Math.random() * transitions.length)];
  }
}

// ============================================================================
// HELPER INTERFACES
// ============================================================================

interface CreativeAnalysis {
  mood: string;
  pacing: string;
  recommendedShots: ShotType[];
  lightingStyles: LightingStyle[];
  colorPalette: string[];
  visualStyle: string;
  platformOptimizations: { min: number; optimal: number; max: number };
}

interface SceneStructure {
  id: string;
  index: number;
  startTime: number;
  duration: number;
  segments: VoiceoverSegment[];
  shotsNeeded: number;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const directorService = DirectorService.getInstance();

/**
 * Generate a master storyboard from brand DNA and creative brief
 */
export function generateStoryboard(
  request: DirectorRequest
): DirectorResponse {
  return directorService.generateStoryboard(request);
}
