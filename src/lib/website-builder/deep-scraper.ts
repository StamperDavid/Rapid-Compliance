/**
 * Deep Scraper & Multi-Page Crawler
 * Extracts section-level structure from websites for the migration pipeline.
 *
 * deepScrape(url)  — section-level extraction (hero, features, CTA, etc.)
 * crawlSite(url)   — follows internal links and deep-scrapes each page
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface DeepScrapeSection {
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'pricing' | 'faq' | 'stats' | 'content' | 'footer' | 'navigation' | 'unknown';
  heading?: string;
  subheading?: string;
  body?: string;
  buttonText?: string;
  buttonUrl?: string;
  images: string[];
  items?: Array<{ title?: string; description?: string; icon?: string }>;
}

export interface DeepScrapeResult {
  url: string;
  title: string;
  description: string;
  sections: DeepScrapeSection[];
  navigation: Array<{ text: string; href: string }>;
  meta: {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    keywords?: string[];
    favicon?: string;
  };
  brand: {
    colors: string[];
    fonts: string[];
    logo?: string;
  };
  images: string[];
  scrapedAt: string;
}

export interface SiteCrawlResult {
  rootUrl: string;
  pages: DeepScrapeResult[];
  internalLinks: Array<{ from: string; to: string }>;
  totalPages: number;
  crawledAt: string;
}

// ============================================================================
// DEEP SCRAPER
// ============================================================================

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Deep-scrape a single URL with section-level extraction.
 */
export async function deepScrape(url: string): Promise<DeepScrapeResult> {
  logger.info('Deep scraping URL', { url, file: 'deep-scraper.ts' });

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract metadata
  const title = $('title').text().trim() || $('h1').first().text().trim() || '';
  const description = $('meta[name="description"]').attr('content') ?? '';
  const meta = {
    ogTitle: $('meta[property="og:title"]').attr('content'),
    ogDescription: $('meta[property="og:description"]').attr('content'),
    ogImage: $('meta[property="og:image"]').attr('content'),
    keywords: $('meta[name="keywords"]').attr('content')?.split(',').map((k) => k.trim()),
    favicon: $('link[rel="icon"]').attr('href') ?? $('link[rel="shortcut icon"]').attr('href'),
  };

  // Extract navigation
  const navigation: Array<{ text: string; href: string }> = [];
  $('nav a, header a').each((_i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      navigation.push({ text, href: resolveUrl(href, url) });
    }
  });
  // Deduplicate
  const navSeen = new Set<string>();
  const uniqueNav = navigation.filter((item) => {
    if (navSeen.has(item.href)) {
      return false;
    }
    navSeen.add(item.href);
    return true;
  });

  // Extract brand hints
  const brand = extractBrandHints($, html);

  // Extract all images
  const images: string[] = [];
  $('img').each((_i, el) => {
    const src = $(el).attr('src') ?? $(el).attr('data-src');
    if (src && !src.startsWith('data:') && !src.includes('placeholder')) {
      images.push(resolveUrl(src, url));
    }
  });

  // Extract sections
  const sections = extractSections($, url);

  return {
    url,
    title,
    description,
    sections,
    navigation: uniqueNav,
    meta,
    brand,
    images: [...new Set(images)].slice(0, 50),
    scrapedAt: new Date().toISOString(),
  };
}

// ============================================================================
// MULTI-PAGE CRAWLER
// ============================================================================

/**
 * Crawl a site by following internal links from the homepage.
 * Same-domain only. Respects maxPages limit.
 */
export async function crawlSite(
  rootUrl: string,
  maxPages = 10
): Promise<SiteCrawlResult> {
  logger.info('Starting site crawl', { rootUrl, maxPages, file: 'deep-scraper.ts' });

  const rootDomain = new URL(rootUrl).hostname;
  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(rootUrl)];
  const pages: DeepScrapeResult[] = [];
  const internalLinks: Array<{ from: string; to: string }> = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }
    visited.add(currentUrl);

    try {
      const result = await deepScrape(currentUrl);
      pages.push(result);

      // Discover internal links for further crawling
      for (const navItem of result.navigation) {
        const resolved = normalizeUrl(navItem.href);
        try {
          const linkDomain = new URL(resolved).hostname;
          if (linkDomain === rootDomain && !visited.has(resolved)) {
            queue.push(resolved);
            internalLinks.push({ from: currentUrl, to: resolved });
          }
        } catch {
          // Invalid URL — skip
        }
      }
    } catch (error) {
      logger.warn('Failed to scrape page during crawl', {
        url: currentUrl,
        error: error instanceof Error ? error.message : String(error),
        file: 'deep-scraper.ts',
      });
    }
  }

  return {
    rootUrl,
    pages,
    internalLinks,
    totalPages: pages.length,
    crawledAt: new Date().toISOString(),
  };
}

// ============================================================================
// SECTION EXTRACTION
// ============================================================================

