/**
 * Web Scraper Service
 * Zero-Noise Architecture: DOM Purge → Markdown Conversion → Clean Text
 * 
 * This replaces expensive APIs like Clearbit by extracting data directly from websites
 */

import * as cheerio from 'cheerio';
import type { ScrapedContent } from './types'
import { logger } from '../logger/logger';

/**
 * Scrape and clean a website
 * Layer 1: DOM Purge (remove noise)
 * Layer 2: Markdown conversion (for LLM processing)
 */
export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  try {
    logger.info('Web Scraper Scraping: url}', { file: 'web-scraper.ts' });
    
    // Fetch the website
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    // LAYER 1: DOM PURGE - Remove all noise
    // Remove scripts, styles, nav, footer, ads, etc.
    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove(); // Sometimes header has noise
    $('iframe').remove();
    $('noscript').remove();
    $('svg').remove();
    
    // Remove common ad/tracking elements
    $('[class*="ad-"]').remove();
    $('[class*="advertisement"]').remove();
    $('[id*="ad-"]').remove();
    $('[class*="cookie"]').remove();
    $('[class*="banner"]').remove();
    $('[class*="popup"]').remove();
    $('[class*="modal"]').remove();

    // LinkedIn-specific UI chrome (updated Feb 2026)
    $('[class*="artdeco-"]').remove();
    $('[class*="scaffold-"]').remove();
    $('[class*="ember-"]').remove();
    $('.authentication-outlet').remove();
    $('.global-nav').remove();
    $('.msg-overlay-list-bubble').remove();
    $('.premium-upsell').remove();
    $('.ad-banner-container').remove();
    
    // Extract metadata
    const metadata = {
      author: $('meta[name="author"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()),
      ogTitle: $('meta[property="og:title"]').attr('content'),
      ogDescription: $('meta[property="og:description"]').attr('content'),
    };
    
    const title = $('title').text() || (metadata.ogTitle ?? '');
    const description = $('meta[name="description"]').attr('content') ?? metadata.ogDescription ?? '';
    
    // LAYER 2: Extract main content
    // Try to find the main content area
    const mainContent =$('main').html() ?? $('article').html() ?? $('body').html() ?? '';
    
    // Convert to clean text
    const $content = cheerio.load(mainContent);
    
    // Get text content only
    const cleanedText = $content.root()
      .text()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
    
    // LAYER 3: Convert to Markdown-like structure (simplified)
    // This makes it easier for LLMs to process
    const markdownText = convertToMarkdown($content);
    
    logger.info('Web Scraper Successfully scraped url} - cleanedText.length} chars', { file: 'web-scraper.ts' });
    
    return {
      url,
      title,
      description,
      cleanedText: markdownText || cleanedText,
      rawHtml: html,
      metadata,
    };
  } catch (error: unknown) {
    const scraperError = error instanceof Error ? error : new Error(String(error));
    const errorMessage = scraperError.message;
    logger.error(`[Web Scraper] Error scraping ${url}`, scraperError, { file: 'web-scraper.ts' });
    throw new Error(`Failed to scrape website: ${errorMessage}`);
  }
}

/**
 * Convert HTML to simplified Markdown
 * This makes content much easier for LLMs to process
 */
function convertToMarkdown($: cheerio.CheerioAPI): string {
  const lines: string[] = [];
  
  // Extract headings
  $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    const level = parseInt(elem.tagName[1]);
    const text = $(elem).text().trim();
    if (text) {
      lines.push(`\n${  '#'.repeat(level)  } ${  text}`);
    }
  });
  
  // Extract paragraphs
  $('p').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) {
      lines.push(`\n${  text}`);
    }
  });
  
  // Extract lists
  $('ul, ol').each((_, listElem) => {
    $(listElem).find('li').each((i, li) => {
      const text = $(li).text().trim();
      if (text) {
        lines.push(`- ${text}`);
      }
    });
  });
  
  return lines.join('\n').trim();
}

