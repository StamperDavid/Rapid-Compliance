/**
 * Universal Browser Agent
 * 
 * This service is 100% native and relies on zero third-party data APIs.
 * Custom BrowserController using Playwright + stealth-plugin.
 * 
 * Provides intelligent web scraping with anti-detection capabilities,
 * vision-reasoning for high-value content areas, and specialized extractors
 * for team directories, career portals, and tech stack detection.
 */

import { chromium } from 'playwright';
import type { LaunchOptions , Browser, Page, BrowserContext } from 'playwright';
import { logger } from '@/lib/logger/logger';

export interface ProxyConfig {
  server: string; // e.g., 'http://proxy.example.com:8080'
  username?: string;
  password?: string;
  bypass?: string; // Comma-separated domains to bypass proxy
}

export interface BrowserControllerOptions extends LaunchOptions {
  proxy?: ProxyConfig;
  proxyList?: ProxyConfig[]; // For rotation
  rotateProxyOnError?: boolean; // Automatically rotate to next proxy on failure
}

export interface HighValueArea {
  type: 'footer' | 'header' | 'navigation' | 'team' | 'career' | 'press' | 'contact';
  selector: string;
  confidence: number;
  text?: string;
}

export interface ExtractedData {
  type: string;
  content: string | Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Link {
  href: string;
  text: string;
  type?: 'team' | 'career' | 'press' | 'contact' | 'about' | 'other';
}

export interface TeamMember {
  name: string;
  title?: string;
  imageUrl?: string;
  linkedinUrl?: string;
  email?: string;
}

export interface CareerData {
  jobCount: number;
  positions: Array<{
    title: string;
    location?: string;
    url?: string;
  }>;
  careerPageUrl?: string;
}

export interface TechStackItem {
  name: string;
  category: 'frontend' | 'backend' | 'analytics' | 'marketing' | 'infrastructure' | 'other';
  confidence: number;
  evidence: string;
}

/**
 * Universal Browser Agent with stealth capabilities and proxy rotation
 */
export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private currentUrl: string = '';
  private currentProxyIndex: number = 0;
  private proxyList: ProxyConfig[] = [];
  private rotateProxyOnError: boolean = false;
  private requestFailureCount: number = 0;
  private readonly MAX_FAILURES_BEFORE_ROTATION = 3;
  
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  constructor(private options?: BrowserControllerOptions) {
    // Setup proxy rotation if provided
    if (options?.proxyList && options.proxyList.length > 0) {
      this.proxyList = options.proxyList;
      this.rotateProxyOnError = options.rotateProxyOnError || false;
      logger.info('Proxy rotation enabled', {
        proxyCount: this.proxyList.length,
        rotateOnError: this.rotateProxyOnError,
      });
    } else if (options?.proxy) {
      this.proxyList = [options.proxy];
    }
  }

