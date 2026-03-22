/**
 * Starter video templates for the pipeline.
 * Each template pre-populates the brief, scene structure, and suggested settings.
 */

import type { VideoAspectRatio } from '@/types/video';

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'marketing' | 'social' | 'internal';
  icon: string; // Lucide icon name
  estimatedDuration: number; // seconds
  aspectRatio: VideoAspectRatio;
  platform: string; // e.g. "YouTube, LinkedIn"
  brief: {
    description: string;
    targetAudience: string;
    tone: string;
  };
  scenes: Array<{
    title: string;
    scriptText: string;
    duration: number;
    visualDescription: string;
  }>;
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'weekly-sales-update',
    name: 'Weekly Sales Update',
    description: 'Quick team update with metrics, wins, and next week focus',
    category: 'sales',
    icon: 'TrendingUp',
    estimatedDuration: 45,
    aspectRatio: '16:9',
    platform: 'Internal, LinkedIn',
    brief: {
      description:
        'Weekly sales performance update covering key metrics, notable wins, and priorities for next week.',
      targetAudience: 'Sales team and leadership',
      tone: 'Professional, motivating',
    },
    scenes: [
      {
        title: 'Hook & Headlines',
        scriptText:
          "Hey team — here's your weekly sales roundup. Let me walk you through the numbers.",
        duration: 10,
        visualDescription: 'Presenter on camera, confident and energetic',
      },
      {
        title: 'Key Metrics',
        scriptText:
          '[INSERT: Total closed, pipeline value, conversion rate, top performer]. Great progress this week.',
        duration: 20,
        visualDescription: 'Presenter highlighting key data points',
      },
      {
        title: 'Call to Action',
        scriptText:
          "For next week, let's focus on [INSERT PRIORITY]. Let's make it happen. See you out there.",
        duration: 15,
        visualDescription: 'Presenter wrapping up with energy and motivation',
      },
    ],
  },
  {
    id: 'product-demo',
    name: 'Product Demo',
    description: 'Show off your product with a problem-solution-demo-CTA flow',
    category: 'marketing',
    icon: 'Play',
    estimatedDuration: 60,
    aspectRatio: '16:9',
    platform: 'YouTube, Website',
    brief: {
      description:
        'Product demonstration video showing the problem, our solution, a live walkthrough, and clear next step.',
      targetAudience: 'Potential customers evaluating the product',
      tone: 'Friendly, confident, clear',
    },
    scenes: [
      {
        title: 'The Problem',
        scriptText:
          "If you've ever struggled with [PROBLEM], you're not alone. Most teams waste hours on this every week.",
        duration: 15,
        visualDescription: 'Presenter empathizing with the audience pain point',
      },
      {
        title: 'The Solution',
        scriptText:
          "That's exactly why we built [PRODUCT]. It [KEY BENEFIT] so you can [OUTCOME].",
        duration: 15,
        visualDescription: 'Presenter introducing the product with confidence',
      },
      {
        title: 'The Demo',
        scriptText:
          "Let me show you how it works. [WALK THROUGH KEY FEATURE]. It's really that simple.",
        duration: 20,
        visualDescription: 'Screen recording or presenter demonstrating the product',
      },
      {
        title: 'Call to Action',
        scriptText:
          'Ready to try it yourself? Head to [URL] and start your free trial today. No credit card required.',
        duration: 10,
        visualDescription: 'Presenter with clear CTA and URL on screen',
      },
    ],
  },
  {
    id: 'testimonial-case-study',
    name: 'Testimonial / Case Study',
    description: 'Share a customer success story with challenge-solution-results',
    category: 'marketing',
    icon: 'Star',
    estimatedDuration: 45,
    aspectRatio: '16:9',
    platform: 'YouTube, LinkedIn, Website',
    brief: {
      description:
        'Customer success story highlighting the challenge they faced, how our solution helped, and measurable results.',
      targetAudience: 'Prospects in evaluation stage',
      tone: 'Authentic, credible, results-focused',
    },
    scenes: [
      {
        title: 'The Challenge',
        scriptText:
          '[CUSTOMER NAME] was facing [SPECIFIC CHALLENGE]. Their team was spending [TIME/MONEY] on [OLD PROCESS].',
        duration: 15,
        visualDescription: 'Presenter setting the scene for the customer story',
      },
      {
        title: 'The Solution',
        scriptText:
          'After implementing [PRODUCT], everything changed. [SPECIFIC FEATURE] allowed them to [BENEFIT].',
        duration: 15,
        visualDescription: 'Presenter explaining the transformation',
      },
      {
        title: 'The Results',
        scriptText:
          "The results speak for themselves: [METRIC 1], [METRIC 2], and [METRIC 3]. That's real impact.",
        duration: 15,
        visualDescription: 'Presenter sharing impressive metrics with enthusiasm',
      },
    ],
  },
  {
    id: 'social-media-ad',
    name: 'Social Media Ad (Short)',
    description: 'Quick hook-and-CTA for TikTok, Reels, or Shorts',
    category: 'social',
    icon: 'Zap',
    estimatedDuration: 15,
    aspectRatio: '9:16',
    platform: 'TikTok, Instagram Reels, YouTube Shorts',
    brief: {
      description:
        'Short-form social media ad designed to capture attention in the first 2 seconds and drive action.',
      targetAudience: 'Scroll-stopping social media audience',
      tone: 'Bold, urgent, conversational',
    },
    scenes: [
      {
        title: 'Hook',
        scriptText: 'Stop scrolling — this will save you [TIME/MONEY] this week.',
        duration: 7,
        visualDescription:
          'Presenter looking directly at camera, high energy, immediate value prop',
      },
      {
        title: 'Call to Action',
        scriptText:
          '[PRODUCT] does [ONE THING] better than anything else. Link in bio to try it free.',
        duration: 8,
        visualDescription: 'Presenter with urgency, pointing gesture, clear CTA overlay',
      },
    ],
  },
  {
    id: 'company-announcement',
    name: 'Company Announcement',
    description: 'Share news, updates, or milestones with your team or audience',
    category: 'internal',
    icon: 'Megaphone',
    estimatedDuration: 30,
    aspectRatio: '16:9',
    platform: 'Internal, LinkedIn, Email',
    brief: {
      description:
        'Company announcement video sharing important news, context, and next steps for the team or public audience.',
      targetAudience: 'Internal team and/or public audience',
      tone: 'Confident, transparent, forward-looking',
    },
    scenes: [
      {
        title: 'The News',
        scriptText:
          "I'm excited to share some big news — [ANNOUNCEMENT]. This has been months in the making.",
        duration: 10,
        visualDescription: 'Presenter delivering exciting news with genuine enthusiasm',
      },
      {
        title: 'The Details',
        scriptText:
          "Here's what this means for [you/the team/our customers]: [IMPACT 1] and [IMPACT 2].",
        duration: 10,
        visualDescription: 'Presenter explaining the impact and implications',
      },
      {
        title: 'Next Steps',
        scriptText:
          "Here's what happens next: [ACTION ITEMS]. If you have questions, [CONTACT METHOD]. Exciting times ahead.",
        duration: 10,
        visualDescription: 'Presenter closing with clear direction and optimism',
      },
    ],
  },
];
