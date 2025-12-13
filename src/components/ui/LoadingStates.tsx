/**
 * Loading States & Skeletons
 * Beautiful loading indicators for better UX
 */

import React from 'react';

/**
 * Skeleton loader for text
 */
export const SkeletonText: React.FC<{
  lines?: number;
  width?: string;
}> = ({ lines = 1, width = '100%' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        style={{
          height: '1rem',
          width: i === lines - 1 ? '70%' : width,
          backgroundColor: '#2a2a2a',
          borderRadius: '0.25rem',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
    ))}
  </div>
);

/**
 * Skeleton loader for cards
 */
export const SkeletonCard: React.FC = () => (
  <div style={{
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '0.75rem',
    padding: '1.5rem',
  }}>
    <div style={{
      height: '1.5rem',
      width: '60%',
      backgroundColor: '#2a2a2a',
      borderRadius: '0.25rem',
      marginBottom: '1rem',
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    }} />
    <SkeletonText lines={3} />
  </div>
);

/**
 * Skeleton loader for table
 */
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 4 }) => (
  <div style={{ width: '100%' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '1rem',
          padding: '1rem',
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        {Array.from({ length: columns }).map((_, j) => (
          <div
            key={j}
            style={{
              height: '1rem',
              backgroundColor: '#2a2a2a',
              borderRadius: '0.25rem',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * Spinner loading indicator
 */
export const Spinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}> = ({ size = 'md', color = '#6366f1' }) => {
  const sizeMap = {
    sm: '1rem',
    md: '2rem',
    lg: '3rem',
  };
  
  return (
    <div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `3px solid ${color}33`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
};

/**
 * Progress bar
 */
export const ProgressBar: React.FC<{
  progress: number; // 0-100
  color?: string;
  showLabel?: boolean;
}> = ({ progress, color = '#6366f1', showLabel = true }) => (
  <div style={{ width: '100%' }}>
    {showLabel && (
      <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
        {progress.toFixed(0)}% Complete
      </div>
    )}
    <div style={{
      width: '100%',
      height: '0.5rem',
      backgroundColor: '#2a2a2a',
      borderRadius: '9999px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        backgroundColor: color,
        transition: 'width 0.3s ease',
      }} />
    </div>
  </div>
);

/**
 * Dot loader (animated dots)
 */
export const DotLoader: React.FC = () => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    {[0, 1, 2].map(i => (
      <div
        key={i}
        style={{
          width: '0.5rem',
          height: '0.5rem',
          backgroundColor: '#6366f1',
          borderRadius: '50%',
          animation: `bounce 1.4s infinite ease-in-out both`,
          animationDelay: `${i * 0.16}s`,
        }}
      />
    ))}
  </div>
);

/**
 * Loading overlay
 */
export const LoadingOverlay: React.FC<{
  message?: string;
}> = ({ message }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    zIndex: 9999,
  }}>
    <Spinner size="lg" />
    {message && (
      <div style={{ color: '#fff', fontSize: '1.125rem' }}>
        {message}
      </div>
    )}
  </div>
);

/**
 * Add global animation styles
 */
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes bounce {
      0%, 80%, 100% {
        transform: scale(0);
      }
      40% {
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}














