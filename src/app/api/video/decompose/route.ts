/**
 * Video Decomposition API
 * POST /api/video/decompose - Generate AI-driven scene breakdown from video description
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const VideoTypeValues = ['tutorial', 'explainer', 'product-demo', 'sales-pitch', 'testimonial', 'social-ad'] as const;
const PlatformValues = ['youtube', 'tiktok', 'instagram', 'linkedin', 'website'] as const;

const DecomposeSchema = z.object({
  description: z.string().min(1, 'Video description required'),
  videoType: z.enum(VideoTypeValues),
  platform: z.enum(PlatformValues),
  duration: z.number().min(10).max(600).default(60),
});

interface Scene {
  sceneNumber: number;
  title: string;
  scriptText: string;
  visualDescription: string;
  suggestedDuration: number;
}

interface DecomposePlan {
  videoType: string;
  targetAudience: string;
  keyMessages: string[];
  scenes: Scene[];
  assetsNeeded: string[];
  avatarRecommendation: null;
  estimatedTotalDuration: number;
}

type VideoType = typeof VideoTypeValues[number];

/**
 * Generate scene breakdown based on video type and description
 */
function generateSceneBreakdown(
  description: string,
  videoType: VideoType,
  platform: string,
  duration: number,
  sceneCount: number
): Scene[] {
  const scenes: Scene[] = [];
  const durationPerScene = Math.floor(duration / sceneCount);

  // Extract key phrases from description for script generation
  const extractedContext = description.substring(0, 100);

  switch (videoType) {
    case 'tutorial': {
      // Intro → Step-by-step scenes → Summary/CTA
      scenes.push({
        sceneNumber: 1,
        title: 'Introduction',
        scriptText: `Welcome to this tutorial. Today we'll be covering ${extractedContext}. By the end of this video, you'll have a clear understanding of how to achieve your goals with this approach.`,
        visualDescription: 'Title card with tutorial topic, professional background',
        suggestedDuration: durationPerScene,
      });

      for (let i = 2; i < sceneCount; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Step ${i - 1}`,
          scriptText: `In this step, we focus on implementing the key aspects of ${extractedContext}. Follow along carefully as we demonstrate the exact process you need to replicate these results.`,
          visualDescription: `Screen recording or demonstration of step ${i - 1}`,
          suggestedDuration: durationPerScene,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Summary & Next Steps',
        scriptText: `Great job! You've now learned the essential techniques for ${extractedContext}. Remember to practice these steps and don't hesitate to revisit this tutorial. Subscribe for more helpful content.`,
        visualDescription: 'Summary slide with key takeaways and call-to-action',
        suggestedDuration: durationPerScene,
      });
      break;
    }

    case 'explainer': {
      // Hook → Problem → Solution → Benefits → CTA
      scenes.push({
        sceneNumber: 1,
        title: 'Hook',
        scriptText: `Did you know that most businesses struggle with ${extractedContext}? In the next ${duration} seconds, we'll show you a better way.`,
        visualDescription: 'Attention-grabbing visual or statistic',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Problem',
        scriptText: `Traditional approaches to ${extractedContext} are time-consuming, inefficient, and costly. Many teams waste hours on tasks that could be automated or streamlined.`,
        visualDescription: 'Visualization of common pain points and challenges',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 3,
        title: 'The Solution',
        scriptText: `That's where ${extractedContext} comes in. Our approach transforms the way you work by automating complex processes and delivering results in minutes, not hours.`,
        visualDescription: 'Product or solution demonstration',
        suggestedDuration: durationPerScene,
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Key Benefits',
          scriptText: `With ${extractedContext}, you'll save time, reduce costs, and improve outcomes. Teams report up to 10x productivity gains and significantly better results.`,
          visualDescription: 'Benefits list with icons or graphics',
          suggestedDuration: durationPerScene,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Call to Action',
        scriptText: `Ready to transform your workflow? Get started today with ${extractedContext}. Click the link below to learn more and start your free trial.`,
        visualDescription: 'CTA button with website URL or contact information',
        suggestedDuration: durationPerScene,
      });
      break;
    }

    case 'product-demo': {
      // Intro → Feature highlights → Use cases → CTA
      scenes.push({
        sceneNumber: 1,
        title: 'Product Introduction',
        scriptText: `Welcome to ${extractedContext}. In this demo, we'll walk you through the key features and show you how our solution can transform your business.`,
        visualDescription: 'Product logo and hero image',
        suggestedDuration: durationPerScene,
      });

      for (let i = 2; i < sceneCount - 1; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Feature ${i - 1}`,
          scriptText: `Let's explore one of our most powerful features. ${extractedContext} enables you to accomplish tasks faster and more efficiently than ever before.`,
          visualDescription: `Screen recording showing feature ${i - 1} in action`,
          suggestedDuration: durationPerScene,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Get Started',
        scriptText: `You've seen how ${extractedContext} can streamline your workflow. Ready to experience it yourself? Sign up now and get instant access to all these powerful features.`,
        visualDescription: 'Sign-up form or demo request CTA',
        suggestedDuration: durationPerScene,
      });
      break;
    }

    case 'sales-pitch': {
      // Pain point → Solution intro → Benefits → Social proof → CTA
      scenes.push({
        sceneNumber: 1,
        title: 'The Pain Point',
        scriptText: `Are you tired of dealing with ${extractedContext}? You're not alone. Thousands of businesses face this same challenge every single day.`,
        visualDescription: 'Relatable scenario showing the problem',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 2,
        title: 'Introducing the Solution',
        scriptText: `Imagine if ${extractedContext} could be completely automated. Our solution does exactly that, giving you back hours of valuable time.`,
        visualDescription: 'Product introduction with key value proposition',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 3,
        title: 'Why It Works',
        scriptText: `Unlike other approaches, ${extractedContext} is built on proven technology that delivers consistent results. It's fast, reliable, and incredibly easy to use.`,
        visualDescription: 'Feature benefits and comparison chart',
        suggestedDuration: durationPerScene,
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Proven Results',
          scriptText: `Don't just take our word for it. Companies using ${extractedContext} report an average ROI of 300% in the first quarter. Results speak louder than promises.`,
          visualDescription: 'Customer testimonials and success metrics',
          suggestedDuration: durationPerScene,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Special Offer',
        scriptText: `Ready to see these results for yourself? For a limited time, we're offering exclusive pricing for new customers. Click below to claim your spot before it's gone.`,
        visualDescription: 'Limited-time offer with pricing details',
        suggestedDuration: durationPerScene,
      });
      break;
    }

    case 'testimonial': {
      // Intro → Story → Results → Recommendation
      scenes.push({
        sceneNumber: 1,
        title: 'Introduction',
        scriptText: `Hi, I'm here to share my experience with ${extractedContext}. Before I started using this solution, I was facing some serious challenges.`,
        visualDescription: 'Customer speaking to camera, authentic setting',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Journey',
        scriptText: `When I first discovered ${extractedContext}, I was skeptical. But after trying it out, I quickly realized this was different from anything else I'd tried.`,
        visualDescription: 'Customer describing their experience',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 3,
        title: 'The Results',
        scriptText: `The impact has been incredible. Since implementing ${extractedContext}, I've seen measurable improvements across the board. My productivity has doubled, and I'm achieving goals I never thought possible.`,
        visualDescription: 'B-roll showing success metrics or results',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: sceneCount,
        title: 'My Recommendation',
        scriptText: `If you're on the fence about ${extractedContext}, my advice is simple: just try it. You have nothing to lose and everything to gain. It's been a game-changer for me.`,
        visualDescription: 'Customer final thoughts with product logo',
        suggestedDuration: durationPerScene,
      });
      break;
    }

    case 'social-ad': {
      // Hook → Value prop → Demo → CTA
      scenes.push({
        sceneNumber: 1,
        title: 'Scroll-Stopping Hook',
        scriptText: `Stop scrolling! What if I told you ${extractedContext} could change everything? Watch this.`,
        visualDescription: 'Bold text overlay with eye-catching visual',
        suggestedDuration: durationPerScene,
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Promise',
        scriptText: `${extractedContext} delivers results you can see immediately. No complicated setup, no learning curve—just instant value.`,
        visualDescription: 'Quick benefit statements with dynamic graphics',
        suggestedDuration: durationPerScene,
      });

      if (sceneCount > 3) {
        scenes.push({
          sceneNumber: 3,
          title: 'Quick Demo',
          scriptText: `Here's exactly how it works. In just a few clicks, you can accomplish what used to take hours. It's that simple.`,
          visualDescription: 'Fast-paced product demonstration',
          suggestedDuration: durationPerScene,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Urgent CTA',
        scriptText: `Don't wait—${extractedContext} is waiting for you. Tap the link now and get started in seconds. Limited spots available!`,
        visualDescription: 'Clear CTA button with urgency indicators',
        suggestedDuration: durationPerScene,
      });
      break;
    }

    default: {
      // Fallback generic structure
      for (let i = 1; i <= sceneCount; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Scene ${i}`,
          scriptText: `This scene focuses on ${extractedContext}. We'll cover the key points and ensure the message resonates with your audience.`,
          visualDescription: `Visual content for scene ${i}`,
          suggestedDuration: durationPerScene,
        });
      }
    }
  }

  return scenes;
}