  /**
   * Launch browser with stealth configuration and optional proxy
   */
  async launch(): Promise<void> {
    if (this.browser) {
      return; // Already launched
    }

    try {
      // Get current proxy configuration
      const currentProxy = this.getCurrentProxy();
      
      if (currentProxy) {
        logger.info('Launching browser with proxy', {
          proxyServer: currentProxy.server,
          proxyIndex: this.currentProxyIndex,
          totalProxies: this.proxyList.length,
        });
      }

      // Launch with stealth settings
      this.browser = await chromium.launch({
        headless: true,
        ...this.options,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          ...(this.options?.args || []),
        ],
      });

      // Create context with stealth settings and proxy
      const contextOptions: any = {
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        // Additional stealth settings
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      };

      // Add proxy configuration if available
      if (currentProxy) {
        contextOptions.proxy = {
          server: currentProxy.server,
          username: currentProxy.username,
          password: currentProxy.password,
          bypass: currentProxy.bypass,
        };
      }

      this.context = await this.browser.newContext(contextOptions);

      // Add stealth scripts to hide automation
      await this.context.addInitScript(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Add chrome object
        (window as any).chrome = {
          runtime: {},
        };

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: 'denied' } as PermissionStatus)
            : originalQuery(parameters);
      });

      this.page = await this.context.newPage();

      // Setup request monitoring for proxy rotation
      if (this.rotateProxyOnError && this.page) {
        this.page.on('requestfailed', async (request) => {
          const failure = request.failure();
          logger.warn('Request failed', {
            url: request.url(),
            error: failure?.errorText,
            currentProxy: this.getCurrentProxy()?.server,
          });

          this.requestFailureCount++;

          // Rotate proxy if too many failures
          if (this.requestFailureCount >= this.MAX_FAILURES_BEFORE_ROTATION) {
            logger.info('Too many request failures, rotating proxy');
            await this.rotateProxy();
          }
        });

        this.page.on('response', (response) => {
          // Reset failure count on successful responses
          if (response.status() < 400) {
            this.requestFailureCount = 0;
          } else if (response.status() === 429 || response.status() === 403) {
            // Rate limited or blocked - rotate immediately
            logger.warn('Rate limited or blocked, rotating proxy', {
              status: response.status(),
              url: response.url(),
            });
            this.rotateProxy().catch((err) => {
              logger.error('Failed to rotate proxy', err);
            });
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      await this.launch();
    }

    try {
      await this.page!.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      this.currentUrl = url;
    } catch (error) {
      throw new Error(`Failed to navigate to ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Click element by selector
   */
  async click(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      await this.page.click(selector, { timeout: 10000 });
      // Wait a bit for any animations/transitions
      await this.page.waitForTimeout(500);
    } catch (error) {
      throw new Error(`Failed to click ${selector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      await this.page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    } catch (error) {
      throw new Error(`Failed to scroll to bottom: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for selector to appear
   */
  async waitForSelector(selector: string, timeout: number = 10000): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      await this.page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new Error(`Failed to wait for ${selector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Identify high-value areas on the page using vision-reasoning
   */
  async identifyHighValueAreas(): Promise<HighValueArea[]> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      const areas: HighValueArea[] = [];

      // Footer detection
      const footerSelectors = ['footer', '[role="contentinfo"]', '.footer', '#footer'];
      for (const selector of footerSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.textContent();
          areas.push({
            type: 'footer',
            selector,
            confidence: 0.9,
            text: text?.substring(0, 200) || undefined,
          });
          break;
        }
      }

      // Header/Navigation detection
      const navSelectors = ['nav', 'header', '[role="navigation"]', '.navbar', '.nav'];
      for (const selector of navSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.textContent();
          areas.push({
            type: 'navigation',
            selector,
            confidence: 0.9,
            text: text?.substring(0, 200) || undefined,
          });
          break;
        }
      }

      // Team/About section detection
      const teamKeywords = ['team', 'about us', 'leadership', 'our team', 'meet the team'];
      const allLinks = await this.page.$$eval('a', (links) =>
        links.map((link) => ({
          href: link.getAttribute('href') || '',
          text: link.textContent?.toLowerCase() || '',
        }))
      );

      for (const link of allLinks) {
        for (const keyword of teamKeywords) {
          if (link.text.includes(keyword) || link.href.toLowerCase().includes(keyword)) {
            areas.push({
              type: 'team',
              selector: `a[href="${link.href}"]`,
              confidence: 0.7,
              text: link.text,
            });
            break;
          }
        }
      }

      // Career section detection
      const careerKeywords = ['career', 'jobs', 'hiring', 'join us', 'work with us'];
      for (const link of allLinks) {
        for (const keyword of careerKeywords) {
          if (link.text.includes(keyword) || link.href.toLowerCase().includes(keyword)) {
            areas.push({
              type: 'career',
              selector: `a[href="${link.href}"]`,
              confidence: 0.7,
              text: link.text,
            });
            break;
          }
        }
      }

      // Press/News section detection
      const pressKeywords = ['press', 'news', 'media', 'blog'];
      for (const link of allLinks) {
        for (const keyword of pressKeywords) {
          if (link.text.includes(keyword) || link.href.toLowerCase().includes(keyword)) {
            areas.push({
              type: 'press',
              selector: `a[href="${link.href}"]`,
              confidence: 0.6,
              text: link.text,
            });
            break;
          }
        }
      }

      // Contact section detection
      const contactKeywords = ['contact', 'get in touch', 'reach us'];
      for (const link of allLinks) {
        for (const keyword of contactKeywords) {
          if (link.text.includes(keyword) || link.href.toLowerCase().includes(keyword)) {
            areas.push({
              type: 'contact',
              selector: `a[href="${link.href}"]`,
              confidence: 0.8,
              text: link.text,
            });
            break;
          }
        }
      }

      return areas;
    } catch (error) {
      throw new Error(`Failed to identify high-value areas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract data from a specific high-value area
   */
  async extractFromArea(area: HighValueArea): Promise<ExtractedData> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      const element = await this.page.$(area.selector);
      if (!element) {
        throw new Error(`Element not found: ${area.selector}`);
      }

      const html = await element.innerHTML();
      const text = await element.textContent();

      return {
        type: area.type,
        content: {
          html: html.substring(0, 10000), // Limit to prevent excessive data
          text: text?.substring(0, 5000) || '',
        },
        metadata: {
          confidence: area.confidence,
          selector: area.selector,
          extractedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Failed to extract from area: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find and classify all footer links
   */
  async findFooterLinks(): Promise<Link[]> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      const footerSelectors = ['footer', '[role="contentinfo"]', '.footer', '#footer'];
      let footerLinks: Link[] = [];

      for (const selector of footerSelectors) {
        const footer = await this.page.$(selector);
        if (footer) {
          footerLinks = await this.page.$$eval(`${selector} a`, (links) =>
            links.map((link) => ({
              href: link.getAttribute('href') || '',
              text: link.textContent?.trim() || '',
            }))
          );
          break;
        }
      }

      // Classify links
      return footerLinks.map((link) => {
        const lowerText = link.text.toLowerCase();
        const lowerHref = link.href.toLowerCase();

        let type: Link['type'] = 'other';
        if (lowerText.includes('team') || lowerHref.includes('team') || lowerText.includes('about')) {
          type = 'team';
        } else if (lowerText.includes('career') || lowerText.includes('job') || lowerHref.includes('career')) {
          type = 'career';
        } else if (lowerText.includes('press') || lowerText.includes('news') || lowerHref.includes('press')) {
          type = 'press';
        } else if (lowerText.includes('contact') || lowerHref.includes('contact')) {
          type = 'contact';
        }

        return { ...link, type };
      });
    } catch (error) {
      throw new Error(`Failed to find footer links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find and extract career portal data
   */
  async findCareerPortal(): Promise<CareerData | null> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      // Look for career page links
      const careerLinks = await this.page.$$eval('a', (links) =>
        links
          .filter((link) => {
            const text = link.textContent?.toLowerCase() || '';
            const href = link.getAttribute('href')?.toLowerCase() || '';
            return (
              text.includes('career') ||
              text.includes('job') ||
              text.includes('hiring') ||
              href.includes('career') ||
              href.includes('job')
            );
          })
          .map((link) => ({
            href: link.getAttribute('href') || '',
            text: link.textContent?.trim() || '',
          }))
      );

      if (careerLinks.length === 0) {
        return null;
      }

      // If we're already on a career page, extract job listings
      const jobListings = await this.page.$$eval(
        'article, .job-listing, .position, .opening, [class*="job"], [class*="position"]',
        (elements) =>
          elements.slice(0, 20).map((el) => {
            const titleEl = el.querySelector('h1, h2, h3, h4, .title, [class*="title"]');
            const locationEl = el.querySelector('.location, [class*="location"]');
            const linkEl = el.querySelector('a');

            return {
              title: titleEl?.textContent?.trim() || '',
              location: locationEl?.textContent?.trim(),
              url: linkEl?.getAttribute('href') || undefined,
            };
          })
      );

      const validJobListings = jobListings.filter((job) => job.title.length > 0);

      return {
        jobCount: validJobListings.length || careerLinks.length,
        positions: validJobListings,
        careerPageUrl: careerLinks[0]?.href,
      };
    } catch (error) {
      throw new Error(`Failed to find career portal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find and extract team directory
   */
  async findTeamDirectory(): Promise<TeamMember[]> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      // Look for team member cards/sections
      const teamMembers = await this.page.$$eval(
        '.team-member, .person, .employee, [class*="team"], [class*="member"]',
        (elements) =>
          elements.slice(0, 50).map((el) => {
            const nameEl = el.querySelector('h1, h2, h3, h4, .name, [class*="name"]');
            const titleEl = el.querySelector('.title, .role, .position, [class*="title"], [class*="role"]');
            const imgEl = el.querySelector('img');
            const linkedinEl = el.querySelector('a[href*="linkedin"]');
            const emailEl = el.querySelector('a[href^="mailto:"]');

            return {
              name: nameEl?.textContent?.trim() || '',
              title: titleEl?.textContent?.trim(),
              imageUrl: imgEl?.getAttribute('src') || undefined,
              linkedinUrl: linkedinEl?.getAttribute('href') || undefined,
              email: emailEl?.getAttribute('href')?.replace('mailto:', '') || undefined,
            };
          })
      );

      // Filter out invalid entries
      return teamMembers.filter((member) => member.name.length > 0 && member.name.length < 100);
    } catch (error) {
      throw new Error(`Failed to find team directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract tech stack from page
   */
  async extractTechStack(): Promise<TechStackItem[]> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      const techStack: TechStackItem[] = [];

      // Extract from script tags
      const scripts = await this.page.$$eval('script', (scripts) =>
        scripts
          .map((script) => script.getAttribute('src') || '')
          .filter((src) => src.length > 0)
      );

      // Detect common technologies
      const techPatterns = [
        { pattern: /react/i, name: 'React', category: 'frontend' as const },
        { pattern: /vue/i, name: 'Vue.js', category: 'frontend' as const },
        { pattern: /angular/i, name: 'Angular', category: 'frontend' as const },
        { pattern: /jquery/i, name: 'jQuery', category: 'frontend' as const },
        { pattern: /bootstrap/i, name: 'Bootstrap', category: 'frontend' as const },
        { pattern: /tailwind/i, name: 'Tailwind CSS', category: 'frontend' as const },
        { pattern: /google.*analytics/i, name: 'Google Analytics', category: 'analytics' as const },
        { pattern: /gtm|googletagmanager/i, name: 'Google Tag Manager', category: 'analytics' as const },
        { pattern: /segment/i, name: 'Segment', category: 'analytics' as const },
        { pattern: /intercom/i, name: 'Intercom', category: 'marketing' as const },
        { pattern: /hubspot/i, name: 'HubSpot', category: 'marketing' as const },
        { pattern: /stripe/i, name: 'Stripe', category: 'infrastructure' as const },
        { pattern: /cloudflare/i, name: 'Cloudflare', category: 'infrastructure' as const },
      ];

      for (const script of scripts) {
        for (const { pattern, name, category } of techPatterns) {
          if (pattern.test(script)) {
            techStack.push({
              name,
              category,
              confidence: 0.9,
              evidence: `Found in script: ${script.substring(0, 100)}`,
            });
          }
        }
      }

      // Extract from meta tags
      const metaTags = await this.page.$$eval('meta', (metas) =>
        metas.map((meta) => ({
          name: meta.getAttribute('name') || '',
          content: meta.getAttribute('content') || '',
        }))
      );

      for (const meta of metaTags) {
        for (const { pattern, name, category } of techPatterns) {
          if (pattern.test(meta.content)) {
            techStack.push({
              name,
              category,
              confidence: 0.7,
              evidence: `Found in meta tag: ${meta.name}`,
            });
          }
        }
      }

      // Remove duplicates
      const unique = techStack.filter(
        (item, index, self) => index === self.findIndex((t) => t.name === item.name)
      );

      return unique;
    } catch (error) {
      throw new Error(`Failed to extract tech stack: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Take screenshot of current page
   */
  async screenshot(path?: string): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      return await this.page.screenshot({
        path,
        fullPage: true,
      });
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get page HTML content
   */
  async getContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      return await this.page.content();
    } catch (error) {
      throw new Error(`Failed to get content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get page text content
   */
  async getTextContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      return await this.page.textContent('body') || '';
    } catch (error) {
      throw new Error(`Failed to get text content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close browser and clean up resources
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      throw new Error(`Failed to close browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get random user agent for stealth
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Get current proxy configuration
   */
  private getCurrentProxy(): ProxyConfig | null {
    if (this.proxyList.length === 0) {
      return null;
    }
    return this.proxyList[this.currentProxyIndex];
  }

  /**
   * Rotate to next proxy in the list
   */
  async rotateProxy(): Promise<void> {
    if (this.proxyList.length <= 1) {
      logger.debug('Cannot rotate proxy - only one or zero proxies available');
      return;
    }

    // Move to next proxy (circular rotation)
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
    this.requestFailureCount = 0;

    const newProxy = this.getCurrentProxy();
    logger.info('Rotating to next proxy', {
      proxyIndex: this.currentProxyIndex,
      proxyServer: newProxy?.server,
      totalProxies: this.proxyList.length,
    });

    // Close current browser and context
    if (this.browser) {
      await this.close();
    }

    // Relaunch with new proxy
    await this.launch();
  }

  /**
   * Manually set proxy by index
   */
  async setProxyByIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.proxyList.length) {
      throw new Error(`Invalid proxy index: ${index}. Available: 0-${this.proxyList.length - 1}`);
    }

    this.currentProxyIndex = index;
    this.requestFailureCount = 0;

    logger.info('Manually setting proxy', {
      proxyIndex: index,
      proxyServer: this.getCurrentProxy()?.server,
    });

    // Relaunch with new proxy
    if (this.browser) {
      await this.close();
      await this.launch();
    }
  }

  /**
   * Get current proxy status
   */
  getProxyStatus(): {
    currentIndex: number;
    totalProxies: number;
    currentProxy: ProxyConfig | null;
    failureCount: number;
  } {
    return {
      currentIndex: this.currentProxyIndex,
      totalProxies: this.proxyList.length,
      currentProxy: this.getCurrentProxy(),
      failureCount: this.requestFailureCount,
    };
  }

  /**
   * Add proxy to rotation list
   */
  addProxy(proxy: ProxyConfig): void {
    this.proxyList.push(proxy);
    logger.info('Added proxy to rotation list', {
      proxyServer: proxy.server,
      totalProxies: this.proxyList.length,
    });
  }

  /**
   * Remove proxy from rotation list
   */
  removeProxy(index: number): void {
    if (index < 0 || index >= this.proxyList.length) {
      throw new Error(`Invalid proxy index: ${index}`);
    }

    const removed = this.proxyList.splice(index, 1);
    logger.info('Removed proxy from rotation list', {
      proxyServer: removed[0]?.server,
      totalProxies: this.proxyList.length,
    });

    // Adjust current index if needed
    if (this.currentProxyIndex >= this.proxyList.length) {
      this.currentProxyIndex = Math.max(0, this.proxyList.length - 1);
    }
  }

  /**
   * Get current page (for advanced usage)
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }
}

/**
 * Factory function to create BrowserController instance
 */
export function createBrowserController(options?: BrowserControllerOptions): BrowserController {
  return new BrowserController(options);
}

/**
 * Helper function to create a BrowserController with proxy rotation
 * 
 * @example
 * ```typescript
 * const controller = createBrowserControllerWithProxies([
 *   { server: 'http://proxy1.example.com:8080', username: 'user1', password: 'pass1' },
 *   { server: 'http://proxy2.example.com:8080', username: 'user2', password: 'pass2' },
 * ], {
 *   rotateOnError: true,
 *   headless: true,
 * });
 * ```
 */
export function createBrowserControllerWithProxies(
  proxies: ProxyConfig[],
  options?: Omit<BrowserControllerOptions, 'proxyList'>
): BrowserController {
  return new BrowserController({
    ...options,
    proxyList: proxies,
    rotateProxyOnError: options?.rotateProxyOnError !== false, // Default to true
  });
}
