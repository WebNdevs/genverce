'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
}

let toastListeners: ((toast: Toast) => void)[] = [];
let toastId = 0;

export function toast(props: Omit<Toast, 'id'>) {
  const id = String(++toastId);
  toastListeners.forEach((listener) => listener({ ...props, id }));
}

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-success',
    iconCls: 'text-success',
    border: 'border-success/30',
    bg: 'bg-success/5',
  },
  error: {
    icon: AlertCircle,
    bar: 'bg-error',
    iconCls: 'text-error',
    border: 'border-error/30',
    bg: 'bg-error/5',
  },
  default: {
    icon: Info,
    bar: 'bg-brand',
    iconCls: 'text-brand-light',
    border: 'border-brand/20',
    bg: 'bg-brand/5',
  },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 5000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const v = VARIANTS[t.variant ?? 'default'];
          const Icon = v.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'pointer-events-auto relative flex items-start gap-3 w-[calc(100vw-2rem)] max-w-sm',
                'rounded-xl border shadow-xl shadow-black/60 overflow-hidden',
                'bg-[#16162a]',
                v.border,
              )}
            >
              {/* Accent bar */}
              <div className={cn('absolute left-0 top-0 bottom-0 w-1', v.bar)} />

              {/* Content */}
              <div className="flex items-start gap-3 pl-4 pr-10 py-3.5 w-full">
                <Icon size={18} className={cn('flex-shrink-0 mt-0.5', v.iconCls)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary leading-snug">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{t.description}</p>
                  )}
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => dismiss(t.id)}
                className="absolute top-2.5 right-2.5 p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
