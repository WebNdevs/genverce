export default function RootLoading() {
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

      {/* Main Hero / Content Skeleton */}
      <main className="min-h-screen flex items-center justify-center pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full flex flex-col items-center">
          {/* Badge skeleton */}
          <div className="w-56 h-9 rounded-full bg-surface border border-brand/20 animate-pulse mb-8" />
          {/* Title skeleton */}
          <div className="w-full max-w-2xl h-14 sm:h-20 rounded-2xl bg-surface/80 border border-border animate-pulse mb-6" />
          {/* Subtitle skeleton */}
          <div className="w-full max-w-md h-8 rounded-xl bg-surface/60 border border-border animate-pulse mb-10" />
          {/* Action buttons skeleton */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <div className="w-48 h-12 rounded-lg bg-brand/30 animate-pulse" />
            <div className="w-44 h-12 rounded-lg bg-surface border border-border animate-pulse" />
          </div>
          {/* Stats counters skeleton */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-8 rounded-lg bg-surface border border-brand/20 animate-pulse" />
                <div className="w-20 h-4 rounded bg-surface/60 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
