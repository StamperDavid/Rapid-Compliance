/**
 * Mission Control — Loading skeleton
 */
export default function MissionControlLoading() {
  return (
    <div style={{
      display: 'flex',
      gap: '1rem',
      height: 'calc(100vh - 120px)',
      padding: '1.5rem',
    }}>
      {/* Left skeleton */}
      <div style={{
        width: 260,
        flexShrink: 0,
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border-light)',
      }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            padding: '1rem',
            borderBottom: '1px solid var(--color-border-light)',
          }}>
            <div style={{
              height: 14,
              width: '80%',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 4,
              marginBottom: 8,
            }} />
            <div style={{
              height: 10,
              width: '50%',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 4,
            }} />
          </div>
        ))}
      </div>

      {/* Center skeleton */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          color: 'var(--color-text-disabled)',
          fontSize: '0.875rem',
        }}>
          Loading Mission Control...
        </div>
      </div>

      {/* Right skeleton */}
      <div style={{
        width: 300,
        flexShrink: 0,
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border-light)',
      }} />
    </div>
  );
}
