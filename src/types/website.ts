/**
 * Website Builder Types
 * Multi-tenant architecture - all data scoped to organizationId
 */

export interface SiteConfig {
  id: string;
  organizationId: string; // CRITICAL: Always present for isolation
  
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
  organizationId: string; // CRITICAL: Isolation

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
  
  // Settings
  fullWidth?: boolean;
  maxWidth?: number;
  
  // Metadata
  name?: string; // For editor reference
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

export interface AnimationConfig {
  type: 'fade' | 'slide' | 'zoom' | 'bounce' | 'none';
  duration?: number; // ms
  delay?: number; // ms
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

export interface BlogPost {
  id: string;
  organizationId: string; // CRITICAL: Isolation
  
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
  organizationId: string; // CRITICAL: Isolation
  
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
  organizationId: string; // CRITICAL: Isolation
  
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
  organizationId?: string; // Optional - null = platform template, set = custom template
  
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
  organizationId: string; // CRITICAL: One domain = one org
  
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

