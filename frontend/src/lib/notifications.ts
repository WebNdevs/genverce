import { create } from 'zustand';

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export function isMessageNotification(n: Pick<AppNotification, 'href'>): boolean {
  const href = String(n?.href ?? '');
  return href === '/messages' || href.startsWith('/chat/');
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  // Hydrate from DB on load
  hydrate: (items: AppNotification[]) => void;
  // Add a real-time notification (before DB round-trip confirms)
  addLocal: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

let _localId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  hydrate: (items) =>
    set((s) => {
      // Preserve any locally-marked-read state so a DB re-fetch doesn't undo it
      const localReadIds = new Set(
        s.notifications.filter((n) => n.read).map((n) => n.id)
      );
      const merged = items.map((n) =>
        localReadIds.has(n.id) ? { ...n, read: true } : n
      );
      return {
        notifications: merged,
        unreadCount: merged.filter((n) => !n.read).length,
      };
    }),

  addLocal: (n) => {
    const notification: AppNotification = {
      ...n,
      id: `local-${++_localId}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    }));
  },

  markRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      if (!target || target.read) return s;
      return {
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      };
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}));
