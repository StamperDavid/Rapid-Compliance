'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NavigationProgress
 * Shows a top-of-page progress bar during client-side navigations.
 * Uses pathname changes to detect navigation start/end.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const previousPathname = useRef(pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Intercept link clicks to start the progress bar immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) { return; }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) { return; }
      if (anchor.target === '_blank') { return; }

      // Only show progress for internal navigations to different routes
      if (href !== previousPathname.current) {
        setIsNavigating(true);
        setProgress(15);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  // Simulate progress while navigating
  useEffect(() => {
    if (!isNavigating) { return; }

    cleanup();

    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        // Slow down as we approach completion — never reach 100 until actual navigation completes
        if (prev >= 90) { return prev; }
        if (prev >= 70) { return prev + 0.5; }
        if (prev >= 50) { return prev + 1; }
        return prev + 3;
      });
    }, 100);

    return cleanup;
  }, [isNavigating, cleanup]);

  // When pathname changes, complete the animation
  useEffect(() => {
    if (pathname !== previousPathname.current) {
      previousPathname.current = pathname;

      if (isNavigating) {
        // Complete the bar
        setProgress(100);

        const timer = setTimeout(() => {
          setIsNavigating(false);
          setProgress(0);
        }, 300);

        return () => clearTimeout(timer);
      }
    }
  }, [pathname, isNavigating]);

  return (
    <AnimatePresence>
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Page loading"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
              boxShadow: '0 0 10px var(--color-primary), 0 0 5px var(--color-primary)',
              borderRadius: '0 2px 2px 0',
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
