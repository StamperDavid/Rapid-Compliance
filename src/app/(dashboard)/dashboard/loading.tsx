export default function DashboardLoading() {
  return (
    <div style={{ padding: '2rem' }} role="status" aria-busy="true" aria-label="Loading dashboard">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header skeleton */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="animate-pulse" style={{ height: '2rem', width: '180px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.5rem', marginBottom: '0.5rem' }} />
            <div className="animate-pulse" style={{ height: '0.875rem', width: '300px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', opacity: 0.6 }} />
          </div>
          <div className="animate-pulse" style={{ height: '2.5rem', width: '120px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.5rem' }} />
        </div>

        {/* Stats grid skeleton — 4 stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-main)',
                borderRadius: '1rem',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ height: '0.875rem', width: '80px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', marginBottom: '0.75rem' }} />
                  <div style={{ height: '2rem', width: '120px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem' }} />
                </div>
                <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'var(--color-border-main)', borderRadius: '0.5rem', opacity: 0.3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline + Activity skeleton — 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Pipeline section */}
          <div
            className="animate-pulse"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-main)',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <div style={{ height: '1.25rem', width: '140px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', marginBottom: '1.5rem' }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ height: '0.875rem', width: '100px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem' }} />
                  <div style={{ height: '0.875rem', width: '140px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem' }} />
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '9999px' }} />
              </div>
            ))}
          </div>

          {/* Activity section */}
          <div
            className="animate-pulse"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-main)',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <div style={{ height: '1.25rem', width: '150px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', marginBottom: '1.5rem' }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '1.5rem', height: '1.5rem', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '0.875rem', width: '60%', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
                  <div style={{ height: '0.75rem', width: '80%', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions + Tasks skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div
            className="animate-pulse"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-main)',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <div style={{ height: '1.25rem', width: '130px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', marginBottom: '1.5rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '3.5rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem' }} />
              ))}
            </div>
          </div>
          <div
            className="animate-pulse"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-main)',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <div style={{ height: '1.25rem', width: '140px', backgroundColor: 'var(--color-border-main)', borderRadius: '0.25rem', marginBottom: '1.5rem' }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: '3rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', marginBottom: '0.75rem' }} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading dashboard...</span>
    </div>
  );
}