function extractSections($: cheerio.CheerioAPI, baseUrl: string): DeepScrapeSection[] {
  const sections: DeepScrapeSection[] = [];

  // Try semantic HTML sections first
  const sectionEls = $('main section, main > div, article, [class*="section"], [class*="hero"], [class*="feature"], [class*="testimonial"], [class*="pricing"], [class*="faq"], [class*="cta"], [class*="footer"]');

  if (sectionEls.length > 0) {
    sectionEls.each((_i, el) => {
      const section = classifySection($, el, baseUrl);
      if (section) {
        sections.push(section);
      }
    });
  }

  // Fallback: if no semantic sections found, extract from body
  if (sections.length === 0) {
    const body = $('body');
    const heading = body.find('h1').first().text().trim();
    const bodyText = body.find('p').first().text().trim();

    sections.push({
      type: 'content',
      heading: heading || undefined,
      body: bodyText || undefined,
      images: [],
    });
  }

  // Deduplicate by heading
  const seen = new Set<string>();
  return sections.filter((s) => {
    const key = `${s.type}:${s.heading ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function classifySection($: cheerio.CheerioAPI, el: Element, baseUrl: string): DeepScrapeSection | null {
  const $el = $(el);
  const classes = ($el.attr('class') ?? '').toLowerCase();
  const text = $el.text().trim();

  // Skip empty sections
  if (text.length < 10) {
    return null;
  }

  const heading = $el.find('h1, h2, h3').first().text().trim() || undefined;
  const subheading = $el.find('h2, h3, p').first().text().trim() || undefined;
  const body = $el.find('p').map((_i, p) => $(p).text().trim()).get().join(' ').slice(0, 500) || undefined;

  const buttonEl = $el.find('a[class*="btn"], a[class*="button"], button').first();
  const buttonText = buttonEl.text().trim() || undefined;
  const buttonUrl = buttonEl.attr('href') ? resolveUrl(buttonEl.attr('href') ?? '', baseUrl) : undefined;

  const sectionImages: string[] = [];
  $el.find('img').each((_i, img) => {
    const src = $(img).attr('src') ?? $(img).attr('data-src');
    if (src && !src.startsWith('data:')) {
      sectionImages.push(resolveUrl(src, baseUrl));
    }
  });

  // Classify section type based on class names and content
  let type: DeepScrapeSection['type'] = 'unknown';

  if (classes.includes('hero') || classes.includes('banner') || classes.includes('jumbotron') || $el.find('h1').length > 0 && $el.index() < 3) {
    type = 'hero';
  } else if (classes.includes('feature') || classes.includes('benefit') || classes.includes('service')) {
    type = 'features';
  } else if (classes.includes('testimonial') || classes.includes('review') || classes.includes('quote')) {
    type = 'testimonials';
  } else if (classes.includes('pricing') || classes.includes('plan') || text.includes('$') && text.includes('/mo')) {
    type = 'pricing';
  } else if (classes.includes('faq') || classes.includes('accordion') || text.includes('?')) {
    type = 'faq';
  } else if (classes.includes('cta') || classes.includes('call-to-action')) {
    type = 'cta';
  } else if (classes.includes('stat') || classes.includes('counter') || classes.includes('number')) {
    type = 'stats';
  } else if (classes.includes('footer') || $el.is('footer')) {
    type = 'footer';
  } else if (classes.includes('nav') || $el.is('nav')) {
    type = 'navigation';
  } else {
    type = 'content';
  }

  // Extract list items for features/pricing/FAQ
  let items: DeepScrapeSection['items'];
  if (type === 'features' || type === 'pricing' || type === 'faq') {
    const listItems = $el.find('li, [class*="item"], [class*="card"]');
    if (listItems.length > 0) {
      items = [];
      listItems.each((_i, li) => {
        const itemTitle = $(li).find('h3, h4, strong').first().text().trim();
        const itemDesc = $(li).find('p').first().text().trim();
        if (itemTitle || itemDesc) {
          items?.push({ title: itemTitle || undefined, description: itemDesc || undefined });
        }
      });
    }
  }

  return {
    type,
    heading,
    subheading: subheading !== heading ? subheading : undefined,
    body: body !== heading ? body : undefined,
    buttonText,
    buttonUrl,
    images: sectionImages.slice(0, 5),
    items: items && items.length > 0 ? items : undefined,
  };
}

// ============================================================================
// BRAND EXTRACTION
// ============================================================================

function extractBrandHints($: cheerio.CheerioAPI, html: string): DeepScrapeResult['brand'] {
  const colors: string[] = [];
  const fonts: string[] = [];

  // Extract colors from inline styles and CSS custom properties
  const colorMatches = html.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)/g);
  if (colorMatches) {
    const colorSet = new Set(colorMatches.map((c) => c.toLowerCase()));
    // Filter out common boilerplate colors
    const boilerplate = new Set(['#000', '#000000', '#fff', '#ffffff', '#333', '#333333', '#666', '#666666', '#999', '#ccc', '#eee', '#f5f5f5']);
    for (const color of colorSet) {
      if (!boilerplate.has(color)) {
        colors.push(color);
      }
    }
  }

  // Extract fonts from CSS
  const fontMatches = html.match(/font-family:\s*['"]?([^'";\n}]+)/gi);
  if (fontMatches) {
    const fontSet = new Set<string>();
    for (const match of fontMatches) {
      const font = match.replace(/font-family:\s*['"]?/i, '').split(',')[0]?.trim();
      if (font && !['inherit', 'initial', 'sans-serif', 'serif', 'monospace', 'system-ui'].includes(font.toLowerCase())) {
        fontSet.add(font.replace(/['"]/g, ''));
      }
    }
    fonts.push(...fontSet);
  }

  // Extract logo
  let logo: string | undefined;
  const logoEl = $('img[class*="logo"], img[alt*="logo"], a[class*="logo"] img, header img').first();
  if (logoEl.length > 0) {
    logo = logoEl.attr('src') ?? logoEl.attr('data-src');
  }

  return {
    colors: colors.slice(0, 10),
    fonts: fonts.slice(0, 5),
    logo,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash, hash, and common tracking params
    u.hash = '';
    u.search = '';
    let path = u.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    return `${u.origin}${path}`;
  } catch {
    return url;
  }
}
