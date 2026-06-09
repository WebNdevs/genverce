'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notifications';
import { connectSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toaster';
import { GET_MY_CHATS } from '@/graphql/queries/chat';
import { GET_MY_NOTIFICATIONS } from '@/graphql/queries/notification';

export function ChatNotifier() {
  const pathname = usePathname();
  const { isAuthenticated, token } = useAuthStore();
  const { hydrate, addLocal } = useNotificationStore();
  const joinedRooms = useRef<Set<string>>(new Set());
  const activeChatIdRef = useRef<string | null>(null);
  const notificationsEnabled =
    (process.env.NEXT_PUBLIC_DISABLE_CHAT_NOTIFICATIONS ?? 'false').toLowerCase() !== 'true';

  useEffect(() => {
    const p = pathname ?? '';
    if (p.startsWith('/admin/chats/')) {
      const parts = p.split('/').filter(Boolean);
      activeChatIdRef.current = parts[2] || null;
      return;
    }
    if (p.startsWith('/chat/')) {
      try {
        activeChatIdRef.current = localStorage.getItem('activeChatId');
      } catch {
        activeChatIdRef.current = null;
      }
      return;
    }
    if (p.startsWith('/messages')) {
      try {
        activeChatIdRef.current = localStorage.getItem('activeChatId');
      } catch {
        activeChatIdRef.current = null;
      }
      return;
    }
    activeChatIdRef.current = null;
  }, [pathname]);

  // Hydrate notifications from DB on load
  const { data: notifData } = useQuery(GET_MY_NOTIFICATIONS, {
    skip: !isAuthenticated || !notificationsEnabled,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (notifData?.myNotifications) {
      hydrate(notifData.myNotifications);
    }
  }, [notifData]);

  const { data: chatsData } = useQuery(GET_MY_CHATS, {
    skip: !isAuthenticated || !notificationsEnabled,
    fetchPolicy: 'cache-and-network',
  });

  const chats: any[] = chatsData?.myChats ?? [];

  // Join all chat rooms
  useEffect(() => {
    if (!token || chats.length === 0) return;
    const socket = connectSocket(token);
    chats.forEach((chat) => {
      if (!joinedRooms.current.has(chat.id)) {
        socket.emit('joinChat', { chatId: chat.id });
        joinedRooms.current.add(chat.id);
      }
    });
  }, [token, chats.length]);

  // Listen for new messages globally
  useEffect(() => {
    if (!notificationsEnabled) return;
    if (!token) return;
    const socket = connectSocket(token);

    const handleNewMessage = (msg: any) => {
      if (msg.role !== 'ASSISTANT') return;

      const p = pathname ?? '';
      if (p.startsWith('/chat/')) {
        const parts = p.split('/').filter(Boolean);
        const activeInfluencerId = parts[1] || '';
        if (activeInfluencerId) {
          const activeChat = chats.find((c) => c?.influencerId === activeInfluencerId);
          if (activeChat?.id && msg.chatId === activeChat.id) return;
        }
        try {
          const active = localStorage.getItem('activeChatId');
          if (active && msg.chatId === active) return;
        } catch {}
      }
      if (p.startsWith('/messages')) {
        try {
          const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const activeInfluencerId = qs?.get('with') || '';
          if (activeInfluencerId) {
            const activeChat = chats.find((c) => c?.influencerId === activeInfluencerId);
            if (activeChat?.id && msg.chatId === activeChat.id) return;
          }
        } catch {}
        try {
          const active = localStorage.getItem('activeChatId');
          if (active && msg.chatId === active) return;
        } catch {}
      }
      if (activeChatIdRef.current && msg.chatId === activeChatIdRef.current) return;

      const chat = chats.find((c) => c.id === msg.chatId);
      const influencerName = chat?.influencer?.name ?? 'AI Influencer';
      const influencerId = chat?.influencerId;

      const onThisChat = pathname === `/chat/${influencerId}`;
      if (onThisChat) return;

      const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content;

      // Add to local store immediately for real-time feel
      // (DB record already created by backend; will sync on next query refetch)
      addLocal({
        title: `New message from ${influencerName}`,
        description: preview,
        href: `/chat/${influencerId}`,
      });

      toast({
        title: `New message from ${influencerName}`,
        description: preview,
        variant: 'default',
      });
    };

    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [token, chats, pathname, addLocal, notificationsEnabled]);

  return null;
}
