/**
 * Brand Identity — canonical, unified brand foundation.
 *
 * Single source of truth that unifies the three historically fragmented brand
 * stores into one shape:
 *   1. VOICE  — `BrandDNA` (persisted on the org root doc under `brandDNA`)
 *   2. VISUAL (video)   — `BrandKit` (logo / colors / typography / intro-outro)
 *   3. VISUAL (website) — `GlobalBranding` (full 11-color palette, fonts, name, tagline)
 *
 * This file is ADDITIVE: it does not modify or re-point any existing reader.
 * Existing stores continue to work; this is the forward-looking canonical model.
 */

import type {
  BrandColors,
  BrandIntroOutro,
  BrandLogo,
  BrandTypography,
} from '@/types/brand-kit';
import type { BrandingColors, BrandingFonts } from '@/types/website-editor';

// ============================================================================
// Palette alias
// ============================================================================

/** The full 11-color brand palette (alias of the website editor's `BrandingColors`). */
export type BrandPalette = BrandingColors;

// ============================================================================
// Voice — superset of BrandDNA, every field carried verbatim
// ============================================================================

/**
 * Brand voice — a superset of `BrandDNA` from `brand-dna-service.ts`.
 * Every field of `BrandDNA` is present; `toneOfVoice` is typed as a plain string.
 */
export interface BrandVoice {
  companyDescription: string;
  uniqueValue: string;
  targetAudience: string;
  toneOfVoice: string;
  communicationStyle: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  industry: string;
  competitors: string[];
}

// ============================================================================
// Example assets
// ============================================================================

export interface BrandExampleAsset {
  type: 'social-post' | 'ad' | 'image';
  mediaId?: string;
  url?: string;
  note?: string;
}

// ============================================================================
// Canonical Brand Identity
// ============================================================================

export interface BrandIdentity {
  /** Brand voice (superset of BrandDNA). */
  voice: BrandVoice;
  /** Display company name. */
  companyName: string;
  /** Short tagline / slogan. */
  tagline: string;
  /** Logo watermark configuration (null when none resolved). */
  logo: BrandLogo | null;
  /** Full 11-color brand palette. */
  colors: BrandPalette;
  /** Heading + body fonts. */
  fonts: BrandingFonts;
  /** Caption/text typography for video output. */
  typography: BrandTypography;
  /** Intro/outro configuration for video output. */
  introOutro: BrandIntroOutro;
  /** Example reference assets that exemplify the brand. */
  exampleAssets: BrandExampleAsset[];
  /** Last update metadata. */
  updatedAt: string;
  updatedBy: string;
}

// ============================================================================
// Defaults
// ============================================================================

/**
 * Default canonical brand identity for new accounts.
 *
 * colors.primary/secondary/accent mirror DEFAULT_BRAND_KIT.colors for continuity
 * (amber / slate / emerald); the remaining 8 palette colors are sensible neutrals.
 * typography mirrors DEFAULT_BRAND_KIT.typography. Fonts default to 'Inter'.
 */
export const DEFAULT_BRAND_IDENTITY: BrandIdentity = {
  voice: {
    companyDescription: '',
    uniqueValue: '',
    targetAudience: '',
    toneOfVoice: 'professional',
    communicationStyle: 'Helpful and informative',
    keyPhrases: [],
    avoidPhrases: [],
    industry: '',
    competitors: [],
  },
  companyName: '',
  tagline: '',
  logo: null,
  colors: {
    primary: '#F59E0B', // amber-500   — mirrors DEFAULT_BRAND_KIT.colors.primary
    secondary: '#1E293B', // slate-800  — mirrors DEFAULT_BRAND_KIT.colors.secondary
    accent: '#10B981', // emerald-500  — mirrors DEFAULT_BRAND_KIT.colors.accent
    background: '#FFFFFF',
    surface: '#F8FAFC', // slate-50
    text: '#0F172A', // slate-900
    textMuted: '#64748B', // slate-500
    border: '#E2E8F0', // slate-200
    success: '#10B981', // emerald-500
    warning: '#F59E0B', // amber-500
    error: '#EF4444', // red-500
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  typography: {
    fontFamily: 'Inter',
    captionColor: '#FFFFFF',
    captionBackground: 'rgba(0,0,0,0.6)',
  },
  introOutro: {
    introTemplate: null,
    introCustomUrl: null,
    introDuration: 3,
    outroTemplate: null,
    outroCustomUrl: null,
    outroDuration: 4,
    outroCta: '',
  },
  exampleAssets: [],
  updatedAt: new Date().toISOString(),
  updatedBy: '',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract the 3-color video `BrandColors` from the full 11-color palette.
 * Used to feed the video pipeline (which only cares about primary/secondary/accent).
 */
export function brandColorsFromPalette(p: BrandPalette): BrandColors {
  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
  };
}
