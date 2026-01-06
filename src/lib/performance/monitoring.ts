/**
 * Performance Monitoring Utilities
 * Track and report web vitals and performance metrics
 */

export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

/**
 * Collect Web Vitals
 */
export function collectWebVitals(callback: (metrics: PerformanceMetrics) => void): void {
  if (typeof window === 'undefined') {return;}

  const metrics: PerformanceMetrics = {};

  // Observe FCP (First Contentful Paint)
  if ('PerformanceObserver' in window) {
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name === 'first-contentful-paint') {
            metrics.fcp = entry.startTime;
            callback(metrics);
          }
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });

      // Observe LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
        callback(metrics);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Observe FID (First Input Delay)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          metrics.fid = (entry as any).processingStart - entry.startTime;
          callback(metrics);
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Observe CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            metrics.cls = clsValue;
            callback(metrics);
          }
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.error('[Performance] Error collecting web vitals:', error);
    }
  }

  // Collect TTFB (Time to First Byte)
  if (performance.timing) {
    const ttfb = performance.timing.responseStart - performance.timing.requestStart;
    metrics.ttfb = ttfb;
    callback(metrics);
  }
}

/**
 * Report performance metrics to analytics
 */
export function reportPerformance(metrics: PerformanceMetrics, organizationId: string): void {
  // Send to analytics endpoint
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const data = {
      organizationId,
      metrics,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    navigator.sendBeacon('/api/analytics/performance', JSON.stringify(data));
  }
}

/**
 * Get performance score (0-100)
 */
export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  let score = 100;

  // LCP scoring (good < 2.5s, needs improvement < 4s, poor >= 4s)
  if (metrics.lcp) {
    if (metrics.lcp > 4000) {
      score -= 30;
    } else if (metrics.lcp > 2500) {
      score -= 15;
    }
  }

  // FID scoring (good < 100ms, needs improvement < 300ms, poor >= 300ms)
  if (metrics.fid) {
    if (metrics.fid > 300) {
      score -= 25;
    } else if (metrics.fid > 100) {
      score -= 10;
    }
  }

  // CLS scoring (good < 0.1, needs improvement < 0.25, poor >= 0.25)
  if (metrics.cls) {
    if (metrics.cls > 0.25) {
      score -= 25;
    } else if (metrics.cls > 0.1) {
      score -= 10;
    }
  }

  // FCP scoring (good < 1.8s, needs improvement < 3s, poor >= 3s)
  if (metrics.fcp) {
    if (metrics.fcp > 3000) {
      score -= 20;
    } else if (metrics.fcp > 1800) {
      score -= 10;
    }
  }

  return Math.max(0, score);
}

/**
 * Log performance metrics to console (dev mode)
 */
export function logPerformanceMetrics(metrics: PerformanceMetrics): void {
  if (process.env.NODE_ENV !== 'development') {return;}

  console.group('🚀 Performance Metrics');
  console.log('FCP (First Contentful Paint):', metrics.fcp?.toFixed(0), 'ms');
  console.log('LCP (Largest Contentful Paint):', metrics.lcp?.toFixed(0), 'ms');
  console.log('FID (First Input Delay):', metrics.fid?.toFixed(0), 'ms');
  console.log('CLS (Cumulative Layout Shift):', metrics.cls?.toFixed(3));
  console.log('TTFB (Time to First Byte):', metrics.ttfb?.toFixed(0), 'ms');
  console.log('Performance Score:', calculatePerformanceScore(metrics), '/100');
  console.groupEnd();
}

/**
 * Monitor long tasks (tasks taking > 50ms)
 */
export function monitorLongTasks(callback: (duration: number) => void): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {return;}

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          callback(entry.duration);
          console.warn('[Performance] Long task detected:', entry.duration, 'ms');
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    // longtask not supported in all browsers
  }
}

/**
 * Resource timing analysis
 */
export function analyzeResourceTiming(): {
  total: number;
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
} {
  if (typeof window === 'undefined') {
    return { total: 0, scripts: 0, stylesheets: 0, images: 0, fonts: 0 };
  }

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  const analysis = {
    total: resources.length,
    scripts: 0,
    stylesheets: 0,
    images: 0,
    fonts: 0,
  };

  resources.forEach((resource) => {
    if (resource.initiatorType === 'script') {
      analysis.scripts++;
    } else if (resource.initiatorType === 'link' && resource.name.includes('.css')) {
      analysis.stylesheets++;
    } else if (resource.initiatorType === 'img') {
      analysis.images++;
    } else if (resource.name.includes('.woff') || resource.name.includes('.ttf')) {
      analysis.fonts++;
    }
  });

  return analysis;
}


