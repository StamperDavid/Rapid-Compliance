/**
 * Widget Content Type Definitions
 * Proper TypeScript interfaces for all widget data structures
 */

// Base widget content
export interface BaseWidgetContent {
  [key: string]: unknown;
}

// Text-based widgets
export interface HeadingContent extends BaseWidgetContent {
  text: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  level?: number;
}

export interface TextContent extends BaseWidgetContent {
  content: string;
}

export interface ButtonContent extends BaseWidgetContent {
  text: string;
  url?: string;
  color?: string;
  openInNewTab?: boolean;
  disabled?: boolean;
  expanded?: boolean;
}

export interface LinkContent extends BaseWidgetContent {
  text: string;
  url: string;
  openInNewTab?: boolean;
  newTab?: boolean;
}

// Media widgets
export interface ImageContent extends BaseWidgetContent {
  src: string;
  alt: string;
  caption?: string;
}

export interface VideoContent extends BaseWidgetContent {
  url: string;
  provider: 'youtube' | 'vimeo' | 'custom';
}

// Layout widgets
export interface SpacerContent extends BaseWidgetContent {
  height: string;
}

export interface DividerContent extends BaseWidgetContent {
  thickness?: string;
  color?: string;
}

// Hero and CTA
export interface HeroContent extends BaseWidgetContent {
  heading: string;
  subheading?: string;
  buttonText?: string;
  buttonUrl?: string;
  backgroundImage?: string;
}

export interface CTAContent extends BaseWidgetContent {
  heading: string;
  text?: string;
  subheading?: string;
  buttonText: string;
  buttonUrl?: string;
}

// Complex widgets
export interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
}

export interface FeaturesContent extends BaseWidgetContent {
  features: FeatureItem[];
}

export interface PricingPlan {
  name: string;
  price: string | number;
  period?: string;
  features: string[];
  featured?: boolean;
  buttonText?: string;
  buttonUrl?: string;
}

export interface PricingContent extends BaseWidgetContent {
  plans: PricingPlan[];
}

export interface TestimonialContent extends BaseWidgetContent {
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
}

export interface StatItem {
  number: string | number;
  label: string;
}

export interface StatsContent extends BaseWidgetContent {
  stats: StatItem[];
}

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface GalleryContent extends BaseWidgetContent {
  images: GalleryImage[];
  columns?: number;
  gap?: string;
}

export interface LogoItem {
  src: string;
  alt: string;
}

export interface LogoGridContent extends BaseWidgetContent {
  logos: LogoItem[];
}

// Form widgets
export interface ContactFormContent extends BaseWidgetContent {
  submitText?: string;
}

export interface NewsletterContent extends BaseWidgetContent {
  heading: string;
  placeholder?: string;
  buttonText?: string;
}

// Social and interactive
export interface SocialIcon {
  platform: string;
  url: string;
}

export interface SocialIconsContent extends BaseWidgetContent {
  icons: SocialIcon[];
}

export interface IconBoxContent extends BaseWidgetContent {
  icon: string;
  title: string;
  description: string;
}

// Advanced widgets
export interface HTMLContent extends BaseWidgetContent {
  html: string;
}

export interface CodeContent extends BaseWidgetContent {
  code: string;
}

export interface ModalContent extends BaseWidgetContent {
  buttonText: string;
  buttonColor?: string;
  title?: string;
}

export interface TabItem {
  title: string;
  content: string;
}

export interface TabsContent extends BaseWidgetContent {
  tabs: TabItem[];
}

export interface AccordionItem {
  title: string;
  content: string;
}

export interface AccordionContent extends BaseWidgetContent {
  items: AccordionItem[];
}

// Union type for all widget contents
export type WidgetContent =
  | HeadingContent
  | TextContent
  | ButtonContent
  | LinkContent
  | ImageContent
  | VideoContent
  | SpacerContent
  | DividerContent
  | HeroContent
  | CTAContent
  | FeaturesContent
  | PricingContent
  | TestimonialContent
  | StatsContent
  | GalleryContent
  | LogoGridContent
  | ContactFormContent
  | NewsletterContent
  | SocialIconsContent
  | IconBoxContent
  | HTMLContent
  | CodeContent
  | ModalContent
  | TabsContent
  | AccordionContent
  | BaseWidgetContent;

// Type guard helpers
export function isHeadingContent(data: unknown): data is HeadingContent {
  return typeof data === 'object' && data !== null && 'text' in data;
}

export function isImageContent(data: unknown): data is ImageContent {
  return typeof data === 'object' && data !== null && 'src' in data && 'alt' in data;
}

export function isFeaturesContent(data: unknown): data is FeaturesContent {
  return typeof data === 'object' && data !== null && 'features' in data && Array.isArray((data as FeaturesContent).features);
}

export function isPricingContent(data: unknown): data is PricingContent {
  return typeof data === 'object' && data !== null && 'plans' in data && Array.isArray((data as PricingContent).plans);
}
