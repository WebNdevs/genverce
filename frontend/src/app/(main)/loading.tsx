export default function MainLoading() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Top Navbar Skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/20 animate-pulse" />
            <div className="w-24 h-6 rounded bg-surface border border-border animate-pulse" />
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="w-32 h-4 rounded bg-surface border border-border animate-pulse" />
            <div className="w-48 h-4 rounded bg-surface border border-border animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface border border-border" />
            <div className="w-28 h-9 rounded-lg bg-brand/20 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Page Skeleton */}
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <div className="w-64 h-9 rounded-xl bg-surface border border-border animate-pulse" />
              <div className="w-96 h-5 rounded-lg bg-surface/60 border border-border animate-pulse" />
            </div>
            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface p-6 space-y-4 animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-surface border border-border" />
                    <div className="space-y-2 flex-1">
                      <div className="w-3/4 h-5 rounded bg-background" />
                      <div className="w-1/2 h-4 rounded bg-background" />
                    </div>
                  </div>
                  <div className="w-full h-12 rounded bg-background" />
                  <div className="w-full h-9 rounded-lg bg-brand/10 border border-brand/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
