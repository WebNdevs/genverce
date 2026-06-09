'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Briefcase, Search, ArrowLeft, ChevronRight, Wifi, WifiOff, Menu, X,
  ChevronUp, ChevronDown, Paperclip, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { ImageBubble } from '@/components/ui/image-bubble';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { GET_MY_CHATS } from '@/graphql/queries/chat';
import { START_CHAT } from '@/graphql/mutations/chat';
import { MARK_NOTIFICATION_READ } from '@/graphql/mutations/notification';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notifications';

import { connectSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toaster';
import { Message } from '@/types';

/* ── helpers ─────────────────────────────────────────────── */
function dateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtSidebarTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ name, src, size = 10 }: { name: string; src?: string; size?: number }) {
  const s = `w-${size} h-${size}`;
  return (
    <div className={`${s} rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text flex-shrink-0 overflow-hidden`}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

/* ── inject date separators ──────────────────────────────── */
type MsgOrSep = Message | { type: 'separator'; label: string; key: string };

function injectSeparators(msgs: Message[]): MsgOrSep[] {
  const result: MsgOrSep[] = [];
  let lastDate = '';
  for (const m of msgs) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDate) {
      result.push({ type: 'separator', label: dateSeparator(m.createdAt), key: `sep-${m.id}` });
      lastDate = day;
    }
    result.push(m);
  }
  return result;
}

/* ── highlight matching text ─────────────────────────────── */
function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-brand/30 text-text-primary rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

