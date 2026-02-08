/**
 * Site-Mimicry Style Guide Integrator
 *
 * Bridges the Intelligent Crawler's extracted style data with the Video Engine.
 * Ensures generated commercials perfectly match the client's "Twin" website aesthetics.
 *
 * Features:
 * - Automatic style extraction from crawled websites
 * - Color palette to video LUT mapping
 * - Typography to text overlay conversion
 * - Visual style to camera/lighting recommendations
 * - Brand asset discovery and integration
 */

import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
  SiteMimicryStyleGuide,
  VisualStyleConfig,
  VisualPrompt,
  LightingStyle,
  ShotType,
  BrandDNASnapshot,
} from './types';

// ============================================================================
// STYLE EXTRACTION CONFIGURATION
// ============================================================================

/**
 * Aesthetic profiles and their visual characteristics
 */
const AESTHETIC_PROFILES: Record<string, AestheticProfile> = {
  minimal: {
    name: 'Minimal',
    characteristics: ['clean lines', 'white space', 'simple typography'],
    recommendedLighting: ['natural', 'soft', 'high-key'],
    recommendedShots: ['wide', 'medium', 'close-up'],
    colorSaturation: 0.85,
    contrastLevel: 1.0,
    motionStyle: 'slow',
  },
  modern: {
    name: 'Modern',
    characteristics: ['bold typography', 'geometric shapes', 'gradients'],
    recommendedLighting: ['studio', 'cinematic', 'rim-light'],
    recommendedShots: ['medium', 'medium-close-up', 'dutch-angle'],
    colorSaturation: 1.0,
    contrastLevel: 1.1,
    motionStyle: 'medium',
  },
  classic: {
    name: 'Classic',
    characteristics: ['serif fonts', 'traditional layouts', 'muted colors'],
    recommendedLighting: ['natural', 'golden-hour', 'soft'],
    recommendedShots: ['wide', 'medium', 'over-the-shoulder'],
    colorSaturation: 0.9,
    contrastLevel: 1.05,
    motionStyle: 'slow',
  },
  bold: {
    name: 'Bold',
    characteristics: ['high contrast', 'vivid colors', 'large type'],
    recommendedLighting: ['dramatic', 'hard', 'backlit'],
    recommendedShots: ['close-up', 'extreme-close-up', 'low-angle'],
    colorSaturation: 1.2,
    contrastLevel: 1.2,
    motionStyle: 'fast',
  },
  playful: {
    name: 'Playful',
    characteristics: ['bright colors', 'rounded shapes', 'fun typography'],
    recommendedLighting: ['high-key', 'soft', 'natural'],
    recommendedShots: ['medium', 'medium-close-up', 'point-of-view'],
    colorSaturation: 1.15,
    contrastLevel: 1.0,
    motionStyle: 'dynamic',
  },
};

/**
 * Color temperature mapping based on color palette dominance
 * Reserved for future color analysis features
 */
const _COLOR_TEMPERATURE_MAP: Record<string, number> = {
  warm: 15,
  neutral: 0,
  cool: -15,
};

// ============================================================================
// STYLE GUIDE INTEGRATOR SERVICE
// ============================================================================

export class StyleGuideIntegrator {
  private static instance: StyleGuideIntegrator;

  // Cache for processed style guides
  private styleGuideCache: Map<string, ProcessedStyleGuide> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  static getInstance(): StyleGuideIntegrator {
    if (!StyleGuideIntegrator.instance) {
      StyleGuideIntegrator.instance = new StyleGuideIntegrator();
    }
    return StyleGuideIntegrator.instance;
  }

