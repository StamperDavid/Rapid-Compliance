/**
 * Brand Kit Types
 *
 * Visual identity configuration applied to all video output —
 * logo watermark, brand colors, caption fonts, and intro/outro templates.
 */

// ============================================================================
// Logo
// ============================================================================

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface BrandLogo {
  /** Firebase Storage URL for uploaded logo (PNG/SVG) */
  url: string;
  /** Corner placement on video output */
  position: LogoPosition;
  /** Opacity 0.0-1.0 (default 0.7) */
  opacity: number;
  /** Scale relative to video width 0.05-0.25 (default 0.1 = 10% of video width) */
  scale: number;
}

// ============================================================================
// Colors
// ============================================================================

export interface BrandColors {
  /** Primary brand color (hex) — used for caption backgrounds, accents */
  primary: string;
  /** Secondary brand color (hex) — used for alternating elements */
  secondary: string;
  /** Accent color (hex) — used for highlights, CTAs */
  accent: string;
}

// ============================================================================
// Typography
// ============================================================================

export type BrandFontFamily =
  | 'Inter'
  | 'Roboto'
  | 'Open Sans'
  | 'Montserrat'
  | 'Poppins'
  | 'Lato'
  | 'Oswald'
  | 'Raleway'
  | 'Playfair Display'
  | 'Source Code Pro';

export const BRAND_FONT_OPTIONS: readonly BrandFontFamily[] = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Lato',
  'Oswald',
  'Raleway',
  'Playfair Display',
  'Source Code Pro',
] as const;

export interface BrandTypography {
  /** Font family for captions and text overlays */
  fontFamily: BrandFontFamily;
  /** Caption text color (hex) — overrides default white */
  captionColor: string;
  /** Caption background color (hex with alpha) — overrides default black */
  captionBackground: string;
}

// ============================================================================
// Intro/Outro Templates
// ============================================================================

export type IntroOutroTemplate =
  | 'fade-logo'      // Simple fade-in of logo over brand color background
  | 'slide-up'       // Logo slides up from bottom
  | 'zoom-pulse'     // Logo pulses/zooms into frame
  | 'minimal-text'   // Company name in brand font on dark bg
  | 'custom';        // User-uploaded video file

export const INTRO_OUTRO_TEMPLATES: readonly { id: IntroOutroTemplate; label: string; description: string }[] = [
  { id: 'fade-logo', label: 'Fade Logo', description: 'Logo fades in over brand-colored background' },
  { id: 'slide-up', label: 'Slide Up', description: 'Logo slides up from the bottom' },
  { id: 'zoom-pulse', label: 'Zoom Pulse', description: 'Logo zooms in with a subtle pulse' },
  { id: 'minimal-text', label: 'Minimal Text', description: 'Company name in your brand font' },
  { id: 'custom', label: 'Custom Upload', description: 'Upload your own intro/outro video' },
] as const;

export interface BrandIntroOutro {
  /** Intro template type */
  introTemplate: IntroOutroTemplate | null;
  /** Custom intro video URL (only if template = 'custom') */
  introCustomUrl: string | null;
  /** Intro duration in seconds (3-5s range) */
  introDuration: number;
  /** Outro template type */
  outroTemplate: IntroOutroTemplate | null;
  /** Custom outro video URL (only if template = 'custom') */
  outroCustomUrl: string | null;
  /** Outro duration in seconds (3-5s range) */
  outroDuration: number;
  /** CTA text displayed in outro (e.g., "Visit salesvelocity.ai") */
  outroCta: string;
}

// ============================================================================
// Full Brand Kit
// ============================================================================

export interface BrandKit {
  /** Whether the brand kit is active (applied to video output) */
  enabled: boolean;
  /** Logo watermark configuration */
  logo: BrandLogo | null;
  /** Brand color palette */
  colors: BrandColors;
  /** Caption/text typography */
  typography: BrandTypography;
  /** Intro/outro configuration */
  introOutro: BrandIntroOutro;
  /** Last update metadata */
  updatedAt: string;
  updatedBy: string;
}

/** Default brand kit for new accounts */
export const DEFAULT_BRAND_KIT: BrandKit = {
  enabled: false,
  logo: null,
  colors: {
    primary: '#F59E0B',   // amber-500
    secondary: '#1E293B', // slate-800
    accent: '#10B981',    // emerald-500
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
  updatedAt: new Date().toISOString(),
  updatedBy: '',
};
