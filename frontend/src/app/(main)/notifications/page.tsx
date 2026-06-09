'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, MessageSquare, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { useNotificationStore, AppNotification, isMessageNotification } from '@/lib/notifications';
import { MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ } from '@/graphql/mutations/notification';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 6;

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, markRead } = useNotificationStore();
  const [markReadMutation] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_READ);
  const [page, setPage] = useState(1);
  const general = notifications.filter((n) => !isMessageNotification(n));

  // Mark all unread GENERAL notifications as read as soon as the page is viewed
  useEffect(() => {
    const unreadGeneral = general.filter((n) => !n.read);
    if (unreadGeneral.length === 0) return;
    unreadGeneral.forEach((n) => markRead(n.id));
    const ids = unreadGeneral.map((n) => n.id).filter((id) => !id.startsWith('local-'));
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => markReadMutation({ variables: { id } }))).catch(() => {});
  }, []);

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    if (!n.id.startsWith('local-')) {
      markReadMutation({ variables: { id: n.id } });
    }
    router.push(n.href);
  };

  const handleMarkAllRead = () => {
    const unreadGeneral = general.filter((n) => !n.read);
    unreadGeneral.forEach((n) => markRead(n.id));
    const ids = unreadGeneral.map((n) => n.id).filter((id) => !id.startsWith('local-'));
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => markReadMutation({ variables: { id } }))).catch(() => {});
  };

  const unread = general.filter((n) => !n.read).length;
  const totalPages = Math.ceil(general.length / PAGE_SIZE);
  const paginated = general.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="py-2">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            <span className="gradient-text">Notifications</span>
          </h1>
          <p className="text-text-secondary">
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </motion.div>

      {general.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-14 text-center">
          <Bell size={40} className="text-text-secondary/30 mx-auto mb-4" />
          <p className="text-text-secondary text-lg mb-1">No notifications yet</p>
          <p className="text-text-secondary/60 text-sm">General updates will appear here.</p>
        </motion.div>
      ) : (
        <div className="glass-card overflow-hidden">
          {paginated.map((n, i) => (
            <motion.button
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => handleClick(n)}
              className={cn(
                'w-full text-left flex items-start gap-4 px-5 py-4 border-b border-border/60 last:border-0 hover:bg-surface transition-colors',
                !n.read && 'bg-brand/5'
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                n.read ? 'bg-surface border border-border' : 'bg-brand/10 border border-brand/20'
              )}>
                <MessageSquare size={15} className={n.read ? 'text-text-secondary' : 'text-brand-light'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium leading-snug', n.read ? 'text-text-secondary' : 'text-text-primary')}>
                  {n.title}
                </p>
                {n.description && (
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.description}</p>
                )}
                <p className="text-[11px] text-text-secondary/50 mt-1.5">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.read && (
                <span className="w-2.5 h-2.5 rounded-full bg-brand flex-shrink-0 mt-1.5" />
              )}
            </motion.button>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
              <p className="text-xs text-text-secondary">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, general.length)} of {general.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                      p === page
                        ? 'bg-brand/20 text-brand-light'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