  /**
   * Extract style guide from a crawled website
   */
  extractStyleGuide(
    sourceUrl: string,
    crawledData: CrawledWebsiteData
  ): SiteMimicryStyleGuide {
    logger.info('StyleGuideIntegrator: Extracting style guide', {
      sourceUrl,
    });

    // Extract color palette
    const colorPalette = this.extractColorPalette(crawledData);

    // Extract typography
    const typography = this.extractTypography(crawledData);

    // Determine visual style
    const visualStyle = this.determineVisualStyle(crawledData);

    // Extract motion preferences from CSS/JS
    const motionPreferences = this.extractMotionPreferences(crawledData);

    // Find brand assets
    const discoveredAssets = this.discoverBrandAssets(crawledData);

    // Calculate extraction confidence
    const extractionConfidence = this.calculateExtractionConfidence({
      colorPalette,
      typography,
      visualStyle,
    });

    const styleGuide: SiteMimicryStyleGuide = {
      id: uuidv4(),
      sourceUrl,
      colorPalette,
      typography,
      visualStyle,
      motionPreferences,
      discoveredAssets,
      extractionConfidence,
      extractedAt: new Date(),
      sourcePageTitle: crawledData.pageTitle,
    };

    logger.info('StyleGuideIntegrator: Style guide extracted', {
      styleGuideId: styleGuide.id,
      confidence: extractionConfidence.overall,
    });

    return styleGuide;
  }

  /**
   * Convert style guide to visual style config for video engine
   */
  convertToVisualStyleConfig(styleGuide: SiteMimicryStyleGuide): VisualStyleConfig {
    logger.info('StyleGuideIntegrator: Converting to visual style config', {
      styleGuideId: styleGuide.id,
    });

    // Determine the aesthetic profile
    const aestheticProfile = AESTHETIC_PROFILES[styleGuide.visualStyle.overallAesthetic] ||
      AESTHETIC_PROFILES['modern'];

    // Map color palette to video color grading
    const colorGrading = this.mapColorPaletteToGrading(
      styleGuide.colorPalette,
      aestheticProfile
    );

    // Select appropriate LUT based on aesthetic
    const lutId = this.selectLUTForAesthetic(styleGuide.visualStyle.overallAesthetic);

    const config: VisualStyleConfig = {
      lutId,
      lutIntensity: 0.7,
      colorCorrection: {
        exposure: colorGrading.exposure,
        contrast: colorGrading.contrast,
        saturation: colorGrading.saturation,
        temperature: colorGrading.temperature,
        tint: colorGrading.tint,
        highlights: colorGrading.highlights,
        shadows: colorGrading.shadows,
        vibrance: colorGrading.vibrance,
      },
      brandOverlay: {
        logoUrl: styleGuide.discoveredAssets.logoUrl,
        logoPosition: this.determineLogoPosition(styleGuide.visualStyle.overallAesthetic),
        logoOpacity: 0.85,
        watermarkEnabled: false,
      },
      filmGrain: this.shouldAddFilmGrain(styleGuide.visualStyle.overallAesthetic)
        ? { enabled: true, intensity: 0.08, size: 'fine' as const }
        : undefined,
      vignette: {
        enabled: true,
        intensity: 0.12,
        softness: 0.8,
      },
    };

    return config;
  }

  /**
   * Generate visual prompt modifiers from style guide
   */
  generatePromptModifiers(styleGuide: SiteMimicryStyleGuide): PromptModifiers {
    const aestheticProfile = AESTHETIC_PROFILES[styleGuide.visualStyle.overallAesthetic] ||
      AESTHETIC_PROFILES['modern'];

    return {
      colorDescription: this.generateColorDescription(styleGuide.colorPalette),
      lightingRecommendations: aestheticProfile.recommendedLighting,
      recommendedShotTypes: aestheticProfile.recommendedShots as ShotType[],
      styleKeywords: aestheticProfile.characteristics,
      motionSpeed: aestheticProfile.motionStyle,
      brandColorHex: styleGuide.colorPalette.primary,
      environmentSuggestions: this.generateEnvironmentSuggestions(
        styleGuide.visualStyle.overallAesthetic
      ),
    };
  }

