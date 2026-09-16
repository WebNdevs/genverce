'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface TabNavigationContextType {
  isNavigating: boolean;
  startNavigation: () => void;
  stopNavigation: () => void;
}

const TabNavigationContext = createContext<TabNavigationContextType>({
  isNavigating: false,
  startNavigation: () => {},
  stopNavigation: () => {},
});

function RouteChangeListener({ onRouteChanged }: { onRouteChanged: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onRouteChanged();
  }, [pathname, searchParams, onRouteChanged]);

  return null;
}

export function TabNavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
    setProgress(20);
  }, []);

  const stopNavigation = useCallback(() => {
    setProgress(100);
    const timer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 220);
    return () => clearTimeout(timer);
  }, []);

  // Progress animation steps
  useEffect(() => {
    if (!isNavigating) return;
    const t1 = setTimeout(() => setProgress((p) => Math.max(p, 50)), 50);
    const t2 = setTimeout(() => setProgress((p) => Math.max(p, 75)), 180);
    const t3 = setTimeout(() => setProgress((p) => Math.max(p, 90)), 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isNavigating]);

  // Intercept clicks on links & tabs globally for ZERO-delay visual feedback
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const link = target.closest('a');
      const button = target.closest('button');

      if (link && link.href) {
        try {
          const url = new URL(link.href, window.location.href);
          if (url.origin === window.location.origin && url.href !== window.location.href) {
            startNavigation();
          }
        } catch {}
      } else if (button) {
        const isTab =
          button.getAttribute('role') === 'tab' ||
          button.getAttribute('data-tab') !== null ||
          button.classList.contains('tab-btn') ||
          button.closest('[role="tablist"]') !== null;
        if (isTab) {
          startNavigation();
          setTimeout(() => stopNavigation(), 250);
        }
      }
    };

    window.addEventListener('pointerdown', handleGlobalPointerDown, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
    };
  }, [startNavigation, stopNavigation]);

  return (
    <TabNavigationContext.Provider value={{ isNavigating, startNavigation, stopNavigation }}>
      <Suspense fallback={null}>
        <RouteChangeListener onRouteChanged={stopNavigation} />
      </Suspense>

      {/* Top Loading Bar */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-[99999] h-1 pointer-events-none bg-surface/30">
          <div
            className="h-full bg-gradient-brand shadow-[0_0_12px_#4F46E5] transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {children}
    </TabNavigationContext.Provider>
  );
}

export function useTabNavigation() {
  return useContext(TabNavigationContext);
}
