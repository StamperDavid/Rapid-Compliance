/**
 * Website Builder Types
 * Penthouse architecture for SalesVelocity.ai
 */

export interface SiteConfig {
  id: string;
  
  // Domain settings
  subdomain: string; // e.g., "acme" → acme.yourplatform.com
  customDomain?: string; // e.g., "www.acme.com"
  customDomainVerified: boolean;
  sslEnabled: boolean;
  
  // SEO
  seo: SitewideSEO;
  
  // Analytics
  analytics?: AnalyticsConfig;
  
  // Status
  status: 'draft' | 'published' | 'suspended';
  publishedAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SitewideSEO {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  favicon?: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  canonicalUrl?: string;
  /** AI bot access control — keys are bot user-agent names, values are allow/block */
  aiBotAccess?: Record<string, boolean>;
}

export interface AnalyticsConfig {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  hotjarId?: string;
  customScripts?: string[]; // Head/body injection
}

export interface Page {
  id: string;

  // Basic info
  slug: string; // URL path
  title: string;

  // Content (drag-drop page builder)
  content: PageSection[];

  // SEO
  seo: PageSEO;

  // Styling
  customCSS?: string;

  // Status
  status?: 'draft' | 'published' | 'scheduled';
  publishedAt?: string;
  scheduledFor?: string;
  isPublished?: boolean;

  // Version control
  version?: number;
  lastPublishedVersion?: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastEditedBy: string;
}

export interface PageSEO {
  metaTitle?: string; // Defaults to page title
  metaDescription?: string;
  metaKeywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  customMetaTags?: Array<{ name: string; content: string }>;
}

export interface PageSection {
  id: string;
  type: 'section'; // Container for widgets
  
  // Layout
  columns: PageColumn[];
  
  // Styling
  backgroundColor?: string;
  backgroundImage?: string;
  padding?: Spacing;
  margin?: Spacing;
  
  // Responsive
  mobileLayout?: 'stack' | 'hide' | 'custom';

  // Multi-column layout (editor "Layout" controls). The renderer already flexes
  // columns side-by-side (`flex: column.width`); these refine that band:
  //  - `columnGap`     → horizontal gap between columns, in px.
  //  - `verticalAlign` → cross-axis alignment of the columns (CSS `align-items`).
  columnGap?: number;
  verticalAlign?: 'flex-start' | 'center' | 'flex-end';

  // Section shape dividers (Elementor-style). Optional + additive: when unset,
  // the section renders byte-identically to before. Top/bottom independently
  // configured. Rendered as absolutely-positioned SVG overlays pinned to the
  // section's top/bottom edges by the ResponsiveRenderer.
  shapeDividerTop?: ShapeDivider;
  shapeDividerBottom?: ShapeDivider;

  // Settings
  fullWidth?: boolean;
  maxWidth?: number;

  // Metadata
  name?: string; // For editor reference
}

/** The catalog of built-in section shape dividers (`'none'` = no divider). */
export type ShapeDividerType =
  | 'none' | 'wave' | 'waves' | 'tilt' | 'triangle' | 'curve' | 'arrow'
  | 'mountains' | 'clouds' | 'zigzag' | 'split' | 'book' | 'drops' | 'pyramids';

/**
 * A single section shape divider (top or bottom edge). All visual knobs are
 * optional and fall back to sensible defaults at render time.
 */
export interface ShapeDivider {
  type: ShapeDividerType;
  color?: string;      // fill; defaults to a sensible token if unset
  height?: number;     // px (SVG height)
  width?: number;      // % (>= 100), for stretched shapes
  flip?: boolean;      // mirror horizontally
  invert?: boolean;    // flip the shape vertically (peak<->valley)
  front?: boolean;     // render above section content (z-index)
}

export interface PageColumn {
  id: string;
  width: number; // Percentage or flex value
  widgets: Widget[];
}

export interface Widget {
  id: string;
  type: WidgetType;

  // Widget-specific data
  data: WidgetData;

  // Styling
  style?: WidgetStyle;

  /**
   * Nested child widgets. ONLY layout/container widgets (`container` / `row` /
   * `column` — see `isContainerType`) use this; leaf widgets leave it undefined.
   *
   * Backward-compat + live safety: legacy container widgets that predate true
   * nesting have `children === undefined` and render exactly as before (a styled
   * empty box). A container becomes a real nestable flex/grid box only once
   * `children` is an array (even an empty `[]`). This keeps the public marketing
   * site byte-identical for any content authored before this feature.
   */
  children?: Widget[];

  // Responsive overrides
  responsive?: {
    mobile?: Partial<WidgetStyle>;
    tablet?: Partial<WidgetStyle>;
  };

  // Settings
  hidden?: boolean;
  animation?: AnimationConfig;
}

export type WidgetType =
  // Layout
  | 'container'
  | 'row'
  | 'column'
  | 'spacer'
  | 'divider'
  // Content
  | 'heading'
  | 'text'
  | 'button'
  | 'link'
  | 'image'
  | 'video'
  | 'hero'
  | 'features'
  | 'pricing'
  | 'testimonial'
  | 'cta'
  | 'stats'
  | 'counter'
  // Interactive
  | 'modal'
  | 'tabs'
  | 'accordion'
  | 'progress'
  | 'faq'
  // Forms
  | 'contact-form'
  | 'newsletter'
  | 'custom-form'
  // Media
  | 'gallery'
  | 'slider'
  | 'icon-box'
  | 'logo-grid'
  // Advanced
  | 'html'
  | 'code'
  | 'map'
  | 'countdown'
  | 'social-icons'
  | 'blog-list'
  | 'blog-post'
  | 'ecommerce';

export interface WidgetData {
  // Varies by widget type
  [key: string]: unknown;
}

export interface WidgetStyle {
  // Layout
  padding?: Spacing;
  margin?: Spacing;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  minHeight?: string;
  display?: 'block' | 'inline-block' | 'flex' | 'grid';
  flexDirection?: 'row' | 'column';
  flexWrap?: 'nowrap' | 'wrap';
  gap?: string;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  
  // Typography
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  
  // Colors
  color?: string;
  backgroundColor?: string;