  /**
   * Enhance a visual prompt with style guide data
   */
  enhancePromptWithStyleGuide(
    basePrompt: VisualPrompt,
    styleGuide: SiteMimicryStyleGuide
  ): VisualPrompt {
    const modifiers = this.generatePromptModifiers(styleGuide);

    // Enhance the color grading description
    const enhancedColorGrading = `${basePrompt.colorGrading}, incorporating ${modifiers.colorDescription}`;

    // Add brand color elements
    const enhancedBrandElements = [
      ...basePrompt.brandElements,
      `brand color ${styleGuide.colorPalette.primary}`,
    ];

    // Enhance the compiled prompt
    const enhancedCompiledPrompt = this.enhanceCompiledPrompt(
      basePrompt.compiledPrompt,
      modifiers
    );

    return {
      ...basePrompt,
      colorGrading: enhancedColorGrading,
      brandElements: enhancedBrandElements,
      compiledPrompt: enhancedCompiledPrompt,
    };
  }

  /**
   * Recommend camera settings based on style guide
   */
  recommendCameraSettings(styleGuide: SiteMimicryStyleGuide): CameraRecommendations {
    const aestheticProfile = AESTHETIC_PROFILES[styleGuide.visualStyle.overallAesthetic] ||
      AESTHETIC_PROFILES['modern'];

    return {
      preferredShotTypes: aestheticProfile.recommendedShots as ShotType[],
      preferredLighting: aestheticProfile.recommendedLighting as LightingStyle[],
      recommendedPacing: aestheticProfile.motionStyle,
      depthOfFieldPreference: this.determineDepthOfField(styleGuide.visualStyle.overallAesthetic),
      motionBlurPreference: this.determineMotionBlur(aestheticProfile.motionStyle),
    };
  }

  /**
   * Create video-optimized brand DNA from style guide
   */
  createVideoOptimizedBrandDNA(
    baseBrandDNA: BrandDNASnapshot,
    styleGuide: SiteMimicryStyleGuide
  ): BrandDNASnapshot {
    const modifiers = this.generatePromptModifiers(styleGuide);

    return {
      ...baseBrandDNA,
      primaryColor: styleGuide.colorPalette.primary,
      secondaryColor: styleGuide.colorPalette.secondary,
      // Enhance communication style with visual descriptors
      communicationStyle: `${baseBrandDNA.communicationStyle}. Visual style: ${modifiers.styleKeywords.join(', ')}`,
    };
  }

  /**
   * Get processed style guide from cache or process new
   */
  getProcessedStyleGuide(
    styleGuide: SiteMimicryStyleGuide
  ): ProcessedStyleGuide {
    const cached = this.styleGuideCache.get(styleGuide.id);
    if (cached && Date.now() - cached.processedAt.getTime() < this.CACHE_TTL) {
      return cached;
    }

    const processed: ProcessedStyleGuide = {
      styleGuideId: styleGuide.id,
      visualStyleConfig: this.convertToVisualStyleConfig(styleGuide),
      promptModifiers: this.generatePromptModifiers(styleGuide),
      cameraRecommendations: this.recommendCameraSettings(styleGuide),
      processedAt: new Date(),
    };

    this.styleGuideCache.set(styleGuide.id, processed);
    return processed;
  }

  // ============================================================================
  // EXTRACTION METHODS
  // ============================================================================

  /**
   * Extract color palette from crawled data
   */
  private extractColorPalette(
    crawledData: CrawledWebsiteData
  ): SiteMimicryStyleGuide['colorPalette'] {
    const { cssVariables, computedStyles } = crawledData;

    // Try to find CSS variables first
    const primary = cssVariables['--primary-color'] ||
      cssVariables['--brand-color'] ||
      computedStyles.dominantColors[0] ||
      '#1a1a1a';

    const secondary = cssVariables['--secondary-color'] ||
      computedStyles.dominantColors[1] ||
      '#ffffff';

    const accent = cssVariables['--accent-color'] ||
      computedStyles.dominantColors[2] ||
      '#0066cc';

    const background = cssVariables['--background-color'] ||
      computedStyles.backgroundColor ||
      '#ffffff';

    const text = cssVariables['--text-color'] ||
      computedStyles.textColor ||
      '#333333';

    return {
      primary: this.normalizeColor(primary),
      secondary: this.normalizeColor(secondary),
      accent: this.normalizeColor(accent),
      background: this.normalizeColor(background),
      text: this.normalizeColor(text),
      additionalColors: computedStyles.dominantColors.slice(3, 8).map(c => this.normalizeColor(c)),
    };
  }

