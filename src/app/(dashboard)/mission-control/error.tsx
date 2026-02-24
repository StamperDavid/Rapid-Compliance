'use client';

/**
 * Mission Control — Error boundary
 */
export default function MissionControlError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 'calc(100vh - 120px)',
      gap: '1rem',
      padding: '2rem',
    }}>
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--color-error)',
      }}>
        Mission Control Error
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary)',
        maxWidth: 400,
        textAlign: 'center',
      }}>
        {error.message || 'Something went wrong loading Mission Control.'}
      </div>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '0.5rem 1.5rem',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        Try Again
      </button>
    </div>
  );
}
