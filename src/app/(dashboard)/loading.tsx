export default function DashboardGroupLoading() {
  return (
    <div className="min-h-screen bg-black p-8" role="status" aria-busy="true" aria-label="Loading page">
      <div className="max-w-[1400px] mx-auto animate-pulse">
        {/* Generic page header skeleton */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div>
            <div className="h-8 w-40 bg-white/10 rounded-lg mb-1" />
            <div className="h-4 w-28 bg-white/10 rounded opacity-60" />
          </div>
        </div>

        {/* Generic content area skeleton */}
        <div className="rounded-2xl bg-black/40 border border-white/10 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-4 p-4 border-b border-white/10">
            <div className="h-10 w-64 bg-white/5 border border-white/10 rounded-xl" />
            <div className="h-10 w-28 bg-white/5 rounded-xl" />
          </div>
          {/* Content rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-white/5">
              <div className="h-4 w-4 bg-white/5 rounded" />
              <div className="h-4 bg-white/5 rounded flex-1" style={{ maxWidth: `${60 + (i % 3) * 10}%` }} />
              <div className="h-4 bg-white/5 rounded w-24" />
              <div className="h-7 w-16 bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
