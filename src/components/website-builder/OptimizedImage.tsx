/**
 * Optimized Image Component
 * Lazy loading, responsive images, WebP support
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { getImageSizes } from '@/lib/performance/image-optimizer';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean; // Disable lazy loading for above-the-fold images
  sizes?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  onLoad?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  style,
  priority = false,
  sizes,
  onLoad,
}: OptimizedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(priority);

  useEffect(() => {
    if (priority) {
      setIsVisible(true);
      return;
    }

    // Lazy loading with Intersection Observer on the container div
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Generate responsive size hint
  const sizesAttr = sizes ? getImageSizes(sizes) : '100vw';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      className={className}
    >
      {/* Placeholder while loading */}
      {!isLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--color-bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--color-border-light)',
              borderTopColor: 'var(--color-info)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* Actual image — unoptimized because the image-optimizer generates its own srcSet */}
      {isVisible && (
        <Image
          src={src}
          alt={alt}
          width={width ?? 0}
          height={height ?? 0}
          sizes={sizesAttr}
          unoptimized
          priority={priority}
          onLoad={handleLoad}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