  /**
   * Extract typography information
   */
  private extractTypography(
    crawledData: CrawledWebsiteData
  ): SiteMimicryStyleGuide['typography'] {
    const { computedStyles } = crawledData;

    return {
      headingFont: computedStyles.headingFont ?? 'Inter',
      bodyFont: computedStyles.bodyFont ?? 'Inter',
      headingWeight: computedStyles.headingWeight ?? 700,
      bodyWeight: computedStyles.bodyWeight ?? 400,
      headingSizes: {
        h1: computedStyles.h1Size ?? 48,
        h2: computedStyles.h2Size ?? 36,
        h3: computedStyles.h3Size ?? 24,
      },
    };
  }

  /**
   * Determine visual style from design patterns
   */
  private determineVisualStyle(
    crawledData: CrawledWebsiteData
  ): SiteMimicryStyleGuide['visualStyle'] {
    const { computedStyles, layoutAnalysis } = crawledData;

    // Analyze border radius patterns
    let borderRadius: SiteMimicryStyleGuide['visualStyle']['borderRadius'] = 'subtle';
    if (computedStyles.averageBorderRadius === 0) {
      borderRadius = 'none';
    } else if (computedStyles.averageBorderRadius > 16) {
      borderRadius = 'rounded';
    } else if (computedStyles.averageBorderRadius > 24) {
      borderRadius = 'pill';
    }

    // Analyze shadow usage
    let shadowStyle: SiteMimicryStyleGuide['visualStyle']['shadowStyle'] = 'subtle';
    if (!computedStyles.usesShadows) {
      shadowStyle = 'none';
    } else if (computedStyles.shadowIntensity > 0.3) {
      shadowStyle = 'heavy';
    } else if (computedStyles.shadowIntensity > 0.15) {
      shadowStyle = 'medium';
    }

    // Determine overall aesthetic
    const overallAesthetic = this.classifyAesthetic(computedStyles, layoutAnalysis);

    return {
      borderRadius,
      shadowStyle,
      imageStyle: computedStyles.imagesBorderRadius > 50 ? 'circular' :
        computedStyles.imagesBorderRadius > 8 ? 'rounded' : 'sharp',
      overallAesthetic,
    };
  }