/**
 * Scrape multiple pages in parallel (for deeper research)
 */
export async function scrapeMultiplePages(urls: string[]): Promise<ScrapedContent[]> {
  logger.info('Web Scraper Scraping urls.length} pages in parallel...', { file: 'web-scraper.ts' });
  
  const results = await Promise.allSettled(
    urls.map(url => scrapeWebsite(url))
  );
  
  return results
    .filter((result): result is PromiseFulfilledResult<ScrapedContent> => result.status === 'fulfilled')
    .map(result => result.value);
}

/**
 * Extract specific data points from scraped content
 */
export function extractDataPoints(content: ScrapedContent): {
  potentialEmail?: string;
  potentialPhone?: string;
  socialLinks: string[];
  keywords: string[];
} {
  const { cleanedText, rawHtml } = content;
  
  // Extract email (simple regex)
  const emailMatch = cleanedText.match(/[\w.-]+@[\w.-]+\.\w+/);
  const potentialEmail = emailMatch ? emailMatch[0] : undefined;
  
  // Extract phone (US format)
  const phoneMatch = cleanedText.match(/\(?\d{3}\)?[.\s-]?\d{3}[.\s-]?\d{4}/);
  const potentialPhone = phoneMatch ? phoneMatch[0] : undefined;
  
  // Extract social media links
  const socialLinks: string[] = [];
  if (rawHtml) {
    const $ = cheerio.load(rawHtml);
    $('a[href*="linkedin.com"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {socialLinks.push(href);}
    });
    $('a[href*="twitter.com"], a[href*="x.com"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {socialLinks.push(href);}
    });
    $('a[href*="facebook.com"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {socialLinks.push(href);}
    });
  }
  
  // Extract keywords (top words)
  const words = cleanedText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 4); // Filter short words
  
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const keywords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  return {
    potentialEmail,
    potentialPhone,
    socialLinks: [...new Set(socialLinks)], // Remove duplicates
    keywords,
  };
}

/**
 * Scrape About/Team page to find company info
 */
export async function scrapeAboutPage(baseUrl: string): Promise<ScrapedContent | null> {
  const aboutUrls = [
    `${baseUrl}/about`,
    `${baseUrl}/about-us`,
    `${baseUrl}/company`,
    `${baseUrl}/team`,
    `${baseUrl}/who-we-are`,
  ];
  
  for (const url of aboutUrls) {
    try {
      const content = await scrapeWebsite(url);
      if (content.cleanedText.length > 200) { // Has meaningful content
        return content;
      }
    } catch (_error) {
      // Try next URL
      continue;
    }
  }
  
  return null;
}

/**
 * Scrape careers/jobs page to detect hiring
 */
export async function scrapeCareersPage(baseUrl: string): Promise<{
  isHiring: boolean;
  jobCount: number;
  jobs: Array<{ title: string; url: string }>;
}> {
  const careersUrls = [
    `${baseUrl}/careers`,
    `${baseUrl}/jobs`,
    `${baseUrl}/join-us`,
    `${baseUrl}/work-with-us`,
  ];
  
  for (const url of careersUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (!response.ok) {continue;}
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Look for job listings
      const jobs: Array<{ title: string; url: string }> = [];
      
      $('a[href*="job"], a[href*="career"], a[href*="position"]').each((_, elem) => {
        const title = $(elem).text().trim();
        const href = $(elem).attr('href');
        if (title && href && title.length > 5) {
          jobs.push({ title, url: href });
        }
      });
      
      // Also check for "We're hiring" text
      const pageText = $('body').text().toLowerCase();
      const isHiring = 
        jobs.length > 0 || 
        pageText.includes("we're hiring") || 
        pageText.includes('now hiring') ||
        pageText.includes('open positions');
      
      return {
        isHiring,
        jobCount: jobs.length,
        jobs: jobs.slice(0, 10), // Limit to 10
      };
    } catch (_error) {
      continue;
    }
  }
  
  return { isHiring: false, jobCount: 0, jobs: [] };
}


