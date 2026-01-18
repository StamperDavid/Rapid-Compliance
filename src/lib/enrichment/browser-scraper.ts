/**
 * Browser-Based Web Scraper using Playwright
 * Handles JavaScript-heavy sites (React, Vue, Next.js, etc.)
 * 
 * Playwright is FREE and open-source - no token costs!
 */

import type { ScrapedContent } from './types'
import { logger } from '../logger/logger';

/**
 * Scrape a website using Playwright (handles JavaScript)
 * This is the REAL scraper for modern websites
 */
export async function scrapeWithBrowser(url: string): Promise<ScrapedContent> {
  try {
    logger.info(`Browser Scraper Launching browser for: ${url}`, { file: 'browser-scraper.ts' });

    // Dynamic import to avoid loading Playwright in edge runtime
    let playwright;
    try {
      playwright = await import('playwright');
    } catch (_error) {
      throw new Error('Playwright not installed. Run: npm install playwright && npx playwright install chromium');
    }
    
    // Launch browser (headless)
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();
    
    // Set timeout
    page.setDefaultTimeout(30000); // 30 seconds
    
    try {
      // Navigate to page and wait for network to be idle
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      // Wait a bit for dynamic content to load
      await page.waitForTimeout(2000);
      
      // Extract metadata
      const metadata = await page.evaluate(() => {
        const getMetaContent = (name: string) => {
          const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return meta?.getAttribute('content') ?? undefined;
        };
        
        return {
          author: getMetaContent('author'),
          keywords: getMetaContent('keywords')?.split(',').map(k => k.trim()),
          ogTitle: getMetaContent('og:title'),
          ogDescription: getMetaContent('og:description'),
        };
      });
      
      // Extract title
      const title = await page.title();
      
      // Extract description
      const description = (metadata.ogDescription !== '' && metadata.ogDescription != null) 
        ? metadata.ogDescription 
        : await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => '');
      
      // Remove unwanted elements (same as cheerio scraper)
      await page.evaluate(() => {
        const selectorsToRemove = [
          'script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript', 'svg',
          '[class*="ad-"]', '[class*="advertisement"]', '[id*="ad-"]',
          '[class*="cookie"]', '[class*="banner"]', '[class*="popup"]', '[class*="modal"]',
        ];
        
        selectorsToRemove.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
      });
      
      // Get cleaned text content
      const cleanedText = await page.evaluate(() => {
        // Try to find main content area
        const main = document.querySelector('main') ?? 
                     document.querySelector('article') ?? 
                     document.querySelector('body');
        
        if (!main) {return '';}
        
        // Get text and clean up whitespace
        return main.textContent
          ?.replace(/\s+/g, ' ')
          ?.replace(/\n\s*\n/g, '\n')
          ?.trim() || '';
      });
      
      // Get HTML for backup
      const rawHtml = await page.content();
      
      await browser.close();

      logger.info(`Browser Scraper Successfully scraped ${url} - ${cleanedText.length} chars`, { file: 'browser-scraper.ts' });

      return {
        url,
        title,
        description: description ?? '',
        cleanedText,
        rawHtml,
        metadata,
      };
    } catch (error: unknown) {
      await browser.close();
      throw error;
    }
  } catch (error: unknown) {
    const scraperError = error instanceof Error ? error : new Error(String(error));
    const errorMessage = scraperError.message;
    logger.error(`[Browser Scraper] Error scraping ${url}`, scraperError, { file: 'browser-scraper.ts' });
    throw new Error(`Browser scraping failed: ${errorMessage}`);
  }
}

/**
 * Try scraping with simple fetch first, fall back to browser if needed
 * This saves resources (browser is slower)
 */
export async function smartScrape(url: string): Promise<ScrapedContent> {
  try {
    // First, try simple fetch (faster, cheaper)
    const { scrapeWebsite } = await import('./web-scraper');
    const result = await scrapeWebsite(url);
    
    // If we got meaningful content, return it
    if (result.cleanedText.length > 200) {
      logger.info(`Smart Scraper Static scrape successful for ${url}`, { file: 'browser-scraper.ts' });
      return result;
    }

    // Otherwise, fall back to browser (for JavaScript sites)
    logger.info(`Smart Scraper Static scrape insufficient, using browser for ${url}`, { file: 'browser-scraper.ts' });
    return await scrapeWithBrowser(url);
  } catch (_error) {
    // If simple fetch fails, try browser
    logger.info(`Smart Scraper Static scrape failed, using browser for ${url}`, { file: 'browser-scraper.ts' });
    return scrapeWithBrowser(url);
  }
}

/**
 * Scrape with retry logic (exponential backoff)
 */
export async function scrapeWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<ScrapedContent> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add delay between retries (exponential backoff)
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.info(`Scraper Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`, { file: 'browser-scraper.ts' });
        await sleep(delay);
      }

      return await smartScrape(url);
    } catch (error: unknown) {
      const retryError = error instanceof Error ? error : new Error(String(error));
      lastError = retryError;
      logger.error(`[Scraper] Attempt ${attempt + 1}/${maxRetries} failed`, retryError, {
        attempt: attempt + 1,
        maxRetries,
        file: 'browser-scraper.ts'
      });

      // Don't retry on certain errors
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
          errorMessage.includes('404')) {
        throw error; // Domain doesn't exist, no point retrying
      }
    }
  }

  throw lastError ?? new Error('Scraping failed after retries');
}

/**
 * Get random user agent to avoid detection
 */
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Rate limiter to avoid getting blocked
 */
class RateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private minDelay = 1000; // 1 second between requests to same domain
  
  async throttle(domain: string): Promise<void> {
    const lastTime = this.lastRequestTime.get(domain) ?? 0;
    const timeSinceLastRequest = Date.now() - lastTime;
    
    if (timeSinceLastRequest < this.minDelay) {
      const delay = this.minDelay - timeSinceLastRequest;
      logger.info(`Rate Limiter Throttling request to ${domain} for ${delay}ms`, { file: 'browser-scraper.ts' });
      await sleep(delay);
    }

    this.lastRequestTime.set(domain, Date.now());
  }
}

export const rateLimiter = new RateLimiter();


