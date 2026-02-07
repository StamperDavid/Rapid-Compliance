export default function DealsLoading() {
  return (
    <div className="min-h-screen bg-black p-8" role="status" aria-busy="true" aria-label="Loading deals">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div>
            <div className="h-8 w-24 bg-white/10 rounded-lg mb-1" />
            <div className="h-4 w-40 bg-white/10 rounded opacity-60" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 bg-white/10 rounded-xl" />
          <div className="h-10 w-32 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Pipeline view skeleton — 6 stage columns */}
      <div className="grid grid-cols-6 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-3">
            {/* Stage header */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="h-4 bg-white/10 rounded" style={{ width: '60%' }} />
              <div className="h-5 w-6 bg-white/10 rounded-full" />
            </div>
            {/* Deal cards in stage */}
            {Array.from({ length: Math.max(1, 3 - col % 2) }).map((_, card) => (
              <div key={card} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="h-4 bg-white/10 rounded mb-2" style={{ width: '80%' }} />
                <div className="h-3 bg-white/5 rounded mb-3" style={{ width: '60%' }} />
                <div className="flex justify-between items-center">
                  <div className="h-5 w-16 bg-white/10 rounded-lg" />
                  <div className="h-3 w-12 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading deals...</span>
    </div>
  );
}
