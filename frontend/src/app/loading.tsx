'use client';

import { useState, useEffect } from 'react';

export default function Loading() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm glass-card p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
          </div>
          <div className="flex-1">
            <div className="h-3 w-28 skeleton" />
            <div className="h-2 w-40 skeleton mt-2" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-10 skeleton rounded-lg" />
          <div className="h-10 skeleton rounded-lg" />
          <div className="h-10 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}
