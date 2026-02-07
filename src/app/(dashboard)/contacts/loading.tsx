export default function ContactsLoading() {
  return (
    <div className="min-h-screen bg-black p-8" role="status" aria-busy="true" aria-label="Loading contacts">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div>
            <div className="h-8 w-32 bg-white/10 rounded-lg mb-1" />
            <div className="h-4 w-36 bg-white/10 rounded opacity-60" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-20 bg-white/10 rounded-xl" />
          <div className="h-10 w-32 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="mb-6 animate-pulse">
        <div className="h-10 w-full max-w-sm bg-white/5 border border-white/10 rounded-xl" />
      </div>

      {/* Contact cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded mb-1" style={{ width: '60%' }} />
                <div className="h-3 bg-white/5 rounded" style={{ width: '40%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-white/5 rounded" style={{ width: '80%' }} />
              <div className="h-3 bg-white/5 rounded" style={{ width: '65%' }} />
              <div className="h-3 bg-white/5 rounded" style={{ width: '50%' }} />
            </div>
            <div className="flex gap-2 mt-4">
              <div className="h-7 w-16 bg-white/5 rounded-lg" />
              <div className="h-7 w-16 bg-white/5 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading contacts...</span>
    </div>
  );
}
