'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Search, X, Menu, ChevronUp, ChevronDown,
  MessageSquare, Wifi, WifiOff, Briefcase, PenSquare, Paperclip, FileText, CornerUpLeft,
  CheckCircle, AlertCircle, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { GET_MY_CHATS } from '@/graphql/queries/chat';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
import { START_CHAT } from '@/graphql/mutations/chat';
import { MARK_NOTIFICATION_READ } from '@/graphql/mutations/notification';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notifications';
import { connectSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toaster';
import { Message } from '@/types';
import { ImageBubble } from '@/components/ui/image-bubble';
import { ChatNotesPanel } from '@/components/chat/chat-notes-panel';
import { MarkdownContent } from '@/components/chat/markdown-content';
import { ChatReplyBanner, ChatQuotedPreview } from '@/components/chat/chat-reply-ui';
import { ReplyTarget, parseReplyMessage, serializeReplyMessage } from '@/lib/chat-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateSeparator(iso: string) {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtListTime(iso: string) {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

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

function InfluencerAvatar({ name, src, size = 40, online = false }: {
  name: string; src?: string; size?: number; online?: boolean;
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full overflow-hidden border-2 border-border bg-surface flex items-center justify-center font-semibold gradient-text"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {src
          ? <img src={src} alt={name} className="w-full h-full object-cover" />
          : name.charAt(0)}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-success border-2 border-background"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  influencerId, user, token, onChatsRefetch, hireAndUsage, onOrdersRefetch,
}: {
  influencerId: string;
  user: any;
  token: string;
  onChatsRefetch: () => void;
  hireAndUsage?: {
    isHired: boolean;
    hasRemainingUsage: boolean;
    remainingUnits: number;
    totalOrdered: number;
    totalDelivered: number;
  };
  onOrdersRefetch?: () => void;
}) {
  const isHired = hireAndUsage?.isHired ?? false;
  const hasRemainingUsage = hireAndUsage?.hasRemainingUsage ?? false;
  const remainingUnits = hireAndUsage?.remainingUnits ?? 0;
  const totalOrdered = hireAndUsage?.totalOrdered ?? 0;
  const totalDelivered = hireAndUsage?.totalDelivered ?? 0;
  const { notifications, markRead } = useNotificationStore();
  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ);

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

  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [isTyping, setIsTyping]   = useState(false);
  const [chatId, setChatId]       = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [notesOpen, setNotesOpen]     = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<null | { url: string; name: string; mimeType: string; isImage: boolean }>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const searchInputRef  = useRef<HTMLInputElement>(null);
  const msgRefs         = useRef<Record<string, HTMLDivElement | null>>({});
  const chatIdRef       = useRef<string | null>(null);
  const initializedFor  = useRef<string | null>(null);

  const { data: infData } = useQuery(GET_INFLUENCER, { variables: { id: influencerId } });
  const influencer        = infData?.influencer as any;
  const influencerName    = influencer?.name ?? '…';
  const inactive          = influencer?.isActive === false;

  const [startChat] = useMutation(START_CHAT, {
    onCompleted: (data) => {
      const chat = data.startChat;
      chatIdRef.current = chat.id;
      setChatId(chat.id);
      setMessages((chat.messages ?? []).map((m: any) => ({ ...m })));
      try {
        localStorage.setItem('activeChatId', chat.id);
      } catch {}
      connectSocket(token).emit('joinChat', { chatId: chat.id, active: true });
      try {
        if (user?.id) connectSocket(token).emit('setActiveChat', { chatId: chat.id, userId: user.id });
      } catch {}
      onChatsRefetch();
    },
    onError: (err) => {
      console.error('[MessagesPage] startChat error:', err);
      toast({ title: 'Chat initialization error', description: err.message, variant: 'error' });
    },
  });

  useEffect(() => {
    if (!token || !influencerId) return;
    if (initializedFor.current === influencerId) return;
    initializedFor.current = influencerId;

    const socket = connectSocket(token);
    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      if (chatIdRef.current) {
        socket.emit('joinChat', { chatId: chatIdRef.current, active: true });
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
      onChatsRefetch();
      onOrdersRefetch?.();
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
      initializedFor.current = null;
    };
  }, [influencerId, token, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const q          = searchQuery.trim().toLowerCase();
  const matchedIds = q ? messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.id) : [];
  const clamped    = matchedIds.length > 0 ? Math.min(searchIndex, matchedIds.length - 1) : 0;

  useEffect(() => {
    setSearchIndex(0);
    if (matchedIds.length > 0)
      msgRefs.current[matchedIds[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const navigate = (dir: 1 | -1) => {
    if (!matchedIds.length) return;
    const next = (clamped + dir + matchedIds.length) % matchedIds.length;
    setSearchIndex(next);
    msgRefs.current[matchedIds[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
    connectSocket(token).emit('sendMessage', {
      chatId, influencerId, content,
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

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openSearch = () => {
    setSearchOpen(true); setSearchQuery(''); setSearchIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };

  const decorated = injectSeparators(messages);

  return (
    <div className="flex flex-col h-full">

      {/* ── Chat header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <InfluencerAvatar name={influencerName} src={influencer?.avatar} size={40} online={!inactive} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{influencerName}</p>
            <div className="flex items-center gap-1.5">
              {connected
                ? <><Wifi size={11} className="text-success" /><span className="text-[11px] text-success">Online</span></>
                : <><WifiOff size={11} className="text-text-secondary" /><span className="text-[11px] text-text-secondary">Connecting…</span></>}
              {inactive && <span className="text-[11px] text-error ml-1">· Unavailable</span>}
            </div>
            {/* Header Status Badge */}
            {isHired ? (
              hasRemainingUsage ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" />
                  <span>Hired · {remainingUnits} of {totalOrdered} uses remaining</span>
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
                  {totalDelivered} of {totalOrdered} deliverables completed
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              notesOpen
                ? 'bg-brand/10 text-brand-light border border-brand/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
            }`}
            title="Private Notes"
          >
            <FileText size={15} />
            <span className="hidden sm:inline">Notes</span>
          </button>
          <button
            onClick={searchOpen ? closeSearch : openSearch}
            className={`p-2 rounded-lg transition-colors ${searchOpen ? 'bg-brand/10 text-brand-light' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
            title="Search messages"
          >
            <Search size={16} />
          </button>
          <Link
            href={`/influencers/${influencerId}`}
            className="hidden sm:flex px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
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
                  href={inactive ? '#' : `/order/${influencerId}?mode=add-usage`}
                  aria-disabled={inactive}
                  className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors ${inactive ? 'pointer-events-none opacity-50' : ''}`}
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
                  href={inactive ? '#' : `/order/${influencerId}?mode=add-usage`}
                  aria-disabled={inactive}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition-colors shadow-sm ${inactive ? 'pointer-events-none opacity-50' : ''}`}
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
                href={inactive ? '#' : `/order/${influencerId}`}
                aria-disabled={inactive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition-colors ${inactive ? 'pointer-events-none opacity-50' : ''}`}
              >
                <Briefcase size={12} />
                Hire
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Search bar ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border bg-background flex-shrink-0"
          >
            <div className="flex items-center gap-2 px-5 py-2.5">
              <Search size={14} className="text-text-secondary flex-shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(e.shiftKey ? -1 : 1);
                  if (e.key === 'Escape') closeSearch();
                }}
                placeholder="Search in conversation…"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none"
              />
              {searchQuery && (
                <span className="text-xs text-text-secondary flex-shrink-0 min-w-[3.5rem] text-right">
                  {matchedIds.length === 0 ? 'No results' : `${clamped + 1} / ${matchedIds.length}`}
                </span>
              )}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => navigate(-1)} disabled={!matchedIds.length}
                  className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => navigate(1)} disabled={!matchedIds.length}
                  className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
                <button onClick={closeSearch} className="p-1 rounded text-text-secondary hover:text-text-primary ml-0.5">
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unavailable banner ── */}
      {inactive && (
        <div className="px-5 py-2 bg-error/8 border-b border-error/20 text-xs text-error text-center flex-shrink-0">
          This influencer is currently unavailable. Messaging is disabled.
        </div>
      )}

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-0.5">
        {messages.length === 0 && !isTyping ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <InfluencerAvatar name={influencerName} src={influencer?.avatar} size={64} online={!inactive} />
            <p className="font-semibold mt-4 mb-1">{influencerName}</p>
            <p className="text-sm text-text-secondary max-w-xs">
              {influencer?.contentStyle ?? 'AI Influencer'}
            </p>
            <p className="text-xs text-text-secondary/50 mt-4">Say hello to start the conversation.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {decorated.map((item) => {
              if ('type' in item) {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-text-secondary/50 font-medium px-3 bg-background rounded-full border border-border py-0.5">
                      {item.label}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                );
              }

              const msg = item as Message;
              const isUser        = msg.role === 'USER';
              const isMatch       = !!q && msg.content.toLowerCase().includes(q);
              const isActiveMatch = isMatch && matchedIds[clamped] === msg.id;
              const isHighlighted = highlightedMsgId === msg.id;
              const { reply, body } = parseReplyMessage(msg.content);

              return (
                <motion.div
                  key={msg.id}
                  ref={(el) => { msgRefs.current[msg.id] = el; }}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2.5 mb-2`}
                >
                  {!isUser && (
                    <InfluencerAvatar name={influencerName} src={influencer?.avatar} size={30} />
                  )}
                  <div className={`group max-w-[60%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    {!isUser && (
                      <span className="text-[11px] text-text-secondary/70 mb-1 ml-1 font-medium">{influencerName}</span>
                    )}
                    <div className={`${msg.imageUrl ? 'p-1.5' : 'px-4 py-2.5'} text-sm leading-relaxed break-words transition-all duration-300 ${
                      isUser
                        ? 'bg-brand text-white rounded-2xl rounded-br-none shadow-sm'
                        : 'bg-surface border border-border text-text-primary rounded-2xl rounded-bl-none'
                    } ${isActiveMatch ? 'ring-2 ring-brand/60 ring-offset-2 ring-offset-background' : ''} ${
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
                      <span className="text-[10px] text-text-secondary/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        {fmtTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                  {isUser && (
                    <div className="w-[30px] h-[30px] rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
                      {user?.name?.charAt(0) ?? 'U'}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-end gap-2.5 mb-2"
              >
                <InfluencerAvatar name={influencerName} src={influencer?.avatar} size={30} />
                <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-none flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-text-secondary/40 animate-typing-dot"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="flex-shrink-0 border-t border-border bg-surface/80 backdrop-blur-sm px-5 py-4">
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
              disabled={inactive || !chatId || !connected || uploading}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border bg-background text-text-secondary hover:text-text-primary hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
              title="Upload file"
            >
              <Paperclip size={17} />
            </button>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                }}
                onKeyDown={handleKey}
                placeholder={inactive ? 'This influencer is unavailable' : `Message ${influencerName}…`}
                rows={1}
                disabled={inactive}
                className="w-full resize-none px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-colors text-sm disabled:opacity-50 leading-relaxed"
                style={{ minHeight: '48px', maxHeight: '140px' }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !pendingUpload) || !connected || inactive || uploading}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-sm hover:shadow-brand/30 hover:shadow-md mb-0.5"
            >
              <Send size={17} className="text-white" />
            </button>
          </div>
        </div>
        <p className="text-center text-[11px] text-text-secondary/40 mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, hydrated, token } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Clear all unread message-related notifications when the messages page is opened
  const { notifications: allNotifs, markRead: markNotifRead } = useNotificationStore();
  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ);
  useEffect(() => {
    allNotifs
      .filter((n) => !n.read && (n.href.startsWith('/chat/') || n.href === '/messages'))
      .forEach((n) => {
        markNotifRead(n.id);
        if (!n.id.startsWith('local-')) {
          markNotificationRead({ variables: { id: n.id } });
        }
      });
  }, [mounted]);

  const [selectedId, setSelectedId]   = useState<string | null>(searchParams.get('with'));
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [listSearch, setListSearch]   = useState('');
  const didInitFromQuery = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    const withId = searchParams.get('with');
    if (!didInitFromQuery.current) {
      didInitFromQuery.current = true;
      if (withId) {
        setSelectedId(withId);
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
          setMobilePanelOpen(true);
        }
      }
      return;
    }

    if (withId && withId !== selectedId) {
      setSelectedId(withId);
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        setMobilePanelOpen(true);
      }
    }
    if (!withId && selectedId) {
      setSelectedId(null);
    }
  }, [mounted, searchParams]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const { data: chatsData, refetch: refetchChats } = useQuery(GET_MY_CHATS, {
    fetchPolicy: 'cache-and-network',
    skip: !isAuthenticated,
  });
  const allChats: any[] = chatsData?.myChats ?? [];

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

  const lastActivatedChatId = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !user?.id) return;
    const influencerId = selectedId || '';
    if (!influencerId) {
      if (lastActivatedChatId.current) {
        try {
          connectSocket(token).emit('clearActiveChat', {});
        } catch {}
        lastActivatedChatId.current = null;
      }
      try {
        localStorage.removeItem('activeChatId');
      } catch {}
      return;
    }

    const chat = allChats.find((c) => c?.influencerId === influencerId);
    const chatId = typeof chat?.id === 'string' ? chat.id : '';
    if (!chatId) return;
    if (lastActivatedChatId.current === chatId) return;
    lastActivatedChatId.current = chatId;

    try {
      localStorage.setItem('activeChatId', chatId);
    } catch {}
    const socket = connectSocket(token);
    socket.emit('joinChat', { chatId, active: true });
    socket.emit('setActiveChat', { chatId, userId: user.id });
  }, [token, user?.id, selectedId, allChats.length]);

  const sortedChats = [...allChats].sort((a, b) => {
    const aT = a.messages?.[a.messages.length - 1]?.createdAt ?? a.createdAt;
    const bT = b.messages?.[b.messages.length - 1]?.createdAt ?? b.createdAt;
    return new Date(bT).getTime() - new Date(aT).getTime();
  });

  const filtered = listSearch.trim()
    ? sortedChats.filter((c) => c.influencer?.name?.toLowerCase().includes(listSearch.toLowerCase()))
    : sortedChats;

  const select = (influencerId: string) => {
    setSelectedId(influencerId);
    setMobilePanelOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set('with', influencerId);
    window.history.replaceState(null, '', url.toString());
  };

  // ── Conversation list panel ──────────────────────────────────────────────────
  const ListPanel = (
    <div className="flex flex-col h-full bg-background border-r border-border">

      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div>
          <h2 className="font-bold text-lg">Messages</h2>
          {allChats.length > 0 && (
            <p className="text-xs text-text-secondary mt-0.5">{allChats.length} conversation{allChats.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Link href="/influencers"
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
          title="Start new chat"
        >
          <PenSquare size={17} />
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand transition-colors"
          />
          {listSearch && (
            <button onClick={() => setListSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-text-secondary/40" />
            </div>
            <p className="font-medium text-sm mb-1">
              {allChats.length === 0 ? 'No conversations yet' : 'No results'}
            </p>
            <p className="text-xs text-text-secondary mb-4">
              {allChats.length === 0
                ? 'Start chatting with an AI influencer.'
                : 'Try a different search term.'}
            </p>
            {allChats.length === 0 && (
              <Link href="/influencers" className="btn-brand text-xs px-4 py-2">
                Browse Influencers
              </Link>
            )}
          </div>
        ) : (
          filtered.map((c: any) => {
            const lastMsg = c.messages?.[c.messages.length - 1];
            const isActive = c.influencerId === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => select(c.influencerId)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-border/40 transition-all hover:bg-surface/60 ${
                  isActive ? 'bg-brand/5 border-l-[3px] border-l-brand pl-[13px]' : 'border-l-[3px] border-l-transparent'
                }`}
              >
                <InfluencerAvatar name={c.influencer?.name ?? '?'} src={c.influencer?.avatar} size={44} online />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm truncate ${isActive ? 'font-semibold text-text-primary' : 'font-medium'}`}>
                      {c.influencer?.name ?? 'Unknown'}
                    </p>
                    {lastMsg && (
                      <span className="text-[11px] text-text-secondary/60 flex-shrink-0 ml-2">
                        {fmtListTime(lastMsg.createdAt)}
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
                  <p className="text-xs text-text-secondary/60 truncate mb-1">
                    {c.influencer?.contentStyle ?? 'AI Influencer'}
                  </p>
                  {lastMsg ? (
                    <p className={`text-xs truncate ${isActive ? 'text-text-secondary' : 'text-text-secondary/70'}`}>
                      {lastMsg.role === 'USER'
                        ? <span><span className="text-brand-light/70">You:</span> {lastMsg.content}</span>
                        : lastMsg.content}
                    </p>
                  ) : (
                    <p className="text-xs text-text-secondary/40 italic">No messages yet</p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Empty / welcome state ────────────────────────────────────────────────────
  const EmptyState = (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-20 h-20 rounded-3xl bg-brand/8 border border-brand/15 flex items-center justify-center mb-5">
        <MessageSquare size={32} className="text-brand-light/70" />
      </div>
      <h3 className="font-bold text-lg mb-2">Select a conversation</h3>
      <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
        Choose a conversation from the left to start messaging an AI influencer.
      </p>
      {allChats.length === 0 && (
        <Link href="/influencers" className="mt-6 btn-brand px-6 py-2.5 text-sm">
          Browse Influencers
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex bg-background overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Desktop: left panel always visible ── */}
      <div className="hidden lg:flex flex-col w-[340px] xl:w-[380px] flex-shrink-0 h-full">
        {ListPanel}
      </div>

      {/* ── Mobile: slide-in overlay ── */}
      <AnimatePresence>
        {!mobilePanelOpen && (
          <motion.div
            initial={false}
            className="lg:hidden flex flex-col w-full h-full absolute inset-0"
          >
            {ListPanel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right panel ── */}
      <main className="hidden lg:flex flex-col flex-1 min-w-0 h-full bg-background">
        {selectedId && token ? (
          <ChatPanel
            key={selectedId}
            influencerId={selectedId}
            user={user}
            token={token}
            onChatsRefetch={refetchChats}
            hireAndUsage={usageByInfluencer.get(selectedId) || { isHired: false, hasRemainingUsage: false, remainingUnits: 0, totalOrdered: 0, totalDelivered: 0 }}
            onOrdersRefetch={refetchOrders}
          />
        ) : (
          EmptyState
        )}
      </main>

      {/* ── Mobile: chat panel slides in over the list ── */}
      <AnimatePresence>
        {mobilePanelOpen && selectedId && token && (
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="lg:hidden absolute inset-0 flex flex-col bg-background z-10"
          >
            {/* Mobile back header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              >
                <Menu size={20} />
              </button>
              <span className="font-semibold text-sm truncate">
                {allChats.find((c) => c.influencerId === selectedId)?.influencer?.name ?? 'Chat'}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel
                key={selectedId}
                influencerId={selectedId}
                user={user}
                token={token}
                onChatsRefetch={refetchChats}
                hireAndUsage={usageByInfluencer.get(selectedId) || { isHired: false, hasRemainingUsage: false, remainingUnits: 0, totalOrdered: 0, totalDelivered: 0 }}
                onOrdersRefetch={refetchOrders}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
