/**
 * AI Search Optimization Health API
 * Returns a scored health report of all AI search optimization features:
 * robots.txt, llms.txt, schema markup coverage, sitemap freshness, AI bot access.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateSiteSchemaReport } from '@/lib/seo/schema-markup-service';
import { logger } from '@/lib/logger/logger';
import type { Page, BlogPost, SiteConfig } from '@/types/website';

interface WebsiteSettings extends Partial<SiteConfig> {
  robotsTxt?: string;
  llmsTxt?: string;
}

interface AiBotStatus {
  userAgent: string;
  label: string;
  allowed: boolean;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  details: string;
}

const AI_BOTS = [
  { userAgent: 'GPTBot', label: 'OpenAI GPT' },
  { userAgent: 'ChatGPT-User', label: 'ChatGPT' },
  { userAgent: 'Google-Extended', label: 'Google Gemini' },
  { userAgent: 'Claude-Web', label: 'Anthropic Claude' },
  { userAgent: 'anthropic-ai', label: 'Anthropic AI' },
  { userAgent: 'CCBot', label: 'Common Crawl' },
  { userAgent: 'PerplexityBot', label: 'Perplexity' },
  { userAgent: 'Bytespider', label: 'ByteDance' },
  { userAgent: 'cohere-ai', label: 'Cohere' },
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Load site settings
    const settingsRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/settings`
    );
    const settingsDoc = await settingsRef.get();
    const settings = (settingsDoc.data() as WebsiteSettings | undefined) ?? {};

    // Load published pages
    const pagesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/pages`
    );
    const pagesSnapshot = await pagesRef.where('status', '==', 'published').get();
    const pages: Page[] = [];
    pagesSnapshot.forEach((doc) => {
      pages.push({ id: doc.id, ...doc.data() } as Page);
    });

    // Load published blog posts
    const postsRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/blog-posts`
    );
    const postsSnapshot = await postsRef.where('status', '==', 'published').get();
    const posts: BlogPost[] = [];
    postsSnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as BlogPost);
    });

    // Determine base URL
    const host = request.headers.get('host') ?? 'localhost';
    const baseUrl = settings.customDomain
      ? `https://${settings.customDomain}`
      : settings.subdomain
        ? `https://${settings.subdomain}.${host}`
        : `https://${host}`;

    // Run health checks
    const checks: HealthCheck[] = [];

    // 1. Robots.txt check
    const hasCustomRobotsTxt = Boolean(settings.robotsTxt);
    const robotsIndexEnabled = settings.seo?.robotsIndex !== false;
    checks.push({
      name: 'Robots.txt',
      status: robotsIndexEnabled ? 'pass' : 'warn',
      score: robotsIndexEnabled ? 100 : 50,
      details: hasCustomRobotsTxt
        ? 'Custom robots.txt configured'
        : robotsIndexEnabled
          ? 'Auto-generated robots.txt with indexing enabled'
          : 'Indexing disabled — search engines cannot crawl your site',
    });

    // 2. llms.txt check
    const hasLlmsTxt = Boolean(settings.llmsTxt);
    const hasSeoTitle = Boolean(settings.seo?.title);
    const hasSeoDescription = Boolean(settings.seo?.description);
    const llmsAutoGenReady = hasSeoTitle && hasSeoDescription;
    checks.push({
      name: 'llms.txt',
      status: hasLlmsTxt ? 'pass' : llmsAutoGenReady ? 'pass' : 'warn',
      score: hasLlmsTxt ? 100 : llmsAutoGenReady ? 80 : 30,
      details: hasLlmsTxt
        ? 'Custom llms.txt configured'
        : llmsAutoGenReady
          ? 'Auto-generated from site title, description, and published content'
          : 'Missing site title/description — llms.txt will be sparse. Add SEO metadata.',
    });

    // 3. Schema markup coverage
    const schemaReport = generateSiteSchemaReport(settings, baseUrl, pages, posts);
    const coveragePercent = schemaReport.coverage.coveragePercent;
    checks.push({
      name: 'Schema Markup',
      status: coveragePercent >= 80 ? 'pass' : coveragePercent >= 50 ? 'warn' : 'fail',
      score: coveragePercent,
      details: `${coveragePercent}% coverage — ${schemaReport.coverage.pagesWithSchema}/${schemaReport.coverage.totalPages} pages, ${schemaReport.coverage.postsWithSchema}/${schemaReport.coverage.totalPosts} blog posts have JSON-LD schemas`,
    });

    // 4. Sitemap freshness
    const hasPublishedPages = pages.length > 0;
    const hasPublishedPosts = posts.length > 0;
    const hasSitemapContent = hasPublishedPages || hasPublishedPosts;
    checks.push({
      name: 'Sitemap',
      status: hasSitemapContent ? 'pass' : 'warn',
      score: hasSitemapContent ? 100 : 40,
      details: hasSitemapContent
        ? `Sitemap includes ${pages.length} pages and ${posts.length} blog posts`
        : 'No published content — sitemap is empty. Publish pages to populate.',
    });

    // 5. SEO metadata completeness
    const seoFields = [
      hasSeoTitle,
      hasSeoDescription,
      Boolean(settings.seo?.keywords?.length),
      Boolean(settings.seo?.ogImage),
      Boolean(settings.seo?.favicon),
    ];
    const seoScore = Math.round((seoFields.filter(Boolean).length / seoFields.length) * 100);
    checks.push({
      name: 'SEO Metadata',
      status: seoScore >= 80 ? 'pass' : seoScore >= 60 ? 'warn' : 'fail',
      score: seoScore,
      details: `${seoFields.filter(Boolean).length}/5 SEO fields configured (title, description, keywords, OG image, favicon)`,
    });

    // 6. AI bot access matrix
    const aiBotAccess = settings.seo?.aiBotAccess ?? {};
    const botStatuses: AiBotStatus[] = AI_BOTS.map((bot) => ({
      userAgent: bot.userAgent,
      label: bot.label,
      allowed: aiBotAccess[bot.userAgent] !== false,
    }));
    const allowedBots = botStatuses.filter((b) => b.allowed).length;
    checks.push({
      name: 'AI Bot Access',
      status: allowedBots > 0 ? 'pass' : 'warn',
      score: Math.round((allowedBots / AI_BOTS.length) * 100),
      details: `${allowedBots}/${AI_BOTS.length} AI bots allowed to crawl`,
    });

    // Calculate overall score
    const overallScore = Math.round(
      checks.reduce((sum, c) => sum + c.score, 0) / checks.length
    );

    return NextResponse.json({
      success: true,
      overallScore,
      grade: overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F',
      checks,
      aiBots: botStatuses,
      schemaCoverage: schemaReport.coverage,
      contentStats: {
        publishedPages: pages.length,
        publishedPosts: posts.length,
        totalContent: pages.length + posts.length,
      },
    });
  } catch (error: unknown) {
    logger.error('AI search health check failed', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/admin/seo/ai-search',
      method: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to run AI search health check' },
      { status: 500 }
    );
  }
}