/**
 * Extract key messages from description
 */
function extractKeyMessages(description: string, videoType: VideoType): string[] {
  const messages: string[] = [];
  const descriptionLower = description.toLowerCase();

  // Add type-specific messages
  if (videoType === 'tutorial') {
    messages.push('Step-by-step guidance');
    messages.push('Practical implementation');
  } else if (videoType === 'explainer') {
    messages.push('Clear problem-solution narrative');
    messages.push('Educational value');
  } else if (videoType === 'product-demo') {
    messages.push('Feature showcase');
    messages.push('Practical use cases');
  } else if (videoType === 'sales-pitch') {
    messages.push('Value proposition');
    messages.push('ROI and benefits');
  } else if (videoType === 'testimonial') {
    messages.push('Authentic customer story');
    messages.push('Real-world results');
  } else if (videoType === 'social-ad') {
    messages.push('Immediate engagement');
    messages.push('Clear call-to-action');
  }

  // Add context from description
  if (descriptionLower.includes('save time') || descriptionLower.includes('efficiency')) {
    messages.push('Time savings and efficiency');
  }

  return messages.slice(0, 3);
}

/**
 * Determine assets needed based on video type
 */
function determineAssetsNeeded(videoType: VideoType, _platform: string): string[] {
  const baseAssets = ['Brand logo', 'Background music'];

  if (videoType === 'tutorial' || videoType === 'product-demo') {
    return [...baseAssets, 'Screen recordings', 'Product screenshots'];
  } else if (videoType === 'testimonial') {
    return [...baseAssets, 'Customer video footage', 'B-roll clips'];
  } else if (videoType === 'social-ad') {
    return [...baseAssets, 'Eye-catching graphics', 'Motion graphics'];
  } else if (videoType === 'explainer') {
    return [...baseAssets, 'Infographics', 'Icon set', 'Animation assets'];
  } else if (videoType === 'sales-pitch') {
    return [...baseAssets, 'Product images', 'Statistics graphics', 'Testimonial clips'];
  }

  return baseAssets;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parseResult = DecomposeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { description, videoType, platform, duration } = parseResult.data;

    logger.info('Video Decompose API: Generating scene breakdown', {
      videoType,
      platform,
      duration,
    });

    // Calculate scene count
    const sceneCount = Math.max(2, Math.min(8, Math.ceil(duration / 15)));

    // Generate scenes
    const scenes = generateSceneBreakdown(description, videoType, platform, duration, sceneCount);

    // Calculate total duration from scenes
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.suggestedDuration, 0);

    // Extract key messages
    const keyMessages = extractKeyMessages(description, videoType);

    // Determine assets needed
    const assetsNeeded = determineAssetsNeeded(videoType, platform);

    const plan: DecomposePlan = {
      videoType,
      targetAudience: 'Business professionals and teams',
      keyMessages,
      scenes,
      assetsNeeded,
      avatarRecommendation: null,
      estimatedTotalDuration: totalDuration,
    };

    return NextResponse.json({
      success: true,
      plan,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video decompose API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
