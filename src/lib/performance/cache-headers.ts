/**
 * Cache Headers Configuration
 * Optimize caching for different resource types
 */

export interface CacheConfig {
  maxAge: number; // seconds
  staleWhileRevalidate?: number; // seconds
  public?: boolean;
  immutable?: boolean;
}

/**
 * Generate Cache-Control header value
 */
export function generateCacheControl(config: CacheConfig): string {
  const parts: string[] = [];

  if (config.public) {
    parts.push('public');
  } else {
    parts.push('private');
  }

  parts.push(`max-age=${config.maxAge}`);

  if (config.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (config.immutable) {
    parts.push('immutable');
  }

  return parts.join(', ');
}

/**
 * Cache configurations for different resource types
 */
export const cacheConfigs = {
  // Static assets (images, fonts, etc.) - cache forever
  staticAssets: {
    maxAge: 31536000, // 1 year
    public: true,
    immutable: true,
  },

  // Published pages - cache with revalidation
  publishedPage: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 1 day
    public: true,
  },

  // Blog posts - cache with revalidation
  blogPost: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 1 day
    public: true,
  },

  // API responses - short cache
  apiResponse: {
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 300, // 5 minutes
    public: false,
  },

  // Preview pages - no cache
  preview: {
    maxAge: 0,
    public: false,
  },

  // Dynamic content - minimal cache
  dynamic: {
    maxAge: 30, // 30 seconds
    staleWhileRevalidate: 60, // 1 minute
    public: true,
  },
};

/**
 * Apply cache headers to a Response
 */
export function applyCacheHeaders(
  response: Response,
  configType: keyof typeof cacheConfigs
): Response {
  const config = cacheConfigs[configType];
  const cacheControl = generateCacheControl(config);

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', cacheControl);

  // Add ETag for better caching
  if (configType === 'publishedPage' || configType === 'blogPost') {
    const etag = generateETag(response);
    if (etag) {
      headers.set('ETag', etag);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Generate ETag from response
 */
function generateETag(response: Response): string | null {
  try {
    // Simple ETag based on current timestamp
    // In production, use content hash
    return `"${Date.now()}"`;
  } catch {
    return null;
  }
}

/**
 * Check if request has matching ETag
 */
export function checkETag(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  return ifNoneMatch === etag;
}

/**
 * CDN configuration for Vercel
 */
export const cdnConfig = {
  // Vercel Edge Network configuration
  edge: {
    regions: ['all'], // Deploy to all edge regions
    caching: {
      // Cache at edge for performance
      publishedPages: true,
      blogPosts: true,
      staticAssets: true,
    },
  },

  // Purge cache configuration
  purge: {
    onPublish: true, // Purge cache when page is published
    onUpdate: true, // Purge cache when page is updated
    onDelete: true, // Purge cache when page is deleted
  },
};

