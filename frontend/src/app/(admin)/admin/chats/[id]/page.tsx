'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, User, Shield, ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import Link from 'next/link';
import { GET_ADMIN_CHAT } from '@/graphql/queries/chat';
import { useAuthStore } from '@/lib/auth';
import { connectSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toaster';
import { Message } from '@/types';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
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

function Avatar({ name, src, size = 10 }: { name: string; src?: string; size?: number }) {
  const s = `w-${size} h-${size}`;
  return (
    <div className={`${s} rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text flex-shrink-0 overflow-hidden`}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

export default function AdminChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params?.id as string;
  const { user, isAuthenticated, hydrated, token } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const socketInitialized = useRef(false);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/login');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading } = useQuery(GET_ADMIN_CHAT, {
    variables: { chatId },
    skip: !chatId,
    fetchPolicy: 'cache-and-network',
  });

  const chat = data?.adminGetChat;
  const influencer = chat?.influencer;
  const customer = chat?.customer;

  // Load history from query
  useEffect(() => {
    if (chat?.messages) {
      setMessages(chat.messages);
    }
  }, [chat?.messages?.length]);

  // Socket: join room and listen for real-time messages
  useEffect(() => {
    if (!token || !chatId || socketInitialized.current) return;
    socketInitialized.current = true;

    const socket = connectSocket(token);
    socket.emit('joinChat', { chatId });

    socket.on('newMessage', (msg: Message) => {
      if (msg.chatId !== chatId) return;
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    });

    return () => {
      socket.emit('leaveChat', { chatId });
      socket.off('newMessage');
      socketInitialized.current = false;
    };
  }, [token, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setSearchIndex(0);
    if (matchedIds.length > 0) {
      msgRefs.current[matchedIds[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const sendMessage = () => {
    if (!input.trim() || sending) return;
    setSending(true);
    connectSocket(token!).emit('adminSendMessage', { chatId, content: input.trim() });
    setInput('');
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const q = searchQuery.trim().toLowerCase();
  const matchedIds = q
    ? messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.id)
    : [];
  const clampedIndex = matchedIds.length > 0 ? Math.min(searchIndex, matchedIds.length - 1) : 0;

  const navigateMatch = (dir: 1 | -1) => {
    if (!matchedIds.length) return;
    const next = (clampedIndex + dir + matchedIds.length) % matchedIds.length;
    setSearchIndex(next);
    msgRefs.current[matchedIds[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const decorated = injectSeparators(messages);

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-surface flex-shrink-0 z-10">
        <Link href={chat?.influencerId ? `/admin/influencers/${chat.influencerId}?tab=chats` : '/admin/chats'} className="text-text-secondary hover:text-text-primary">
          <ArrowLeft size={20} />
        </Link>

        {/* Influencer */}
        {influencer && <Avatar name={influencer.name} src={influencer.avatar} size={8} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{influencer?.name ?? '…'}</span>
            <span className="text-text-secondary/40 text-xs">↔</span>
            <div className="flex items-center gap-1">
              <User size={12} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">{customer?.name ?? '…'}</span>
              {customer?.email && (
                <span className="text-xs text-text-secondary/50 hidden sm:inline">({customer.email})</span>
              )}
            </div>
          </div>
          <p className="text-xs text-text-secondary/50">{influencer?.contentStyle ?? ''}</p>
        </div>

        {/* Admin badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20">
          <Shield size={11} className="text-brand-light" />
          <span className="text-xs text-brand-light font-medium">Admin View</span>
        </div>

        {/* Search toggle */}
        <button
          onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setSearchIndex(0); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className={`p-1.5 rounded-lg border border-border transition-colors ${searchOpen ? 'border-brand text-brand' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <Search size={15} />
        </button>
      </header>

      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
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
                  if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
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
                <button onClick={() => navigateMatch(-1)} disabled={!matchedIds.length}
                  className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors">
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => navigateMatch(1)} disabled={!matchedIds.length}
                  className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors">
                  <ChevronDown size={15} />
                </button>
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors ml-1">
                  <X size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading && messages.length === 0 ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
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
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2 mb-1`}
                >
                  {!isUser && (
                    <Avatar name={influencer?.name ?? '?'} src={influencer?.avatar} size={7} />
                  )}
                  <div className={`group max-w-[65%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    {!isUser && (
                      <span className="text-[11px] text-text-secondary/60 mb-1 ml-1">{influencer?.name}</span>
                    )}
                    <div className={`px-4 py-2.5 text-sm leading-relaxed break-words transition-shadow ${
                      isUser
                        ? 'bg-brand text-white rounded-2xl rounded-br-sm'
                        : 'bg-surface border border-border text-text-primary rounded-2xl rounded-bl-sm'
                    } ${isActiveMatch ? 'ring-2 ring-brand ring-offset-1 ring-offset-background' : ''}`}>
                      {highlight(msg.content, searchQuery.trim())}
                    </div>
                    <span className="text-[10px] text-text-secondary/50 mt-1 mx-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {fmtTime(msg.createdAt)}
                    </span>
                  </div>
                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
                      {customer?.name?.charAt(0) ?? 'U'}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Admin input area */}
      <div className="flex-shrink-0 border-t border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={12} className="text-brand-light" />
          <span className="text-xs text-brand-light font-medium">
            Replying as {influencer?.name ?? 'influencer'}
          </span>
        </div>
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message as ${influencer?.name ?? 'influencer'}…`}
            rows={1}
            className="flex-1 resize-none px-4 py-3 bg-background border border-brand/30 rounded-xl text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors text-sm leading-relaxed"
            style={{ minHeight: '46px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
          >
            <Send size={17} className="text-white" />
          </button>
        </div>
        <p className="text-center text-[11px] text-text-secondary/50 mt-2">
          Press Enter to send · Messages appear as {influencer?.name ?? 'the influencer'} to the user
        </p>
      </div>
    </div>
  );
}