function parseFileMessage(text: string) {
  const t = (text ?? '').trim();
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const fileLineIndex = lines.findIndex((l) => /^file:\s*/i.test(l));
  if (fileLineIndex < 0) return null;
  const url = lines[lines.length - 1] ?? '';
  if (!/^https?:\/\//i.test(url)) return null;
  const name = (lines[fileLineIndex] ?? '').replace(/^file:\s*/i, '').trim() || 'Attachment';
  const captionLines = lines.slice(0, fileLineIndex);
  const caption = captionLines.join('\n').trim();
  return { name, url, caption };
}

function isFileMessage(text: string) {
  return !!parseFileMessage(text);
}

function renderFileMessage(text: string) {
  const parsed = parseFileMessage(text);
  if (!parsed) return <>{text}</>;
  const { name, url, caption } = parsed;
  return (
    <div className="flex flex-col gap-1.5">
      {caption ? <div className="text-sm whitespace-pre-wrap">{caption}</div> : null}
      <div className="text-sm font-medium">{name}</div>
      <a href={url} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2 opacity-90 hover:opacity-100">
        Download
      </a>
    </div>
  );
}

function shouldShowImageText(text: string) {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (/^image:\s*/i.test(t) && !t.includes('\n')) return false;
  return true;
}

/* ── main component ──────────────────────────────────────── */
export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, hydrated, token } = useAuthStore();
  const { notifications, markRead } = useNotificationStore();
  const influencerId = params?.id as string;
  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ);
  const unreadMessageCount = notifications.filter(
    (n) => !n.read && (n.href.startsWith('/chat/') || n.href === '/messages')
  ).length;

  // Mark notifications for this chat as read when entering
  useEffect(() => {
    notifications
      .filter((n) => !n.read && n.href === `/chat/${influencerId}`)
      .forEach((n) => {
        markRead(n.id);
        if (!n.id.startsWith('local-')) {
          markNotificationRead({ variables: { id: n.id } });
        }
      });
  }, [influencerId, notifications.length]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<null | { url: string; name: string; mimeType: string; isImage: boolean }>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chatInitialized = useRef(false);
  // Keep chatId in a ref so reconnect handler always has the latest value
  const chatIdRef = useRef<string | null>(null);

  const { data: influencerData } = useQuery(GET_INFLUENCER, {
    variables: { id: influencerId },
    skip: !influencerId,
  });
  const influencer = influencerData?.influencer as any;
  const influencerName = influencer?.name ?? '…';
  const influencerInactive = influencer?.isActive === false;

  const { data: chatsData, refetch: refetchChats } = useQuery(GET_MY_CHATS, {
    fetchPolicy: 'cache-and-network',
    skip: !isAuthenticated,
  });
  const allChats = chatsData?.myChats ?? [];

  const filteredChats = sidebarSearch.trim()
    ? allChats.filter((c: any) =>
        c.influencer?.name?.toLowerCase().includes(sidebarSearch.toLowerCase())
      )
    : allChats;

  const joinRoom = (id: string) => {
    connectSocket(token!).emit('joinChat', { chatId: id, active: true });
  };

  const [startChat] = useMutation(START_CHAT, {
    onCompleted: (data) => {
      const chat = data.startChat;
      const realChatId = chat.id;
      chatIdRef.current = realChatId;
      setChatId(realChatId);
      try {
        localStorage.setItem('activeChatId', realChatId);
      } catch {}
      try {
        if (user?.id && token) connectSocket(token).emit('setActiveChat', { chatId: realChatId, userId: user.id });
      } catch {}

      const history: Message[] = (chat.messages ?? []).map((m: any) => ({ ...m }));
      setMessages(history);

      joinRoom(realChatId);
      refetchChats();
    },
  });

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!token || chatInitialized.current) return;
    chatInitialized.current = true;

    const socket = connectSocket(token);
    setConnected(socket.connected);

    socket.on('connect', () => {
      setConnected(true);
      // Re-join room on every reconnect so events are never missed
      if (chatIdRef.current) {
        joinRoom(chatIdRef.current);
        try {
          localStorage.setItem('activeChatId', chatIdRef.current);
        } catch {}
        try {
          if (user?.id) socket.emit('setActiveChat', { chatId: chatIdRef.current, userId: user.id });
        } catch {}
      }
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('newMessage', (msg: Message) => {
      if (msg.chatId !== chatIdRef.current) return;
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      refetchChats();
    });
    socket.on('typing', ({ isTyping: t }: { isTyping: boolean }) => setIsTyping(t));
    socket.on('chatError', ({ message }: { message: string }) => {
      setIsTyping(false);
      toast({ title: 'Chat error', description: message, variant: 'error' });
    });

    startChat({ variables: { influencerId } });

    return () => {
      if (chatIdRef.current) socket.emit('leaveChat', { chatId: chatIdRef.current });
      try {
        const active = localStorage.getItem('activeChatId');
        if (active && chatIdRef.current && active === chatIdRef.current) localStorage.removeItem('activeChatId');
      } catch {}
      try {
        socket.emit('clearActiveChat', {});
      } catch {}
      socket.off('connect');
      socket.off('disconnect');
      socket.off('newMessage');
      socket.off('typing');
      socket.off('chatError');
      chatInitialized.current = false;
    };
  }, [hydrated, isAuthenticated, token, influencerId, user?.id]);

  // Reset state when navigating to a different influencer
  useEffect(() => {
    chatIdRef.current = null;
    setMessages([]);
    setChatId(null);
  }, [influencerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    setSearchIndex(0);
    if (matchedIds.length > 0) {
      msgRefs.current[matchedIds[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const sendMessage = () => {
    if ((!input.trim() && !pendingUpload) || !chatId || !connected || uploading) return;
    const base = input.trim();
    const content = pendingUpload
      ? pendingUpload.isImage
        ? (base || `Image: ${pendingUpload.name}`)
        : `${base ? `${base}\n\n` : ''}File: ${pendingUpload.name}\n${pendingUpload.url}`
      : base;
    connectSocket(token!).emit('sendMessage', {
      chatId,
      influencerId,
      content,
      ...(pendingUpload?.isImage ? { imageUrl: pendingUpload.url } : {}),
      userId: user?.id,
    });
    setInput('');
    setPendingUpload(null);
    inputRef.current?.focus();
  };

  const uploadFile = async (file: File) => {
    if (!chatId || !connected) return;
    setUploading(true);
    try {
      const authToken = localStorage.getItem('genverce_token') || token || '';
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form },
      );
      if (!res.ok) {
        let detail = '';
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const j = await res.json();
            detail = String(j?.message || j?.error || '');
          } else {
            detail = (await res.text()).trim();
          }
        } catch {}
        const msg = detail || `Upload failed (${res.status})`;
        throw new Error(msg);
      }
      const payload = await res.json();
      const url = payload?.url as string;
      if (!url) throw new Error('Upload failed');

      const mimeType = String(payload?.mimeType || file.type || '');
      const isImage = mimeType.startsWith('image/');
      setPendingUpload({ url, name: file.name, mimeType, isImage });
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    await uploadFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const q = searchQuery.trim().toLowerCase();
  const matchedIds = q
    ? messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.id)
    : [];
  const clampedIndex = matchedIds.length > 0 ? Math.min(searchIndex, matchedIds.length - 1) : 0;

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchIndex(0);
  };
  const navigateMatch = (dir: 1 | -1) => {
    if (!matchedIds.length) return;
    const next = (clampedIndex + dir + matchedIds.length) % matchedIds.length;
    setSearchIndex(next);
    msgRefs.current[matchedIds[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const decorated = injectSeparators(messages);

  /* ── sidebar ─────────────────────────────────────────────── */
  const Sidebar = (
    <aside className="flex flex-col h-full bg-surface border-r border-border">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="font-semibold text-sm">Messages</h2>
        <button className="lg:hidden text-text-secondary" onClick={() => setSidebarOpen(false)}>
          <X size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <p className="text-center text-xs text-text-secondary py-8 px-4">No conversations yet.</p>
        ) : (
          filteredChats.map((c: any) => {
            const lastMsg = c.messages?.[0];
            const isActive = c.influencerId === influencerId;
            return (
              <Link
                key={c.id}
                href={`/chat/${c.influencerId}`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 border-b border-border/50 transition-colors hover:bg-background/70 ${isActive ? 'bg-brand/5 border-l-2 border-l-brand' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-background border border-brand/20 flex items-center justify-center font-semibold text-sm gradient-text overflow-hidden">
                    {c.influencer?.avatar
                      ? <img src={c.influencer.avatar} alt={c.influencer.name} className="w-full h-full object-cover" />
                      : c.influencer?.name?.charAt(0) ?? '?'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-surface" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className={`text-sm truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
                      {c.influencer?.name ?? 'Unknown'}
                    </p>
                    {lastMsg && (
                      <span className="text-[10px] text-text-secondary flex-shrink-0 ml-1">
                        {fmtSidebarTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  {lastMsg ? (
                    <p className="text-xs text-text-secondary truncate">
                      {lastMsg.role === 'USER' ? 'You: ' : ''}{lastMsg.content}
                    </p>
                  ) : (
                    <p className="text-xs text-text-secondary/40 italic">No messages yet</p>
                  )}
                </div>
                {isActive && <ChevronRight size={14} className="text-brand-light flex-shrink-0" />}
              </Link>
            );
          })
        )}
      </div>

      {/* Browse more */}
      <div className="p-3 border-t border-border">
        <Link href="/influencers" className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors">
          Browse Influencers
        </Link>
      </div>
    </aside>
  );

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar (slim, replaces full Navbar) */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-surface flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={20} />
          </Link>
          <Link href="/" className="font-bold text-base gradient-text hidden sm:block">Genverce</Link>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Link
            href="/messages"
            className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-background/70 text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
            title="Messages"
            aria-label="Messages"
          >
            <MessageSquare size={16} />
            {unreadMessageCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </Link>
          {connected
            ? <><Wifi size={14} className="text-success" /><span className="text-success hidden sm:inline">Connected</span></>
            : <><WifiOff size={14} className="text-error" /><span className="text-error hidden sm:inline">Reconnecting…</span></>}
        </div>
        {/* Mobile: open sidebar */}
        <button className="lg:hidden text-text-secondary hover:text-text-primary" onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <div className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 h-full">
          {Sidebar}
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: 'tween', duration: 0.22 }}
                className="fixed left-0 top-0 bottom-0 w-72 z-40 lg:hidden"
              >
                {Sidebar}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main chat panel */}
        <main className="flex flex-col flex-1 min-w-0 h-full border-l border-border">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
            <button className="lg:hidden text-text-secondary hover:text-text-primary mr-1" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <Avatar name={influencerName} src={influencer?.avatar} size={10} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{influencerName}</p>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${influencerInactive ? 'bg-error' : 'bg-success'}`} />
              </div>
              <p className="text-xs text-text-secondary truncate">{influencer?.contentStyle ?? ''}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={searchOpen ? closeSearch : openSearch}
                className={`p-1.5 rounded-lg border border-border transition-colors ${searchOpen ? 'border-brand text-brand' : 'text-text-secondary hover:text-text-primary hover:border-brand/40'}`}
                title="Search messages"
              >
                <Search size={15} />
              </button>
              <Link
                href={`/influencers/${influencerId}`}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
              >
                View Profile
              </Link>
              <Link
                href={influencerInactive ? '#' : `/order/${influencerId}`}
                aria-disabled={influencerInactive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-hover transition-colors ${influencerInactive ? 'pointer-events-none opacity-50' : ''}`}
              >
                <Briefcase size={13} />
                Hire
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-b border-border bg-background flex-shrink-0"
              >
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <Search size={14} className="text-text-secondary flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigateMatch(e.shiftKey ? -1 : 1);
                      if (e.key === 'Escape') closeSearch();
                    }}
                    placeholder="Search messages…"
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none"
                  />
                  {searchQuery && (
                    <span className="text-xs text-text-secondary flex-shrink-0 min-w-[3rem] text-right">
                      {matchedIds.length === 0 ? 'No results' : `${clampedIndex + 1} / ${matchedIds.length}`}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => navigateMatch(-1)}
                      disabled={matchedIds.length === 0}
                      className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                      title="Previous match (Shift+Enter)"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => navigateMatch(1)}
                      disabled={matchedIds.length === 0}
                      className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                      title="Next match (Enter)"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button onClick={closeSearch} className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors ml-1">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unavailable banner */}
          {influencerInactive && (
            <div className="px-4 py-2.5 bg-error/10 border-b border-error/20 text-xs text-error text-center">
              This influencer is currently unavailable. Messaging is disabled.
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            <AnimatePresence initial={false}>
              {decorated.map((item) => {
                if ('type' in item) {
                  return (
                    <div key={item.key} className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[11px] text-text-secondary/60 font-medium px-2 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  );
                }

                const msg = item as Message;
                const isUser = msg.role === 'USER';
                const isMatch = q && msg.content.toLowerCase().includes(q);
                const isActiveMatch = isMatch && matchedIds[clampedIndex] === msg.id;

                return (
                  <motion.div
                    key={msg.id}
                    ref={(el) => { msgRefs.current[msg.id] = el; }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2 mb-1 ${isActiveMatch ? 'scroll-mt-4' : ''}`}
                  >
                    {!isUser && (
                      <Avatar name={influencerName} src={influencer?.avatar} size={7} />
                    )}
                    <div className={`group max-w-[65%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                      {!isUser && (
                        <span className="text-[11px] text-text-secondary/60 mb-1 ml-1">{influencerName}</span>
                      )}
                      <div className={`${msg.imageUrl ? 'p-1.5' : 'px-4 py-2.5'} text-sm leading-relaxed break-words transition-shadow ${
                        isUser
                          ? 'bg-brand text-white rounded-2xl rounded-br-sm'
                          : 'bg-surface border border-border text-text-primary rounded-2xl rounded-bl-sm'
                      } ${isActiveMatch ? 'ring-2 ring-brand ring-offset-1 ring-offset-background' : ''}`}>
                        {msg.imageUrl ? (
                          <div className="flex flex-col gap-2">
                            {shouldShowImageText(msg.content) ? (
                              <div className="px-2 pt-1 whitespace-pre-wrap">
                                {highlight(msg.content, searchQuery.trim())}
                              </div>
                            ) : null}
                            <ImageBubble src={msg.imageUrl} alt={msg.content || 'Image'} msgId={msg.id} />
                          </div>
                        ) : isFileMessage(msg.content) ? (
                          renderFileMessage(msg.content)
                        ) : (
                          highlight(msg.content, searchQuery.trim())
                        )}
                      </div>
                      <span className="text-[10px] text-text-secondary/50 mt-1 mx-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {fmtTime(msg.createdAt)}
                      </span>
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
                        {user?.name?.charAt(0) ?? 'U'}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-end gap-2 mb-1"
                >
                  <Avatar name={influencerName} src={influencer?.avatar} size={7} />
                  <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-text-secondary/40 animate-typing-dot"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-border bg-surface px-4 py-3">
            <div className="max-w-4xl mx-auto">
              {pendingUpload ? (
                <div className="flex items-center justify-between gap-3 mb-2 px-3 py-2 rounded-xl border border-border bg-background">
                  <div className="min-w-0">
                    <div className="text-xs text-text-secondary">Attachment</div>
                    <div className="text-sm text-text-primary truncate">
                      {pendingUpload.isImage ? 'Image' : 'File'}: {pendingUpload.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingUpload(null)}
                    className="w-9 h-9 rounded-lg border border-border bg-surface hover:border-brand/40 transition-colors flex items-center justify-center flex-shrink-0"
                    title="Remove attachment"
                  >
                    <X size={16} className="text-text-secondary" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2 sm:gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={influencerInactive || !chatId || !connected || uploading}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border bg-background text-text-secondary hover:text-text-primary hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
                  title="Upload file"
                >
                  <Paperclip size={17} />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={influencerInactive ? 'This influencer is unavailable' : `Message ${influencerName}…`}
                  rows={1}
                  disabled={influencerInactive}
                  className="flex-1 resize-none px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors text-sm disabled:opacity-50 leading-relaxed"
                  style={{ minHeight: '46px', maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !pendingUpload) || !connected || influencerInactive || uploading}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
                >
                  <Send size={17} className="text-white" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-text-secondary/50 mt-2">
              Press Enter to send · Shift+Enter for new line · You are chatting with an AI influencer
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
