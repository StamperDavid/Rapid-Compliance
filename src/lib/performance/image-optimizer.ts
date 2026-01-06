/**
 * Image Optimization Utilities
 * Optimize images for web delivery
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  imageUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1920]
): string {
  return widths
    .map(width => {
      const optimizedUrl = optimizeImageUrl(imageUrl, { width, format: 'webp' });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Optimize image URL (works with Next.js Image or external services)
 */
export function optimizeImageUrl(
  imageUrl: string,
  options: ImageOptimizationOptions
): string {
  // If it's a relative URL or Next.js static asset
  if (imageUrl.startsWith('/')) {
    return buildNextImageUrl(imageUrl, options);
  }

  // If it's an external URL, consider using a proxy/CDN
  // For now, return as-is (could integrate with Cloudinary, Imgix, etc.)
  return imageUrl;
}

/**
 * Build Next.js Image Optimization URL
 */
function buildNextImageUrl(
  src: string,
  options: ImageOptimizationOptions
): string {
  const params = new URLSearchParams();

  if (options.width) {params.set('w', options.width.toString());}
  if (options.height) {params.set('h', options.height.toString());}
  if (options.quality) {params.set('q', options.quality.toString());}
  if (options.format) {params.set('f', options.format);}

  const queryString = params.toString();
  return queryString ? `${src}?${queryString}` : src;
}

/**
 * Get image dimensions for responsive loading
 */
export function getImageSizes(breakpoints: {
  mobile?: string;
  tablet?: string;
  desktop?: string;
}): string {
  const sizes: string[] = [];

  if (breakpoints.mobile) {
    sizes.push(`(max-width: 640px) ${breakpoints.mobile}`);
  }
  if (breakpoints.tablet) {
    sizes.push(`(max-width: 1024px) ${breakpoints.tablet}`);
  }
  if (breakpoints.desktop) {
    sizes.push(breakpoints.desktop);
  }

  return sizes.join(', ') || '100vw';
}

/**
 * Lazy load configuration
 */
export const lazyLoadConfig = {
  rootMargin: '50px', // Start loading 50px before entering viewport
  threshold: 0.01,
};

/**
 * Preload critical images
 */
export function preloadImage(src: string, as: 'image' = 'image'): void {
  if (typeof document === 'undefined') {return;}

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Calculate optimal image quality based on size
 */
export function getOptimalQuality(width: number): number {
  // Larger images can use lower quality without noticeable degradation
  if (width <= 400) {return 85;}
  if (width <= 800) {return 80;}
  if (width <= 1200) {return 75;}
  return 70;
}

/**
 * Check if WebP is supported
 */
export function supportsWebP(): boolean {
  if (typeof document === 'undefined') {return false;}

  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}

/**
 * Get image format based on browser support
 */
export function getOptimalFormat(): 'webp' | 'jpeg' {
  return supportsWebP() ? 'webp' : 'jpeg';
}


