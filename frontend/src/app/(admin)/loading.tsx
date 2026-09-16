export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Top Navbar Skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/20 animate-pulse" />
            <div className="w-24 h-6 rounded bg-surface border border-border animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface border border-border" />
            <div className="w-24 h-9 rounded-lg bg-brand/20 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Admin Layout Skeleton */}
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-6">
            {/* Sidebar Skeleton */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="rounded-lg border border-border bg-surface p-2 space-y-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-9 rounded-md bg-background animate-pulse" />
                ))}
              </div>
            </aside>

            {/* Admin Content Area Skeleton */}
            <section className="flex-1 min-w-0 space-y-6">
              <div className="w-48 h-8 rounded-lg bg-surface border border-border animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-border bg-surface p-4 animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 rounded-xl border border-border bg-surface p-6 animate-pulse" />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
