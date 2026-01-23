/**
 * Lazy Loading Utilities
 * Implement intersection observer for lazy loading
 */

/**
 * Lazy load configuration
 */
export interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number | number[];
  onIntersect?: (element: Element) => void;
}

/**
 * Component import function type
 */
interface ComponentModule {
  default: React.ComponentType;
}

/**
 * Create intersection observer for lazy loading
 */
export function createLazyLoader(options: LazyLoadOptions = {}): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  const config = {
    rootMargin:(options.rootMargin !== '' && options.rootMargin != null) ? options.rootMargin : '50px',
    threshold: options.threshold ?? 0.01,
  };

  return new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        
        // Call custom handler if provided
        if (options.onIntersect) {
          options.onIntersect(element);
        } else {
          // Default: load image
          loadImage(element);
        }

        // Stop observing this element
        observer.unobserve(element);
      }
    });
  }, config);
}

/**
 * Load image from data attributes
 */
function loadImage(element: Element): void {
  const img = element as HTMLImageElement;
  const src = img.dataset.src;
  const srcset = img.dataset.srcset;

  if (src) {
    img.src = src;
    img.removeAttribute('data-src');
  }

  if (srcset) {
    img.srcset = srcset;
    img.removeAttribute('data-srcset');
  }

  // Add loaded class
  img.classList.add('loaded');
}

/**
 * Observe elements for lazy loading
 */
export function observeLazyLoad(
  selector: string = '[data-src], [data-srcset]',
  options?: LazyLoadOptions
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const observer = createLazyLoader(options);
  
  if (!observer) {
    // Fallback: load all images immediately
    document.querySelectorAll(selector).forEach(loadImage);
    return () => {};
  }

  // Observe all matching elements
  const elements = document.querySelectorAll(selector);
  elements.forEach(el => observer.observe(el));

  // Return cleanup function
  return () => {
    observer.disconnect();
  };
}

/**
 * Lazy load component wrapper
 */
export function lazyLoadComponent(
  importFn: () => Promise<ComponentModule>,
  options: {
    fallback?: React.ReactNode;
    delay?: number;
  } = {}
): Promise<ComponentModule> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const { delay = 0 } = options;

  return new Promise<ComponentModule>(resolve => {
    setTimeout(() => {
      void importFn().then(resolve);
    }, delay);
  });
}

/**
 * Preload next sections
 */
export function preloadNextSections(currentSection: number, totalSections: number): void {
  if (typeof window === 'undefined') {return;}

  // Preload next 2 sections
  const sectionsToPreload = [currentSection + 1, currentSection + 2].filter(
    n => n < totalSections
  );

  sectionsToPreload.forEach(sectionIndex => {
    const section = document.querySelector(`[data-section="${sectionIndex}"]`);
    if (section) {
      // Preload images in this section
      const images = section.querySelectorAll('img[data-src]');
      images.forEach(img => loadImage(img));
    }
  });
}

/**
 * Defer non-critical scripts
 */
export function deferScript(src: string, onLoad?: () => void): void {
  if (typeof document === 'undefined') {return;}

  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  
  if (onLoad) {
    script.onload = onLoad;
  }

  document.body.appendChild(script);
}

/**
 * Window with requestIdleCallback support
 */
interface WindowWithIdleCallback extends Window {
  requestIdleCallback: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
}

/**
 * Load script only when idle
 */
export function loadWhenIdle(callback: () => void, timeout: number = 2000): void {
  if (typeof window === 'undefined') {return;}

  if ('requestIdleCallback' in window) {
    (window as WindowWithIdleCallback).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, timeout);
  }
}


