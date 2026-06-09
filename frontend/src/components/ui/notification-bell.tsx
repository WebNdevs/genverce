'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, MessageSquare, CheckCheck, ChevronRight } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { useNotificationStore, AppNotification, isMessageNotification } from '@/lib/notifications';
import { MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ } from '@/graphql/mutations/notification';
import { cn } from '@/lib/utils';

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, markRead } = useNotificationStore();
  const general = notifications.filter((n) => !isMessageNotification(n));
  const unreadCount = general.filter((n) => !n.read).length;
  const recent = general.slice(0, 5);

  const [markReadMutation] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Mark all unread GENERAL notifications as read when the dropdown is opened
  useEffect(() => {
    if (!open || unreadCount <= 0) return;
    const unreadGeneral = general.filter((n) => !n.read);
    unreadGeneral.forEach((n) => markRead(n.id));
    const ids = unreadGeneral.map((n) => n.id).filter((id) => !id.startsWith('local-'));
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => markReadMutation({ variables: { id } }))).catch(() => {});
  }, [open]);

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    if (!n.id.startsWith('local-')) {
      markReadMutation({ variables: { id: n.id } });
    }
    setOpen(false);
    router.push(n.href);
  };

  const handleMarkAllRead = () => {
    const unreadGeneral = general.filter((n) => !n.read);
    unreadGeneral.forEach((n) => markRead(n.id));
    const ids = unreadGeneral.map((n) => n.id).filter((id) => !id.startsWith('local-'));
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => markReadMutation({ variables: { id } }))).catch(() => {});
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface/70 text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 glass-card overflow-hidden shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {general.some((n) => !n.read) && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-brand-light hover:text-brand transition-colors"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={28} className="text-text-secondary/30 mx-auto mb-2" />
                <p className="text-sm text-text-secondary">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {recent.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-surface transition-colors',
                        !n.read && 'bg-brand/5'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        n.read ? 'bg-surface' : 'bg-brand/10'
                      )}>
                        <MessageSquare size={14} className={n.read ? 'text-text-secondary' : 'text-brand-light'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-medium leading-snug', !n.read && 'text-text-primary')}>
                          {n.title}
                        </p>
                        {n.description && (
                          <p className="text-xs text-text-secondary truncate mt-0.5">{n.description}</p>
                        )}
                        <p className="text-[10px] text-text-secondary/50 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Footer */}
            <button
              onClick={() => { setOpen(false); router.push('/notifications'); }}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-brand-light hover:text-brand hover:bg-surface transition-colors border-t border-border"
            >
              All Notifications <ChevronRight size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
