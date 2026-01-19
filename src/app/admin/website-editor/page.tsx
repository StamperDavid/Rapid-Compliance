'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link'
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

interface ElementStyles {
  // Layout
  width?: string;
  height?: string;
  minHeight?: string;
  minWidth?: string;
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

interface ResponsiveStyles {
  desktop: ElementStyles;
  tablet?: ElementStyles;
  mobile?: ElementStyles;
}

// Content types for different widgets
type StringContent = string;
type HeroContent = { title?: string; subtitle?: string; buttonText?: string; buttonLink?: string };
type IconBoxContent = { icon?: string; title?: string; text?: string };
type TestimonialContent = { quote?: string; author?: string; role?: string; company?: string; avatar?: string };
type TestimonialSliderContent = { testimonials?: TestimonialContent[] };
type CounterContent = { number?: string | number; suffix?: string; label?: string };
type ProgressBarContent = { label?: string; value?: number };
type NewsletterContent = { placeholder?: string; buttonText?: string };
type FeatureGridContent = { items?: Array<{ icon?: string; title?: string; desc?: string }> };
type StatsContent = { items?: Array<{ value?: string; label?: string }> };
type FAQContent = { items?: Array<{ q?: string; a?: string }> };
type AccordionContent = { items?: Array<{ title?: string; content?: string }> };
type TabsContent = { tabs?: Array<{ title?: string; content?: string }> };
type FormContent = { fields?: Array<{ type?: string; label?: string; placeholder?: string }>; submitText?: string };
type SocialLinksContent = { links?: Array<{ platform?: string; url?: string }> };
type PricingTableContent = { plans?: Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }> };
type ListContent = string[];

type WidgetContent =
  | StringContent
  | HeroContent
  | IconBoxContent
  | TestimonialContent
  | TestimonialSliderContent
  | CounterContent
  | ProgressBarContent
  | NewsletterContent
  | FeatureGridContent
  | StatsContent
  | FAQContent
  | AccordionContent
  | TabsContent
  | FormContent
  | SocialLinksContent
  | PricingTableContent
  | ListContent
  | undefined;

interface WidgetSettings {
  [key: string]: string | number | boolean | string[] | undefined;
  href?: string;
  target?: string;
  src?: string;
  alt?: string;
  type?: string;
  autoplay?: boolean;
  height?: number;
  useSiteLogo?: boolean;
  tag?: string;
  style?: string;
  placeholder?: string;
  options?: string[];
  images?: string[];
  modalId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  language?: string;
  targetDate?: string;
  tweetUrl?: string;
}

interface WidgetElement {
  id: string;
  type: string;
  content?: WidgetContent;
  children?: WidgetElement[];
  styles: ResponsiveStyles;
  settings?: WidgetSettings;
}

interface PageSection {
  id: string;
  type: 'section';
  name: string;
  children: WidgetElement[];
  styles: ResponsiveStyles;
  visible: boolean;
}

