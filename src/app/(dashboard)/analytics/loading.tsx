export default function AnalyticsLoading() {
  return (
    <div className="bg-black min-h-screen p-8" role="status" aria-busy="true" aria-label="Loading analytics">
      <div className="max-w-[1400px] mx-auto">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-pulse">
          <div>
            <div className="h-8 w-48 bg-white/10 rounded-lg mb-2" />
            <div className="h-4 w-64 bg-white/10 rounded opacity-60" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-14 bg-white/10 rounded-lg" />
            ))}
          </div>
        </div>

        {/* KPI cards skeleton — 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="h-3 bg-white/10 rounded" style={{ width: '50%' }} />
                <div className="w-10 h-10 bg-white/10 rounded-xl" />
              </div>
              <div className="h-8 bg-white/10 rounded mb-2" style={{ width: '60%' }} />
              <div className="h-3 bg-white/5 rounded" style={{ width: '70%' }} />
            </div>
          ))}
        </div>

        {/* Quick access cards skeleton — 4 cards */}
        <div className="animate-pulse mb-8">
          <div className="h-6 w-36 bg-white/10 rounded mb-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex-shrink-0" />
              <div className="flex-1">
                <div className="h-5 bg-white/10 rounded mb-2" style={{ width: '50%' }} />
                <div className="h-3 bg-white/5 rounded mb-1" style={{ width: '90%' }} />
                <div className="h-3 bg-white/5 rounded" style={{ width: '70%' }} />
              </div>
              <div className="w-5 h-5 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading analytics...</span>
    </div>
  );
}
