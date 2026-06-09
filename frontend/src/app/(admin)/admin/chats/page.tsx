'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import { MessageSquare, Search, User } from 'lucide-react';
import Link from 'next/link';
import { GET_ALL_CHATS } from '@/graphql/queries/chat';
import { useAuthStore } from '@/lib/auth';

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ name, src }: { name: string; src?: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text flex-shrink-0 overflow-hidden">
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

export default function AdminChatsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/login');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading } = useQuery(GET_ALL_CHATS, { fetchPolicy: 'cache-and-network' });
  const chats: any[] = data?.allChats ?? [];

  const filtered = search.trim()
    ? chats.filter((c) =>
        c.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer?.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.influencer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : chats;

  if (!mounted) return null;

  return (
    <div className="py-2">
      <motion.div initial={{ opacity: 0, y: 20 }} ani mate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold mb-1">
          All <span className="gradient-text">Chats</span>
        </h1>
        <p className="text-text-secondary">View and manage conversations between users and AI influencers</p>
      </motion.div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user or influencer name..."
          className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageSquare size={36} className="text-brand/30 mx-auto mb-3" />
          <p className="text-text-secondary">No chats found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chat) => {
            const lastMsg = chat.messages?.[chat.messages.length - 1];
            return (
              <motion.div key={chat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Link
                  href={`/admin/chats/${chat.id}`}
                  className="glass-card p-4 flex items-center gap-4 hover:border-brand/40 transition-colors group"
                >
                  {/* Influencer avatar */}
                  <Avatar name={chat.influencer?.name ?? '?'} src={chat.influencer?.avatar} />

                  {/* Chat info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm truncate">{chat.influencer?.name ?? 'Unknown'}</span>
                      <span className="text-text-secondary/40 text-xs">↔</span>
                      <div className="flex items-center gap-1 min-w-0">
                        <User size={11} className="text-text-secondary flex-shrink-0" />
                        <span className="text-sm text-text-secondary truncate">{chat.customer?.name ?? 'Unknown'}</span>
                      </div>
                    </div>
                    {lastMsg ? (
                      <p className="text-xs text-text-secondary truncate">
                        {lastMsg.role === 'USER' ? `${chat.customer?.name}: ` : `${chat.influencer?.name}: `}
                        {lastMsg.content}
                      </p>
                    ) : (
                      <p className="text-xs text-text-secondary/40 italic">No messages</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex-shrink-0 text-right">
                    {lastMsg && (
                      <p className="text-[11px] text-text-secondary">{fmtTime(lastMsg.createdAt)}</p>
                    )}
                    <p className="text-[11px] text-text-secondary/50 mt-0.5">
                      {chat.messages?.length ?? 0} msgs
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
