'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { GET_MY_CHATS } from '@/graphql/queries/chat';
import { useAuthStore } from '@/lib/auth';

export default function MyChatsPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const { data, loading } = useQuery(GET_MY_CHATS, { fetchPolicy: 'cache-and-network' });
  const chats = data?.myChats ?? [];

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="py-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-3xl font-bold">My <span className="gradient-text">Chats</span></h1>
            <p className="text-text-secondary mt-1">All your conversations with AI influencers</p>
          </motion.div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
          ) : chats.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-12 text-center">
              <MessageSquare size={40} className="mx-auto text-text-secondary/40 mb-4" />
              <p className="text-text-secondary text-lg mb-2">No conversations yet</p>
              <p className="text-text-secondary/60 text-sm mb-6">Start chatting with an AI influencer to get content ideas.</p>
              <Link href="/influencers" className="btn-brand">Browse Influencers</Link>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {chats.map((chat: any, i: number) => {
                const lastMsg = chat.messages?.[0];
                const influencer = chat.influencer;
                return (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={`/chat/${chat.influencerId}`}
                      className="glass-card p-4 flex items-center gap-4 hover:border-brand/40 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-surface border border-brand/30 flex items-center justify-center text-lg font-bold gradient-text flex-shrink-0">
                        {influencer?.avatar ? (
                          <img src={influencer.avatar} alt={influencer.name} className="w-full h-full object-cover rounded-full" />
                        ) : influencer?.name?.charAt(0) ?? '?'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-semibold text-sm truncate">{influencer?.name ?? 'Unknown'}</p>
                          {lastMsg && (
                            <span className="text-[11px] text-text-secondary flex items-center gap-1 flex-shrink-0 ml-2">
                              <Clock size={11} />
                              {fmtTime(lastMsg.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary/60 truncate mb-1">{influencer?.contentStyle ?? ''}</p>
                        {lastMsg ? (
                          <p className="text-xs text-text-secondary truncate">
                            <span className={lastMsg.role === 'USER' ? 'text-brand-light' : ''}>
                              {lastMsg.role === 'USER' ? 'You: ' : `${influencer?.name ?? 'AI'}: `}
                            </span>
                            {lastMsg.content}
                          </p>
                        ) : (
                          <p className="text-xs text-text-secondary/40 italic">No messages yet</p>
                        )}
                      </div>

                      <ArrowRight size={16} className="text-text-secondary/40 group-hover:text-brand-light transition-colors flex-shrink-0" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Total count */}
          {!loading && chats.length > 0 && (
            <p className="text-center text-xs text-text-secondary mt-6">
              {chats.length} conversation{chats.length !== 1 ? 's' : ''}
            </p>
          )}
    </div>
  );
}
