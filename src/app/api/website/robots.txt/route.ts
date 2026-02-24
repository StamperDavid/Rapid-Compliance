/**
 * Robots.txt Generator
 * Serves custom robots.txt from site settings with AI bot directives.
 * Includes user-agent rules for major AI crawlers (GPTBot, Claude-Web, etc.)
 * and references llms.txt for AI model discovery.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

interface WebsiteData {
  customDomain?: string;
  customDomainVerified?: boolean;
  subdomain?: string;
  robotsTxt?: string;
  seo?: {
    robotsIndex?: boolean;
    robotsFollow?: boolean;
    aiBotAccess?: Record<string, boolean>;
  };
}

/**
 * Known AI crawler user-agents.
 * These are the major LLM/AI bots that respect robots.txt directives.
 */
const AI_BOTS = [
  { userAgent: 'GPTBot', label: 'OpenAI GPT crawler' },
  { userAgent: 'ChatGPT-User', label: 'ChatGPT browsing' },
  { userAgent: 'Google-Extended', label: 'Google Gemini training' },
  { userAgent: 'Claude-Web', label: 'Anthropic Claude crawler' },
  { userAgent: 'anthropic-ai', label: 'Anthropic AI crawler' },
  { userAgent: 'CCBot', label: 'Common Crawl (AI training)' },
  { userAgent: 'PerplexityBot', label: 'Perplexity AI crawler' },
  { userAgent: 'Bytespider', label: 'ByteDance AI crawler' },
  { userAgent: 'cohere-ai', label: 'Cohere AI crawler' },
] as const;

export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return new NextResponse('Server configuration error', { status: 500 });
    }

    const host = request.headers.get('host') ?? '';

    // Get site settings
    const settingsRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/settings`
    );
    const settingsDoc = await settingsRef.get();
    const settingsData = settingsDoc.data() as WebsiteData | undefined;

    // If fully custom robots.txt is saved, serve it directly
    if (settingsData?.robotsTxt) {
      return new NextResponse(settingsData.robotsTxt, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }

    // Auto-generate robots.txt from settings
    const robotsTxt = generateRobotsTxt(host, settingsData);

    return new NextResponse(robotsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    logger.error('Robots.txt generation error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/robots.txt',
      method: 'GET',
    });
    return new NextResponse('Failed to generate robots.txt', { status: 500 });
  }
}

function generateRobotsTxt(host: string, settings: WebsiteData | undefined): string {
  const lines: string[] = [];

  // General crawlers
  lines.push('User-agent: *');
  if (settings?.seo?.robotsIndex === false) {
    lines.push('Disallow: /');
  } else {
    lines.push('Allow: /');
    // Block internal/admin paths
    lines.push('Disallow: /api/');
    lines.push('Disallow: /admin/');
    lines.push('Disallow: /_next/');
  }
  lines.push('');

  // AI bot directives
  const aiBotAccess = settings?.seo?.aiBotAccess ?? {};
  const hasAnyAiBotRules = Object.keys(aiBotAccess).length > 0;

  if (hasAnyAiBotRules) {
    // Only output rules for bots that are explicitly blocked
    for (const bot of AI_BOTS) {
      const allowed = aiBotAccess[bot.userAgent];
      if (allowed === false) {
        lines.push(`# ${bot.label}`);
        lines.push(`User-agent: ${bot.userAgent}`);
        lines.push('Disallow: /');
        lines.push('');
      }
    }
  }

  // Discovery files
  lines.push(`Sitemap: https://${host}/sitemap.xml`);
  lines.push('');

  // llms.txt reference for AI model discovery
  lines.push('# AI model discovery');
  lines.push(`# llms.txt: https://${host}/llms.txt`);

  return lines.join('\n');
}
