/**
 * Loading State Components
 * Reusable loading indicators for consistent UX
 */

'use client';

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`${sizeClasses[size]} border-t-transparent border-blue-500 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingButton({
  loading,
  children,
  onClick,
  disabled,
  ...props
}: {
  loading: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  [key: string]: any;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        opacity: loading || disabled ? 0.6 : 1,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        ...props.style,
      }}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}

export function LoadingSkeleton({ count = 1 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '4rem',
            background: 'linear-gradient(90deg, #1a1a1a 25%, #262626 50%, #1a1a1a 75%)',
            backgroundSize: '200% 100%',
            animation: 'loading 1.5s ease-in-out infinite',
            borderRadius: '0.5rem',
          }}
        />
      ))}
      <style jsx>{`
        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

export function LoadingTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '2rem',
              background: '#262626',
              borderRadius: '0.25rem',
            }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '1rem',
            marginBottom: '0.5rem',
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              style={{
                height: '3rem',
                background: 'linear-gradient(90deg, #1a1a1a 25%, #262626 50%, #1a1a1a 75%)',
                backgroundSize: '200% 100%',
                animation: `loading 1.5s ease-in-out infinite ${j * 0.1}s`,
                borderRadius: '0.25rem',
              }}
            />
          ))}
        </div>
      ))}
      <style jsx>{`
        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        zIndex: 9999,
      }}
    >
      <LoadingSpinner size="lg" />
      <div style={{ color: '#fff', fontSize: '1.125rem' }}>{message}</div>
    </div>
  );
}










