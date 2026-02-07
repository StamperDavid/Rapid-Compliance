export default function LeadsLoading() {
  return (
    <div className="min-h-screen bg-black p-8" role="status" aria-busy="true" aria-label="Loading leads">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div>
            <div className="h-8 w-24 bg-white/10 rounded-lg mb-1" />
            <div className="h-4 w-32 bg-white/10 rounded opacity-60" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-2 mb-6 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 rounded-xl bg-white/10" style={{ width: `${70 + i * 10}px` }} />
        ))}
      </div>

      {/* Search bar skeleton */}
      <div className="mb-4 animate-pulse">
        <div className="h-10 w-full max-w-sm bg-white/5 border border-white/10 rounded-xl" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl bg-black/40 border border-white/10 overflow-hidden animate-pulse">
        {/* Table header */}
        <div className="grid grid-cols-8 gap-4 p-4 border-b border-white/10">
          <div className="h-4 w-4 bg-white/10 rounded" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-4 bg-white/10 rounded" style={{ width: `${50 + (i % 3) * 20}%` }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-8 gap-4 p-4 border-b border-white/5">
            <div className="h-4 w-4 bg-white/5 rounded" />
            <div className="h-4 bg-white/5 rounded" style={{ width: '80%' }} />
            <div className="h-4 bg-white/5 rounded" style={{ width: '70%' }} />
            <div className="h-4 bg-white/5 rounded" style={{ width: '90%' }} />
            <div className="h-4 bg-white/5 rounded" style={{ width: '60%' }} />
            <div className="h-5 w-14 bg-white/5 rounded-lg" />
            <div className="h-5 w-10 bg-white/5 rounded-lg" />
            <div className="h-7 w-16 bg-white/5 rounded-lg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading leads...</span>
    </div>
  );
}
