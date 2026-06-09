'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Play, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { GET_PENDING_REVIEW_ORDERS } from '@/graphql/queries/order';
import { APPROVE_ORDER, REJECT_ORDER } from '@/graphql/mutations/order';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';

export default function ReviewerPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!['ADMIN', 'REVIEWER'].includes(user?.role ?? '')) { router.push('/dashboard'); }
  }, [hydrated, isAuthenticated, user]);

  const { data, loading, refetch } = useQuery(GET_PENDING_REVIEW_ORDERS, {
    pollInterval: 30000,
  });

  const orders = data?.pendingReviewOrders ?? [];
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o: any) => {
      const fields = [
        o.id,
        o.influencer?.name,
        o.customer?.name,
        o.customer?.email,
        o.package,
        JSON.stringify(o.projectBrief ?? {}),
      ].filter(Boolean).map(String);
      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [orders, query]);

  const [approveOrder, { loading: approving }] = useMutation(APPROVE_ORDER, {
    onCompleted: (data) => {
      toast({ title: 'Order approved and delivered!', variant: 'success' });
      refetch();
      if (selectedOrder?.id === data.approveOrder.id) setSelectedOrder(null);
    },
    onError: (e) => toast({ title: 'Failed to approve', description: e.message, variant: 'error' }),
  });

  const [rejectOrder, { loading: rejecting }] = useMutation(REJECT_ORDER, {
    onCompleted: () => {
      toast({ title: 'Order rejected. Regeneration queued.', variant: 'default' });
      setRejectingId(null);
      setRejectNotes('');
      refetch();
    },
    onError: (e) => toast({ title: 'Failed to reject', description: e.message, variant: 'error' }),
  });

  const getHoursAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Review <span className="gradient-text">Queue</span></h1>
          <p className="text-sm text-text-secondary mt-1">
            {filtered.length} video{filtered.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors text-sm">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by influencer, customer, email, package, brief"
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <CheckCircle size={48} className="text-success mx-auto mb-4" />
          <p className="text-xl font-semibold mb-2">Queue is clear!</p>
          <p className="text-text-secondary">No videos pending review. Great work!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((order: any) => {
            const hoursAgo = getHoursAgo(order.createdAt);
            const isUrgent = hoursAgo >= 20;

            return (
              <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className={`glass-card overflow-hidden ${isUrgent ? 'border-error/50' : ''}`}>
                {isUrgent && (
                  <div className="bg-error/10 border-b border-error/20 px-4 py-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-error" />
                    <span className="text-error text-xs font-medium">
                      Approaching 24h deadline — {hoursAgo}h elapsed
                    </span>
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text">
                      {order.influencer?.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{order.influencer?.name}</p>
                      <p className="text-sm text-text-secondary">{order.package?.replace(/_/g,' ')}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-text-secondary">
                        <Clock size={11} /> Submitted {hoursAgo}h ago
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${order.price}</p>
                      <p className="text-xs text-text-secondary">{order.customer?.email}</p>
                    </div>
                  </div>

                  <div className="bg-background rounded-xl p-4 mb-4 text-sm space-y-2">
                    <p className="font-medium text-text-secondary text-xs uppercase tracking-wide">Project Brief</p>
                    {Object.entries(order.projectBrief ?? {}).map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-text-secondary capitalize w-28 flex-shrink-0">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-text-primary text-xs">{Array.isArray(val) ? (val as string[]).join(', ') : String(val)}</span>
                      </div>
                    ))}
                  </div>

                  {order.videoUrl && (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4 cursor-pointer group"
                      onClick={() => setSelectedOrder(order)}>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 group-hover:bg-black/40 transition-colors">
                        <div className="w-14 h-14 rounded-full bg-brand/80 flex items-center justify-center">
                          <Play size={24} className="text-white ml-1" />
                        </div>
                      </div>
                      <p className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded">
                        Preview
                      </p>
                    </div>
                  )}

                  {rejectingId === order.id && (
                    <div className="mb-4 p-3 bg-background rounded-xl border border-error/30">
                      <p className="text-sm font-medium text-error mb-2">Rejection Notes</p>
                      <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3} placeholder="Explain why this video is being rejected (required for regeneration)..."
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-error transition-colors resize-none" />
                    </div>
                  )}

                  <div className="flex gap-3">
                    {rejectingId === order.id ? (
                      <>
                        <button
                          onClick={() => rejectOrder({ variables: { id: order.id, notes: rejectNotes } })}
                          disabled={!rejectNotes.trim() || rejecting}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-error/10 border border-error/30 text-error rounded-xl text-sm font-medium hover:bg-error/20 transition-colors disabled:opacity-50">
                          <XCircle size={16} /> Confirm Reject
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectNotes(''); }}
                          className="flex-1 btn-ghost text-sm py-2.5">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => approveOrder({ variables: { id: order.id } })}
                          disabled={approving}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-success/10 border border-success/30 text-success rounded-xl text-sm font-medium hover:bg-success/20 transition-colors disabled:opacity-50">
                          <CheckCircle size={16} /> Approve & Deliver
                        </button>
                        <button
                          onClick={() => setRejectingId(order.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-error/10 border border-error/30 text-error rounded-xl text-sm font-medium hover:bg-error/20 transition-colors">
                          <XCircle size={16} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Video modal */}
      <AnimatePresence>
        {selectedOrder?.videoUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <video src={selectedOrder.videoUrl} controls autoPlay className="w-full rounded-2xl" />
              <button onClick={() => setSelectedOrder(null)} className="mt-4 w-full btn-ghost text-sm">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
