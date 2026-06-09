'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Download, Ticket, Star, CheckCircle, XCircle, Clock, Loader, Zap } from 'lucide-react';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
import { CREATE_REVIEW } from '@/graphql/mutations/ticket';
import { useAuthStore } from '@/lib/auth';
import { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_PAYMENT: { label: 'Awaiting Payment', color: 'text-text-secondary', icon: Clock },
  PAID: { label: 'Paid', color: 'text-brand-light', icon: CheckCircle },
  GENERATING: { label: 'Generating', color: 'text-brand-light', icon: Loader },
  PENDING_REVIEW: { label: 'Under Review', color: 'text-brand-light', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-success', icon: CheckCircle },
  DELIVERED: { label: 'Delivered', color: 'text-success', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'text-error', icon: XCircle },
  REFUNDED: { label: 'Refunded', color: 'text-text-secondary', icon: XCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-error', icon: XCircle },
};

function SearchParamsHandler() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get('success')) {
      toast({ title: 'Payment successful!', description: 'Your order is now being processed.', variant: 'success' });
    }
  }, [searchParams]);
  return null;
}

function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });
  const [reviewingOrder, setReviewingOrder] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const { data, loading, refetch } = useQuery(GET_MY_ORDERS);
  const orders: Order[] = data?.myOrders ?? [];

  const [createReview, { loading: reviewLoading }] = useMutation(CREATE_REVIEW, {
    onCompleted: () => {
      toast({ title: 'Review submitted!', variant: 'success' });
      setReviewingOrder(null);
      setRating(5);
      setComment('');
      refetch();
    },
    onError: (e) => toast({ title: 'Failed to submit review', description: e.message, variant: 'error' }),
  });

  return (
    <div className="py-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-3xl font-bold mb-1">My <span className="gradient-text">Orders</span></h1>
            <p className="text-text-secondary">View, download and manage all your video orders</p>
          </motion.div>

          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
          ) : orders.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-text-secondary mb-4">No orders yet.</p>
              <Link href="/influencers" className="btn-brand">Browse Influencers</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PAID;
                const Icon = cfg.icon;
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-surface border border-brand/30 flex items-center justify-center text-xl font-bold gradient-text flex-shrink-0">
                        {order.influencer?.name?.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/dashboard/orders/influencer/${order.influencer?.id ?? order.influencerId}`}
                              className="font-semibold hover:text-brand-light transition-colors"
                            >
                              {order.influencer?.name}
                            </Link>
                            <p className="text-sm text-text-secondary">{order.package?.replace(/_/g, ' ')} · ${order.price}</p>
                            <p className="text-xs text-text-secondary mt-0.5">{fmtDate(order.createdAt)}</p>
                          </div>
                          <span className={cn('flex items-center gap-1.5 text-xs font-medium', cfg.color)}>
                            <Icon size={12} className={order.status === 'GENERATING' ? 'animate-spin' : ''} />
                            {cfg.label}
                          </span>
                        </div>

                        {/* Progress bar for active orders */}
                        {['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED'].includes(order.status) && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-text-secondary mb-1">
                              <span>Progress</span>
                              <span>{order.videosDelivered}/{order.videosOrdered} videos</span>
                            </div>
                            <div className="h-1.5 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-brand rounded-full transition-all"
                                style={{ width: `${(order.videosDelivered / order.videosOrdered) * 100}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Link
                            href={`/dashboard/orders/influencer/${order.influencer?.id ?? order.influencerId}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary transition-colors"
                          >
                            View All Projects
                          </Link>
                          {order.videoUrl && order.status === 'DELIVERED' && (
                            <a href={order.videoUrl} download
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/30 text-success rounded-lg text-xs font-medium hover:bg-success/20 transition-colors">
                              <Download size={13} /> Download Video
                            </a>
                          )}
                          {order.status === 'DELIVERED' && !order.review && reviewingOrder !== order.id && (
                            <button onClick={() => setReviewingOrder(order.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 border border-brand/30 text-brand-light rounded-lg text-xs font-medium hover:bg-brand/20 transition-colors">
                              <Star size={13} /> Leave Review
                            </button>
                          )}
                          {order.status === 'DELIVERED' && order.review && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary">
                              <Star size={13} className="text-brand-light fill-brand-light" /> Reviewed
                            </span>
                          )}
                          {!['REFUNDED', 'CANCELLED'].includes(order.status) && (
                            <Link href={`/dashboard/tickets?orderId=${order.id}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary transition-colors">
                              <Ticket size={13} /> Raise Issue
                            </Link>
                          )}
                        </div>

                        {/* Inline review form */}
                        {reviewingOrder === order.id && (
                          <div className="mt-4 p-4 bg-background rounded-xl border border-border space-y-3">
                            <p className="text-sm font-medium">Rate your experience</p>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map((r) => (
                                <button key={r} onClick={() => setRating(r)}>
                                  <Star size={22} className={r <= rating ? 'text-brand-light fill-brand-light' : 'text-border'} />
                                </button>
                              ))}
                            </div>
                            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                              placeholder="Share your experience..." className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => createReview({ variables: { orderId: order.id, rating, comment } })}
                                disabled={reviewLoading}
                                className="btn-brand text-xs px-4 py-2 disabled:opacity-50">Submit</button>
                              <button onClick={() => setReviewingOrder(null)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
    </div>
  );
}

export default function OrdersPageWrapper() {
  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsHandler />
      </Suspense>
      <OrdersPage />
    </>
  );
}