  // Gradient fills (real Elementor-Pro-class output)
  /**
   * Gradient-colored TEXT. When set on a text-bearing widget
   * (`heading` / `text` / `hero` / `cta`), the element's text is painted with a
   * CSS `linear-gradient` via `background-clip: text` (matching the real site's
   * `bg-gradient-to-r ... bg-clip-text text-transparent` headings, e.g. the
   * purple-gradient "Sales Workforce" words). `color` is ignored when this is
   * present. Example:
   *   textGradient: { from: '#a855f7', to: '#6366f1', angle: 90 }
   */
  textGradient?: GradientStops;
  /**
   * Gradient BACKGROUND fill for the widget box (cards, CTA bands, featured
   * pricing). Expands to a `linear-gradient` `background-image`. A solid
   * `backgroundColor` still paints behind it as a base.
   */
  backgroundGradient?: GradientStops;

  // Borders
  border?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  
  // Effects
  boxShadow?: string;
  opacity?: number;
  transform?: string;
  transition?: string;
  
  // Background
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
}

export interface Spacing {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * Colour stops for a `linear-gradient`, used by `WidgetStyle.textGradient`
 * (gradient text) and `WidgetStyle.backgroundGradient` (gradient fills).
 */
export interface GradientStops {
  /** Starting colour (any CSS colour: hex, rgb, var(), etc.). */
  from: string;
  /** Optional middle colour stop for a three-stop gradient. */
  via?: string;
  /** Ending colour. */
  to: string;
  /** Gradient angle in degrees. Defaults to 90 (left → right). */
  angle?: number;
}

export interface AnimationConfig {
  type: 'fade' | 'slide' | 'zoom' | 'bounce' | 'none';
  duration?: number; // ms
  delay?: number; // ms
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

export interface BlogPost {
  id: string;

  // Basic info
  slug: string;
  title: string;
  excerpt: string;
  
  // Content
  content: PageSection[]; // Same structure as pages
  featuredImage?: string;
  
  // Blog-specific
  author: string; // User ID
  authorName?: string;
  authorAvatar?: string;
  publishedAt?: string;
  categories: string[];
  tags: string[];
  featured: boolean;
  
  // SEO
  seo: PageSEO;
  
  // Status
  status: 'draft' | 'published' | 'scheduled';
  scheduledFor?: string;
  
  // Engagement
  views: number;
  readTime?: number; // minutes
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastEditedBy: string;
}

export interface SiteTheme {
  id: string;

  // Branding
  branding: WebsiteBrandingConfig;
  
  // Colors
  colors: ColorScheme;
  
  // Typography
  typography: TypographyConfig;
  
  // Layout
  layout: WebsiteLayoutConfig;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteBrandingConfig {
  logo?: string; // URL to logo image
  logoLight?: string; // For dark backgrounds
  logoDark?: string; // For light backgrounds
  favicon?: string;
  brandName: string;
  tagline?: string;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface TypographyConfig {
  headingFont: string; // Google Font name or system font
  bodyFont: string;
  
  // Font sizes
  h1Size: string;
  h2Size: string;
  h3Size: string;
  h4Size: string;
  h5Size: string;
  h6Size: string;
  bodySize: string;
  
  // Font weights
  headingWeight: string | number;
  bodyWeight: string | number;
  
  // Line heights
  headingLineHeight: string;
  bodyLineHeight: string;
}

export interface WebsiteLayoutConfig {
  maxWidth: number; // px
  containerPadding: string;
  sectionPadding: string;
  gridGap: string;
  borderRadius: string;
}

export interface Navigation {
  id: string;

  header: NavItem[];
  footer: FooterConfig;
  
  updatedAt: string;
  updatedBy: string;
}

export interface NavItem {
  id: string;
  label: string;
  url: string;
  type: 'page' | 'external' | 'dropdown';
  icon?: string;
  children?: NavItem[];
  newTab?: boolean;
}

export interface FooterConfig {
  columns: FooterColumn[];
  copyright: string;
  socialLinks: SocialLink[];
  showLogo: boolean;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: NavItem[];
}

export interface SocialLink {
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'github' | 'tiktok';
  url: string;
}

export interface PageTemplate {
  id: string;
  
  name: string;
  description: string;
  category: 'business' | 'saas' | 'ecommerce' | 'portfolio' | 'agency' | 'blog' | 'other';
  thumbnail?: string;
  
  // Template content
  content: PageSection[];
  
  // Settings
  isPublic: boolean; // Can other orgs use this?
  isPremium: boolean;
  
  // Metadata
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

export interface CustomDomain {
  id: string; // Domain name (e.g., "www.acme.com")
  
  // Verification
  verified: boolean;
  verificationMethod: 'cname' | 'a-record' | 'txt';
  verificationValue: string;
  verifiedAt?: string;
  
  // SSL
  sslEnabled: boolean;
  sslStatus: 'pending' | 'active' | 'failed';
  sslIssuedAt?: string;
  sslExpiresAt?: string;
  
  // DNS records user must create
  dnsRecords: DNSRecord[];
  
  // Status
  status: 'pending' | 'active' | 'failed' | 'suspended';
  
  // Metadata
  createdAt: string;
  lastCheckedAt: string;
}

export interface DNSRecord {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  value: string;
  status: 'pending' | 'verified' | 'failed';
}

