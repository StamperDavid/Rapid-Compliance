/**
 * BuiltWith API Service
 * Technology stack detection
 * https://api.builtwith.com/
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';

const BUILTWITH_API_BASE = 'https://api.builtwith.com';

export interface BuiltWithTechnology {
  Tag: string;
  Name: string;
  FirstDetected: number;
  LastDetected: number;
  IsPremium: string;
  Link?: string;
  Description?: string;
}

export interface BuiltWithResult {
  Domain: string;
  Technologies: BuiltWithTechnology[];
  Categories: {
    [category: string]: BuiltWithTechnology[];
  };
}

/**
 * Get technology stack for a domain
 */
export async function getTechStack(
  domain: string,
  organizationId: string
): Promise<string[]> {
  try {
    const apiKey = await getBuiltWithApiKey(organizationId);
    
    if (!apiKey) {
      console.warn('[BuiltWith] API key not configured, using fallback');
      return await getFallbackTechStack(domain);
    }

    const response = await fetch(
      `${BUILTWITH_API_BASE}/v20/api.json?KEY=${apiKey}&LOOKUP=${encodeURIComponent(domain)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[BuiltWith] API error: ${response.status}`);
      return await getFallbackTechStack(domain);
    }

    const data = await response.json();
    
    if (!data.Results || data.Results.length === 0) {
      return [];
    }

    const result = data.Results[0];
    const technologies: string[] = [];

    // Extract all technologies
    if (result.Result && result.Result.Paths && result.Result.Paths.length > 0) {
      const path = result.Result.Paths[0];
      
      if (path.Technologies) {
        path.Technologies.forEach((tech: BuiltWithTechnology) => {
          technologies.push(tech.Name);
        });
      }
    }

    return technologies;
  } catch (error) {
    console.error('[BuiltWith] Error getting tech stack:', error);
    return await getFallbackTechStack(domain);
  }
}

/**
 * Get detailed technology information
 */
export async function getTechStackDetailed(
  domain: string,
  organizationId: string
): Promise<BuiltWithResult | null> {
  try {
    const apiKey = await getBuiltWithApiKey(organizationId);
    
    if (!apiKey) {
      return null;
    }

    const response = await fetch(
      `${BUILTWITH_API_BASE}/v20/api.json?KEY=${apiKey}&LOOKUP=${encodeURIComponent(domain)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.Results || data.Results.length === 0) {
      return null;
    }

    const result = data.Results[0];
    const technologies: BuiltWithTechnology[] = [];
    const categories: { [key: string]: BuiltWithTechnology[] } = {};

    if (result.Result && result.Result.Paths && result.Result.Paths.length > 0) {
      const path = result.Result.Paths[0];
      
      if (path.Technologies) {
        path.Technologies.forEach((tech: BuiltWithTechnology) => {
          technologies.push(tech);
          
          // Group by tag/category
          if (!categories[tech.Tag]) {
            categories[tech.Tag] = [];
          }
          categories[tech.Tag].push(tech);
        });
      }
    }

    return {
      Domain: domain,
      Technologies: technologies,
      Categories: categories,
    };
  } catch (error) {
    console.error('[BuiltWith] Error getting detailed tech stack:', error);
    return null;
  }
}

/**
 * Fallback tech detection using Wappalyzer-style approach
 * (Simple pattern matching on public website)
 */
async function getFallbackTechStack(domain: string): Promise<string[]> {
  try {
    // Fetch the website homepage
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const technologies: string[] = [];

    // Simple pattern matching for common technologies
    const patterns = {
      'React': [/react/i, /_react/i, /data-reactroot/i],
      'Next.js': [/next\.js/i, /_next\//i],
      'Vue.js': [/vue\.js/i, /data-v-/i],
      'Angular': [/angular/i, /ng-/i],
      'WordPress': [/wp-content/i, /wordpress/i],
      'Shopify': [/cdn\.shopify\.com/i, /shopify/i],
      'Stripe': [/stripe\.com/i, /stripe/i],
      'Google Analytics': [/google-analytics\.com/i, /gtag/i],
      'jQuery': [/jquery/i],
      'Bootstrap': [/bootstrap/i],
      'Tailwind CSS': [/tailwindcss/i],
      'Cloudflare': [/cloudflare/i],
      'AWS': [/amazonaws\.com/i],
      'Vercel': [/vercel/i],
      'Netlify': [/netlify/i],
    };

    for (const [tech, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(html))) {
        technologies.push(tech);
      }
    }

    return technologies;
  } catch (error) {
    console.error('[BuiltWith] Fallback detection error:', error);
    return [];
  }
}

/**
 * Get BuiltWith API key
 */
async function getBuiltWithApiKey(organizationId: string): Promise<string | null> {
  try {
    // Try environment variable first
    if (process.env.BUILTWITH_API_KEY) {
      return process.env.BUILTWITH_API_KEY;
    }

    // Try organization API keys
    const keys = await apiKeyService.getKeys(organizationId);
    return keys?.enrichment?.builtWithApiKey || null;
  } catch (error) {
    console.error('[BuiltWith] Error getting API key:', error);
    return null;
  }
}

/**
 * Categorize technologies
 */
export function categorizeTechnologies(technologies: string[]): {
  frontend: string[];
  backend: string[];
  infrastructure: string[];
  analytics: string[];
  marketing: string[];
  ecommerce: string[];
} {
  const categories = {
    frontend: [] as string[],
    backend: [] as string[],
    infrastructure: [] as string[],
    analytics: [] as string[],
    marketing: [] as string[],
    ecommerce: [] as string[],
  };

  const categoryMap: { [key: string]: keyof typeof categories } = {
    'React': 'frontend',
    'Vue.js': 'frontend',
    'Angular': 'frontend',
    'Next.js': 'frontend',
    'Svelte': 'frontend',
    'jQuery': 'frontend',
    'Bootstrap': 'frontend',
    'Tailwind CSS': 'frontend',
    
    'Node.js': 'backend',
    'Django': 'backend',
    'Rails': 'backend',
    'Laravel': 'backend',
    'Express': 'backend',
    'FastAPI': 'backend',
    
    'AWS': 'infrastructure',
    'Google Cloud': 'infrastructure',
    'Azure': 'infrastructure',
    'Cloudflare': 'infrastructure',
    'Vercel': 'infrastructure',
    'Netlify': 'infrastructure',
    'Docker': 'infrastructure',
    'Kubernetes': 'infrastructure',
    
    'Google Analytics': 'analytics',
    'Mixpanel': 'analytics',
    'Segment': 'analytics',
    'Amplitude': 'analytics',
    'Hotjar': 'analytics',
    
    'HubSpot': 'marketing',
    'Mailchimp': 'marketing',
    'Intercom': 'marketing',
    'Drift': 'marketing',
    
    'Shopify': 'ecommerce',
    'WooCommerce': 'ecommerce',
    'Magento': 'ecommerce',
    'BigCommerce': 'ecommerce',
    'Stripe': 'ecommerce',
  };

  technologies.forEach(tech => {
    const category = categoryMap[tech];
    if (category) {
      categories[category].push(tech);
    }
  });

  return categories;
}







