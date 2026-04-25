/**
 * Campaign Templates API
 * GET /api/campaigns/templates — List pre-built campaign templates
 *
 * Each template carries a pre-filled prompt that the campaigns dashboard
 * sends to Jasper via Mission Control. Jasper then plans the campaign
 * across the appropriate department delegations (delegate_to_content +
 * delegate_to_marketing + delegate_to_intelligence as needed). The
 * `defaults` block is a hint for the prompt template, not a tool call
 * payload.
 *
 * Stored in Firestore with auto-seeding on first access.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  iconName: string;
  /** Pre-filled prompt for Jasper */
  promptTemplate: string;
  /** Default hints used when rendering the prompt template */
  defaults: {
    audience: string;
    tone: 'professional' | 'conversational' | 'energetic' | 'empathetic';
    platforms: string;
    skipVideo: boolean;
    skipEmail: boolean;
  };
  /** Deliverable types this template produces */
  deliverableTypes: string[];
  /** Example topics the user can customize */
  exampleTopics: string[];
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Full-channel launch campaign with blog announcement, teaser video, social blitz, and email sequence',
    category: 'Launch',
    iconName: 'Rocket',
    promptTemplate: 'Create a product launch campaign for: {topic}. Target audience: {audience}. Generate a blog announcement, video teaser, social posts across all platforms, and a launch email.',
    defaults: {
      audience: 'existing customers and prospects',
      tone: 'energetic',
      platforms: 'twitter,linkedin',
      skipVideo: false,
      skipEmail: false,
    },
    deliverableTypes: ['blog', 'video', 'social_post', 'email'],
    exampleTopics: [
      'New AI-powered analytics dashboard',
      'Spring product collection launch',
      'Mobile app v2.0 release',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'blog-series',
    name: 'Blog & Social Series',
    description: 'Thought leadership blog post with matching social content for maximum organic reach',
    category: 'Content',
    iconName: 'FileText',
    promptTemplate: 'Create a thought leadership blog post about: {topic}. Target audience: {audience}. Generate the blog post plus social posts to promote it across platforms.',
    defaults: {
      audience: 'industry professionals and decision-makers',
      tone: 'professional',
      platforms: 'twitter,linkedin',
      skipVideo: true,
      skipEmail: false,
    },
    deliverableTypes: ['blog', 'social_post', 'email'],
    exampleTopics: [
      '5 trends shaping our industry in 2026',
      'How AI is transforming small business operations',
      'The ultimate guide to customer retention',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-generation',
    name: 'Lead Generation',
    description: 'Educational content designed to attract and convert prospects into qualified leads',
    category: 'Sales',
    iconName: 'Target',
    promptTemplate: 'Create a lead generation campaign about: {topic}. Target audience: {audience}. Generate a value-driven blog post, educational social content, and a compelling lead nurture email.',
    defaults: {
      audience: 'potential buyers researching solutions',
      tone: 'empathetic',
      platforms: 'twitter,linkedin',
      skipVideo: true,
      skipEmail: false,
    },
    deliverableTypes: ['blog', 'social_post', 'email'],
    exampleTopics: [
      'Free ROI calculator for marketing automation',
      'Industry benchmark report 2026',
      'Common mistakes when choosing a CRM',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'video-campaign',
    name: 'Video-First Campaign',
    description: 'Video-centered campaign with supporting blog post and social clips for maximum engagement',
    category: 'Video',
    iconName: 'Video',
    promptTemplate: 'Create a video-first campaign about: {topic}. Target audience: {audience}. Generate a video storyboard as the hero content, plus a blog post and social posts to promote it.',
    defaults: {
      audience: 'engaged social media audience',
      tone: 'conversational',
      platforms: 'twitter,linkedin',
      skipVideo: false,
      skipEmail: true,
    },
    deliverableTypes: ['video', 'blog', 'social_post'],
    exampleTopics: [
      'Behind the scenes of our team culture',
      'Customer success story showcase',
      'Product demo walkthrough',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'holiday-seasonal',
    name: 'Holiday / Seasonal',
    description: 'Time-sensitive seasonal campaign with festive content across all channels',
    category: 'Seasonal',
    iconName: 'Calendar',
    promptTemplate: 'Create a seasonal campaign for: {topic}. Target audience: {audience}. Generate festive blog content, a seasonal video, holiday social posts, and a promotional email.',
    defaults: {
      audience: 'existing customers and newsletter subscribers',
      tone: 'energetic',
      platforms: 'twitter,linkedin',
      skipVideo: false,
      skipEmail: false,
    },
    deliverableTypes: ['blog', 'video', 'social_post', 'email'],
    exampleTopics: [
      'Black Friday / Cyber Monday sale',
      'New Year kickoff promotion',
      'Summer clearance event',
      'Back-to-school special',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'educational',
    name: 'Educational Content',
    description: 'How-to content that positions your brand as an industry expert and builds trust',
    category: 'Education',
    iconName: 'BookOpen',
    promptTemplate: 'Create an educational campaign about: {topic}. Target audience: {audience}. Generate a comprehensive how-to blog post, educational social tips, and a follow-up email with additional resources.',
    defaults: {
      audience: 'beginners and intermediate practitioners',
      tone: 'empathetic',
      platforms: 'twitter,linkedin',
      skipVideo: true,
      skipEmail: false,
    },
    deliverableTypes: ['blog', 'social_post', 'email'],
    exampleTopics: [
      'Getting started with email marketing automation',
      'Step-by-step guide to social media strategy',
      'How to build your first sales pipeline',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'brand-awareness',
    name: 'Brand Awareness',
    description: 'Storytelling campaign focused on building brand recognition and emotional connection',
    category: 'Brand',
    iconName: 'Megaphone',
    promptTemplate: 'Create a brand awareness campaign about: {topic}. Target audience: {audience}. Generate a brand story blog post, an inspiring video, and social content that builds emotional connection.',
    defaults: {
      audience: 'broad market audience unfamiliar with the brand',
      tone: 'conversational',
      platforms: 'twitter,linkedin',
      skipVideo: false,
      skipEmail: true,
    },
    deliverableTypes: ['blog', 'video', 'social_post'],
    exampleTopics: [
      'Our founding story and mission',
      'Why we built this product',
      'Meet the team behind the brand',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'email-nurture',
    name: 'Email Nurture Sequence',
    description: 'Email-focused campaign with supporting blog content to nurture leads through the funnel',
    category: 'Email',
    iconName: 'Mail',
    promptTemplate: 'Create an email nurture campaign about: {topic}. Target audience: {audience}. Generate a value-driven blog post as linked content, social posts to drive signups, and a compelling nurture email.',
    defaults: {
      audience: 'leads in the consideration stage',
      tone: 'professional',
      platforms: 'linkedin',
      skipVideo: true,
      skipEmail: false,
    },
    deliverableTypes: ['email', 'blog', 'social_post'],
    exampleTopics: [
      'Welcome series for new trial users',
      'Re-engagement campaign for dormant leads',
      'Post-webinar follow-up sequence',
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * GET /api/campaigns/templates
 */
export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json({ templates: DEFAULT_TEMPLATES });
    }

    const collectionPath = getSubCollection('campaignTemplates');
    const snapshot = await adminDb.collection(collectionPath).orderBy('name').get();

    if (snapshot.empty) {
      logger.info('[Campaign Templates] Seeding default templates', { route: '/api/campaigns/templates' });

      const batch = adminDb.batch();
      for (const template of DEFAULT_TEMPLATES) {
        batch.set(adminDb.collection(collectionPath).doc(template.id), template);
      }
      await batch.commit();

      return NextResponse.json({ templates: DEFAULT_TEMPLATES });
    }

    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ templates });
  } catch (error) {
    logger.error(
      '[Campaign Templates] Failed to fetch',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/campaigns/templates' },
    );
    return NextResponse.json({ templates: DEFAULT_TEMPLATES });
  }
}