  /**
   * Classify the overall aesthetic
   */
  private classifyAesthetic(
    computedStyles: CrawledWebsiteData['computedStyles'],
    layoutAnalysis: CrawledWebsiteData['layoutAnalysis']
  ): SiteMimicryStyleGuide['visualStyle']['overallAesthetic'] {
    // Score each aesthetic
    const scores = {
      minimal: 0,
      modern: 0,
      classic: 0,
      bold: 0,
      playful: 0,
    };

    // Minimal indicators
    if (layoutAnalysis.whitespaceRatio > 0.5) {scores.minimal += 2;}
    if (computedStyles.colorCount < 5) {scores.minimal += 1;}
    if (computedStyles.averageBorderRadius < 4) {scores.minimal += 1;}

    // Modern indicators
    if (computedStyles.usesGradients) {scores.modern += 2;}
    if (computedStyles.headingWeight >= 600) {scores.modern += 1;}
    if (computedStyles.usesShadows && computedStyles.shadowIntensity < 0.2) {scores.modern += 1;}

    // Classic indicators
    if (computedStyles.headingFont.includes('serif')) {scores.classic += 2;}
    if (computedStyles.colorSaturation < 0.5) {scores.classic += 1;}
    if (!computedStyles.usesGradients) {scores.classic += 1;}

    // Bold indicators
    if (computedStyles.colorContrast > 7) {scores.bold += 2;}
    if (computedStyles.headingWeight >= 800) {scores.bold += 1;}
    if (computedStyles.colorSaturation > 0.7) {scores.bold += 1;}

    // Playful indicators
    if (computedStyles.averageBorderRadius > 16) {scores.playful += 2;}
    if (computedStyles.colorCount > 8) {scores.playful += 1;}
    if (computedStyles.colorSaturation > 0.6) {scores.playful += 1;}

    // Find highest score
    return Object.entries(scores).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0] as SiteMimicryStyleGuide['visualStyle']['overallAesthetic'];
  }

  /**
   * Extract motion preferences from CSS animations
   */
  private extractMotionPreferences(
    crawledData: CrawledWebsiteData
  ): SiteMimicryStyleGuide['motionPreferences'] {
    const { animationAnalysis } = crawledData;

    let animationSpeed: 'slow' | 'normal' | 'fast' = 'normal';
    if (animationAnalysis.averageDuration > 500) {
      animationSpeed = 'slow';
    } else if (animationAnalysis.averageDuration < 200) {
      animationSpeed = 'fast';
    }

    let transitionStyle: 'fade' | 'slide' | 'scale' | 'none' = 'fade';
    if (animationAnalysis.commonTransitions.includes('transform')) {
      transitionStyle = 'slide';
    } else if (animationAnalysis.commonTransitions.includes('scale')) {
      transitionStyle = 'scale';
    } else if (!animationAnalysis.hasAnimations) {
      transitionStyle = 'none';
    }

    return {
      animationSpeed,
      transitionStyle,
      microInteractions: animationAnalysis.hasMicroInteractions,
    };
  }

  /**
   * Discover brand assets from crawled data
   */
  private discoverBrandAssets(
    crawledData: CrawledWebsiteData
  ): SiteMimicryStyleGuide['discoveredAssets'] {
    return {
      logoUrl: crawledData.assets.logoUrl,
      faviconUrl: crawledData.assets.faviconUrl,
      heroImageUrls: crawledData.assets.heroImages.slice(0, 5),
      iconStyle: crawledData.assets.iconStyle,
    };
  }

  /**
   * Calculate extraction confidence scores
   */
  private calculateExtractionConfidence(params: {
    colorPalette: SiteMimicryStyleGuide['colorPalette'];
    typography: SiteMimicryStyleGuide['typography'];
    visualStyle: SiteMimicryStyleGuide['visualStyle'];
  }): SiteMimicryStyleGuide['extractionConfidence'] {
    // Color confidence - higher if we found CSS variables
    const colorConfidence = params.colorPalette.primary !== '#1a1a1a' ? 0.9 : 0.6;

    // Typography confidence - higher if we found specific fonts
    const typographyConfidence = params.typography.headingFont !== 'Inter' ? 0.85 : 0.5;

    // Overall confidence
    const overall = (colorConfidence + typographyConfidence) / 2;

    return {
      colors: colorConfidence,
      typography: typographyConfidence,
      overall,
    };
  }

  // ============================================================================
  // CONVERSION METHODS
  // ============================================================================

  /**
   * Map color palette to video color grading parameters
   */
  private mapColorPaletteToGrading(
    colorPalette: SiteMimicryStyleGuide['colorPalette'],
    aestheticProfile: AestheticProfile
  ): {
    exposure: number;
    contrast: number;
    saturation: number;
    temperature: number;
    tint: number;
    highlights: number;
    shadows: number;
    vibrance: number;
  } {
    // Analyze color warmth
    const primaryHsl = this.hexToHsl(colorPalette.primary);
    const isWarm = primaryHsl.h > 0 && primaryHsl.h < 60 || primaryHsl.h > 300;

    // Determine temperature based on color analysis
    const temperature = isWarm ? 10 : primaryHsl.h > 180 ? -10 : 0;

    return {
      exposure: 0,
      contrast: aestheticProfile.contrastLevel,
      saturation: aestheticProfile.colorSaturation,
      temperature,
      tint: 0,
      highlights: 0,
      shadows: 0.03,
      vibrance: aestheticProfile.colorSaturation - 1,
    };
  }

  /**
   * Select LUT based on aesthetic
   */
  private selectLUTForAesthetic(
    aesthetic: SiteMimicryStyleGuide['visualStyle']['overallAesthetic']
  ): string {
    const lutMap: Record<string, string> = {
      minimal: 'corporate-clean',
      modern: 'tech-modern',
      classic: 'natural-balanced',
      bold: 'cinema-contrast',
      playful: 'vibrant-pop',
    };

    return lutMap[aesthetic] || 'natural-balanced';
  }

  /**
   * Determine logo position based on aesthetic
   */
  private determineLogoPosition(
    aesthetic: SiteMimicryStyleGuide['visualStyle']['overallAesthetic']
  ): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
    // Bold and modern prefer bottom-right
    // Classic prefers top-right
    // Minimal and playful prefer bottom-left
    const positionMap: Record<string, 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = {
      minimal: 'bottom-left',
      modern: 'bottom-right',
      classic: 'top-right',
      bold: 'bottom-right',
      playful: 'bottom-left',
    };

    return positionMap[aesthetic] || 'bottom-right';
  }

  /**
   * Determine if film grain should be added
   */
  private shouldAddFilmGrain(
    aesthetic: SiteMimicryStyleGuide['visualStyle']['overallAesthetic']
  ): boolean {
    // Only classic and bold aesthetics typically benefit from film grain
    return aesthetic === 'classic' || aesthetic === 'bold';
  }

  /**
   * Generate color description for prompts
   */
  private generateColorDescription(
    colorPalette: SiteMimicryStyleGuide['colorPalette']
  ): string {
    const primaryHsl = this.hexToHsl(colorPalette.primary);

    // Determine color family
    let colorFamily = 'neutral';
    if (primaryHsl.s > 30) {
      if (primaryHsl.h < 30 || primaryHsl.h > 330) {colorFamily = 'red';}
      else if (primaryHsl.h < 60) {colorFamily = 'orange';}
      else if (primaryHsl.h < 90) {colorFamily = 'yellow';}
      else if (primaryHsl.h < 150) {colorFamily = 'green';}
      else if (primaryHsl.h < 210) {colorFamily = 'cyan';}
      else if (primaryHsl.h < 270) {colorFamily = 'blue';}
      else if (primaryHsl.h < 330) {colorFamily = 'purple';}
    }

    const warmth = primaryHsl.h > 0 && primaryHsl.h < 60 || primaryHsl.h > 300 ? 'warm' : 'cool';

    return `${warmth} ${colorFamily} tones with ${colorPalette.primary} accents`;
  }

  /**
   * Generate environment suggestions based on aesthetic
   */
  private generateEnvironmentSuggestions(
    aesthetic: SiteMimicryStyleGuide['visualStyle']['overallAesthetic']
  ): string[] {
    const suggestions: Record<string, string[]> = {
      minimal: ['clean white studio', 'minimalist office', 'simple backdrop'],
      modern: ['contemporary workspace', 'tech lab', 'urban setting'],
      classic: ['traditional office', 'library setting', 'wood-paneled room'],
      bold: ['dramatic studio', 'industrial space', 'high contrast environment'],
      playful: ['colorful studio', 'creative workspace', 'outdoor setting'],
    };

    return suggestions[aesthetic] || suggestions['modern'];
  }

  /**
   * Determine depth of field preference
   */
  private determineDepthOfField(
    aesthetic: SiteMimicryStyleGuide['visualStyle']['overallAesthetic']
  ): 'shallow' | 'medium' | 'deep' {
    const dofMap: Record<string, 'shallow' | 'medium' | 'deep'> = {
      minimal: 'shallow',
      modern: 'medium',
      classic: 'medium',
      bold: 'shallow',
      playful: 'deep',
    };

    return dofMap[aesthetic] || 'medium';
  }

  /**
   * Determine motion blur preference
   */
  private determineMotionBlur(motionStyle: string): 'none' | 'subtle' | 'moderate' | 'heavy' {
    const blurMap: Record<string, 'none' | 'subtle' | 'moderate' | 'heavy'> = {
      slow: 'none',
      medium: 'subtle',
      fast: 'moderate',
      dynamic: 'subtle',
    };

    return blurMap[motionStyle] || 'subtle';
  }

  /**
   * Enhance compiled prompt with style modifiers
   */
  private enhanceCompiledPrompt(
    basePrompt: string,
    modifiers: PromptModifiers
  ): string {
    const additions = [
      modifiers.colorDescription,
      `${modifiers.motionSpeed} pacing`,
      ...modifiers.styleKeywords.slice(0, 2),
    ];

    return `${basePrompt}, ${additions.join(', ')}`;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Normalize color to hex format
   */
  private normalizeColor(color: string): string {
    if (color.startsWith('#')) {
      return color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    }

    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    return color;
  }

  /**
   * Convert hex to HSL
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return { h: 0, s: 0, l: 0 };
    }

    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Clear style guide cache
   */
  clearCache(): void {
    this.styleGuideCache.clear();
  }
}