interface WebsitePage {
  id: string;
  name: string;
  slug: string;
  sections: PageSection[];
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

interface GlobalBranding {
  logoUrl: string;
  logoHeight: number;
  companyName: string;
  tagline: string;
  faviconUrl: string;
  colors: {
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
  };
  fonts: {
    heading: string;
    body: string;
  };
  borderRadius: string;
}

interface WebsiteConfig {
  branding: GlobalBranding;
  pages: WebsitePage[];
  navigation: {
    style: 'default' | 'centered' | 'minimal';
    showLogin: boolean;
    showSignup: boolean;
    ctaText: string;
    ctaLink: string;
    sticky: boolean;
    transparent: boolean;
  };
  footer: {
    columns: { title: string; links: { label: string; href: string }[] }[];
    socialLinks: { platform: string; url: string }[];
    copyrightText: string;
    showPoweredBy: boolean;
  };
}

// ============================================================================
// WIDGET DEFINITIONS
// ============================================================================

interface WidgetDefinition {
  type: string;
  name: string;
  icon: string;
  category: 'layout' | 'basic' | 'media' | 'content' | 'forms' | 'social' | 'advanced';
  defaultContent?: WidgetContent;
  defaultStyles: ElementStyles;
  defaultSettings?: WidgetSettings;
}

const WIDGET_CATEGORIES = [
  { id: 'layout', name: 'Layout', icon: '📐' },
  { id: 'basic', name: 'Basic', icon: '📝' },
  { id: 'media', name: 'Media', icon: '🖼️' },
  { id: 'content', name: 'Content', icon: '📄' },
  { id: 'forms', name: 'Forms', icon: '📋' },
  { id: 'social', name: 'Social', icon: '🌐' },
  { id: 'advanced', name: 'Advanced', icon: '⚙️' },
];

const WIDGETS: WidgetDefinition[] = [
  // Layout
  { type: 'section', name: 'Section', icon: '▭', category: 'layout', defaultStyles: { padding: '60px 20px', backgroundColor: '#000000' } },
  { type: 'container', name: 'Container', icon: '☐', category: 'layout', defaultStyles: { maxWidth: '1200px', margin: '0 auto', padding: '0 20px' } },
  { type: 'row', name: 'Row', icon: '⬜⬜', category: 'layout', defaultStyles: { display: 'flex', flexWrap: 'wrap', gap: '20px' } },
  { type: 'column', name: 'Column', icon: '▯', category: 'layout', defaultStyles: { display: 'flex', flexDirection: 'column', minWidth: '250px' } },
  { type: 'spacer', name: 'Spacer', icon: '↕️', category: 'layout', defaultStyles: { height: '40px' }, defaultSettings: { height: 40 } },
  { type: 'divider', name: 'Divider', icon: '—', category: 'layout', defaultStyles: { borderBottom: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' } },
  
  // Basic
  { type: 'heading', name: 'Heading', icon: 'H', category: 'basic', defaultContent: 'Heading Text', defaultStyles: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' }, defaultSettings: { tag: 'h2' } },
  { type: 'text', name: 'Text', icon: 'T', category: 'basic', defaultContent: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', defaultStyles: { fontSize: '1rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)' } },
  { type: 'button', name: 'Button', icon: '🔘', category: 'basic', defaultContent: 'Click Me', defaultStyles: { padding: '12px 24px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', display: 'inline-block', textAlign: 'center' }, defaultSettings: { href: '#', target: '_self' } },
  { type: 'link', name: 'Link', icon: '🔗', category: 'basic', defaultContent: 'Learn More →', defaultStyles: { color: '#6366f1', textDecoration: 'none' }, defaultSettings: { href: '#' } },
  { type: 'list', name: 'List', icon: '☰', category: 'basic', defaultContent: ['Item 1', 'Item 2', 'Item 3'], defaultStyles: { color: 'rgba(255,255,255,0.8)' }, defaultSettings: { style: 'bullet' } },
  { type: 'icon', name: 'Icon', icon: '★', category: 'basic', defaultContent: '⚡', defaultStyles: { fontSize: '2rem' } },
  
  // Media
  { type: 'image', name: 'Image', icon: '🖼️', category: 'media', defaultStyles: { maxWidth: '100%', borderRadius: '8px' }, defaultSettings: { src: 'https://placehold.co/800x400', alt: 'Image' } },
  { type: 'video', name: 'Video', icon: '🎬', category: 'media', defaultStyles: { width: '100%', borderRadius: '8px' }, defaultSettings: { src: '', type: 'youtube', autoplay: false } },
  { type: 'gallery', name: 'Gallery', icon: '🖼️🖼️', category: 'media', defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }, defaultSettings: { images: [] } },
  { type: 'icon-box', name: 'Icon Box', icon: '📦', category: 'media', defaultContent: { icon: '🚀', title: 'Feature Title', text: 'Feature description goes here' }, defaultStyles: { textAlign: 'center', padding: '20px' } },
  { type: 'logo', name: 'Logo', icon: '🏷️', category: 'media', defaultStyles: { height: '40px' }, defaultSettings: { useSiteLogo: true } },
  
  // Content
  { type: 'hero', name: 'Hero', icon: '🎯', category: 'content', defaultContent: { title: 'Hero Title', subtitle: 'Hero subtitle text goes here', buttonText: 'Get Started', buttonLink: '/signup' }, defaultStyles: { textAlign: 'center', padding: '100px 20px' } },
  { type: 'feature-grid', name: 'Feature Grid', icon: '⊞', category: 'content', defaultContent: { items: [{ icon: '⚡', title: 'Fast', desc: 'Lightning fast' }, { icon: '🔒', title: 'Secure', desc: 'Enterprise security' }, { icon: '🎯', title: 'Accurate', desc: 'Precision results' }] }, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' } },
  { type: 'pricing-table', name: 'Pricing Table', icon: '💰', category: 'content', defaultContent: { plans: [{ name: 'Starter', price: '$29', features: ['Feature 1', 'Feature 2'] }, { name: 'Pro', price: '$99', features: ['All Starter', 'Feature 3'], highlighted: true }] }, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' } },
  { type: 'testimonial', name: 'Testimonial', icon: '💬', category: 'content', defaultContent: { quote: 'This product changed our business!', author: 'John Doe', role: 'CEO', company: 'Acme Inc', avatar: '' }, defaultStyles: { padding: '30px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px' } },
  { type: 'testimonial-slider', name: 'Testimonial Slider', icon: '💬◀▶', category: 'content', defaultContent: { testimonials: [] }, defaultStyles: {} },
  { type: 'faq', name: 'FAQ', icon: '❓', category: 'content', defaultContent: { items: [{ q: 'Question 1?', a: 'Answer 1' }, { q: 'Question 2?', a: 'Answer 2' }] }, defaultStyles: {} },
  { type: 'accordion', name: 'Accordion', icon: '▼', category: 'content', defaultContent: { items: [{ title: 'Section 1', content: 'Content 1' }] }, defaultStyles: {} },
  { type: 'tabs', name: 'Tabs', icon: '📑', category: 'content', defaultContent: { tabs: [{ title: 'Tab 1', content: 'Content 1' }] }, defaultStyles: {} },
  { type: 'counter', name: 'Counter', icon: '🔢', category: 'content', defaultContent: { number: 1000, suffix: '+', label: 'Happy Customers' }, defaultStyles: { textAlign: 'center' } },
  { type: 'progress-bar', name: 'Progress Bar', icon: '▰▰▱', category: 'content', defaultContent: { label: 'Progress', value: 75 }, defaultStyles: {} },
  { type: 'cta', name: 'CTA Block', icon: '📢', category: 'content', defaultContent: { title: 'Ready to get started?', subtitle: 'Join thousands of happy customers', buttonText: 'Start Free Trial', buttonLink: '/signup' }, defaultStyles: { textAlign: 'center', padding: '60px 20px', backgroundColor: '#6366f1', borderRadius: '12px' } },
  { type: 'stats', name: 'Stats', icon: '📊', category: 'content', defaultContent: { items: [{ value: '10K+', label: 'Users' }, { value: '99%', label: 'Uptime' }, { value: '24/7', label: 'Support' }] }, defaultStyles: { display: 'flex', justifyContent: 'space-around', textAlign: 'center' } },
  
  // Forms
  { type: 'form', name: 'Form', icon: '📝', category: 'forms', defaultContent: { fields: [{ type: 'text', label: 'Name', placeholder: 'Your name' }, { type: 'email', label: 'Email', placeholder: 'you@example.com' }], submitText: 'Submit' }, defaultStyles: { maxWidth: '500px' } },
  { type: 'input', name: 'Input Field', icon: '▭', category: 'forms', defaultStyles: { width: '100%', padding: '12px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff' }, defaultSettings: { type: 'text', placeholder: 'Enter text...' } },
  { type: 'textarea', name: 'Text Area', icon: '▭▭', category: 'forms', defaultStyles: { width: '100%', padding: '12px', minHeight: '120px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff' }, defaultSettings: { placeholder: 'Enter message...' } },
  { type: 'select', name: 'Select', icon: '▾', category: 'forms', defaultStyles: { width: '100%', padding: '12px' }, defaultSettings: { options: ['Option 1', 'Option 2'] } },
  { type: 'checkbox', name: 'Checkbox', icon: '☑', category: 'forms', defaultContent: 'I agree to the terms', defaultStyles: {} },
  { type: 'newsletter', name: 'Newsletter', icon: '📧', category: 'forms', defaultContent: { placeholder: 'Enter your email', buttonText: 'Subscribe' }, defaultStyles: { display: 'flex', gap: '10px' } },
  
  // Social
  { type: 'social-icons', name: 'Social Icons', icon: '🌐', category: 'social', defaultContent: { links: [{ platform: 'twitter', url: '#' }, { platform: 'linkedin', url: '#' }] }, defaultStyles: { display: 'flex', gap: '15px' } },
  { type: 'share-buttons', name: 'Share Buttons', icon: '📤', category: 'social', defaultStyles: { display: 'flex', gap: '10px' } },
  { type: 'twitter-embed', name: 'Twitter Embed', icon: '𝕏', category: 'social', defaultSettings: { tweetUrl: '' }, defaultStyles: {} },
  
  // Advanced
  { type: 'html', name: 'Custom HTML', icon: '</>', category: 'advanced', defaultContent: '<div>Custom HTML here</div>', defaultStyles: {} },
  { type: 'code', name: 'Code Block', icon: '{ }', category: 'advanced', defaultContent: 'const hello = "world";', defaultStyles: { backgroundColor: '#1a1a2e', padding: '20px', borderRadius: '8px', fontFamily: 'monospace' }, defaultSettings: { language: 'javascript' } },
  { type: 'map', name: 'Map', icon: '🗺️', category: 'advanced', defaultSettings: { address: '', lat: 0, lng: 0 }, defaultStyles: { height: '300px', borderRadius: '8px' } },
  { type: 'countdown', name: 'Countdown', icon: '⏱️', category: 'advanced', defaultSettings: { targetDate: '' }, defaultStyles: { display: 'flex', justifyContent: 'center', gap: '20px' } },
  { type: 'alert', name: 'Alert/Notice', icon: '⚠️', category: 'advanced', defaultContent: 'Important notice here', defaultStyles: { padding: '15px 20px', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid #6366f1', borderRadius: '8px' }, defaultSettings: { type: 'info' } },
  { type: 'modal-trigger', name: 'Modal Trigger', icon: '🪟', category: 'advanced', defaultContent: 'Open Modal', defaultStyles: {}, defaultSettings: { modalId: '' } },
];

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_BRANDING: GlobalBranding = {
  logoUrl: '/logo.png',
  logoHeight: 48,
  companyName: 'SalesVelocity.ai',
  tagline: 'Accelerate Your Growth',
  faviconUrl: '/favicon.ico',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#10b981',
    background: '#000000',
    surface: '#0a0a0a',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.1)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  borderRadius: '8px',
};

const DEFAULT_CONFIG: WebsiteConfig = {
  branding: DEFAULT_BRANDING,
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '/',
      isPublished: true,
      isInNav: false,
      navOrder: 0,
      sections: [
        {
          id: 'home-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 80px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'hero-badge', type: 'text', content: '🚀 Complete Sales Platform - Not Just a Chatbot', styles: { desktop: { fontSize: '0.875rem', color: '#a78bfa', marginBottom: '1.5rem', fontWeight: '600', backgroundColor: 'rgba(99,102,241,0.1)', padding: '8px 16px', borderRadius: '999px', border: '1px solid rgba(99,102,241,0.3)', display: 'inline-block' } } },
            { id: 'hero-h1', type: 'heading', content: 'Replace Your Entire Sales Stack', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '1.5rem', lineHeight: '1.1' } }, settings: { tag: 'h1' } },
            { id: 'hero-p1', type: 'text', content: 'AI sales agents + CRM + automation + lead generation + email sequences + social media AI.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.9)', maxWidth: '700px', margin: '0 auto 1rem' } } },
            { id: 'hero-p2', type: 'text', content: 'Stop paying for 6 different tools. Get everything in one place with transparent, usage-based pricing.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', maxWidth: '700px', margin: '0 auto 2rem' } } },
            { id: 'hero-stats', type: 'stats', content: { items: [{ value: '$400-1,250', label: 'Per Month (All Features)' }, { value: '💡 BYOK', label: 'Zero AI Markup' }, { value: 'Records', label: 'Simple Pricing' }] }, styles: { desktop: { display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' } } },
            { id: 'hero-btn', type: 'button', content: 'Start Free Trial →', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
          ],
        },
        {
          id: 'home-whats-included',
          type: 'section',
          name: 'What is Included',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(17,24,39,1)', textAlign: 'center' } },
          children: [
            { id: 'inc-h2', type: 'heading', content: 'What\'s Included in Every Plan', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'inc-p', type: 'text', content: 'The $400 user gets the same features as the $1,250 user. You only pay based on CRM records stored.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '3rem', maxWidth: '700px', margin: '0 auto 3rem' } } },
            { id: 'inc-grid', type: 'feature-grid', content: { items: [
              { icon: '🤖', title: 'Custom AI Sales Agent', desc: 'Fully trainable on your business' },
              { icon: '📧', title: 'Unlimited Email Sequences', desc: 'No sending limits' },
              { icon: '📱', title: 'Multi-Channel Outreach', desc: 'Email, LinkedIn, SMS' },
              { icon: '📊', title: 'Full CRM Suite', desc: 'Custom schemas' },
              { icon: '⚡', title: 'Workflow Automation', desc: 'Build any workflow' },
              { icon: '🛒', title: 'Built-in E-Commerce Engine', desc: 'Cart, checkout, payments' },
              { icon: '🔍', title: 'Lead Scraper & Enrichment', desc: 'Find prospects' },
              { icon: '🎨', title: 'White-Label Branding', desc: 'Your brand' },
              { icon: '🔑', title: 'API Access', desc: 'Full API' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'home-cost-comparison',
          type: 'section',
          name: 'Stop Juggling Tools',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(17,24,39,1)', textAlign: 'center' } },
          children: [
            { id: 'comp-h2', type: 'heading', content: 'Stop Juggling 6 Different Tools', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'comp-p', type: 'text', content: 'Replace your "Frankenstein stack" with one unified platform', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '3rem' } } },
            { id: 'comp-note', type: 'text', content: 'Comparison: Old way ($722-4,397/mo for 6 tools) vs Our platform ($400-1,250/mo for everything). Save $322-3,147 per month.', styles: { desktop: { fontSize: '1rem', color: 'rgba(99,102,241,0.9)', padding: '2rem', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '12px', maxWidth: '800px', margin: '0 auto', border: '2px solid rgba(99,102,241,0.3)' } } },
          ],
        },
        {
          id: 'home-byok',
          type: 'section',
          name: 'BYOK Cost Transparency',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(17,24,39,1)', textAlign: 'center' } },
          children: [
            { id: 'byok-h2', type: 'heading', content: 'BYOK: We Don\'t Markup Your AI Costs', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'byok-p', type: 'text', content: 'Most AI platforms mark up tokens by 300-500%. We don\'t. Connect your OpenRouter key and pay at cost.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' } } },
            { id: 'byok-rec', type: 'text', content: '💡 We recommend OpenRouter - one key gives you access to GPT-4, Claude, Gemini, and 200+ models', styles: { desktop: { fontSize: '1rem', color: 'rgba(99,102,241,0.9)', padding: '1rem 2rem', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '8px', display: 'inline-block', marginBottom: '2rem' } } },
            { id: 'byok-savings', type: 'text', content: 'Typical AI Platform: $1,900/mo (platform + marked up AI) vs Our Platform: $750/mo (platform + AI at cost) = Save $1,150/month', styles: { desktop: { fontSize: '1rem', color: 'rgba(99,102,241,0.9)', padding: '2rem', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '12px', maxWidth: '900px', margin: '0 auto', border: '2px solid rgba(99,102,241,0.3)' } } },
          ],
        },
        {
          id: 'home-tools-replaced',
          type: 'section',
          name: 'Tools Replaced',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'tools-h2', type: 'heading', content: 'One Platform. Six Tools Replaced.', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'tools-p', type: 'text', content: 'Everything you need for modern sales, all in one place', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '3rem' } } },
            { id: 'tools-grid', type: 'feature-grid', content: { items: [
              { icon: '🔍', title: 'Lead Intelligence', desc: 'Replaces Apollo/ZoomInfo - Lead scraper, enrichment, prospect database' },
              { icon: '🤖', title: 'Custom AI Sales Agent', desc: 'Replaces Air AI/11x - Fully trainable, custom memory, learns your business' },
              { icon: '📊', title: 'Full CRM Suite', desc: 'Replaces HubSpot/Pipedrive - Custom schemas, pipeline, tracking' },
              { icon: '📱', title: 'Multi-Channel Outreach', desc: 'Outreach automation - Email sequences, LinkedIn messaging, SMS campaigns' },
              { icon: '⚡', title: 'Automation Engine', desc: 'Replaces Zapier/Make - Workflows, sequences, integrations' },
              { icon: '🛒', title: 'Built-in E-Commerce Engine', desc: 'Commerce platform - Product catalog, cart, checkout, payments, orders' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', maxWidth: '1200px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'home-cta',
          type: 'section',
          name: 'CTA',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#6366f1', textAlign: 'center' } },
          children: [
            { id: 'cta-h2', type: 'heading', content: 'Ready to 10x Your Sales?', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' } }, settings: { tag: 'h2' } },
            { id: 'cta-p', type: 'text', content: 'Join hundreds of businesses using AI to close more deals', styles: { desktop: { fontSize: '1.125rem', opacity: '0.9', marginBottom: '2rem' } } },
            { id: 'cta-btn', type: 'button', content: 'Start Your Free Trial →', styles: { desktop: { padding: '16px 32px', backgroundColor: '#ffffff', color: '#000000', borderRadius: '8px', fontWeight: '600' } }, settings: { href: '/signup' } },
          ],
        },
      ],
    },
    {
      id: 'features',
      name: 'Features',
      slug: '/features',
      isPublished: true,
      isInNav: true,
      navOrder: 1,
      metaTitle: 'Features - SalesVelocity.ai',
      metaDescription: 'A complete AI-powered sales platform with CRM, automation, and e-commerce built in.',
      sections: [
        {
          id: 'features-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'f-h1', type: 'heading', content: 'Everything You Need to Sell More, Faster', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'f-p', type: 'text', content: 'A complete AI-powered sales platform with CRM, automation, and e-commerce built in', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', maxWidth: '700px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'features-ai-agent',
          type: 'section',
          name: 'AI Agent Feature',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'f1-badge', type: 'text', content: '🔥 Flagship Feature', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' } } },
            { id: 'f1-h2', type: 'heading', content: 'Train Your Own AI Sales Agent', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'f1-p', type: 'text', content: 'Not a generic chatbot. A custom AI agent trained specifically on YOUR business, products, and sales process. It learns your brand voice, handles objections your way, and gets smarter with every conversation.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '600px' } } },
            { id: 'f1-list', type: 'feature-grid', content: { items: [
              { icon: '📄', title: 'Upload Knowledge', desc: 'Product docs, pricing sheets, FAQs' },
              { icon: '🎯', title: 'Train in Sandbox', desc: 'Practice real scenarios before going live' },
              { icon: '📈', title: 'Continuous Learning', desc: 'Gets smarter from real conversations' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' } } },
          ],
        },
        {
          id: 'features-crm',
          type: 'section',
          name: 'CRM Feature',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#0a0a0a' } },
          children: [
            { id: 'f2-badge', type: 'text', content: '📊 Powerful CRM', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' } } },
            { id: 'f2-h2', type: 'heading', content: 'CRM That Actually Fits Your Business', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'f2-p', type: 'text', content: 'Create custom objects for anything - not just leads and deals. Track shipments, appointments, inventory, or whatever your business needs. Fully customizable with 20+ field types.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '600px' } } },
            { id: 'f2-list', type: 'feature-grid', content: { items: [
              { icon: '🎨', title: 'Custom Objects', desc: 'For your industry' },
              { icon: '🔗', title: 'Relationships', desc: 'Link data together' },
              { icon: '📐', title: 'Formula Fields', desc: 'Like Excel, but smarter' },
              { icon: '📋', title: 'Multiple Views', desc: 'Kanban, Calendar, Table' },
              { icon: '⚡', title: 'Workflows', desc: 'Automation built-in' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' } } },
          ],
        },
        {
          id: 'features-ecommerce',
          type: 'section',
          name: 'E-Commerce Feature',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'f3-badge', type: 'text', content: '🛒 E-Commerce', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' } } },
            { id: 'f3-h2', type: 'heading', content: 'Sell Products Directly', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'f3-p', type: 'text', content: 'Turn on e-commerce with one click. Your AI agent can show products, answer questions, and complete purchases - all in the same conversation.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '600px' } } },
            { id: 'f3-list', type: 'feature-grid', content: { items: [
              { icon: '🛍️', title: 'In-Chat Cart', desc: 'Shopping in conversation' },
              { icon: '💳', title: 'Payments', desc: 'Stripe, PayPal built-in' },
              { icon: '📦', title: 'Inventory', desc: 'Track stock levels' },
              { icon: '🚚', title: 'Orders', desc: 'Fulfillment tracking' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' } } },
          ],
        },
        {
          id: 'features-grid',
          type: 'section',
          name: 'All Features Grid',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(0,0,0,0.3)' } },
          children: [
            { id: 'fg-h2', type: 'heading', content: 'Plus Everything Else You\'d Expect', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '3rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'fg-grid', type: 'feature-grid', content: { items: [
              { icon: '🎨', title: 'White-Labeling', desc: 'Your brand, your colors, your domain' },
              { icon: '🔗', title: 'Integrations', desc: 'Slack, Stripe, Gmail, Calendar, and more' },
              { icon: '📧', title: 'Email Campaigns', desc: 'Drip campaigns and nurture sequences' },
              { icon: '📱', title: 'Mobile Ready', desc: 'Works perfectly on all devices' },
              { icon: '🔒', title: 'Enterprise Security', desc: 'SOC 2, GDPR, CCPA compliant' },
              { icon: '🌍', title: 'Multi-Language', desc: 'Serve customers in any language' },
              { icon: '📞', title: 'SMS Support', desc: 'Send SMS messages automatically' },
              { icon: '🎯', title: 'Lead Scoring', desc: 'AI-powered lead qualification' },
              { icon: '⏱️', title: '99.9% Uptime', desc: 'Always available when you need it' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'features-cta',
          type: 'section',
          name: 'CTA',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'fc-h2', type: 'heading', content: 'Start Your 14-Day Free Trial', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'fc-p', type: 'text', content: 'No credit card required. Full access to all features.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' } } },
            { id: 'fc-btn', type: 'button', content: 'Get Started Free →', styles: { desktop: { padding: '16px 48px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
          ],
        },
      ],
    },
    {
      id: 'pricing',
      name: 'Pricing',
      slug: '/pricing',
      isPublished: true,
      isInNav: true,
      navOrder: 2,
      metaTitle: 'Pricing - SalesVelocity.ai',
      metaDescription: 'Success-linked pricing based on CRM records stored. Pay for what you store, not what you use. All features included at every tier. Start with a 14-day free trial.',
      sections: [
        {
          id: 'pricing-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 40px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'pr-badge', type: 'text', content: '🤝 Usage-Based Pricing', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem', fontWeight: '600' } } },
            { id: 'pr-h1', type: 'heading', content: 'One Platform. All Features. Always.', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'pr-p1', type: 'text', content: 'You pay based on CRM records stored. Everything else is unlimited.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', maxWidth: '600px', margin: '0 auto 1rem', fontWeight: '500' } } },
            { id: 'pr-p2', type: 'text', content: 'No feature gating. No usage limits. No AI token markup. Your pricing automatically scales with your business needs.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', maxWidth: '700px', margin: '0 auto 2rem' } } },
            { id: 'pr-byok-hero', type: 'icon-box', content: { icon: '💡', title: 'BYOK: Zero AI Token Markup', text: 'Connect your own OpenAI, Anthropic, or OpenRouter API keys. Pay raw market rates—we don\'t markup your AI costs. 100% transparent.' }, styles: { desktop: { display: 'inline-block', padding: '24px 32px', backgroundColor: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: '16px', maxWidth: '700px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'pricing-breakdown',
          type: 'section',
          name: 'Pricing Breakdown',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'breakdown-h2', type: 'heading', content: 'How Pricing Works', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'breakdown-p', type: 'text', content: 'Your monthly price is determined by the number of CRM records you store', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' } } },
            { id: 'pricing-table-simple', type: 'text', content: '0-100 records: $400/month • 101-250 records: $650/month • 251-500 records: $1,000/month • 501-1,000 records: $1,250/month • 1,000+ records: Custom pricing', styles: { desktop: { fontSize: '1.125rem', lineHeight: '2', color: '#ffffff', maxWidth: '800px', margin: '0 auto', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' } } },
          ],
        },
        {
          id: 'pricing-features',
          type: 'section',
          name: 'All Features Included',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'features-h2', type: 'heading', content: 'Everything Included. Always.', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'features-p', type: 'text', content: 'Every tier gets the complete platform with zero restrictions', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' } } },
            { id: 'features-list', type: 'feature-grid', content: { items: [
              { icon: '✓', title: 'AI Sales Agents', desc: 'Unlimited' },
              { icon: '✓', title: 'Lead Scraper & Enrichment', desc: 'Full access' },
              { icon: '✓', title: 'Email Sequences', desc: 'Unlimited' },
              { icon: '✓', title: 'Multi-Channel Outreach', desc: 'Email, LinkedIn, SMS' },
              { icon: '✓', title: 'Social Media AI', desc: 'Auto-posting included' },
              { icon: '✓', title: 'Full CRM Suite', desc: 'Custom schemas' },
              { icon: '✓', title: 'Workflow Automation', desc: 'No limits' },
              { icon: '✓', title: 'E-commerce Integration', desc: 'Built-in' },
              { icon: '✓', title: 'API Access', desc: 'Full API' },
              { icon: '✓', title: 'White-Label Options', desc: 'Your brand' },
              { icon: '✓', title: 'Email & Chat Support', desc: 'All tiers' },
              { icon: '💡', title: 'BYOK', desc: 'No AI markup' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', maxWidth: '1200px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'pricing-faq',
          type: 'section',
          name: 'FAQ',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(0,0,0,0.2)' } },
          children: [
            { id: 'faq-h2', type: 'heading', content: 'Frequently Asked Questions', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '3rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'pr-faq', type: 'faq', content: { items: [
              { q: 'How does the 14-day free trial work?', a: "Sign up with your email, credit card required. You will get full access to all features for 14 days. Cancel anytime before the trial ends to avoid charges." },
              { q: 'How does pricing scale with my CRM records?', a: "You pay based on how many records you store in your CRM. As you grow beyond a tier limit, your billing automatically adjusts to the next tier. All features remain the same at every tier." },
              { q: 'What counts as a record?', a: "A record is any contact, lead, company, or custom object you create in your CRM. Deleted records do not count toward your limit." },
              { q: 'Can I change tiers later?', a: "Absolutely! Upgrade or downgrade anytime based on your record count. We prorate the difference on upgrades." },
              { q: 'What happens if I exceed my record limit?', a: "We will notify you when you reach 80% capacity. You can upgrade before hitting the limit, or we will automatically move you to the next tier and adjust billing." },
              { q: 'What is Bring Your Own Keys (BYOK)?', a: "You can connect your own OpenAI, Anthropic, or other AI provider API keys and pay them directly at raw market rates. We do not markup AI costs - that is your direct relationship with the AI provider." },
              { q: 'Do you offer discounts for nonprofits?', a: "Yes! We offer 50% off for registered nonprofits and early-stage startups. Contact us with proof." },
              { q: 'What payment methods do you accept?', a: "All major credit cards via Stripe. Enterprise customers (1000+ records) can arrange invoicing." },
            ] }, styles: { desktop: { maxWidth: '800px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'pricing-cta',
          type: 'section',
          name: 'CTA',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'cta-h2', type: 'heading', content: 'Ready to Get Started?', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'cta-p1', type: 'text', content: 'Sign up once. No plan selection needed. Your pricing automatically adjusts as you grow.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' } } },
            { id: 'cta-p2', type: 'text', content: '14-day free trial • Credit card required • Cancel anytime', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' } } },
            { id: 'cta-btn', type: 'button', content: 'Start Your Free Trial →', styles: { desktop: { padding: '16px 48px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
            { id: 'cta-note', type: 'text', content: 'Pricing starts at $400/month for 0-100 records. All features + BYOK (no AI markup) included from day one.', styles: { desktop: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginTop: '1.5rem' } } },
          ],
        },
      ],
    },
    {
      id: 'demo',
      name: 'Demo',
      slug: '/demo',
      isPublished: true,
      isInNav: true,
      navOrder: 3,
      metaTitle: 'Live AI Demo - SalesVelocity.ai',
      metaDescription: 'See our AI sales agent in action. Chat with a live AI agent and experience what your customers will get.',
      sections: [
        {
          id: 'demo-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'demo-badge', type: 'text', content: '🤖 Live AI Demo', styles: { desktop: { fontSize: '0.875rem', color: '#a78bfa', marginBottom: '1.5rem', fontWeight: '600', backgroundColor: 'rgba(99,102,241,0.1)', padding: '8px 16px', borderRadius: '999px', border: '1px solid rgba(99,102,241,0.3)', display: 'inline-block' } } },
            { id: 'demo-h1', type: 'heading', content: 'See Our AI Agent In Action', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'demo-p1', type: 'text', content: 'This is a live AI sales agent powered by our platform. Go ahead - ask it anything.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.9)', maxWidth: '700px', margin: '0 auto 1rem' } } },
            { id: 'demo-p2', type: 'text', content: 'This is exactly what your customers will experience when you deploy your own trained AI agent.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', maxWidth: '700px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'demo-cta',
          type: 'section',
          name: 'CTA',
          visible: true,
          styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'demo-cta-p', type: 'text', content: 'Impressed? Your AI agent can be even smarter - trained specifically on YOUR business.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' } } },
            { id: 'demo-cta-btn', type: 'button', content: 'Create Your Own AI Agent →', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
          ],
        },
      ],
    },
    {
      id: 'about',
      name: 'About',
      slug: '/about',
      isPublished: true,
      isInNav: true,
      navOrder: 4,
      metaTitle: 'About Us - SalesVelocity.ai',
      metaDescription: 'Building the future of AI-powered sales automation.',
      sections: [
        {
          id: 'about-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000' } },
          children: [
            { id: 'ab-h1', type: 'heading', content: 'About Us', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'ab-p', type: 'text', content: 'Building the future of AI-powered sales automation', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
          ],
        },
        {
          id: 'about-mission',
          type: 'section',
          name: 'Mission',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'ab-h2', type: 'heading', content: 'Our Mission', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'ab-text1', type: 'text', content: 'We believe every business deserves access to world-class sales automation, regardless of size or budget. SalesVelocity.ai democratizes cutting-edge technology, making it accessible to startups and enterprises alike.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' } } },
            { id: 'ab-text2', type: 'text', content: 'By combining artificial intelligence with proven sales methodologies, we\'re helping businesses close more deals, nurture better relationships, and grow faster.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)' } } },
          ],
        },
        {
          id: 'about-story',
          type: 'section',
          name: 'Our Story',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
          children: [
            { id: 'ab-h3', type: 'heading', content: 'Our Story', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'ab-story1', type: 'text', content: 'Founded in 2024, SalesVelocity.ai emerged from a simple observation: most businesses struggle with lead qualification, follow-ups, and sales process consistency. Traditional CRMs require too much manual work. AI chatbots are too generic.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' } } },
            { id: 'ab-story2', type: 'text', content: 'We built something different - an AI sales agent that learns YOUR business, speaks in YOUR voice, and follows YOUR process. It\'s like hiring your best sales rep and cloning them to work 24/7.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)' } } },
          ],
        },
        {
          id: 'about-values',
          type: 'section',
          name: 'Our Values',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'ab-h4', type: 'heading', content: 'Our Values', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'ab-values', type: 'feature-grid', content: { items: [
              { icon: '🚀', title: 'Innovation First', desc: 'We push boundaries with AI technology while keeping the user experience simple.' },
              { icon: '🤝', title: 'Customer Success', desc: 'Your growth is our success. We\'re invested in helping you close more deals.' },
              { icon: '🔒', title: 'Privacy & Security', desc: 'Your data is yours. Enterprise-grade security, never sell your information.' },
              { icon: '💡', title: 'Transparency', desc: 'No hidden fees, no dark patterns. What you see is what you get.' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '800px' } } },
          ],
        },
        {
          id: 'about-cta',
          type: 'section',
          name: 'CTA',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
          children: [
            { id: 'ab-cta-h', type: 'heading', content: 'Join Us', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'ab-cta-p', type: 'text', content: 'We\'re always looking for talented people who are passionate about AI, sales, and helping businesses grow.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '1.5rem' } } },
            { id: 'ab-cta-btn', type: 'button', content: 'Get in Touch →', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600' } }, settings: { href: '/contact' } },
          ],
        },
      ],
    },
    {
      id: 'contact',
      name: 'Contact',
      slug: '/contact',
      isPublished: true,
      isInNav: true,
      navOrder: 4,
      metaTitle: 'Contact Us - SalesVelocity.ai',
      metaDescription: 'Have questions? We\'d love to hear from you. Get in touch with our team.',
      sections: [
        {
          id: 'contact-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'ct-h1', type: 'heading', content: 'Get in Touch', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'ct-p', type: 'text', content: 'Have questions? We\'d love to hear from you.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
          ],
        },
        {
          id: 'contact-info',
          type: 'section',
          name: 'Contact Methods',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'ct-grid', type: 'feature-grid', content: { items: [
              { icon: '📧', title: 'Email Us', desc: 'support@salesvelocity.ai - We respond within 24 hours' },
              { icon: '💬', title: 'Live Chat', desc: 'Available 9am-6pm EST - Click the chat widget' },
              { icon: '📚', title: 'Documentation', desc: 'Check our comprehensive guides at /docs' },
              { icon: '🎯', title: 'Sales Inquiries', desc: 'sales@salesvelocity.ai - For enterprise plans' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '800px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'contact-form-note',
          type: 'section',
          name: 'Form Note',
          visible: true,
          styles: { desktop: { padding: '40px 20px', backgroundColor: '#0a0a0a', textAlign: 'center' } },
          children: [
            { id: 'ct-form-h', type: 'heading', content: 'Send Us a Message', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'ct-form-p', type: 'text', content: 'Fill out the contact form on this page and we\'ll get back to you as soon as possible.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)' } } },
          ],
        },
      ],
    },
    {
      id: 'blog',
      name: 'Blog',
      slug: '/blog',
      isPublished: true,
      isInNav: false,
      navOrder: 10,
      metaTitle: 'Blog - SalesVelocity.ai',
      metaDescription: 'Insights, guides, and news about AI-powered sales automation.',
      sections: [
        {
          id: 'blog-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'bl-h1', type: 'heading', content: 'Blog', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'bl-p', type: 'text', content: 'Insights, guides, and news about AI-powered sales', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
          ],
        },
        {
          id: 'blog-posts',
          type: 'section',
          name: 'Blog Posts',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'bl-posts', type: 'feature-grid', content: { items: [
              { icon: '🤖', title: 'How AI is Transforming Sales in 2024', desc: 'Discover the latest trends in AI-powered sales automation.' },
              { icon: '📚', title: '10 Best Practices for Training Your AI Agent', desc: 'Learn how to get the most out of your AI sales agent.' },
              { icon: '📈', title: 'Case Study: 300% Conversion Increase', desc: 'How one company tripled their lead conversion rate.' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'blog-subscribe',
          type: 'section',
          name: 'Subscribe',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a', textAlign: 'center' } },
          children: [
            { id: 'bl-sub-h', type: 'heading', content: 'More Posts Coming Soon', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'bl-sub-p', type: 'text', content: 'Subscribe to our newsletter to get notified when we publish new articles.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)' } } },
          ],
        },
      ],
    },
    {
      id: 'docs',
      name: 'Documentation',
      slug: '/docs',
      isPublished: true,
      isInNav: false,
      navOrder: 11,
      metaTitle: 'Documentation - SalesVelocity.ai',
      metaDescription: 'Everything you need to know about using SalesVelocity.ai.',
      sections: [
        {
          id: 'docs-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'dc-h1', type: 'heading', content: 'Documentation', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'dc-p', type: 'text', content: 'Everything you need to know about using SalesVelocity.ai', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' } } },
          ],
        },
        {
          id: 'docs-quick',
          type: 'section',
          name: 'Quick Links',
          visible: true,
          styles: { desktop: { padding: '40px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'dc-quick', type: 'feature-grid', content: { items: [
              { icon: '📖', title: 'Guides', desc: 'Step-by-step tutorials' },
              { icon: '🎥', title: 'Video Tutorials', desc: 'Watch and learn' },
              { icon: '💻', title: 'API Reference', desc: 'Developer documentation' },
              { icon: '💬', title: 'Support', desc: 'Get help from our team' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', maxWidth: '900px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'docs-categories',
          type: 'section',
          name: 'Categories',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
          children: [
            { id: 'dc-cats', type: 'feature-grid', content: { items: [
              { icon: '🚀', title: 'Getting Started', desc: 'Quick Start Guide, Account Setup, Training Your First Agent' },
              { icon: '📊', title: 'CRM & Sales', desc: 'Managing Leads, Deal Pipeline, Workflow Automation' },
              { icon: '🤖', title: 'AI Configuration', desc: 'Agent Personality, Knowledge Base, Advanced Prompting' },
              { icon: '🔗', title: 'Integrations', desc: 'Stripe, Google Calendar, Slack, API Documentation' },
              { icon: '📈', title: 'Analytics', desc: 'Dashboard Overview, Custom Reports, Conversion Tracking' },
              { icon: '⚡', title: 'Advanced Topics', desc: 'White-Label, Custom Schemas, Multi-Tenant Setup' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'docs-help',
          type: 'section',
          name: 'Help',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'dc-help-h', type: 'heading', content: 'Can\'t Find What You\'re Looking For?', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'dc-help-p', type: 'text', content: 'Our support team is here to help. Get in touch and we\'ll respond within 24 hours.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' } } },
            { id: 'dc-help-btn', type: 'button', content: 'Contact Support →', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600' } }, settings: { href: '/contact' } },
          ],
        },
      ],
    },
    {
      id: 'privacy',
      name: 'Privacy Policy',
      slug: '/privacy',
      isPublished: true,
      isInNav: false,
      navOrder: 20,
      metaTitle: 'Privacy Policy - SalesVelocity.ai',
      metaDescription: 'How we collect, use, and protect your personal information.',
      sections: [
        {
          id: 'priv-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 40px', backgroundColor: '#000000' } },
          children: [
            { id: 'pv-h1', type: 'heading', content: 'Privacy Policy', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'pv-date', type: 'text', content: 'Last updated: December 2024', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.5)' } } },
          ],
        },
        {
          id: 'priv-content',
          type: 'section',
          name: 'Content',
          visible: true,
          styles: { desktop: { padding: '40px 20px 80px', backgroundColor: '#000000' } },
          children: [
            { id: 'pv-intro', type: 'text', content: 'At SalesVelocity.ai, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
            { id: 'pv-h2-1', type: 'heading', content: 'Information We Collect', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'pv-p1', type: 'text', content: 'We collect information you provide directly, including account details, business information, and content you upload to train your AI agents. We also automatically collect usage data, device information, and cookies.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
            { id: 'pv-h2-2', type: 'heading', content: 'How We Use Your Information', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'pv-p2', type: 'text', content: 'We use your information to provide and improve our services, personalize your experience, communicate with you, and ensure platform security. We never sell your personal data to third parties.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
            { id: 'pv-contact', type: 'text', content: 'Questions? Contact us at privacy@salesvelocity.ai', styles: { desktop: { fontSize: '1rem', color: '#6366f1' } } },
          ],
        },
      ],
    },
    {
      id: 'terms',
      name: 'Terms of Service',
      slug: '/terms',
      isPublished: true,
      isInNav: false,
      navOrder: 21,
      metaTitle: 'Terms of Service - SalesVelocity.ai',
      metaDescription: 'Terms and conditions for using the SalesVelocity.ai platform.',
      sections: [
        {
          id: 'terms-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 40px', backgroundColor: '#000000' } },
          children: [
            { id: 'tm-h1', type: 'heading', content: 'Terms of Service', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'tm-date', type: 'text', content: 'Last updated: December 2024', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.5)' } } },
          ],
        },
        {
          id: 'terms-content',
          type: 'section',
          name: 'Content',
          visible: true,
          styles: { desktop: { padding: '40px 20px 80px', backgroundColor: '#000000' } },
          children: [
            { id: 'tm-intro', type: 'text', content: 'Welcome to SalesVelocity.ai. By accessing or using our platform, you agree to be bound by these Terms of Service. Please read them carefully.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
            { id: 'tm-h2-1', type: 'heading', content: 'Account Terms', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'tm-p1', type: 'text', content: 'You must be 18 years or older to use this service. You are responsible for maintaining the security of your account and password. You may not use the service for any illegal or unauthorized purpose.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
            { id: 'tm-h2-2', type: 'heading', content: 'Acceptable Use', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'tm-p2', type: 'text', content: 'You agree not to misuse our services, interfere with other users, attempt unauthorized access, or use the platform to send spam or malicious content.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
            { id: 'tm-contact', type: 'text', content: 'Questions? Contact us at legal@salesvelocity.ai', styles: { desktop: { fontSize: '1rem', color: '#6366f1' } } },
          ],
        },
      ],
    },
    {
      id: 'security',
      name: 'Security',
      slug: '/security',
      isPublished: true,
      isInNav: false,
      navOrder: 22,
      pageType: 'content',
      metaTitle: 'Security & Compliance - SalesVelocity.ai',
      metaDescription: 'Enterprise-grade security to protect your data. SOC 2, GDPR, and CCPA compliant.',
      sections: [
        {
          id: 'sec-hero',
          type: 'section',
          name: 'Hero',
          visible: true,
          styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'sc-h1', type: 'heading', content: 'Security & Compliance', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
            { id: 'sc-p', type: 'text', content: 'Enterprise-grade security to protect your data', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
          ],
        },
        {
          id: 'sec-features',
          type: 'section',
          name: 'Security Features',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
          children: [
            { id: 'sc-grid', type: 'feature-grid', content: { items: [
              { icon: '🔒', title: 'Data Encryption', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256)' },
              { icon: '🏢', title: 'SOC 2 Compliant', desc: 'Infrastructure meets SOC 2 Type II compliance standards' },
              { icon: '🛡️', title: 'GDPR Ready', desc: 'Fully compliant with GDPR, CCPA, and other privacy regulations' },
              { icon: '🔐', title: 'Access Controls', desc: 'MFA, role-based permissions, and IP whitelisting' },
              { icon: '🔍', title: 'Regular Audits', desc: 'Quarterly security audits by certified third-party firms' },
              { icon: '💾', title: 'Automated Backups', desc: 'Daily backups with 30-day retention and point-in-time recovery' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '900px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'sec-stack',
          type: 'section',
          name: 'Security Stack',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
          children: [
            { id: 'sc-stack-h', type: 'heading', content: 'Our Security Stack', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'sc-stack-grid', type: 'feature-grid', content: { items: [
              { icon: '☁️', title: 'Infrastructure', desc: 'Google Cloud Platform, Firebase Security Rules, DDoS Protection, WAF' },
              { icon: '💻', title: 'Application', desc: 'Rate Limiting, Input Validation, XSS Protection, CSRF Tokens' },
              { icon: '👁️', title: 'Monitoring', desc: '24/7 Security Monitoring, Intrusion Detection, Audit Logging' },
            ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' } } },
          ],
        },
        {
          id: 'sec-report',
          type: 'section',
          name: 'Report Issue',
          visible: true,
          styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000', textAlign: 'center' } },
          children: [
            { id: 'sc-rep-h', type: 'heading', content: 'Report a Security Issue', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
            { id: 'sc-rep-p', type: 'text', content: 'We take security seriously. If you discover a vulnerability, please report it responsibly.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' } } },
            { id: 'sc-rep-btn', type: 'button', content: 'Report Vulnerability →', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600' } }, settings: { href: 'mailto:security@salesvelocity.ai' } },
          ],
        },
      ],
    },
    // Auth Pages
    {
      id: 'login',
      name: 'Login',
      slug: '/login',
      isPublished: true,
      isInNav: false,
      navOrder: 30,
      pageType: 'auth',
      metaTitle: 'Login - SalesVelocity.ai',
      metaDescription: 'Sign in to your SalesVelocity.ai account',
      sections: [],
    },
    {
      id: 'signup',
      name: 'Sign Up',
      slug: '/signup',
      isPublished: true,
      isInNav: false,
      navOrder: 31,
      pageType: 'auth',
      metaTitle: 'Sign Up - SalesVelocity.ai',
      metaDescription: 'Create your SalesVelocity.ai account and start your free trial',
      sections: [],
    },
    {
      id: 'forgot-password',
      name: 'Forgot Password',
      slug: '/forgot-password',
      isPublished: true,
      isInNav: false,
      navOrder: 32,
      pageType: 'auth',
      metaTitle: 'Reset Password - SalesVelocity.ai',
      metaDescription: 'Reset your SalesVelocity.ai password',
      sections: [],
    },
  ],
  navigation: {
    style: 'default',
    showLogin: true,
    showSignup: true,
    ctaText: 'Start Free Trial',
    ctaLink: '/signup',
    sticky: true,
    transparent: false,
  },
  footer: {
    columns: [
      { title: 'Product', links: [{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Documentation', href: '/docs' }] },
      { title: 'Company', links: [{ label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }] },
      { title: 'Legal', links: [{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Security', href: '/security' }] },
    ],
    socialLinks: [
      { platform: 'Twitter', url: 'https://twitter.com' },
      { platform: 'LinkedIn', url: 'https://linkedin.com' },
    ],
    copyrightText: '© {year} {company}. All rights reserved.',
    showPoweredBy: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = () => `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createWidget = (type: string): WidgetElement => {
  const def = WIDGETS.find(w => w.type === type);
  return {
    id: generateId(),
    type,
    content: def?.defaultContent,
    styles: { desktop: { ...def?.defaultStyles } },
    settings: { ...def?.defaultSettings },
    children: ['section', 'container', 'row', 'column'].includes(type) ? [] : undefined,
  };
};

// ============================================================================
// STYLE EDITOR COMPONENT
// ============================================================================

interface StyleField {
  key: string;
  label: string;
  type: 'text' | 'color' | 'select';
  placeholder?: string;
  options?: string[];
}

interface StyleGroup {
  name: string;
  fields: StyleField[];
}

function StyleEditor({ 
  styles, 
  onChange, 
  breakpoint 
}: { 
  styles: ResponsiveStyles; 
  onChange: (styles: ResponsiveStyles) => void;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
}) {
  const currentStyles = (styles[breakpoint] ?? styles.desktop) ?? {};
  
  const updateStyle = (key: string, value: string) => {
    onChange({
      ...styles,
      [breakpoint]: { ...currentStyles, [key]: value },
    });
  };

  const styleGroups: StyleGroup[] = [
    {
      name: 'Spacing',
      fields: [
        { key: 'padding', label: 'Padding', type: 'text' as const, placeholder: '20px' },
        { key: 'margin', label: 'Margin', type: 'text' as const, placeholder: '0' },
        { key: 'gap', label: 'Gap', type: 'text' as const, placeholder: '20px' },
      ],
    },
    {
      name: 'Size',
      fields: [
        { key: 'width', label: 'Width', type: 'text' as const, placeholder: 'auto' },
        { key: 'height', label: 'Height', type: 'text' as const, placeholder: 'auto' },
        { key: 'maxWidth', label: 'Max Width', type: 'text' as const, placeholder: 'none' },
        { key: 'minHeight', label: 'Min Height', type: 'text' as const, placeholder: 'auto' },
      ],
    },
    {
      name: 'Typography',
      fields: [
        { key: 'fontSize', label: 'Font Size', type: 'text' as const, placeholder: '1rem' },
        { key: 'fontWeight', label: 'Font Weight', type: 'select' as const, options: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'] },
        { key: 'lineHeight', label: 'Line Height', type: 'text' as const, placeholder: '1.5' },
        { key: 'textAlign', label: 'Text Align', type: 'select' as const, options: ['left', 'center', 'right', 'justify'] },
      ],
    },
    {
      name: 'Colors',
      fields: [
        { key: 'color', label: 'Text Color', type: 'color' as const },
        { key: 'backgroundColor', label: 'Background', type: 'color' as const },
      ],
    },
    {
      name: 'Border',
      fields: [
        { key: 'borderRadius', label: 'Border Radius', type: 'text' as const, placeholder: '0' },
        { key: 'border', label: 'Border', type: 'text' as const, placeholder: '1px solid #333' },
      ],
    },
    {
      name: 'Layout',
      fields: [
        { key: 'display', label: 'Display', type: 'select' as const, options: ['block', 'flex', 'grid', 'inline', 'inline-block', 'none'] },
        { key: 'flexDirection', label: 'Flex Direction', type: 'select' as const, options: ['row', 'column', 'row-reverse', 'column-reverse'] },
        { key: 'justifyContent', label: 'Justify', type: 'select' as const, options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
        { key: 'alignItems', label: 'Align', type: 'select' as const, options: ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'] },
      ],
    },
    {
      name: 'Effects',
      fields: [
        { key: 'boxShadow', label: 'Box Shadow', type: 'text' as const, placeholder: 'none' },
        { key: 'opacity', label: 'Opacity', type: 'text' as const, placeholder: '1' },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {styleGroups.map(group => (
        <div key={group.name}>
          <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{group.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {group.fields.map(field => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ width: '80px', fontSize: '0.75rem', color: '#999' }}>{field.label}</label>
                {field.type === 'color' ? (
                  <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
                    <input
                      type="color"
                      value={((currentStyles[field.key as keyof ElementStyles] as string) !== '' && currentStyles[field.key as keyof ElementStyles] != null) ? (currentStyles[field.key as keyof ElementStyles] as string) : '#ffffff'}
                      onChange={(e) => updateStyle(field.key, e.target.value)}
                      style={{ width: '32px', height: '28px', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={(currentStyles[field.key as keyof ElementStyles] as string) ?? ''}
                      onChange={(e) => updateStyle(field.key, e.target.value)}
                      placeholder="transparent"
                      style={{ flex: 1, padding: '4px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }}
                    />
                  </div>
                ) : field.type === 'select' ? (
                  <select
                    value={(currentStyles[field.key as keyof ElementStyles] as string) ?? ''}
                    onChange={(e) => updateStyle(field.key, e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }}
                  >
                    <option value="">-</option>
                    {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={(currentStyles[field.key as keyof ElementStyles] as string) ?? ''}
                    onChange={(e) => updateStyle(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    style={{ flex: 1, padding: '4px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// WIDGET RENDERER
// ============================================================================

function WidgetRenderer({ 
  element, 
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  branding,
  breakpoint,
}: {
  element: WidgetElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<WidgetElement>) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  branding: GlobalBranding;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
}) {
  const styles = { ...element.styles.desktop, ...element.styles[breakpoint] };
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleContentChange = () => {
    if (contentRef.current) {
      onUpdate({ content: contentRef.current.innerText });
    }
  };

  const baseStyle: React.CSSProperties = {
    ...styles as React.CSSProperties,
    position: 'relative',
    outline: isSelected ? '2px solid #6366f1' : '1px dashed transparent',
    cursor: 'pointer',
    transition: 'outline 0.15s',
  };

  const renderContent = () => {
    switch (element.type) {
      case 'heading': {

        return (
          <div
            ref={contentRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleContentChange}
            onDoubleClick={() => setIsEditing(true)}
            style={{ outline: 'none' }}
          >
            {(element.content !== '' && element.content != null) ? (typeof element.content === 'string' ? element.content : JSON.stringify(element.content)) : 'Heading'}
          </div>
        );
      }

      case 'text':
        return (
          <div
            ref={contentRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleContentChange}
            onDoubleClick={() => setIsEditing(true)}
            style={{ outline: 'none' }}
          >
            {(element.content !== '' && element.content != null) ? (typeof element.content === 'string' ? element.content : JSON.stringify(element.content)) : 'Text content'}
          </div>
        );

      case 'button':
        return (
          <span style={{ cursor: 'pointer' }}>{(element.content !== '' && element.content != null) ? (typeof element.content === 'string' ? element.content : JSON.stringify(element.content)) : 'Button'}</span>
        );

      case 'image':
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(element.settings?.src !== '' && element.settings?.src != null) ? element.settings.src : 'https://placehold.co/800x400'}
            alt={element.settings?.alt ?? ''}
            style={{ maxWidth: '100%', display: 'block' }}
          />
        );

      case 'icon':
        return <span>{(element.content !== '' && element.content != null) ? (typeof element.content === 'string' ? element.content : JSON.stringify(element.content)) : '⚡'}</span>;

      case 'spacer':
        return <div style={{ height: element.settings?.height ?? 40 }} />;

      case 'divider':
        return <hr style={{ border: 'none', borderBottom: (styles.borderBottom !== '' && styles.borderBottom != null) ? styles.borderBottom : '1px solid rgba(255,255,255,0.1)', margin: 0 }} />;

      case 'icon-box': {
        const iconBoxContent = element.content as IconBoxContent | undefined;
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{(iconBoxContent?.icon !== '' && iconBoxContent?.icon != null) ? iconBoxContent.icon : '🚀'}</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{(iconBoxContent?.title !== '' && iconBoxContent?.title != null) ? iconBoxContent.title : 'Title'}</h3>
            <p style={{ opacity: 0.7 }}>{(iconBoxContent?.text !== '' && iconBoxContent?.text != null) ? iconBoxContent.text : 'Description'}</p>
          </div>
        );
      }

      case 'hero': {
        const heroContent = element.content as HeroContent | undefined;
        return (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>{(heroContent?.title !== '' && heroContent?.title != null) ? heroContent.title : 'Hero Title'}</h1>
            <p style={{ fontSize: '1.25rem', opacity: 0.8, marginBottom: '2rem' }}>{(heroContent?.subtitle !== '' && heroContent?.subtitle != null) ? heroContent.subtitle : 'Subtitle'}</p>
            <span style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: branding.colors.primary, color: '#fff', borderRadius: '8px', fontWeight: '600' }}>
              {(heroContent?.buttonText !== '' && heroContent?.buttonText != null) ? heroContent.buttonText : 'Get Started'}
            </span>
          </div>
        );
      }

      case 'feature-grid': {
        const featureContent = element.content as FeatureGridContent | undefined;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '30px' }}>
            {(featureContent?.items ?? []).map((item, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{item.icon}</div>
                <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{item.title}</h3>
                <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        );
      }

      case 'testimonial': {
        const testimonialContent = element.content as TestimonialContent | undefined;
        return (
          <div>
            <p style={{ fontSize: '1.125rem', fontStyle: 'italic', marginBottom: '1rem' }}>&quot;{testimonialContent?.quote}&quot;</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#333', borderRadius: '50%' }} />
              <div>
                <div style={{ fontWeight: '600' }}>{testimonialContent?.author}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>{testimonialContent?.role}, {testimonialContent?.company}</div>
              </div>
            </div>
          </div>
        );
      }

      case 'cta': {
        const ctaContent = element.content as HeroContent | undefined;
        return (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{(ctaContent?.title !== '' && ctaContent?.title != null) ? ctaContent.title : 'CTA Title'}</h2>
            <p style={{ opacity: 0.8, marginBottom: '1.5rem' }}>{(ctaContent?.subtitle !== '' && ctaContent?.subtitle != null) ? ctaContent.subtitle : 'Subtitle'}</p>
            <span style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#fff', color: '#000', borderRadius: '8px', fontWeight: '600' }}>
              {(ctaContent?.buttonText !== '' && ctaContent?.buttonText != null) ? ctaContent.buttonText : 'Get Started'}
            </span>
          </div>
        );
      }

      case 'stats': {
        const statsContent = element.content as StatsContent | undefined;
        return (
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            {(statsContent?.items ?? []).map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{item.value}</div>
                <div style={{ opacity: 0.6 }}>{item.label}</div>
              </div>
            ))}
          </div>
        );
      }

      case 'counter': {
        const counterContent = element.content as CounterContent | undefined;
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{counterContent?.number}{counterContent?.suffix}</div>
            <div style={{ opacity: 0.6 }}>{counterContent?.label}</div>
          </div>
        );
      }

      case 'newsletter': {
        const newsletterContent = element.content as NewsletterContent | undefined;
        return (
          <div style={{ display: 'flex', gap: '10px', maxWidth: '400px' }}>
            <input type="email" placeholder={(newsletterContent?.placeholder !== '' && newsletterContent?.placeholder != null) ? newsletterContent.placeholder : 'Enter email'} style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff' }} />
            <button style={{ padding: '12px 20px', backgroundColor: branding.colors.primary, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}>{(newsletterContent?.buttonText !== '' && newsletterContent?.buttonText != null) ? newsletterContent.buttonText : 'Subscribe'}</button>
          </div>
        );
      }

      case 'social-icons': {
        const socialContent = element.content as SocialLinksContent | undefined;
        return (
          <div style={{ display: 'flex', gap: '15px' }}>
            {(socialContent?.links ?? []).map((link, i) => (
              <span key={i} style={{ fontSize: '1.5rem', opacity: 0.7 }}>
                {link.platform === 'twitter' ? '𝕏' : link.platform === 'linkedin' ? 'in' : link.platform === 'facebook' ? 'f' : '🌐'}
              </span>
            ))}
          </div>
        );
      }

      case 'faq': {
        const faqContent = element.content as FAQContent | undefined;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(faqContent?.items ?? []).map((item, i) => (
              <div key={i} style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{item.q}</div>
                <div style={{ opacity: 0.7 }}>{item.a}</div>
              </div>
            ))}
          </div>
        );
      }

      case 'alert':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>ℹ️</span>
            <span>{(element.content !== '' && element.content != null) ? (typeof element.content === 'string' ? element.content : JSON.stringify(element.content)) : 'Alert message'}</span>
          </div>
        );

      case 'section':
      case 'container':
      case 'row':
      case 'column':
        return element.children?.length ? (
          element.children.map((child) => (
            <WidgetRenderer
              key={child.id}
              element={child}
              isSelected={false}
              onSelect={() => {}}
              onUpdate={() => {}}
              onDelete={() => {}}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              branding={branding}
              breakpoint={breakpoint}
            />
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)' }}>
            Drop widgets here
          </div>
        );

      default:
        return <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>{element.type} widget</div>;
    }
  };

  return (
    <div
      style={baseStyle}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isSelected && (
        <div style={{ position: 'absolute', top: '-24px', left: '0', display: 'flex', gap: '4px', zIndex: 10 }}>
          <span style={{ padding: '2px 8px', backgroundColor: '#6366f1', color: '#fff', fontSize: '0.625rem', borderRadius: '4px 4px 0 0' }}>
            {element.type}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ padding: '2px 6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.625rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}
      {renderContent()}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WebsiteEditorPage() {
  // State
  const [config, setConfig] = useState<WebsiteConfig>(DEFAULT_CONFIG);
  const [selectedPageId, setSelectedPageId] = useState<string>('home');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [leftPanel, setLeftPanel] = useState<'widgets' | 'pages' | 'branding'>('widgets');
  const [_rightPanel, _setRightPanel] = useState<'style' | 'settings'>('style');
  const [_draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [widgetFilter, setWidgetFilter] = useState<string>('');
  const [expandedCategory, setExpandedCategory] = useState<string>('basic');
  const [_history, _setHistory] = useState<WebsiteConfig[]>([]);
  const [_historyIndex, _setHistoryIndex] = useState(-1);

  const selectedPage = config.pages.find(p => p.id === selectedPageId);
  
  // Find selected element recursively
  const findElement = (elements: WidgetElement[], id: string): WidgetElement | null => {
    for (const el of elements) {
      if (el.id === id) {return el;}
      if (el.children) {
        const found = findElement(el.children, id);
        if (found) {return found;}
      }
    }
    return null;
  };

  const findElementInSections = (sections: PageSection[], id: string): WidgetElement | null => {
    for (const section of sections) {
      if (section.id === id) {
        // PageSection can be treated as a WidgetElement (omitting PageSection-specific fields)
        return {
          id: section.id,
          type: section.type,
          content: undefined,
          children: section.children,
          styles: section.styles,
          settings: undefined
        };
      }
      const found = findElement(section.children, id);
      if (found) {return found;}
    }
    return null;
  };

  const selectedElement = selectedPage ? findElementInSections(selectedPage.sections, selectedElementId ?? '') : null;

  // Load config - smart merge: prefer defaults for pages with more content
  useEffect(() => {
    const load = () => {
      // Always start with DEFAULT_CONFIG which has the real website content
      // Firestore is only used for saving edits
      setConfig(DEFAULT_CONFIG);
    };
    load();
  }, []);

  // Save config
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      await FirestoreService.set('platform', 'website-editor-config', {
        ...config,
        updatedAt: new Date().toISOString(),
      }, false);

      // Also save branding to theme for PublicLayout
      await FirestoreService.set('platform', 'website-config', {
        branding: config.branding,
        navigation: config.navigation,
        footer: config.footer,
      }, false);
      
      setHasChanges(false);
      // eslint-disable-next-line no-alert
      window.alert('Published successfully!');
    } catch (e) {
      logger.error('Failed to save:', e instanceof Error ? e : new Error(String(e)), { file: 'page.tsx' });
      // eslint-disable-next-line no-alert
      window.alert('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Update helpers
  const updateConfig = (updates: Partial<WebsiteConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const addSection = () => {
    if (!selectedPage) {return;}
    const newSection: PageSection = {
      id: generateId(),
      type: 'section',
      name: 'New Section',
      children: [],
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#0a0a0a' } },
      visible: true,
    };
    updateConfig({
      pages: config.pages.map(p => 
        p.id === selectedPageId 
          ? { ...p, sections: [...p.sections, newSection] }
          : p
      ),
    });
    setSelectedElementId(newSection.id);
  };

  const addWidgetToSection = (widgetType: string, sectionId: string) => {
    const widget = createWidget(widgetType);
    updateConfig({
      pages: config.pages.map(p => 
        p.id === selectedPageId
          ? {
              ...p,
              sections: p.sections.map(s => 
                s.id === sectionId
                  ? { ...s, children: [...s.children, widget] }
                  : s
              ),
            }
          : p
      ),
    });
    setSelectedElementId(widget.id);
  };

  const deleteElement = (elementId: string) => {
    updateConfig({
      pages: config.pages.map(p => 
        p.id === selectedPageId
          ? {
              ...p,
              sections: p.sections.filter(s => s.id !== elementId).map(s => ({
                ...s,
                type: 'section' as const,
                children: s.children.filter(c => c.id !== elementId),
              })),
            }
          : p
      ),
    });
    setSelectedElementId(null);
  };

  const updateElement = (elementId: string, updates: Partial<WidgetElement>) => {
    updateConfig({
      pages: config.pages.map(p => 
        p.id === selectedPageId
          ? {
              ...p,
              sections: p.sections.map(s => 
                s.id === elementId
                  ? { ...s, ...updates, type: 'section' as const }
                  : {
                      ...s,
                      type: 'section' as const,
                      children: s.children.map(c => 
                        c.id === elementId ? { ...c, ...updates } : c
                      ),
                    }
              ),
            }
          : p
      ),
    });
  };

  const handleDragStart = (e: React.DragEvent, widgetType: string) => {
    setDraggedWidget(widgetType);
    e.dataTransfer.setData('widgetType', widgetType);
  };

  const handleDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    const widgetType = e.dataTransfer.getData('widgetType');
    if (widgetType && sectionId) {
      addWidgetToSection(widgetType, sectionId);
    }
    setDraggedWidget(null);
  };

  const previewWidth = breakpoint === 'desktop' ? '100%' : breakpoint === 'tablet' ? '768px' : '375px';

  const filteredWidgets = WIDGETS.filter(w => 
    widgetFilter ? w.name.toLowerCase().includes(widgetFilter.toLowerCase()) : true
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000', color: '#fff', overflow: 'hidden' }}>
      {/* Top Bar */}
      <div style={{ height: '50px', backgroundColor: '#0a0a0a', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/admin" style={{ color: '#666', textDecoration: 'none' }}>← Back</Link>
          <span style={{ fontWeight: '600' }}>Website Editor</span>
          {hasChanges && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>• Unsaved</span>}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Breakpoint Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#1a1a1a', borderRadius: '6px', padding: '2px' }}>
            {(['desktop', 'tablet', 'mobile'] as const).map(bp => (
              <button
                key={bp}
                onClick={() => setBreakpoint(bp)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: breakpoint === bp ? '#333' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: breakpoint === bp ? '#fff' : '#666',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {bp === 'desktop' ? '🖥️' : bp === 'tablet' ? '📱' : '📱'}
              </button>
            ))}
          </div>
          
          <a href="/" target="_blank" style={{ padding: '6px 12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', textDecoration: 'none', fontSize: '0.75rem' }}>
            Preview ↗
          </a>
          
          <button
            onClick={() => {
              // eslint-disable-next-line no-alert
              if (window.confirm('Reset this page to defaults? This will restore the original content for the currently selected page.')) {
                const defaultPage = DEFAULT_CONFIG.pages.find(p => p.id === selectedPageId);
                if (defaultPage) {
                  updateConfig({
                    pages: config.pages.map(p => p.id === selectedPageId ? defaultPage : p),
                  });
                }
              }
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.7rem',
            }}
          >
            Reset Page
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
            style={{
              padding: '6px 16px',
              backgroundColor: hasChanges ? '#6366f1' : '#333',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              fontSize: '0.75rem',
              fontWeight: '600',
            }}
          >
            {isSaving ? 'Saving...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Widgets/Pages/Branding */}
        <div style={{ width: '280px', backgroundColor: '#0a0a0a', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Panel Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
            {(['widgets', 'pages', 'branding'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setLeftPanel(tab)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  backgroundColor: leftPanel === tab ? '#111' : 'transparent',
                  border: 'none',
                  borderBottom: leftPanel === tab ? '2px solid #6366f1' : '2px solid transparent',
                  color: leftPanel === tab ? '#fff' : '#666',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                }}
              >
                {tab === 'widgets' ? '🧩' : tab === 'pages' ? '📄' : '🎨'}
                <div style={{ marginTop: '2px' }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</div>
              </button>
            ))}
          </div>

          {/* Panel Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
            {leftPanel === 'widgets' && (
              <>
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search widgets..."
                  value={widgetFilter}
                  onChange={(e) => setWidgetFilter(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', marginBottom: '0.75rem' }}
                />
                
                {/* Widget Categories */}
                {WIDGET_CATEGORIES.map(cat => {
                  const catWidgets = filteredWidgets.filter(w => w.category === cat.id);
                  if (catWidgets.length === 0) {return null;}
                  
                  return (
                    <div key={cat.id} style={{ marginBottom: '0.5rem' }}>
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === cat.id ? '' : cat.id)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#111',
                          border: '1px solid #222',
                          borderRadius: '6px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span>{cat.icon} {cat.name}</span>
                        <span style={{ color: '#666' }}>{expandedCategory === cat.id ? '▼' : '▶'}</span>
                      </button>
                      
                      {expandedCategory === cat.id && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px', padding: '6px' }}>
                          {catWidgets.map(widget => (
                            <div
                              key={widget.type}
                              draggable
                              onDragStart={(e) => handleDragStart(e, widget.type)}
                              style={{
                                padding: '10px 8px',
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #333',
                                borderRadius: '6px',
                                cursor: 'grab',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                transition: 'all 0.15s',
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                              onMouseOut={(e) => (e.currentTarget.style.borderColor = '#333')}
                            >
                              <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{widget.icon}</div>
                              <div style={{ color: '#ccc' }}>{widget.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

{leftPanel === 'pages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    // eslint-disable-next-line no-alert
                    const name = window.prompt('Page name:');
                    if (name) {
                      const slug = `/${  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
                      const newPage: WebsitePage = {
                        id: generateId(),
                        name,
                        slug,
                        sections: [],
                        isPublished: false,
                        isInNav: true,
                        navOrder: config.pages.length,
                        pageType: 'content',
                        metaTitle: `${name} - ${config.branding.companyName}`,
                        metaDescription: '',
                      };
                      updateConfig({ pages: [...config.pages, newPage] });
                      setSelectedPageId(newPage.id);
                    }
                  }}
                  style={{ padding: '10px', backgroundColor: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
                >
                  + Add Page
                </button>

                {/* Page List */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {config.pages.map(page => (
                    <div
                      key={page.id}
                      onClick={() => setSelectedPageId(page.id)}
                      style={{
                        padding: '10px',
                        marginBottom: '4px',
                        backgroundColor: selectedPageId === page.id ? '#1a1a1a' : 'transparent',
                        border: selectedPageId === page.id ? '1px solid #6366f1' : '1px solid #222',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>{page.name}</span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {page.pageType === 'auth' && <span style={{ fontSize: '0.5rem', padding: '2px 4px', backgroundColor: '#4338ca', borderRadius: '2px' }}>AUTH</span>}
                          <span style={{ fontSize: '0.5rem', padding: '2px 4px', backgroundColor: page.isPublished ? '#065f46' : '#7c2d12', borderRadius: '2px' }}>
                            {page.isPublished ? 'LIVE' : 'DRAFT'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>{page.slug}</div>
                    </div>
                  ))}
                </div>

                {/* Selected Page Settings */}
                {selectedPage && (
                  <div style={{ borderTop: '1px solid #222', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '600', color: '#888', textTransform: 'uppercase' }}>Page Settings</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Page Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', marginBottom: '0.25rem' }}>Page Name</label>
                        <input
                          type="text"
                          value={selectedPage.name}
                          onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, name: e.target.value } : p) })}
                          style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                        />
                      </div>

                      {/* URL Slug */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', marginBottom: '0.25rem' }}>URL Slug</label>
                        <input
                          type="text"
                          value={selectedPage.slug}
                          onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, slug: e.target.value } : p) })}
                          style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                        />
                      </div>

                      {/* Toggles */}
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedPage.isPublished}
                            onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, isPublished: e.target.checked } : p) })}
                          />
                          Published
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedPage.isInNav}
                            onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, isInNav: e.target.checked } : p) })}
                          />
                          In Nav
                        </label>
                      </div>

                      {/* SEO Section */}
                      <div style={{ borderTop: '1px solid #222', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: '600', color: '#888', textTransform: 'uppercase' }}>SEO</h5>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', marginBottom: '0.2rem' }}>Meta Title</label>
                            <input
                              type="text"
                              value={selectedPage.metaTitle ?? ''}
                              onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, metaTitle: e.target.value } : p) })}
                              placeholder={`${selectedPage.name} - ${config.branding.companyName}`}
                              style={{ width: '100%', padding: '5px 7px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', marginBottom: '0.2rem' }}>Meta Description</label>
                            <textarea
                              value={selectedPage.metaDescription ?? ''}
                              onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, metaDescription: e.target.value } : p) })}
                              placeholder="Page description for search engines..."
                              rows={2}
                              style={{ width: '100%', padding: '5px 7px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', resize: 'vertical' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', marginBottom: '0.2rem' }}>Keywords</label>
                            <input
                              type="text"
                              value={selectedPage.metaKeywords ?? ''}
                              onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, metaKeywords: e.target.value } : p) })}
                              placeholder="keyword1, keyword2, keyword3"
                              style={{ width: '100%', padding: '5px 7px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', marginBottom: '0.2rem' }}>OG Image URL</label>
                            <input
                              type="text"
                              value={selectedPage.ogImage ?? ''}
                              onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, ogImage: e.target.value } : p) })}
                              placeholder="https://..."
                              style={{ width: '100%', padding: '5px 7px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }}
                            />
                          </div>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', cursor: 'pointer', color: '#999' }}>
                            <input
                              type="checkbox"
                              checked={selectedPage.noIndex ?? false}
                              onChange={(e) => updateConfig({ pages: config.pages.map(p => p.id === selectedPage.id ? { ...p, noIndex: e.target.checked } : p) })}
                            />
                            No Index (hide from search engines)
                          </label>
                        </div>
                      </div>

                      {/* Delete Page */}
                      {selectedPage.id !== 'home' && (
                        <button
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            if (window.confirm(`Delete "${selectedPage.name}" page?`)) {
                              updateConfig({ pages: config.pages.filter(p => p.id !== selectedPage.id) });
                              setSelectedPageId('home');
                            }
                          }}
                          style={{ padding: '8px', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.5rem' }}
                        >
                          🗑️ Delete Page
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {leftPanel === 'branding' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Logo */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Logo</label>
                  <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    {config.branding.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={config.branding.logoUrl} alt="Logo" style={{ maxHeight: '60px', marginBottom: '0.5rem' }} />
                    )}
                    <label style={{ display: 'block', padding: '8px', backgroundColor: '#6366f1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              updateConfig({
                                branding: { ...config.branding, logoUrl: reader.result as string },
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Company Name</label>
                  <input
                    type="text"
                    value={config.branding.companyName}
                    onChange={(e) => updateConfig({ branding: { ...config.branding, companyName: e.target.value } })}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }}
                  />
                </div>

                {/* Colors */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Colors</label>
                  {Object.entries(config.branding.colors).slice(0, 6).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => updateConfig({
                          branding: { ...config.branding, colors: { ...config.branding.colors, [key]: e.target.value } },
                        })}
                        style={{ width: '32px', height: '28px', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, fontSize: '0.75rem', color: '#999', textTransform: 'capitalize' }}>{key}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateConfig({
                          branding: { ...config.branding, colors: { ...config.branding.colors, [key]: e.target.value } },
                        })}
                        style={{ width: '80px', padding: '4px 6px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.625rem', fontFamily: 'monospace' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, backgroundColor: '#1a1a1a', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <div
            style={{
              width: previewWidth,
              maxWidth: '100%',
              backgroundColor: config.branding.colors.background,
              minHeight: '100%',
              boxShadow: '0 0 60px rgba(0,0,0,0.5)',
            }}
            onClick={() => setSelectedElementId(null)}
          >
            {/* Page Sections */}
            {selectedPage?.sections.length === 0 ? (
              <div
                style={{
                  padding: '100px 40px',
                  textAlign: 'center',
                  border: '2px dashed rgba(255,255,255,0.2)',
                  margin: '20px',
                  borderRadius: '12px',
                  color: 'rgba(255,255,255,0.4)',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addSection();
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Empty Page</div>
                <div style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>Drag widgets here or click below to add a section</div>
                <button
                  onClick={addSection}
                  style={{ padding: '12px 24px', backgroundColor: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
                >
                  + Add Section
                </button>
              </div>
            ) : (
              selectedPage?.sections.map(section => (
                <div
                  key={section.id}
                  style={{
                    ...section.styles.desktop as React.CSSProperties,
                    ...section.styles[breakpoint] as React.CSSProperties,
                    position: 'relative',
                    outline: selectedElementId === section.id ? '2px solid #6366f1' : '1px dashed transparent',
                    minHeight: '100px',
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(section.id); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, section.id)}
                >
                  {/* Section Label */}
                  <div style={{ position: 'absolute', top: '-20px', left: '10px', fontSize: '0.625rem', color: '#666', backgroundColor: '#0a0a0a', padding: '2px 8px', borderRadius: '4px' }}>
                    Section: {section.name}
                  </div>
                  
                  {section.children.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.3)' }}>
                      <div style={{ marginBottom: '0.5rem' }}>🧩</div>
                      <div>Drag widgets here</div>
                    </div>
                  ) : (
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                      {section.children.map(child => (
                        <WidgetRenderer
                          key={child.id}
                          element={child}
                          isSelected={selectedElementId === child.id}
                          onSelect={() => setSelectedElementId(child.id)}
                          onUpdate={(updates) => updateElement(child.id, updates)}
                          onDelete={() => deleteElement(child.id)}
                          onDragStart={() => {}}
                          onDragOver={() => {}}
                          onDrop={() => {}}
                          branding={config.branding}
                          breakpoint={breakpoint}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {/* Add Section Button */}
            {selectedPage && selectedPage.sections.length > 0 && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <button
                  onClick={addSection}
                  style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  + Add Section
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Content & Style Editor */}
        <div style={{ width: '320px', backgroundColor: '#0a0a0a', borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {selectedElement ? (
            <>
              {/* Element Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', backgroundColor: '#111' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Editing Element</div>
                    <div style={{ fontWeight: '600', fontSize: '1rem', textTransform: 'capitalize' }}>{selectedElement.type.replace(/-/g, ' ')}</div>
                  </div>
                  <button
                    onClick={() => deleteElement(selectedElement.id)}
                    style={{ padding: '6px 10px', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto' }}>
                {/* ===== CONTENT SECTION (Always First) ===== */}
                <div style={{ borderBottom: '1px solid #222' }}>
                  <div style={{ padding: '12px 16px', backgroundColor: '#0f0f0f', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📝 Content</span>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {/* Simple String Content (text, heading, button) */}
                    {typeof selectedElement.content === 'string' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>
                          {selectedElement.type === 'heading' ? 'Heading Text' : selectedElement.type === 'button' ? 'Button Text' : 'Text Content'}
                        </label>
                        <textarea
                          value={selectedElement.content}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          rows={selectedElement.type === 'text' ? 4 : 2}
                          placeholder="Enter your content here..."
                          style={{ width: '100%', padding: '10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', resize: 'vertical', lineHeight: '1.5' }}
                        />
                      </div>
                    )}

                    {/* Button Link */}
                    {selectedElement.type === 'button' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Link URL</label>
                        <input
                          type="text"
                          value={selectedElement.settings?.href ?? ''}
                          onChange={(e) => updateElement(selectedElement.id, { settings: { ...selectedElement.settings, href: e.target.value } })}
                          placeholder="/signup or https://..."
                          style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                        />
                      </div>
                    )}

                    {/* Image Element */}
                    {selectedElement.type === 'image' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Image URL</label>
                          <input
                            type="text"
                            value={typeof selectedElement.content === 'string' ? selectedElement.content : ''}
                            onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Alt Text</label>
                          <input
                            type="text"
                            value={selectedElement.settings?.alt ?? ''}
                            onChange={(e) => updateElement(selectedElement.id, { settings: { ...selectedElement.settings, alt: e.target.value } })}
                            placeholder="Image description for accessibility"
                            style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                          />
                        </div>
                      </>
                    )}

                    {/* Video Element */}
                    {selectedElement.type === 'video' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Video URL (YouTube/Vimeo)</label>
                        <input
                          type="text"
                          value={typeof selectedElement.content === 'string' ? selectedElement.content : ''}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          placeholder="https://youtube.com/watch?v=..."
                          style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                        />
                      </div>
                    )}

                    {/* Icon Element */}
                    {selectedElement.type === 'icon' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Icon (emoji or icon code)</label>
                        <input
                          type="text"
                          value={typeof selectedElement.content === 'string' ? selectedElement.content : ''}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          placeholder="🚀 or icon name"
                          style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '1rem', textAlign: 'center' }}
                        />
                      </div>
                    )}

                    {/* No content message for layout elements */}
                    {(['container', 'columns', 'grid', 'row', 'column', 'section', 'spacer', 'divider'].includes(selectedElement.type)) && (
                      <div style={{ padding: '1rem', backgroundColor: '#111', borderRadius: '6px', textAlign: 'center', color: '#666', fontSize: '0.8rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>📦</div>
                        This is a layout element. Drag widgets inside it or adjust its style below.
                      </div>
                    )}

                    {/* Hero/CTA Content */}
                    {(selectedElement.type === 'hero' || selectedElement.type === 'cta') && typeof selectedElement.content === 'object' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Title</label>
                          <input type="text" value={(selectedElement.content as HeroContent)?.title ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as HeroContent), title: e.target.value } })} style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Subtitle</label>
                          <textarea value={(selectedElement.content as HeroContent)?.subtitle ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as HeroContent), subtitle: e.target.value } })} rows={3} style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', resize: 'vertical' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Button Text</label>
                          <input type="text" value={(selectedElement.content as HeroContent)?.buttonText ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as HeroContent), buttonText: e.target.value } })} style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Button Link</label>
                          <input type="text" value={(selectedElement.content as HeroContent)?.buttonLink ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as HeroContent), buttonLink: e.target.value } })} placeholder="/signup" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                      </>
                    )}

                    {/* Testimonial Content */}
                    {selectedElement.type === 'testimonial' && typeof selectedElement.content === 'object' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Quote</label>
                          <textarea value={(selectedElement.content as TestimonialContent)?.quote ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as TestimonialContent), quote: e.target.value } })} rows={3} placeholder="What the customer said..." style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Author</label>
                            <input type="text" value={(selectedElement.content as TestimonialContent)?.author ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as TestimonialContent), author: e.target.value } })} placeholder="John Doe" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Role</label>
                            <input type="text" value={(selectedElement.content as TestimonialContent)?.role ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as TestimonialContent), role: e.target.value } })} placeholder="CEO" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Company</label>
                          <input type="text" value={(selectedElement.content as TestimonialContent)?.company ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as TestimonialContent), company: e.target.value } })} placeholder="Acme Inc" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }} />
                        </div>
                      </>
                    )}

                    {/* Icon Box Content */}
                    {selectedElement.type === 'icon-box' && typeof selectedElement.content === 'object' && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Icon</label>
                            <input type="text" value={(selectedElement.content as IconBoxContent)?.icon ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as IconBoxContent), icon: e.target.value } })} style={{ width: '100%', padding: '8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '1.25rem', textAlign: 'center' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Title</label>
                            <input type="text" value={(selectedElement.content as IconBoxContent)?.title ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as IconBoxContent), title: e.target.value } })} style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Description</label>
                          <textarea value={(selectedElement.content as IconBoxContent)?.text ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as IconBoxContent), text: e.target.value } })} rows={3} style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', resize: 'vertical' }} />
                        </div>
                      </>
                    )}

                    {/* Counter Content */}
                    {selectedElement.type === 'counter' && typeof selectedElement.content === 'object' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Number</label>
                          <input type="text" value={(selectedElement.content as CounterContent)?.number ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as CounterContent), number: e.target.value } })} placeholder="1000" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Suffix</label>
                          <input type="text" value={(selectedElement.content as CounterContent)?.suffix ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as CounterContent), suffix: e.target.value } })} placeholder="+" style={{ width: '100%', padding: '8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', textAlign: 'center' }} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Label</label>
                          <input type="text" value={(selectedElement.content as CounterContent)?.label ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as CounterContent), label: e.target.value } })} placeholder="Happy Customers" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                      </div>
                    )}

                    {/* Feature Grid Items */}
                    {selectedElement.type === 'feature-grid' && ((selectedElement.content as FeatureGridContent)?.items) && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Features ({((selectedElement.content as FeatureGridContent).items ?? []).length})</label>
                        {((selectedElement.content as FeatureGridContent).items ?? []).map((item, idx) => (
                          <div key={idx} style={{ padding: '10px', backgroundColor: '#111', borderRadius: '6px', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <input type="text" value={item.icon ?? ''} placeholder="🚀" onChange={(e) => { const currentContent = selectedElement.content as FeatureGridContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], icon: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ width: '40px', padding: '6px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '1rem', textAlign: 'center' }} />
                              <input type="text" value={item.title ?? ''} placeholder="Feature Title" onChange={(e) => { const currentContent = selectedElement.content as FeatureGridContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], title: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ flex: 1, padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                              <button onClick={() => { const currentContent = selectedElement.content as FeatureGridContent; const items = (currentContent.items ?? []).filter((_, i) => i !== idx); updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ padding: '6px 8px', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}>×</button>
                            </div>
                            <input type="text" value={item.desc ?? ''} placeholder="Feature description" onChange={(e) => { const currentContent = selectedElement.content as FeatureGridContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], desc: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }} />
                          </div>
                        ))}
                        <button onClick={() => { const currentContent = selectedElement.content as FeatureGridContent; const items = [...(currentContent.items ?? []), { icon: '⚡', title: 'New Feature', desc: 'Description' }]; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', border: '1px dashed #444', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}>+ Add Feature</button>
                      </div>
                    )}

                    {/* Stats Items */}
                    {selectedElement.type === 'stats' && ((selectedElement.content as StatsContent)?.items) && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Stats ({((selectedElement.content as StatsContent).items ?? []).length})</label>
                        {((selectedElement.content as StatsContent).items ?? []).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                            <input type="text" value={item.value ?? ''} placeholder="100+" onChange={(e) => { const currentContent = selectedElement.content as StatsContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], value: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ width: '70px', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                            <input type="text" value={item.label ?? ''} placeholder="Label" onChange={(e) => { const currentContent = selectedElement.content as StatsContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], label: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ flex: 1, padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                            <button onClick={() => { const currentContent = selectedElement.content as StatsContent; const items = (currentContent.items ?? []).filter((_, i) => i !== idx); updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ padding: '6px 8px', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}>×</button>
                          </div>
                        ))}
                        <button onClick={() => { const currentContent = selectedElement.content as StatsContent; const items = [...(currentContent.items ?? []), { value: '100+', label: 'New Stat' }]; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', border: '1px dashed #444', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}>+ Add Stat</button>
                      </div>
                    )}

                    {/* FAQ Items */}
                    {selectedElement.type === 'faq' && ((selectedElement.content as FAQContent)?.items) && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>FAQ Items ({((selectedElement.content as FAQContent).items ?? []).length})</label>
                        {((selectedElement.content as FAQContent).items ?? []).map((item, idx) => (
                          <div key={idx} style={{ padding: '10px', backgroundColor: '#111', borderRadius: '6px', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <input type="text" value={item.q ?? ''} placeholder="Question?" onChange={(e) => { const currentContent = selectedElement.content as FAQContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], q: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ flex: 1, padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                              <button onClick={() => { const currentContent = selectedElement.content as FAQContent; const items = (currentContent.items ?? []).filter((_, i) => i !== idx); updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ padding: '6px 8px', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}>×</button>
                            </div>
                            <textarea value={item.a ?? ''} placeholder="Answer..." onChange={(e) => { const currentContent = selectedElement.content as FAQContent; const items = [...(currentContent.items ?? [])]; items[idx] = { ...items[idx], a: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} rows={2} style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', resize: 'vertical' }} />
                          </div>
                        ))}
                        <button onClick={() => { const currentContent = selectedElement.content as FAQContent; const items = [...(currentContent.items ?? []), { q: 'New Question?', a: 'Answer here' }]; updateElement(selectedElement.id, { content: { ...currentContent, items } }); }} style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', border: '1px dashed #444', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}>+ Add FAQ</button>
                      </div>
                    )}

                    {/* Pricing Table */}
                    {selectedElement.type === 'pricing-table' && ((selectedElement.content as PricingTableContent)?.plans) && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Pricing Plans ({((selectedElement.content as PricingTableContent).plans ?? []).length})</label>
                        {((selectedElement.content as PricingTableContent).plans ?? []).map((plan, idx) => (
                          <div key={idx} style={{ padding: '10px', backgroundColor: '#111', borderRadius: '6px', marginBottom: '6px', border: plan.highlighted ? '1px solid #6366f1' : '1px solid #222' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <input type="text" value={plan.name ?? ''} placeholder="Plan Name" onChange={(e) => { const currentContent = selectedElement.content as PricingTableContent; const plans = [...(currentContent.plans ?? [])]; plans[idx] = { ...plans[idx], name: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} style={{ flex: 1, padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                              <button onClick={() => { const currentContent = selectedElement.content as PricingTableContent; const plans = (currentContent.plans ?? []).filter((_, i) => i !== idx); updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} style={{ padding: '6px 8px', backgroundColor: '#7f1d1d', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}>×</button>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                              <input type="text" value={plan.price ?? ''} placeholder="$99" onChange={(e) => { const currentContent = selectedElement.content as PricingTableContent; const plans = [...(currentContent.plans ?? [])]; plans[idx] = { ...plans[idx], price: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} style={{ width: '70px', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                              <input type="text" value={plan.period ?? ''} placeholder="/mo" onChange={(e) => { const currentContent = selectedElement.content as PricingTableContent; const plans = [...(currentContent.plans ?? [])]; plans[idx] = { ...plans[idx], period: e.target.value }; updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} style={{ width: '60px', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }} />
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#888', cursor: 'pointer' }}>
                                <input type="checkbox" checked={plan.highlighted ?? false} onChange={(e) => { const currentContent = selectedElement.content as PricingTableContent; const plans = [...(currentContent.plans ?? [])]; plans[idx] = { ...plans[idx], highlighted: e.target.checked }; updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} />
                                Featured
                              </label>
                            </div>
                            <textarea value={(plan.features ?? []).join('\n')} placeholder="Feature 1&#10;Feature 2" onChange={(e) => { const currentContent = selectedElement.content as PricingTableContent; const plans = [...(currentContent.plans ?? [])]; plans[idx] = { ...plans[idx], features: e.target.value.split('\n') }; updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} rows={3} style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', resize: 'vertical' }} />
                          </div>
                        ))}
                        <button onClick={() => { const currentContent = selectedElement.content as PricingTableContent; const plans = [...(currentContent.plans ?? []), { name: 'New Plan', price: '$0', period: '/mo', features: ['Feature 1'], highlighted: false }]; updateElement(selectedElement.id, { content: { ...currentContent, plans } }); }} style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', border: '1px dashed #444', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}>+ Add Plan</button>
                      </div>
                    )}

                    {/* Newsletter Content */}
                    {selectedElement.type === 'newsletter' && typeof selectedElement.content === 'object' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Placeholder Text</label>
                          <input type="text" value={(selectedElement.content as NewsletterContent)?.placeholder ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as NewsletterContent), placeholder: e.target.value } })} placeholder="Enter your email" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px', fontWeight: '500' }}>Button Text</label>
                          <input type="text" value={(selectedElement.content as NewsletterContent)?.buttonText ?? ''} onChange={(e) => updateElement(selectedElement.id, { content: { ...(selectedElement.content as NewsletterContent), buttonText: e.target.value } })} placeholder="Subscribe" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '0.875rem' }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ===== STYLE SECTION ===== */}
                <div style={{ borderBottom: '1px solid #222' }}>
                  <div style={{ padding: '12px 16px', backgroundColor: '#0f0f0f', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎨 Style</span>
                    <span style={{ fontSize: '0.65rem', color: '#666', marginLeft: '8px' }}>({breakpoint})</span>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    <StyleEditor
                      styles={selectedElement.styles}
                      onChange={(styles) => updateElement(selectedElement.id, { styles })}
                      breakpoint={breakpoint}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', textAlign: 'center', padding: '2rem' }}>
              <div>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Click any element on the canvas</div>
                <div style={{ fontSize: '0.75rem', color: '#555' }}>to edit its content and style</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}







