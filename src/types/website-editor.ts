/**
 * Website Editor Types
 * Types for the visual website editor that saves to Firestore
 * These types mirror the original editor's data model and align with
 * what usePageContent() expects from 'platform/website-editor-config'
 */

// ============================================================================
// Element Styles (56 CSS properties)
// ============================================================================

export interface ElementStyles {
  // Layout
  width?: string;
  height?: string;
  minHeight?: string;
  maxWidth?: string;
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  // Flexbox
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  flexWrap?: string;
  flex?: string;
  minWidth?: string;
  // Typography
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textTransform?: string;
  textDecoration?: string;
  // Colors
  color?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundOverlay?: string;
  // Border
  border?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  // Grid
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumn?: string;
  gridRow?: string;
  // Effects
  boxShadow?: string;
  opacity?: string;
  transform?: string;
  transition?: string;
  // Position
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: string;
}

// ============================================================================
// Responsive Styles
// ============================================================================

export interface ResponsiveStyles {
  desktop: ElementStyles;
  tablet?: ElementStyles;
  mobile?: ElementStyles;
}

// ============================================================================
// Widget Elements
// ============================================================================

export interface WidgetElement {
  id: string;
  type: string;
  content?: unknown;
  children?: WidgetElement[];
  styles: ResponsiveStyles;
  settings?: Record<string, unknown>;
}

// ============================================================================
// Page Structure
// ============================================================================

export interface EditorPageSection {
  id: string;
  type: 'section';
  name: string;
  children: WidgetElement[];
  styles: ResponsiveStyles;
  visible: boolean;
}

export interface EditorPage {
  id: string;
  name: string;
  slug: string;
  sections: EditorPageSection[];
  isPublished: boolean;
  isInNav: boolean;
  navOrder: number;
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  // Page Settings
  pageType?: 'content' | 'auth' | 'system';
  template?: string;
}

// ============================================================================
// Global Branding
// ============================================================================

export interface GlobalBranding {
  logoUrl: string;
  logoHeight: number;
  companyName: string;
  tagline: string;
  faviconUrl: string;
  colors: BrandingColors;
  fonts: BrandingFonts;
  borderRadius: string;
}

export interface BrandingColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface BrandingFonts {
  heading: string;
  body: string;
}

// ============================================================================
// Navigation Config
// ============================================================================

export interface NavigationConfig {
  style: 'default' | 'centered' | 'minimal';
  showLogin: boolean;
  showSignup: boolean;
  ctaText: string;
  ctaLink: string;
  sticky: boolean;
  transparent: boolean;
}

// ============================================================================
// Footer Config
// ============================================================================

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface SocialLinkConfig {
  platform: string;
  url: string;
}

export interface EditorFooterConfig {
  columns: FooterColumn[];
  socialLinks: SocialLinkConfig[];
  copyrightText: string;
  showPoweredBy: boolean;
}

// ============================================================================
// Full Website Config (saved to Firestore)
// ============================================================================

export interface WebsiteConfig {
  branding: GlobalBranding;
  pages: EditorPage[];
  navigation: NavigationConfig;
  footer: EditorFooterConfig;
  updatedAt?: string;
}