// ============================================================================
// HELPER INTERFACES
// ============================================================================

interface AestheticProfile {
  name: string;
  characteristics: string[];
  recommendedLighting: string[];
  recommendedShots: string[];
  colorSaturation: number;
  contrastLevel: number;
  motionStyle: string;
}

interface CrawledWebsiteData {
  pageTitle?: string;
  cssVariables: Record<string, string>;
  computedStyles: {
    dominantColors: string[];
    backgroundColor: string;
    textColor: string;
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    bodyWeight: number;
    h1Size: number;
    h2Size: number;
    h3Size: number;
    averageBorderRadius: number;
    imagesBorderRadius: number;
    usesShadows: boolean;
    shadowIntensity: number;
    usesGradients: boolean;
    colorCount: number;
    colorSaturation: number;
    colorContrast: number;
  };
  layoutAnalysis: {
    whitespaceRatio: number;
    gridBased: boolean;
    symmetrical: boolean;
  };
  animationAnalysis: {
    hasAnimations: boolean;
    averageDuration: number;
    commonTransitions: string[];
    hasMicroInteractions: boolean;
  };
  assets: {
    logoUrl?: string;
    faviconUrl?: string;
    heroImages: string[];
    iconStyle?: string;
  };
}

interface ProcessedStyleGuide {
  styleGuideId: string;
  visualStyleConfig: VisualStyleConfig;
  promptModifiers: PromptModifiers;
  cameraRecommendations: CameraRecommendations;
  processedAt: Date;
}

