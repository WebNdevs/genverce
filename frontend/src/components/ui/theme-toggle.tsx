'use client';

import { useTheme } from '@/providers/theme-provider';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-lg border border-border bg-surface/70 ${className || ''}`} />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface/70 text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50 ${className || ''}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      <motion.div
        key={theme}
        initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-center"
      >
        {theme === 'dark' ? (
          <Sun size={18} className="text-amber-400 hover:text-amber-300" />
        ) : (
          <Moon size={18} className="text-indigo-600 hover:text-indigo-500" />
        )}
      </motion.div>
    </button>
  );
}

export function MobileThemeToggle({ onClose }: { onClose?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-full rounded-lg bg-surface/50 animate-pulse" />;
  }

  return (
    <button
      onClick={() => {
        toggleTheme();
        if (onClose) onClose();
      }}
      className="flex items-center justify-between w-full py-2 px-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
    >
      <div className="flex items-center gap-2">
        {theme === 'dark' ? (
          <Sun size={16} className="text-amber-400" />
        ) : (
          <Moon size={16} className="text-indigo-600" />
        )}
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-surface font-semibold text-text-secondary uppercase tracking-wider">
        {theme}
      </span>
    </button>
  );
}
