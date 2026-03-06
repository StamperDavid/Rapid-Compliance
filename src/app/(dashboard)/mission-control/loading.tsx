/**
 * Mission Control — Loading skeleton matching the 3-panel layout.
 * Left: 280px, Center: flex-1, Right: 340px
 */
export default function MissionControlLoading() {
  return (
    <div style={{
      padding: '1.25rem 1.5rem',
    }}>
      {/* Header skeleton */}
      <div style={{
        height: 24,
        width: 180,
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: 6,
        marginBottom: '0.875rem',
      }} />

      <div style={{
        display: 'flex',
        gap: '0.875rem',
        height: 'calc(100vh - 200px)',
      }}>
        {/* Left skeleton — mission list */}
        <div style={{
          width: 280,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          overflow: 'hidden',
        }}>
          {/* Header bar */}
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border-light)',
          }}>
            <div style={{
              height: 10,
              width: 80,
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 4,
            }} />
          </div>

          {/* Mission card skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              <div style={{
                height: 12,
                width: '85%',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 4,
              }} />
              <div style={{
                height: 10,
                width: 60,
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 9999,
              }} />
              <div style={{
                height: 4,
                width: '100%',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 2,
              }} />
              <div style={{
                height: 8,
                width: 90,
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 4,
              }} />
            </div>
          ))}
        </div>

        {/* Center skeleton — plan view */}
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

        {/* Right skeleton — step detail */}
        <div style={{
          width: 340,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          padding: '1rem',
        }}>
          {/* Detail header skeleton */}
          <div style={{
            height: 10,
            width: 80,
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: 4,
            marginBottom: '1rem',
          }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '1rem',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'var(--color-bg-elevated)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                height: 12,
                width: '70%',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 4,
                marginBottom: 6,
              }} />
              <div style={{
                height: 10,
                width: '50%',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 4,
              }} />
            </div>
          </div>
          <div style={{
            height: 80,
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.5rem',
          }} />
        </div>
      </div>
    </div>
  );
}