interface PromptModifiers {
  colorDescription: string;
  lightingRecommendations: string[];
  recommendedShotTypes: ShotType[];
  styleKeywords: string[];
  motionSpeed: string;
  brandColorHex: string;
  environmentSuggestions: string[];
}

interface CameraRecommendations {
  preferredShotTypes: ShotType[];
  preferredLighting: LightingStyle[];
  recommendedPacing: string;
  depthOfFieldPreference: 'shallow' | 'medium' | 'deep';
  motionBlurPreference: 'none' | 'subtle' | 'moderate' | 'heavy';
}

// ============================================================================
// EXPORTS
// ============================================================================

export const styleGuideIntegrator = StyleGuideIntegrator.getInstance();

/**
 * Extract style guide from crawled website data
 */
export function extractStyleGuide(
  sourceUrl: string,
  crawledData: CrawledWebsiteData
): SiteMimicryStyleGuide {
  return styleGuideIntegrator.extractStyleGuide(sourceUrl, crawledData);
}

/**
 * Convert style guide to visual config for video engine
 */
export function convertToVisualStyleConfig(
  styleGuide: SiteMimicryStyleGuide
): VisualStyleConfig {
  return styleGuideIntegrator.convertToVisualStyleConfig(styleGuide);
}

/**
 * Generate prompt modifiers from style guide
 */
export function generatePromptModifiers(
  styleGuide: SiteMimicryStyleGuide
): PromptModifiers {
  return styleGuideIntegrator.generatePromptModifiers(styleGuide);
}

/**
 * Enhance visual prompt with style guide
 */
export function enhancePromptWithStyleGuide(
  basePrompt: VisualPrompt,
  styleGuide: SiteMimicryStyleGuide
): VisualPrompt {
  return styleGuideIntegrator.enhancePromptWithStyleGuide(basePrompt, styleGuide);
}

/**
 * Get camera recommendations from style guide
 */
export function recommendCameraSettings(
  styleGuide: SiteMimicryStyleGuide
): CameraRecommendations {
  return styleGuideIntegrator.recommendCameraSettings(styleGuide);
}

// Export types
export type { CrawledWebsiteData, ProcessedStyleGuide, PromptModifiers, CameraRecommendations };
