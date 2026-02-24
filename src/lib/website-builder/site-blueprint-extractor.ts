/**
 * Site Blueprint Extractor
 * Takes a SiteCrawlResult and uses AI to normalize it into a structured SiteBlueprint.
 * The blueprint is the canonical intermediate format between scraping and page generation.
 */

import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { logger } from '@/lib/logger/logger';
import type { SiteCrawlResult, DeepScrapeResult } from './deep-scraper';

// ============================================================================
// TYPES
// ============================================================================

export interface SiteBlueprintSection {
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'pricing' | 'faq' | 'stats' | 'content' | 'footer';
  heading?: string;
  subheading?: string;
  body?: string;
  buttonText?: string;
  buttonUrl?: string;
  images?: string[];
  items?: Array<{ title?: string; description?: string; icon?: string }>;
}

export interface SiteBlueprintPage {
  type: 'home' | 'about' | 'services' | 'pricing' | 'contact' | 'blog' | 'product' | 'landing' | 'other';
  title: string;
  slug: string;
  sections: SiteBlueprintSection[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export interface SiteBlueprint {
  brand: {
    name: string;
    tagline?: string;
    colors: string[];
    fonts: string[];
    logo?: string;
    industry?: string;
  };
  pages: SiteBlueprintPage[];
  navigation: Array<{ text: string; href: string }>;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  sourceUrl: string;
  extractedAt: string;
}

// ============================================================================
// EXTRACTION
// ============================================================================

const BLUEPRINT_SYSTEM_PROMPT = `You are a website architecture analyst. Given scraped website data, extract a clean site blueprint in JSON format.

## Output Format
Return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "brand": {
    "name": "Company Name",
    "tagline": "Optional tagline",
    "colors": ["#hex1", "#hex2"],
    "fonts": ["Font Name"],
    "logo": "URL or null",
    "industry": "detected industry"
  },
  "pages": [
    {
      "type": "home|about|services|pricing|contact|blog|product|landing|other",
      "title": "Page Title",
      "slug": "page-slug",
      "sections": [
        {
          "type": "hero|features|testimonials|cta|pricing|faq|stats|content|footer",
          "heading": "Section heading",
          "subheading": "Optional subheading",
          "body": "Section body text",
          "buttonText": "CTA text",
          "buttonUrl": "#",
          "items": [{ "title": "Item", "description": "Detail" }]
        }
      ],
      "seo": { "title": "SEO Title", "description": "Meta description", "keywords": ["kw1"] }
    }
  ],
  "navigation": [{ "text": "Nav Label", "href": "/path" }],
  "seo": { "title": "Site Title", "description": "Site description", "keywords": ["keyword"] }
}

## Rules
- Preserve the original copy as closely as possible
- Classify each page type based on its content and URL pattern
- Classify sections by their visual/structural purpose (hero = above-fold banner, features = benefit cards, etc.)
- Extract the 2-5 most prominent brand colors (skip black, white, gray)
- Detect the primary font family
- Derive the industry from the content
- Keep section text concise — max 500 chars per body
- Include only meaningful sections (skip empty or duplicate ones)`;

/**
 * Extract a SiteBlueprint from crawled site data using AI.
 */
export async function extractSiteBlueprint(crawlResult: SiteCrawlResult): Promise<SiteBlueprint> {
  logger.info('Extracting site blueprint', {
    rootUrl: crawlResult.rootUrl,
    pageCount: crawlResult.totalPages,
    file: 'site-blueprint-extractor.ts',
  });

  // Prepare a condensed representation for the AI
  const condensed = condenseCrawlResult(crawlResult);

  const response = await sendUnifiedChatMessage({
    model: 'gpt-4-turbo',
    messages: [{
      role: 'user',
      content: `Analyze this scraped website data and extract a clean site blueprint:\n\n${JSON.stringify(condensed, null, 2)}`,
    }],
    systemInstruction: BLUEPRINT_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 4000,
  });

  const text = response.text.trim();

  // Parse the JSON response
  let blueprintData: Omit<SiteBlueprint, 'sourceUrl' | 'extractedAt'>;
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    blueprintData = JSON.parse(cleaned) as Omit<SiteBlueprint, 'sourceUrl' | 'extractedAt'>;
  } catch {
    logger.error('Failed to parse blueprint JSON from AI response', new Error('JSON parse failed'), {
      responseLength: text.length,
      file: 'site-blueprint-extractor.ts',
    });

    // Return a minimal fallback blueprint from the crawl data
    blueprintData = buildFallbackBlueprint(crawlResult);
  }

  return {
    ...blueprintData,
    sourceUrl: crawlResult.rootUrl,
    extractedAt: new Date().toISOString(),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

interface CondensedPage {
  url: string;
  title: string;
  description: string;
  sections: Array<{
    type: string;
    heading?: string;
    body?: string;
    buttonText?: string;
    itemCount?: number;
  }>;
  navigation: Array<{ text: string; href: string }>;
  brandColors: string[];
  brandFonts: string[];
  logo?: string;
}

/**
 * Condense crawl results to fit within token limits.
 */
function condenseCrawlResult(crawlResult: SiteCrawlResult): {
  rootUrl: string;
  pages: CondensedPage[];
} {
  const pages: CondensedPage[] = crawlResult.pages.map((page: DeepScrapeResult) => ({
    url: page.url,
    title: page.title,
    description: page.description,
    sections: page.sections.map((s) => ({
      type: s.type,
      heading: s.heading,
      body: s.body?.slice(0, 300),
      buttonText: s.buttonText,
      itemCount: s.items?.length,
    })),
    navigation: page.navigation.slice(0, 10),
    brandColors: page.brand.colors.slice(0, 5),
    brandFonts: page.brand.fonts.slice(0, 3),
    logo: page.brand.logo,
  }));

  return { rootUrl: crawlResult.rootUrl, pages };
}

/**
 * Build a fallback blueprint directly from crawl data without AI.
 */
function buildFallbackBlueprint(crawlResult: SiteCrawlResult): Omit<SiteBlueprint, 'sourceUrl' | 'extractedAt'> {
  const homepage = crawlResult.pages[0];
  if (!homepage) {
    return {
      brand: { name: 'Untitled', colors: [], fonts: [] },
      pages: [],
      navigation: [],
      seo: { title: '', description: '', keywords: [] },
    };
  }

  const pages: SiteBlueprintPage[] = crawlResult.pages.map((page, idx) => ({
    type: idx === 0 ? 'home' as const : guessPageType(page.url, page.title),
    title: page.title,
    slug: idx === 0 ? '' : new URL(page.url).pathname.replace(/^\//, '').replace(/\/$/, '') || `page-${idx}`,
    sections: page.sections.map((s) => ({
      type: s.type === 'unknown' ? 'content' as const : s.type === 'navigation' ? 'content' as const : s.type,
      heading: s.heading,
      subheading: s.subheading,
      body: s.body,
      buttonText: s.buttonText,
      buttonUrl: s.buttonUrl,
      images: s.images.length > 0 ? s.images : undefined,
      items: s.items,
    })),
    seo: {
      title: page.meta.ogTitle ?? page.title,
      description: page.meta.ogDescription ?? page.description,
      keywords: page.meta.keywords ?? [],
    },
  }));

  return {
    brand: {
      name: homepage.title.split(/[|\-–—]/).map((s) => s.trim())[0] ?? 'Untitled',
      colors: homepage.brand.colors.slice(0, 5),
      fonts: homepage.brand.fonts.slice(0, 3),
      logo: homepage.brand.logo,
    },
    pages,
    navigation: homepage.navigation.slice(0, 8),
    seo: {
      title: homepage.meta.ogTitle ?? homepage.title,
      description: homepage.meta.ogDescription ?? homepage.description,
      keywords: homepage.meta.keywords ?? [],
    },
  };
}

function guessPageType(url: string, title: string): SiteBlueprintPage['type'] {
  const path = new URL(url).pathname.toLowerCase();
  const t = title.toLowerCase();

  if (path.includes('about') || t.includes('about')) {
    return 'about';
  }
  if (path.includes('service') || t.includes('service')) {
    return 'services';
  }
  if (path.includes('pricing') || path.includes('plans') || t.includes('pricing')) {
    return 'pricing';
  }
  if (path.includes('contact') || t.includes('contact')) {
    return 'contact';
  }
  if (path.includes('blog') || t.includes('blog')) {
    return 'blog';
  }
  if (path.includes('product') || t.includes('product')) {
    return 'product';
  }
  return 'other';
}
