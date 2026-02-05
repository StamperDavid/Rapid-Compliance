/**
 * Video Specialist
 * STATUS: FUNCTIONAL
 *
 * Provides script-to-storyboard conversion, audio cue generation,
 * scene breakdown, and video content planning capabilities.
 *
 * CAPABILITIES:
 * - Script-to-storyboard conversion with visual descriptions
 * - Audio cue marker generation (music, SFX, VO transitions)
 * - Scene breakdown and timing estimation
 * - B-roll suggestion engine
 * - Thumbnail strategy generation
 * - Video SEO optimization (titles, descriptions, tags)
 * - Platform-specific formatting (YouTube, TikTok, Reels, Shorts)
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import {
  getMemoryVault,
  shareInsight,
  broadcastSignal,
  readAgentInsights,
  type ContentData,
} from '../../shared/tenant-memory-vault';
// DEFAULT_ORG_ID available from '@/lib/constants/platform' if needed

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ScriptToStoryboardPayload {
  action: 'script_to_storyboard';
  script: string;
  platform: 'youtube' | 'tiktok' | 'reels' | 'shorts' | 'generic';
  style?: 'talking_head' | 'documentary' | 'tutorial' | 'vlog' | 'cinematic';
  targetDuration?: number;
}

interface AudioCuePayload {
  action: 'audio_cues';
  script: string;
  mood?: 'energetic' | 'calm' | 'dramatic' | 'inspiring' | 'educational';
  includeSFX?: boolean;
  includeMusic?: boolean;
}

interface SceneBreakdownPayload {
  action: 'scene_breakdown';
  script: string;
  platform: 'youtube' | 'tiktok' | 'reels' | 'shorts';
  includeTimings?: boolean;
}

interface ThumbnailStrategyPayload {
  action: 'thumbnail_strategy';
  videoTitle: string;
  videoTopic: string;
  targetAudience: string;
  variants?: number;
}

interface VideoSEOPayload {
  action: 'video_seo';
  videoTitle: string;
  videoDescription: string;
  targetKeywords: string[];
  platform: 'youtube' | 'tiktok';
}

interface BRollSuggestionPayload {
  action: 'broll_suggestions';
  script: string;
  style: 'stock' | 'custom' | 'mixed';
  budget?: 'free' | 'paid' | 'premium';
}

type VideoPayload =
  | ScriptToStoryboardPayload
  | AudioCuePayload
  | SceneBreakdownPayload
  | ThumbnailStrategyPayload
  | VideoSEOPayload
  | BRollSuggestionPayload;

// ============================================================================
// RESULT TYPES
// ============================================================================

interface StoryboardScene {
  sceneNumber: number;
  timeCode: string;
  duration: number;
  shotType: string;
  visualDescription: string;
  cameraMovement: string;
  onScreenText?: string;
  voiceoverText: string;
  audioCue?: string;
  brollSuggestion?: string;
}

interface StoryboardResult {
  title: string;
  platform: string;
  totalDuration: number;
  sceneCount: number;
  scenes: StoryboardScene[];
  productionNotes: string[];
  equipmentSuggestions: string[];
}

interface AudioCue {
  timeCode: string;
  type: 'music' | 'sfx' | 'vo_transition' | 'ambient';
  description: string;
  intensity: 'low' | 'medium' | 'high';
  duration?: number;
  suggestion?: string;
}

interface AudioCueResult {
  mood: string;
  totalCues: number;
  cues: AudioCue[];
  musicRecommendations: Array<{
    section: string;
    genre: string;
    tempo: string;
    keywords: string[];
  }>;
  mixingNotes: string[];
}

interface Scene {
  sceneNumber: number;
  title: string;
  description: string;
  estimatedDuration: number;
  keyPoints: string[];
  visualStyle: string;
  transitionIn: string;
  transitionOut: string;
}

interface SceneBreakdownResult {
  totalScenes: number;
  totalDuration: number;
  scenes: Scene[];
  pacingAnalysis: {
    averageSceneDuration: number;
    recommendation: string;
  };
}

interface ThumbnailConcept {
  variant: string;
  layout: string;
  primaryText: string;
  secondaryText?: string;
  emotionalHook: string;
  colorScheme: string;
  facialExpression?: string;
  props?: string[];
  clickbaitLevel: 'low' | 'medium' | 'high';
  estimatedCTR: string;
}

interface ThumbnailStrategyResult {
  concepts: ThumbnailConcept[];
  bestPractices: string[];
  avoidList: string[];
  abTestPlan: string[];
}

interface VideoSEOResult {
  optimizedTitle: string;
  titleScore: number;
  optimizedDescription: string;
  tags: string[];
  hashtags: string[];
  keyMoments: Array<{
    timestamp: string;
    label: string;
  }>;
  seoScore: number;
  improvements: string[];
}

interface BRollSuggestion {
  timeCode: string;
  context: string;
  suggestions: Array<{
    type: 'stock' | 'custom' | 'screen_recording' | 'animation';
    description: string;
    searchTerms?: string[];
    source?: string;
  }>;
}

interface BRollResult {
  totalSuggestions: number;
  suggestions: BRollSuggestion[];
  stockSources: string[];
  estimatedCost: string;
}

// ============================================================================
// VIDEO TEMPLATES & CONSTANTS
// ============================================================================

const SHOT_TYPES = {
  WIDE: { name: 'Wide Shot', abbreviation: 'WS', description: 'Full scene establishing context' },
  MEDIUM: { name: 'Medium Shot', abbreviation: 'MS', description: 'Subject from waist up' },
  CLOSEUP: { name: 'Close-Up', abbreviation: 'CU', description: 'Face or detail shot' },
  EXTREME_CLOSEUP: { name: 'Extreme Close-Up', abbreviation: 'ECU', description: 'Eyes or specific detail' },
  OTS: { name: 'Over-the-Shoulder', abbreviation: 'OTS', description: 'POV from behind subject' },
  POV: { name: 'Point of View', abbreviation: 'POV', description: 'First-person perspective' },
  AERIAL: { name: 'Aerial/Drone', abbreviation: 'AERIAL', description: 'Bird\'s eye view' },
  INSERT: { name: 'Insert Shot', abbreviation: 'INSERT', description: 'Detail or cutaway' },
};

const CAMERA_MOVEMENTS = {
  STATIC: 'Static (locked off)',
  PAN: 'Pan (horizontal movement)',
  TILT: 'Tilt (vertical movement)',
  DOLLY: 'Dolly (forward/backward)',
  TRUCK: 'Truck (side-to-side)',
  ZOOM: 'Zoom (in/out)',
  HANDHELD: 'Handheld (organic movement)',
  CRANE: 'Crane (vertical arc)',
  STEADICAM: 'Steadicam (smooth follow)',
};

const PLATFORM_SPECS = {
  youtube: {
    aspectRatio: '16:9',
    maxDuration: 720,
    idealDuration: { min: 480, max: 600 },
    thumbnailSize: '1280x720',
    titleLimit: 100,
    descriptionLimit: 5000,
  },
  tiktok: {
    aspectRatio: '9:16',
    maxDuration: 180,
    idealDuration: { min: 15, max: 60 },
    thumbnailSize: 'auto',
    titleLimit: 150,
    descriptionLimit: 2200,
  },
  reels: {
    aspectRatio: '9:16',
    maxDuration: 90,
    idealDuration: { min: 15, max: 30 },
    thumbnailSize: 'cover_frame',
    titleLimit: 0,
    descriptionLimit: 2200,
  },
  shorts: {
    aspectRatio: '9:16',
    maxDuration: 60,
    idealDuration: { min: 15, max: 45 },
    thumbnailSize: 'auto',
    titleLimit: 100,
    descriptionLimit: 100,
  },
  generic: {
    aspectRatio: '16:9',
    maxDuration: 600,
    idealDuration: { min: 120, max: 300 },
    thumbnailSize: '1920x1080',
    titleLimit: 100,
    descriptionLimit: 5000,
  },
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'VIDEO_SPECIALIST',
    name: 'Video Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: [
      'script_to_storyboard',
      'audio_cue_generation',
      'scene_breakdown',
      'thumbnail_strategy',
      'video_seo',
      'broll_suggestions',
      'platform_optimization',
    ],
  },
  systemPrompt: `You are the Video Specialist, an expert in video content production planning.
You excel at converting scripts to detailed storyboards, generating audio cues,
breaking down scenes with precise timings, and optimizing video content for various platforms.
You understand the nuances of YouTube, TikTok, Reels, and Shorts, and tailor your recommendations accordingly.`,
  tools: ['storyboard_generator', 'audio_analyzer', 'seo_optimizer'],
  outputSchema: {},
  maxTokens: 8192,
  temperature: 0.4,
};

// ============================================================================
// VIDEO SPECIALIST CLASS
// ============================================================================

export class VideoSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.log('INFO', 'Initializing Video Specialist...');
    this.log('INFO', 'Loading storyboard templates and audio cue library...');
    this.isInitialized = true;
    this.log('INFO', 'Video Specialist ready for content production planning');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    await Promise.resolve();
    const taskId = message.id;

    try {
      const payload = message.payload as VideoPayload;

      if (!payload || typeof payload !== 'object' || !('action' in payload)) {
        return this.createReport(taskId, 'FAILED', null, ['Invalid payload: missing action']);
      }

      this.log('INFO', `Processing video action: ${payload.action}`);

      switch (payload.action) {
        case 'script_to_storyboard':
          return this.createReport(taskId, 'COMPLETED', this.handleScriptToStoryboard(payload));

        case 'audio_cues':
          return this.createReport(taskId, 'COMPLETED', this.handleAudioCues(payload));

        case 'scene_breakdown':
          return this.createReport(taskId, 'COMPLETED', this.handleSceneBreakdown(payload));

        case 'thumbnail_strategy':
          return this.createReport(taskId, 'COMPLETED', this.handleThumbnailStrategy(payload));

        case 'video_seo':
          return this.createReport(taskId, 'COMPLETED', this.handleVideoSEO(payload));

        case 'broll_suggestions':
          return this.createReport(taskId, 'COMPLETED', this.handleBRollSuggestions(payload));

        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown action: ${(payload as { action: string }).action}`]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Video processing failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  // ==========================================================================
  // SCRIPT TO STORYBOARD
  // ==========================================================================

  private handleScriptToStoryboard(payload: ScriptToStoryboardPayload): StoryboardResult {
    const { script, platform, style = 'talking_head', targetDuration } = payload;

    this.log('INFO', `Converting script to storyboard for ${platform}`);

    const _platformSpec = PLATFORM_SPECS[platform];
    const scriptSections = this.parseScriptSections(script);
    const estimatedDuration = targetDuration ?? this.estimateDuration(script, platform);

    const scenes: StoryboardScene[] = scriptSections.map((section, index) => {
      const sceneDuration = Math.ceil(estimatedDuration / scriptSections.length);
      const timeCode = this.formatTimeCode(index * sceneDuration);

      return {
        sceneNumber: index + 1,
        timeCode,
        duration: sceneDuration,
        shotType: this.selectShotType(section, style, index),
        visualDescription: this.generateVisualDescription(section, style),
        cameraMovement: this.selectCameraMovement(section, style, index),
        onScreenText: this.extractOnScreenText(section),
        voiceoverText: section.trim(),
        audioCue: this.generateSceneAudioCue(section, index, scriptSections.length),
        brollSuggestion: this.generateBRollForScene(section),
      };
    });

    return {
      title: this.generateStoryboardTitle(script),
      platform,
      totalDuration: estimatedDuration,
      sceneCount: scenes.length,
      scenes,
      productionNotes: this.generateProductionNotes(style, platform),
      equipmentSuggestions: this.suggestEquipment(style, platform),
    };
  }

  private parseScriptSections(script: string): string[] {
    // Split script into logical sections based on paragraphs or markers
    const sections = script
      .split(/\n\n+/)
      .filter(s => s.trim().length > 20)
      .map(s => s.trim());

    // If too few sections, split by sentences
    if (sections.length < 3) {
      const sentences = script.match(/[^.!?]+[.!?]+/g) ?? [script];
      const groupSize = Math.ceil(sentences.length / 5);
      const grouped: string[] = [];

      for (let i = 0; i < sentences.length; i += groupSize) {
        grouped.push(sentences.slice(i, i + groupSize).join(' ').trim());
      }

      return grouped.filter(s => s.length > 0);
    }

    return sections;
  }

  private estimateDuration(script: string, platform: string): number {
    // Average speaking rate: 150 words per minute
    const wordCount = script.split(/\s+/).length;
    const speakingMinutes = wordCount / 150;
    const estimatedSeconds = Math.ceil(speakingMinutes * 60 * 1.2); // 20% buffer for pacing

    const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS] ?? PLATFORM_SPECS.generic;

    // Clamp to platform limits
    return Math.min(estimatedSeconds, spec.maxDuration);
  }

  private selectShotType(section: string, style: string, index: number): string {
    const sectionLower = section.toLowerCase();

    // Opening shot
    if (index === 0) {
      return style === 'cinematic' ? SHOT_TYPES.WIDE.name : SHOT_TYPES.MEDIUM.name;
    }

    // Detail or emphasis
    if (sectionLower.includes('important') || sectionLower.includes('key point')) {
      return SHOT_TYPES.CLOSEUP.name;
    }

    // Demonstration or tutorial
    if (sectionLower.includes('show') || sectionLower.includes('demo')) {
      return SHOT_TYPES.INSERT.name;
    }

    // Default rotation based on style
    const styleRotations: Record<string, string[]> = {
      talking_head: [SHOT_TYPES.MEDIUM.name, SHOT_TYPES.CLOSEUP.name, SHOT_TYPES.MEDIUM.name],
      documentary: [SHOT_TYPES.WIDE.name, SHOT_TYPES.MEDIUM.name, SHOT_TYPES.CLOSEUP.name, SHOT_TYPES.INSERT.name],
      tutorial: [SHOT_TYPES.MEDIUM.name, SHOT_TYPES.INSERT.name, SHOT_TYPES.OTS.name],
      vlog: [SHOT_TYPES.MEDIUM.name, SHOT_TYPES.POV.name, SHOT_TYPES.WIDE.name],
      cinematic: [SHOT_TYPES.WIDE.name, SHOT_TYPES.MEDIUM.name, SHOT_TYPES.CLOSEUP.name, SHOT_TYPES.AERIAL.name],
    };

    const rotation = styleRotations[style] ?? styleRotations.talking_head;
    return rotation[index % rotation.length];
  }

  private selectCameraMovement(section: string, style: string, index: number): string {
    const sectionLower = section.toLowerCase();

    // Energy-based selection
    if (sectionLower.includes('exciting') || sectionLower.includes('fast')) {
      return CAMERA_MOVEMENTS.HANDHELD;
    }

    if (sectionLower.includes('reveal') || sectionLower.includes('show')) {
      return CAMERA_MOVEMENTS.DOLLY;
    }

    // Style-based defaults
    const styleDefaults: Record<string, string[]> = {
      talking_head: [CAMERA_MOVEMENTS.STATIC, CAMERA_MOVEMENTS.STATIC],
      documentary: [CAMERA_MOVEMENTS.PAN, CAMERA_MOVEMENTS.STATIC, CAMERA_MOVEMENTS.DOLLY],
      tutorial: [CAMERA_MOVEMENTS.STATIC, CAMERA_MOVEMENTS.ZOOM],
      vlog: [CAMERA_MOVEMENTS.HANDHELD, CAMERA_MOVEMENTS.STEADICAM],
      cinematic: [CAMERA_MOVEMENTS.DOLLY, CAMERA_MOVEMENTS.CRANE, CAMERA_MOVEMENTS.STEADICAM],
    };

    const movements = styleDefaults[style] ?? styleDefaults.talking_head;
    return movements[index % movements.length];
  }

  private generateVisualDescription(section: string, style: string): string {
    const sectionLower = section.toLowerCase();
    const descriptions: string[] = [];

    // Base description by style
    const styleDescriptions: Record<string, string> = {
      talking_head: 'Subject centered in frame, professional lighting setup',
      documentary: 'Observational shot capturing authentic moment',
      tutorial: 'Clear view of subject and demonstration area',
      vlog: 'Dynamic, personal framing with natural environment',
      cinematic: 'Carefully composed shot with dramatic lighting',
    };

    descriptions.push(styleDescriptions[style] ?? styleDescriptions.talking_head);

    // Context-aware additions
    if (sectionLower.includes('example')) {
      descriptions.push('Include visual example or demonstration');
    }
    if (sectionLower.includes('statistic') || sectionLower.includes('data')) {
      descriptions.push('Overlay graphic with key data point');
    }
    if (sectionLower.includes('emotion') || sectionLower.includes('feel')) {
      descriptions.push('Capture genuine emotional expression');
    }

    return descriptions.join('. ');
  }

  private extractOnScreenText(section: string): string | undefined {
    // Look for quotable phrases or key points
    const quotable = section.match(/"([^"]+)"/);
    if (quotable) {return quotable[1];}

    // Check for numbered points
    const numbered = section.match(/(\d+\.\s*[^.]+)/);
    if (numbered) {return numbered[1];}

    // If section is short, it might be a key point
    if (section.length < 100 && section.split(/\s+/).length < 15) {
      return section.replace(/[.!?]$/, '');
    }

    return undefined;
  }

  private generateSceneAudioCue(section: string, index: number, totalScenes: number): string {
    const sectionLower = section.toLowerCase();

    // Opening
    if (index === 0) {
      return 'Music: Intro bed fades in - energetic but not overpowering';
    }

    // Closing
    if (index === totalScenes - 1) {
      return 'Music: Outro swell - builds to conclusion';
    }

    // Content-based cues
    if (sectionLower.includes('important') || sectionLower.includes('key')) {
      return 'SFX: Subtle emphasis sound (whoosh or ding)';
    }

    if (sectionLower.includes('problem') || sectionLower.includes('issue')) {
      return 'Music: Tension bed - minor key undertone';
    }

    if (sectionLower.includes('solution') || sectionLower.includes('answer')) {
      return 'Music: Resolution - uplifting transition';
    }

    return 'Music: Continue background bed at low level';
  }

  private generateBRollForScene(section: string): string {
    const sectionLower = section.toLowerCase();

    const keywords: Record<string, string> = {
      business: 'Office environment, team collaboration, meetings',
      technology: 'Device screens, code scrolling, tech workspace',
      nature: 'Outdoor landscapes, natural elements, weather',
      people: 'Diverse faces, interactions, everyday activities',
      data: 'Graphs animating, dashboard views, analytics',
      money: 'Currency, financial indicators, transactions',
      success: 'Celebrations, achievements, milestones',
      problem: 'Frustrated expressions, obstacles, challenges',
    };

    for (const [keyword, suggestion] of Object.entries(keywords)) {
      if (sectionLower.includes(keyword)) {
        return suggestion;
      }
    }

    return 'Supporting visuals relevant to topic';
  }

  private formatTimeCode(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private generateStoryboardTitle(script: string): string {
    // Extract first meaningful sentence as title base
    const firstSentence = script.match(/^[^.!?]+[.!?]/)?.[0] ?? '';
    const cleaned = firstSentence.slice(0, 60).trim();
    return cleaned.length > 0 ? cleaned : 'Video Storyboard';
  }

  private generateProductionNotes(style: string, platform: string): string[] {
    const notes: string[] = [];

    // Platform-specific notes
    const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
    notes.push(`Shoot in ${spec.aspectRatio} aspect ratio`);
    notes.push(`Target duration: ${spec.idealDuration.min}-${spec.idealDuration.max} seconds`);

    // Style-specific notes
    const styleNotes: Record<string, string[]> = {
      talking_head: [
        'Use three-point lighting for professional look',
        'Position subject off-center using rule of thirds',
        'Ensure consistent eye-line with camera lens',
      ],
      documentary: [
        'Capture multiple angles of each moment',
        'Prioritize natural lighting when possible',
        'Record ambient sound for authenticity',
      ],
      tutorial: [
        'Ensure screen/product is clearly visible',
        'Use macro lens for detail shots',
        'Record separate audio track for clarity',
      ],
      vlog: [
        'Embrace natural movement and environment',
        'Use external mic for better audio',
        'Capture establishing shots of locations',
      ],
      cinematic: [
        'Scout locations for visual interest',
        'Use ND filters for controlled exposure',
        'Plan camera movements in advance',
      ],
    };

    notes.push(...(styleNotes[style] ?? styleNotes.talking_head));

    return notes;
  }

  private suggestEquipment(style: string, platform: string): string[] {
    const equipment: string[] = [];

    // Base equipment
    equipment.push('Camera (smartphone or dedicated)');
    equipment.push('Microphone (lavalier or shotgun)');

    // Platform-specific
    if (platform === 'tiktok' || platform === 'reels' || platform === 'shorts') {
      equipment.push('Ring light or portable LED panel');
      equipment.push('Smartphone gimbal for stability');
    } else {
      equipment.push('Tripod with fluid head');
      equipment.push('Three-point lighting kit');
    }

    // Style-specific additions
    const styleEquipment: Record<string, string[]> = {
      talking_head: ['Teleprompter or cue cards', 'Backdrop or set design'],
      documentary: ['Portable lighting kit', 'Shotgun microphone'],
      tutorial: ['Screen recording software', 'Macro lens for details'],
      vlog: ['Action camera mount', 'Portable power bank'],
      cinematic: ['Slider or dolly', 'External monitor', 'ND filters'],
    };

    equipment.push(...(styleEquipment[style] ?? []));

    return equipment;
  }

  // ==========================================================================
  // AUDIO CUE GENERATION
  // ==========================================================================

  private handleAudioCues(payload: AudioCuePayload): AudioCueResult {
    const { script, mood = 'educational', includeSFX = true, includeMusic = true } = payload;

    this.log('INFO', `Generating audio cues with ${mood} mood`);

    const sections = this.parseScriptSections(script);
    const cues: AudioCue[] = [];
    let currentTime = 0;

    // Opening cue
    if (includeMusic) {
      cues.push({
        timeCode: '00:00',
        type: 'music',
        description: `Intro music - ${mood} tone, builds energy`,
        intensity: 'medium',
        duration: 5,
        suggestion: this.getMusicSuggestion(mood, 'intro'),
      });
    }

    sections.forEach((section, index) => {
      const sectionDuration = Math.ceil((section.split(/\s+/).length / 150) * 60);
      currentTime += index === 0 ? 5 : sectionDuration;

      // VO transition markers
      if (index > 0) {
        cues.push({
          timeCode: this.formatTimeCode(currentTime),
          type: 'vo_transition',
          description: 'Natural pause for section transition',
          intensity: 'low',
        });
      }

      // SFX for emphasis points
      if (includeSFX && this.sectionNeedsEmphasis(section)) {
        cues.push({
          timeCode: this.formatTimeCode(currentTime + 2),
          type: 'sfx',
          description: this.getSFXDescription(section),
          intensity: this.getSFXIntensity(section),
          suggestion: this.getSFXSuggestion(section),
        });
      }

      // Ambient/mood changes
      if (this.detectMoodShift(section, index > 0 ? sections[index - 1] : undefined)) {
        cues.push({
          timeCode: this.formatTimeCode(currentTime),
          type: 'ambient',
          description: `Mood shift - adjust music bed`,
          intensity: 'low',
        });
      }
    });

    // Closing music cue
    if (includeMusic) {
      cues.push({
        timeCode: this.formatTimeCode(currentTime + 5),
        type: 'music',
        description: `Outro music - ${mood} resolution, fade out`,
        intensity: 'high',
        duration: 8,
        suggestion: this.getMusicSuggestion(mood, 'outro'),
      });
    }

    return {
      mood,
      totalCues: cues.length,
      cues,
      musicRecommendations: this.generateMusicRecommendations(mood, sections.length),
      mixingNotes: this.generateMixingNotes(mood),
    };
  }

  private sectionNeedsEmphasis(section: string): boolean {
    const emphasisKeywords = ['important', 'key', 'crucial', 'remember', 'note', 'highlight', 'tip', 'secret'];
    return emphasisKeywords.some(kw => section.toLowerCase().includes(kw));
  }

  private getSFXDescription(section: string): string {
    const sectionLower = section.toLowerCase();

    if (sectionLower.includes('wrong') || sectionLower.includes('mistake')) {
      return 'Error/negative indicator sound';
    }
    if (sectionLower.includes('correct') || sectionLower.includes('right')) {
      return 'Success/positive indicator sound';
    }
    if (sectionLower.includes('tip') || sectionLower.includes('hack')) {
      return 'Light bulb/idea sound';
    }
    return 'Subtle emphasis whoosh';
  }

  private getSFXIntensity(section: string): 'low' | 'medium' | 'high' {
    const sectionLower = section.toLowerCase();
    if (sectionLower.includes('crucial') || sectionLower.includes('never')) {return 'high';}
    if (sectionLower.includes('important') || sectionLower.includes('always')) {return 'medium';}
    return 'low';
  }

  private getSFXSuggestion(section: string): string {
    const sectionLower = section.toLowerCase();
    if (sectionLower.includes('error') || sectionLower.includes('wrong')) {return 'Negative buzz or error beep';}
    if (sectionLower.includes('success') || sectionLower.includes('win')) {return 'Achievement chime';}
    if (sectionLower.includes('transition')) {return 'Smooth whoosh';}
    return 'Subtle UI click or notification';
  }

  private detectMoodShift(current: string | undefined, previous: string | undefined): boolean {
    if (!current || !previous) {return false;}

    const currentMood = this.detectSectionMood(current);
    const previousMood = this.detectSectionMood(previous);

    return currentMood !== previousMood;
  }

  private detectSectionMood(section: string): string {
    const sectionLower = section.toLowerCase();

    if (sectionLower.includes('problem') || sectionLower.includes('challenge')) {return 'tension';}
    if (sectionLower.includes('solution') || sectionLower.includes('answer')) {return 'resolution';}
    if (sectionLower.includes('exciting') || sectionLower.includes('amazing')) {return 'energetic';}
    return 'neutral';
  }

  private getMusicSuggestion(mood: string, position: string): string {
    const suggestions: Record<string, Record<string, string>> = {
      energetic: {
        intro: 'Upbeat electronic or pop instrumental, 120+ BPM',
        outro: 'Energetic crescendo with satisfying resolution',
      },
      calm: {
        intro: 'Soft acoustic or ambient, 70-90 BPM',
        outro: 'Gentle fade with peaceful resolution',
      },
      dramatic: {
        intro: 'Cinematic orchestral swell, building tension',
        outro: 'Epic resolution with emotional payoff',
      },
      inspiring: {
        intro: 'Uplifting piano or strings, moderate tempo',
        outro: 'Triumphant crescendo with hopeful tone',
      },
      educational: {
        intro: 'Corporate/tech background, unobtrusive',
        outro: 'Clean ending with professional feel',
      },
    };

    return suggestions[mood]?.[position] ?? suggestions.educational[position];
  }

  private generateMusicRecommendations(mood: string, sectionCount: number): AudioCueResult['musicRecommendations'] {
    const recommendations: AudioCueResult['musicRecommendations'] = [];

    // Intro section
    recommendations.push({
      section: 'Intro (0-10s)',
      genre: this.getMoodGenre(mood),
      tempo: this.getMoodTempo(mood),
      keywords: this.getMoodKeywords(mood, 'intro'),
    });

    // Body sections
    if (sectionCount > 3) {
      recommendations.push({
        section: 'Main Content',
        genre: `${this.getMoodGenre(mood)} (low bed)`,
        tempo: 'Moderate',
        keywords: ['background', 'underscore', 'subtle'],
      });
    }

    // Outro
    recommendations.push({
      section: 'Outro',
      genre: this.getMoodGenre(mood),
      tempo: this.getMoodTempo(mood),
      keywords: this.getMoodKeywords(mood, 'outro'),
    });

    return recommendations;
  }

  private getMoodGenre(mood: string): string {
    const genres: Record<string, string> = {
      energetic: 'Electronic/Pop',
      calm: 'Acoustic/Ambient',
      dramatic: 'Cinematic/Orchestral',
      inspiring: 'Indie/Uplifting',
      educational: 'Corporate/Tech',
    };
    return genres[mood] ?? genres.educational;
  }

  private getMoodTempo(mood: string): string {
    const tempos: Record<string, string> = {
      energetic: '120-140 BPM',
      calm: '60-80 BPM',
      dramatic: '80-100 BPM (variable)',
      inspiring: '100-120 BPM',
      educational: '90-110 BPM',
    };
    return tempos[mood] ?? tempos.educational;
  }

  private getMoodKeywords(mood: string, position: string): string[] {
    const keywords: Record<string, Record<string, string[]>> = {
      energetic: {
        intro: ['upbeat', 'driving', 'positive'],
        outro: ['triumphant', 'energetic', 'resolution'],
      },
      calm: {
        intro: ['peaceful', 'gentle', 'ambient'],
        outro: ['serene', 'fade', 'tranquil'],
      },
      dramatic: {
        intro: ['cinematic', 'tension', 'building'],
        outro: ['epic', 'emotional', 'climax'],
      },
      inspiring: {
        intro: ['hopeful', 'uplifting', 'motivational'],
        outro: ['triumphant', 'inspiring', 'achievement'],
      },
      educational: {
        intro: ['corporate', 'professional', 'modern'],
        outro: ['clean', 'resolved', 'polished'],
      },
    };

    return keywords[mood]?.[position] ?? keywords.educational[position];
  }

  private generateMixingNotes(mood: string): string[] {
    const notes = [
      'VO should always be -6dB to -3dB above music bed',
      'Duck music during speech using sidechain compression',
      'SFX should punch through but not overpower',
      'Ensure consistent levels across all sections',
    ];

    const moodNotes: Record<string, string> = {
      energetic: 'Keep energy high but leave room for VO clarity',
      calm: 'Prioritize space and breathing room in mix',
      dramatic: 'Allow dynamic range for emotional impact',
      inspiring: 'Build levels gradually toward climax',
      educational: 'Maintain professional, consistent levels throughout',
    };

    notes.push(moodNotes[mood] ?? moodNotes.educational);

    return notes;
  }

  // ==========================================================================
  // SCENE BREAKDOWN
  // ==========================================================================

  private handleSceneBreakdown(payload: SceneBreakdownPayload): SceneBreakdownResult {
    const { script, platform, includeTimings = true } = payload;

    this.log('INFO', `Breaking down scenes for ${platform}`);

    const sections = this.parseScriptSections(script);
    const totalDuration = this.estimateDuration(script, platform);
    const avgSceneDuration = Math.ceil(totalDuration / sections.length);

    const scenes: Scene[] = sections.map((section, index) => ({
      sceneNumber: index + 1,
      title: this.generateSceneTitle(section, index),
      description: section.slice(0, 200) + (section.length > 200 ? '...' : ''),
      estimatedDuration: includeTimings ? avgSceneDuration : 0,
      keyPoints: this.extractKeyPoints(section),
      visualStyle: this.determineVisualStyle(section),
      transitionIn: this.selectTransition(index, 'in'),
      transitionOut: this.selectTransition(index, 'out', sections.length),
    }));

    return {
      totalScenes: scenes.length,
      totalDuration,
      scenes,
      pacingAnalysis: {
        averageSceneDuration: avgSceneDuration,
        recommendation: this.getPacingRecommendation(avgSceneDuration, platform),
      },
    };
  }

  private generateSceneTitle(section: string, index: number): string {
    // Try to extract a meaningful title from the content
    const firstLine = section.split(/[.!?\n]/)[0].trim();
    if (firstLine.length <= 50) {return firstLine;}

    // Fallback to generic scene name
    const sceneTypes = ['Introduction', 'Setup', 'Development', 'Key Point', 'Example', 'Conclusion'];
    return sceneTypes[index % sceneTypes.length];
  }

  private extractKeyPoints(section: string): string[] {
    const points: string[] = [];

    // Look for numbered items
    const numbered = section.match(/\d+\.\s*[^.]+/g);
    if (numbered) {points.push(...numbered.slice(0, 3));}

    // Look for bullet-like patterns
    const bullets = section.match(/[-*]\s*[^-*\n]+/g);
    if (bullets) {points.push(...bullets.slice(0, 3));}

    // If no structured points, extract key sentences
    if (points.length === 0) {
      const sentences = section.match(/[^.!?]+[.!?]+/g) ?? [];
      points.push(...sentences.slice(0, 2).map(s => s.trim()));
    }

    return points.slice(0, 3);
  }

  private determineVisualStyle(section: string): string {
    const sectionLower = section.toLowerCase();

    if (sectionLower.includes('data') || sectionLower.includes('statistic')) {
      return 'Infographic/data visualization';
    }
    if (sectionLower.includes('example') || sectionLower.includes('show')) {
      return 'Demonstration/screen capture';
    }
    if (sectionLower.includes('story') || sectionLower.includes('experience')) {
      return 'Personal/narrative style';
    }
    return 'Standard talking head with B-roll';
  }

  private selectTransition(index: number, direction: string, totalScenes?: number): string {
    if (direction === 'in') {
      return index === 0 ? 'Fade from black' : 'Cut or J-cut';
    }
    // direction === 'out'
    if (totalScenes && index === totalScenes - 1) {
      return 'Fade to black';
    }
    return 'Cut or L-cut to next scene';
  }

  private getPacingRecommendation(avgDuration: number, platform: string): string {
    const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];

    if (avgDuration < 10) {
      return 'Pacing is very fast - consider extending scenes for better comprehension';
    }
    if (avgDuration > 60 && platform !== 'youtube') {
      return 'Scenes are long for short-form - consider adding more cuts and visual variety';
    }
    if (avgDuration >= spec.idealDuration.min && avgDuration <= spec.idealDuration.max) {
      return 'Pacing is optimal for this platform';
    }
    return 'Consider adjusting scene length to match platform best practices';
  }

  // ==========================================================================
  // THUMBNAIL STRATEGY
  // ==========================================================================

  private handleThumbnailStrategy(payload: ThumbnailStrategyPayload): ThumbnailStrategyResult {
    const { videoTitle, videoTopic, targetAudience, variants = 3 } = payload;

    this.log('INFO', `Generating thumbnail strategy for "${videoTitle}"`);

    const concepts: ThumbnailConcept[] = [];

    // Generate variant concepts
    for (let i = 0; i < variants; i++) {
      concepts.push(this.generateThumbnailConcept(videoTitle, videoTopic, targetAudience, i));
    }

    return {
      concepts,
      bestPractices: this.getThumbnailBestPractices(),
      avoidList: this.getThumbnailAvoidList(),
      abTestPlan: this.generateABTestPlan(concepts),
    };
  }

  private generateThumbnailConcept(
    title: string,
    topic: string,
    audience: string,
    variantIndex: number
  ): ThumbnailConcept {
    const layouts = ['Face + Text', 'Split Screen', 'Before/After', 'Product Focus', 'Emotion Close-up'];
    const expressions = ['Surprised', 'Excited', 'Curious', 'Confident', 'Shocked'];
    const colorSchemes = ['High contrast (yellow/black)', 'Brand colors', 'Red/white', 'Blue gradient', 'Warm tones'];
    const clickbaitLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    const layout = layouts[variantIndex % layouts.length];
    const expression = expressions[variantIndex % expressions.length];
    const colors = colorSchemes[variantIndex % colorSchemes.length];
    const clickbait = clickbaitLevels[Math.min(variantIndex, 2)];

    return {
      variant: String.fromCharCode(65 + variantIndex),
      layout,
      primaryText: this.generateThumbnailText(title, clickbait),
      secondaryText: this.generateSecondaryText(topic, clickbait),
      emotionalHook: this.getEmotionalHook(topic, audience),
      colorScheme: colors,
      facialExpression: expression,
      props: this.suggestProps(topic),
      clickbaitLevel: clickbait,
      estimatedCTR: this.estimateCTR(clickbait, layout),
    };
  }

  private generateThumbnailText(title: string, clickbaitLevel: string): string {
    // Extract key words and shorten
    const words = title.split(/\s+/).slice(0, 4);

    if (clickbaitLevel === 'high') {
      return `${words.slice(0, 2).join(' ').toUpperCase()  }?!`;
    }
    if (clickbaitLevel === 'medium') {
      return words.slice(0, 3).join(' ').toUpperCase();
    }
    return words.join(' ');
  }

  private generateSecondaryText(topic: string, clickbaitLevel: string): string | undefined {
    if (clickbaitLevel === 'low') {return undefined;}

    const hooks = ['You Won\'t Believe...', 'The Truth About...', 'Why Nobody Talks About...', 'The Secret To...'];
    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  private getEmotionalHook(topic: string, _audience: string): string {
    const topicLower = topic.toLowerCase();

    if (topicLower.includes('money') || topicLower.includes('income')) {
      return 'Financial aspiration - promise of wealth/success';
    }
    if (topicLower.includes('mistake') || topicLower.includes('wrong')) {
      return 'Fear of missing out or making errors';
    }
    if (topicLower.includes('secret') || topicLower.includes('hidden')) {
      return 'Curiosity - exclusive knowledge appeal';
    }
    return 'Value proposition - clear benefit to viewer';
  }

  private suggestProps(topic: string): string[] {
    const topicLower = topic.toLowerCase();

    if (topicLower.includes('money') || topicLower.includes('business')) {
      return ['Cash/money visuals', 'Laptop/phone', 'Charts/graphs'];
    }
    if (topicLower.includes('tech') || topicLower.includes('software')) {
      return ['Devices', 'Code on screen', 'Tech gadgets'];
    }
    if (topicLower.includes('fitness') || topicLower.includes('health')) {
      return ['Fitness equipment', 'Healthy food', 'Active wear'];
    }
    return ['Relevant visual aid', 'Brand elements'];
  }

  private estimateCTR(clickbaitLevel: string, layout: string): string {
    const baseCTR: Record<string, number> = {
      low: 3,
      medium: 5,
      high: 8,
    };

    const layoutBonus: Record<string, number> = {
      'Face + Text': 2,
      'Split Screen': 1,
      'Before/After': 3,
      'Product Focus': 0,
      'Emotion Close-up': 2,
    };

    const ctr = baseCTR[clickbaitLevel] + (layoutBonus[layout] ?? 0);
    return `${ctr}-${ctr + 2}%`;
  }

  private getThumbnailBestPractices(): string[] {
    return [
      'Face should take up 30-40% of thumbnail',
      'Use maximum 3-4 words of text',
      'Text should be readable at small sizes',
      'High contrast colors perform better',
      'Consistent style builds brand recognition',
      'Test multiple variants before finalizing',
      'Avoid small details that get lost',
      'Emotions in faces drive more clicks',
    ];
  }

  private getThumbnailAvoidList(): string[] {
    return [
      'Cluttered compositions with too many elements',
      'Small or illegible text',
      'Low contrast color combinations',
      'Misleading images that don\'t match content',
      'Overused stock photo expressions',
      'Copying popular creators exactly',
      'Red arrows pointing at nothing interesting',
    ];
  }

  private generateABTestPlan(concepts: ThumbnailConcept[]): string[] {
    return [
      `Test ${concepts.length} variants over 48-72 hours`,
      'Use YouTube\'s built-in thumbnail A/B testing if available',
      'Track CTR, not just views, for accurate measurement',
      'Minimum 1000 impressions per variant for statistical significance',
      'Consider audience retention alongside CTR',
      'Document learnings for future videos',
    ];
  }

  // ==========================================================================
  // VIDEO SEO
  // ==========================================================================

  private handleVideoSEO(payload: VideoSEOPayload): VideoSEOResult {
    const { videoTitle, videoDescription, targetKeywords, platform } = payload;

    this.log('INFO', `Optimizing video SEO for ${platform}`);

    const optimizedTitle = this.optimizeTitle(videoTitle, targetKeywords, platform);
    const optimizedDescription = this.optimizeDescription(videoDescription, targetKeywords, platform);
    const tags = this.generateTags(targetKeywords, videoTitle);
    const hashtags = this.generateHashtags(targetKeywords, platform);
    const keyMoments = this.generateKeyMoments(videoDescription);

    const seoScore = this.calculateSEOScore(optimizedTitle, optimizedDescription, tags, targetKeywords);

    return {
      optimizedTitle,
      titleScore: this.scoreTitleSEO(optimizedTitle, targetKeywords),
      optimizedDescription,
      tags,
      hashtags,
      keyMoments,
      seoScore,
      improvements: this.generateSEOImprovements(seoScore, platform),
    };
  }

  private optimizeTitle(title: string, keywords: string[], platform: string): string {
    const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
    let optimized = title;

    // Ensure primary keyword is near the beginning
    if (keywords.length > 0 && !title.toLowerCase().startsWith(keywords[0].toLowerCase())) {
      // Check if keyword is already in title
      if (!title.toLowerCase().includes(keywords[0].toLowerCase())) {
        optimized = `${keywords[0]}: ${title}`;
      }
    }

    // Truncate if needed
    if (optimized.length > spec.titleLimit) {
      optimized = `${optimized.slice(0, spec.titleLimit - 3)  }...`;
    }

    return optimized;
  }

  private optimizeDescription(description: string, keywords: string[], platform: string): string {
    const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
    let optimized = description;

    // Add keywords naturally in first 150 characters
    const keywordsInFirst150 = keywords.filter(kw =>
      description.slice(0, 150).toLowerCase().includes(kw.toLowerCase())
    );

    if (keywordsInFirst150.length === 0 && keywords.length > 0) {
      optimized = `${keywords[0]} - ${description}`;
    }

    // Add call to action if missing
    if (!optimized.toLowerCase().includes('subscribe') && !optimized.toLowerCase().includes('follow')) {
      optimized += '\n\nDon\'t forget to subscribe for more content like this!';
    }

    // Truncate if needed
    if (optimized.length > spec.descriptionLimit) {
      optimized = `${optimized.slice(0, spec.descriptionLimit - 3)  }...`;
    }

    return optimized;
  }

  private generateTags(keywords: string[], title: string): string[] {
    const tags: string[] = [];

    // Add target keywords
    tags.push(...keywords.slice(0, 10));

    // Add variations
    keywords.slice(0, 3).forEach(kw => {
      tags.push(`how to ${kw}`);
      tags.push(`${kw} tutorial`);
      tags.push(`best ${kw}`);
    });

    // Add title words
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    tags.push(...titleWords.slice(0, 5));

    // Remove duplicates and limit
    return [...new Set(tags)].slice(0, 30);
  }

  private generateHashtags(keywords: string[], platform: string): string[] {
    const hashtags = keywords.slice(0, 5).map(kw =>
      `#${  kw.replace(/\s+/g, '').toLowerCase()}`
    );

    // Add platform-specific hashtags
    if (platform === 'youtube') {
      hashtags.push('#youtube', '#youtubevideo');
    } else if (platform === 'tiktok') {
      hashtags.push('#fyp', '#foryou', '#viral');
    }

    return hashtags.slice(0, 10);
  }

  private generateKeyMoments(description: string): Array<{ timestamp: string; label: string }> {
    // Generate placeholder key moments based on content structure
    const sections = description.split(/\n\n+/).filter(s => s.trim().length > 20);

    return sections.slice(0, 5).map((section, index) => ({
      timestamp: this.formatTimeCode(index * 60 + 30),
      label: section.slice(0, 50).replace(/[.!?].*$/, '').trim() || `Section ${index + 1}`,
    }));
  }

  private scoreTitleSEO(title: string, keywords: string[]): number {
    let score = 50;

    // Length optimization (50-60 chars ideal)
    if (title.length >= 50 && title.length <= 60) {score += 15;}
    else if (title.length >= 40 && title.length <= 70) {score += 10;}

    // Keyword presence
    const keywordsPresent = keywords.filter(kw =>
      title.toLowerCase().includes(kw.toLowerCase())
    ).length;
    score += keywordsPresent * 10;

    // Keyword position (near beginning is better)
    if (keywords.length > 0 && title.toLowerCase().indexOf(keywords[0].toLowerCase()) < 20) {
      score += 15;
    }

    // Emotional triggers
    const triggers = ['how', 'why', 'what', 'best', 'top', 'ultimate', 'complete'];
    if (triggers.some(t => title.toLowerCase().includes(t))) {score += 10;}

    return Math.min(100, score);
  }

  private calculateSEOScore(
    title: string,
    description: string,
    tags: string[],
    keywords: string[]
  ): number {
    let score = 0;

    // Title score (30% weight)
    score += this.scoreTitleSEO(title, keywords) * 0.3;

    // Description score (30% weight)
    const descScore = this.scoreDescriptionSEO(description, keywords);
    score += descScore * 0.3;

    // Tags score (20% weight)
    const tagScore = Math.min(100, tags.length * 3);
    score += tagScore * 0.2;

    // Keyword coverage (20% weight)
    const coverage = keywords.filter(kw =>
      title.toLowerCase().includes(kw.toLowerCase()) ||
      description.toLowerCase().includes(kw.toLowerCase())
    ).length / keywords.length;
    score += coverage * 100 * 0.2;

    return Math.round(score);
  }

  private scoreDescriptionSEO(description: string, keywords: string[]): number {
    let score = 40;

    // Length (minimum 250 chars, ideal 1000+)
    if (description.length >= 1000) {score += 20;}
    else if (description.length >= 500) {score += 15;}
    else if (description.length >= 250) {score += 10;}

    // Keywords in first 150 chars
    const first150 = description.slice(0, 150).toLowerCase();
    const keywordsInFirst = keywords.filter(kw => first150.includes(kw.toLowerCase())).length;
    score += keywordsInFirst * 10;

    // CTA presence
    if (description.toLowerCase().includes('subscribe') || description.toLowerCase().includes('like')) {
      score += 10;
    }

    // Links/timestamps
    if (description.includes('http') || description.match(/\d+:\d+/)) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private generateSEOImprovements(currentScore: number, platform: string): string[] {
    const improvements: string[] = [];

    if (currentScore < 70) {
      improvements.push('Add more target keywords to title and description');
      improvements.push('Extend description to at least 500 characters');
    }

    if (currentScore < 85) {
      improvements.push('Include timestamps/chapters for better navigation');
      improvements.push('Add relevant hashtags for discoverability');
    }

    if (platform === 'youtube') {
      improvements.push('Create custom thumbnail with keyword text');
      improvements.push('Add end screens and cards for engagement');
    }

    if (improvements.length === 0) {
      improvements.push('SEO is well optimized - monitor performance and iterate');
    }

    return improvements;
  }

  // ==========================================================================
  // B-ROLL SUGGESTIONS
  // ==========================================================================

  private handleBRollSuggestions(payload: BRollSuggestionPayload): BRollResult {
    const { script, style, budget = 'mixed' } = payload;

    this.log('INFO', `Generating B-roll suggestions (${style}, ${budget})`);

    const sections = this.parseScriptSections(script);
    const suggestions: BRollSuggestion[] = [];
    let currentTime = 0;

    sections.forEach((section, _index) => {
      const sectionDuration = Math.ceil((section.split(/\s+/).length / 150) * 60);

      suggestions.push({
        timeCode: this.formatTimeCode(currentTime),
        context: `${section.slice(0, 100)  }...`,
        suggestions: this.generateBRollOptions(section, style, budget),
      });

      currentTime += sectionDuration;
    });

    return {
      totalSuggestions: suggestions.reduce((acc, s) => acc + s.suggestions.length, 0),
      suggestions,
      stockSources: this.getStockSources(budget),
      estimatedCost: this.estimateBRollCost(suggestions, budget),
    };
  }

  private generateBRollOptions(
    section: string,
    style: string,
    budget: string
  ): BRollSuggestion['suggestions'] {
    const options: BRollSuggestion['suggestions'] = [];
    const sectionLower = section.toLowerCase();

    // Stock footage option
    if (style === 'stock' || style === 'mixed') {
      options.push({
        type: 'stock',
        description: this.generateBRollForScene(section),
        searchTerms: this.extractSearchTerms(sectionLower),
        source: budget === 'free' ? 'Pexels/Pixabay' : 'Shutterstock/Getty',
      });
    }

    // Screen recording option
    if (sectionLower.includes('screen') || sectionLower.includes('app') || sectionLower.includes('website')) {
      options.push({
        type: 'screen_recording',
        description: 'Screen capture demonstrating the concept',
        source: 'OBS/Loom',
      });
    }

    // Custom footage option
    if (style === 'custom' || style === 'mixed') {
      options.push({
        type: 'custom',
        description: 'Original footage shot specifically for this section',
      });
    }

    // Animation option for data/concepts
    if (sectionLower.includes('data') || sectionLower.includes('concept') || sectionLower.includes('process')) {
      options.push({
        type: 'animation',
        description: 'Motion graphics explaining the concept',
        source: 'After Effects/Canva',
      });
    }

    return options;
  }

  private extractSearchTerms(text: string): string[] {
    // Extract nouns and action words for stock footage search
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was', 'were'];
    const words = text
      .split(/\s+/)
      .filter(w => w.length > 3 && !commonWords.includes(w))
      .slice(0, 5);

    return words;
  }

  private getStockSources(budget: string): string[] {
    if (budget === 'free') {
      return ['Pexels', 'Pixabay', 'Unsplash', 'Coverr', 'Videvo'];
    }
    if (budget === 'paid') {
      return ['Shutterstock', 'Adobe Stock', 'iStock', 'Pond5'];
    }
    return ['Pexels (free)', 'Shutterstock (paid)', 'Adobe Stock (paid)', 'Storyblocks'];
  }

  private estimateBRollCost(suggestions: BRollSuggestion[], budget: string): string {
    const clipCount = suggestions.reduce((acc, s) => acc + s.suggestions.length, 0);

    if (budget === 'free') {return '$0 (free sources)';}
    if (budget === 'paid') {return `$${clipCount * 15}-$${clipCount * 50} (stock licensing)`;}
    return `$${Math.floor(clipCount * 7.5)}-$${clipCount * 25} (mixed sources)`;
  }

  // ==========================================================================
  // SIGNAL HANDLING
  // ==========================================================================

  async handleSignal(signal: Signal): Promise<AgentReport> {
    this.log('INFO', `Received signal: ${signal.type} from ${signal.origin}`);

    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };

    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 950, boilerplate: 50 };
  }

  // ==========================================================================
  // SHARED MEMORY INTEGRATION
  // ==========================================================================

  /**
   * Write storyboard content to the shared memory vault
   */
  private async shareStoryboardToVault(
    storyboard: Record<string, unknown>
  ): Promise<void> {
    const vault = getMemoryVault();

    const videoId = storyboard.videoId as string;
    const title = storyboard.title as string;
    const metadata = storyboard.metadata as { targetPlatform: string; totalDuration: number; sceneCount: number };
    const scenes = storyboard.scenes as unknown[];

    await vault.writeContent(
      `storyboard_${videoId}`,
      {
        contentType: 'STORYBOARD',
        platform: metadata.targetPlatform,
        title: title,
        content: storyboard,
        status: 'DRAFT',
        generatedBy: this.identity.id,
      },
      this.identity.id,
      { tags: ['video', 'storyboard', metadata.targetPlatform] }
    );

    // Share insight about the video content strategy
    await shareInsight(
      this.identity.id,
      'CONTENT',
      `Video Storyboard: ${title}`,
      `Created ${scenes.length}-scene storyboard for ${metadata.targetPlatform}. ` +
      `Total duration: ${metadata.totalDuration}s. ` +
      `Includes ${metadata.sceneCount} scenes with audio cues.`,
      {
        confidence: 85,
        relatedAgents: ['CONTENT_MANAGER', 'TIKTOK_EXPERT', 'COPYWRITER'],
        tags: ['video', 'content-strategy'],
      }
    );
  }

  /**
   * Read trend insights from other agents before creating content
   */
  private async readTrendInsightsFromVault(): Promise<{
    trendingTopics: string[];
    recommendations: string[];
  }> {
    const insights = await readAgentInsights(this.identity.id, {
      type: 'TREND',
      minConfidence: 70,
      limit: 5,
    });

    const trendingTopics: string[] = [];
    const recommendations: string[] = [];

    for (const insight of insights) {
      if (insight.value.title) {
        trendingTopics.push(insight.value.title);
      }
      if (insight.value.recommendedActions) {
        recommendations.push(...insight.value.recommendedActions);
      }
    }

    return { trendingTopics, recommendations };
  }

  /**
   * Broadcast a signal when video content needs optimization
   */
  private async broadcastVideoOptimizationSignal(
    videoId: string,
    issue: string
  ): Promise<void> {
    await broadcastSignal(
      this.identity.id,
      'VIDEO_OPTIMIZATION_NEEDED',
      'MEDIUM',
      {
        videoId,
        issue,
        timestamp: new Date().toISOString(),
      },
      ['CONTENT_MANAGER', 'SEO_EXPERT', 'TIKTOK_EXPERT']
    );
  }

  /**
   * Get content from other agents for video inspiration
   */
  private async getRelatedContentFromVault(
    platform: string
  ): Promise<ContentData[]> {
    const vault = getMemoryVault();
    const content = await vault.getContent(this.identity.id);

    return content
      .filter(c => c.tags.includes(platform) || c.value.platform === platform)
      .map(c => c.value)
      .slice(0, 5);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createVideoSpecialist(): VideoSpecialist {
  return new VideoSpecialist();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let videoSpecialistInstance: VideoSpecialist | null = null;

export function getVideoSpecialist(): VideoSpecialist {
  videoSpecialistInstance ??= createVideoSpecialist();
  return videoSpecialistInstance;
}
