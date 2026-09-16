'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Briefcase, Search, ArrowLeft, ChevronRight, Wifi, WifiOff, Menu, X,
  ChevronUp, ChevronDown, Paperclip, MessageSquare, FileText, CornerUpLeft, CheckCircle,
  AlertCircle, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { ImageBubble } from '@/components/ui/image-bubble';
import { ChatNotesPanel } from '@/components/chat/chat-notes-panel';
import { MarkdownContent } from '@/components/chat/markdown-content';
import { ChatReplyBanner, ChatQuotedPreview } from '@/components/chat/chat-reply-ui';
import { ReplyTarget, parseReplyMessage, serializeReplyMessage } from '@/lib/chat-utils';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { GET_MY_CHATS } from '@/graphql/queries/chat';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<null | { url: string; name: string; mimeType: string; isImage: boolean }>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
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

  const { data: myOrdersData, refetch: refetchOrders } = useQuery(GET_MY_ORDERS, {
    fetchPolicy: 'cache-and-network',
    skip: !isAuthenticated,
  });

  const usageByInfluencer = useMemo(() => {
    const orders = myOrdersData?.myOrders || [];
    const validOrders = orders.filter(
      (o: any) =>
        ['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED', 'DELIVERED'].includes(o.status),
    );
    const map = new Map<string, { isHired: boolean; hasRemainingUsage: boolean; remainingUnits: number; totalOrdered: number; totalDelivered: number }>();
    for (const o of validOrders) {
      if (!o.influencerId) continue;
      let cur = map.get(o.influencerId);
      if (!cur) {
        cur = { isHired: true, hasRemainingUsage: false, remainingUnits: 0, totalOrdered: 0, totalDelivered: 0 };
        map.set(o.influencerId, cur);
      }
      let postsDelivered = 0;
      let imagesDelivered = 0;
      if (o.projectBrief) {
        try {
          const brief = typeof o.projectBrief === 'string' ? JSON.parse(o.projectBrief) : o.projectBrief;
          if (Array.isArray(brief?.generatedPosts)) postsDelivered = brief.generatedPosts.length;
          if (Array.isArray(brief?.generatedImages)) imagesDelivered = brief.generatedImages.length;
        } catch {}
      }
      const effective = Math.max(o.videosDelivered || 0, postsDelivered, imagesDelivered);
      const ordered = o.videosOrdered > 0 ? o.videosOrdered : 1;
      const deliveredForOrder = Math.min(ordered, effective);
      cur.totalOrdered += ordered;
      cur.totalDelivered += deliveredForOrder;
    }

    map.forEach((cur) => {
      cur.remainingUnits = Math.max(0, cur.totalOrdered - cur.totalDelivered);
      cur.hasRemainingUsage = cur.remainingUnits > 0;
    });
    return map;
  }, [myOrdersData]);

  const hireAndUsage = useMemo(() => {
    return usageByInfluencer.get(influencerId) || {
      isHired: false,
      hasRemainingUsage: false,
      remainingUnits: 0,
      totalOrdered: 0,
      totalDelivered: 0,
    };
  }, [usageByInfluencer, influencerId]);

  const isHired = hireAndUsage.isHired;
  const hasRemainingUsage = hireAndUsage.hasRemainingUsage;
  const remainingUnits = hireAndUsage.remainingUnits;

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
    onError: (err) => {
      console.error('[ChatPage] startChat error:', err);
      toast({ title: 'Chat initialization error', description: err.message, variant: 'error' });
    },
  });

  const chatInitializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!token || !influencerId) return;

    if (chatInitializedFor.current === influencerId) return;
    chatInitializedFor.current = influencerId;

    const socket = connectSocket(token);
    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      if (chatIdRef.current) {
        joinRoom(chatIdRef.current);
        try {
          localStorage.setItem('activeChatId', chatIdRef.current);
        } catch {}
        try {
          if (user?.id) socket.emit('setActiveChat', { chatId: chatIdRef.current, userId: user.id });
        } catch {}
      }
    };

    const onDisconnect = () => setConnected(false);
    const onNewMessage = (msg: Message) => {
      if (msg.chatId !== chatIdRef.current) return;
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      refetchChats();
      refetchOrders();
    };
    const onTyping = ({ isTyping: t }: { isTyping: boolean }) => setIsTyping(t);
    const onChatError = ({ message }: { message: string }) => {
      setIsTyping(false);
      toast({ title: 'Chat error', description: message, variant: 'error' });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('newMessage', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('chatError', onChatError);

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
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('newMessage', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('chatError', onChatError);
      chatInitializedFor.current = null;
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

  const handleReply = (msg: Message) => {
    const isUser = msg.role === 'USER';
    const senderName = isUser ? 'You' : influencerName;
    const { body } = parseReplyMessage(msg.content);
    setReplyingTo({
      id: msg.id,
      role: msg.role,
      senderName,
      content: body,
      imageUrl: msg.imageUrl,
    });
    inputRef.current?.focus();
  };

  const scrollToMessage = (msgId?: string) => {
    if (!msgId) return;
    const el = msgRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  const sendMessage = () => {
    if ((!input.trim() && !pendingUpload) || !chatId || !connected || uploading) return;
    const base = input.trim();
    const withReply = serializeReplyMessage(base, replyingTo);
    const content = pendingUpload
      ? pendingUpload.isImage
        ? (withReply || `Image: ${pendingUpload.name}`)
        : `${withReply ? `${withReply}\n\n` : ''}File: ${pendingUpload.name}\n${pendingUpload.url}`
      : withReply;
    connectSocket(token!).emit('sendMessage', {
      chatId,
      influencerId,
      content,
      ...(pendingUpload?.isImage ? { imageUrl: pendingUpload.url } : {}),
      userId: user?.id,
    });
    setInput('');
    setPendingUpload(null);
    setReplyingTo(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
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
                  {/* Hired & Remaining Usage Status Badge */}
                  {(() => {
                    const u = usageByInfluencer.get(c.influencerId);
                    if (u?.isHired) {
                      if (u.remainingUnits > 0) {
                        return (
                          <div className="mb-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Hired · {u.remainingUnits} left
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="mb-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Hired · 0 left
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="mb-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface border border-border text-text-secondary">
                          <span className="w-1.5 h-1.5 rounded-full bg-text-secondary/50" />
                          Not Hired
                        </span>
                      </div>
                    );
                  })()}
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
    <div className="flex h-full bg-background overflow-hidden">

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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{influencerName}</p>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${influencerInactive ? 'bg-error' : 'bg-success'}`} />
              {/* Header Status Badge */}
              {isHired ? (
                hasRemainingUsage ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" />
                    <span>Hired · {remainingUnits} of {hireAndUsage.totalOrdered} uses remaining</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <AlertCircle size={11} className="text-amber-400 flex-shrink-0" />
                    <span>Hired · 0 uses remaining</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface border border-border text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-secondary/50 flex-shrink-0" />
                  <span>Not Hired · 0 uses remaining</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
              <span>{influencer?.contentStyle || 'AI Influencer'}</span>
              {isHired && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-[11px] text-text-secondary">
                    {hireAndUsage.totalDelivered} of {hireAndUsage.totalOrdered} deliverables completed
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setNotesOpen(!notesOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium ${
                notesOpen
                  ? 'border-brand bg-brand/10 text-brand-light font-semibold'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-brand/40'
              }`}
              title="Private Notes"
            >
              <FileText size={15} />
              <span className="hidden sm:inline">Notes</span>
            </button>
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
            {isHired ? (
              hasRemainingUsage ? (
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/dashboard/orders/influencer/${influencerId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                    title={`You have ${remainingUnits} remaining deliverable(s). Click to view deliverables and orders.`}
                  >
                    <CheckCircle size={13} className="text-emerald-400" />
                    <span>Hired · {remainingUnits} left</span>
                  </Link>
                  <Link
                    href={influencerInactive ? '#' : `/order/${influencerId}?mode=add-usage`}
                    aria-disabled={influencerInactive}
                    className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors ${influencerInactive ? 'pointer-events-none opacity-50' : ''}`}
                    title="Add more usage to your project"
                  >
                    <Plus size={13} />
                    <span>Add Usage</span>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/dashboard/orders/influencer/${influencerId}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors"
                    title="All deliverables used in current plan. Click to view orders."
                  >
                    <AlertCircle size={13} className="text-amber-400" />
                    <span>Hired · 0 Left</span>
                  </Link>
                  <Link
                    href={influencerInactive ? '#' : `/order/${influencerId}?mode=add-usage`}
                    aria-disabled={influencerInactive}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition-colors shadow-sm ${influencerInactive ? 'pointer-events-none opacity-50' : ''}`}
                    title="Purchase additional usage or hire a new package"
                  >
                    <Plus size={13} />
                    <span>Add Usage</span>
                  </Link>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-text-secondary">
                  Not Hired
                </span>
                <Link
                  href={influencerInactive ? '#' : `/order/${influencerId}`}
                  aria-disabled={influencerInactive}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition-colors ${influencerInactive ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Briefcase size={13} />
                  Hire
                </Link>
              </div>
            )}
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
                const isHighlighted = highlightedMsgId === msg.id;
                const { reply, body } = parseReplyMessage(msg.content);

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
                      <div className={`${msg.imageUrl ? 'p-1.5' : 'px-4 py-2.5'} text-sm leading-relaxed break-words transition-all duration-300 ${
                        isUser
                          ? 'bg-brand text-white rounded-2xl rounded-br-sm'
                          : 'bg-surface border border-border text-text-primary rounded-2xl rounded-bl-sm'
                      } ${isActiveMatch ? 'ring-2 ring-brand ring-offset-1 ring-offset-background' : ''} ${
                        isHighlighted ? 'ring-2 ring-brand-light ring-offset-2 ring-offset-background shadow-lg shadow-brand/20 scale-[1.01]' : ''
                      }`}>
                        {reply && (
                          <ChatQuotedPreview
                            reply={reply}
                            isUser={isUser}
                            onScrollToMessage={scrollToMessage}
                          />
                        )}
                        {msg.imageUrl ? (
                          <div className="flex flex-col gap-2">
                            {shouldShowImageText(body) ? (
                              <div className="px-2 pt-1">
                                <MarkdownContent
                                  content={body}
                                  isUser={isUser}
                                  searchQuery={searchQuery.trim()}
                                />
                              </div>
                            ) : null}
                            <ImageBubble src={msg.imageUrl} alt={body || 'Image'} msgId={msg.id} />
                          </div>
                        ) : isFileMessage(body) ? (
                          renderFileMessage(body)
                        ) : (
                          <MarkdownContent
                            content={body}
                            isUser={isUser}
                            searchQuery={searchQuery.trim()}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 mx-1">
                        <button
                          type="button"
                          onClick={() => handleReply(msg)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all px-1.5 py-0.5 rounded hover:bg-surface border border-transparent hover:border-border text-text-secondary/70 hover:text-text-primary flex items-center gap-1 text-[11px]"
                          title="Reply to this message"
                        >
                          <CornerUpLeft size={12} />
                          <span className="text-[10px]">Reply</span>
                        </button>
                        <span className="text-[10px] text-text-secondary/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          {fmtTime(msg.createdAt)}
                        </span>
                      </div>
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
              <AnimatePresence>
                {replyingTo && (
                  <ChatReplyBanner
                    replyingTo={replyingTo}
                    onCancel={() => setReplyingTo(null)}
                  />
                )}
              </AnimatePresence>
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

      {/* Upwork-style Private Notes Drawer Panel */}
      <ChatNotesPanel
        chatId={chatId}
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
        influencerName={influencerName}
      />
    </div>
  );
}
