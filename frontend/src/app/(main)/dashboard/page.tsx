'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Video, ShoppingCart, Users, ArrowRight, Download, Ticket,
  Clock, CheckCircle, XCircle, Loader, Zap, Star, MessageSquare
} from 'lucide-react';
import { GET_DASHBOARD_DATA } from '@/graphql/queries/order';
import { useAuthStore } from '@/lib/auth';
import { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';
import AdminDashboard from '@/app/(admin)/admin/page';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: any }> = {
  PENDING_PAYMENT: { label: 'Awaiting Payment', color: 'text-text-secondary', icon: Clock },
  PAID: { label: 'Paid', color: 'text-brand-light', icon: CheckCircle },
  GENERATING: { label: 'Generating', color: 'text-brand-light', icon: Loader },
  PENDING_REVIEW: { label: 'In Review', color: 'text-brand-light', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-success', icon: CheckCircle },
  DELIVERED: { label: 'Delivered', color: 'text-success', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'text-error', icon: XCircle },
  REFUNDED: { label: 'Refunded', color: 'text-text-secondary', icon: XCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-error', icon: XCircle },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });

  useLayoutEffect(() => {
    setMounted(true);
    if (hydrated && !isAuthenticated) { router.push('/login'); }
  }, [hydrated, isAuthenticated]);

  const { data, loading: ordersLoading } = useQuery(GET_DASHBOARD_DATA, {
    skip: !isAuthenticated,
  });

  const orders: Order[] = data?.myOrders ?? [];
  const stats = data?.myStats ?? { totalOrders: 0, totalVideosGenerated: 0, totalInfluencersHired: 0 };

  const activeOrders = orders.filter((o) =>
    ['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED'].includes(o.status)
  );
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');

  if (!mounted) {
    return null;
  }

  return (
    user?.role === 'ADMIN' ? (
      <AdminDashboard />
    ) : (
      <div className="py-2">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span></h1>
          <p className="text-text-secondary mt-1">Track your orders and manage your AI content</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'text-brand-light' },
            { label: 'Videos Generated', value: stats.totalVideosGenerated, icon: Video, color: 'text-success' },
            { label: 'Influencers Hired', value: stats.totalInfluencersHired, icon: Users, color: 'text-brand' },
          ].map((stat, i) => (
            <div key={stat.label} className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
                <stat.icon size={22} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
            <div className="space-y-3">
              {activeOrders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <div key={order.id} className="glass-card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface border border-brand/30 flex items-center justify-center text-lg sm:text-xl font-bold gradient-text flex-shrink-0">
                      {order.influencer?.name?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{order.influencer?.name}</p>
                      <p className="text-xs sm:text-sm text-text-secondary truncate">{order.package.replace('_', ' ')} · ${order.price}</p>
                    </div>
                    <div className={cn('flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium flex-shrink-0', statusCfg.color)}>
                      <StatusIcon size={13} className={order.status === 'GENERATING' ? 'animate-spin' : ''} />
                      <span className="hidden xs:inline sm:inline">{statusCfg.label}</span>
                    </div>
                    <p className="text-xs text-text-secondary hidden sm:block flex-shrink-0">{fmtDate(order.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link href="/influencers" className="glass-card glow-border p-5 flex items-center gap-3 hover:border-brand/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Zap size={18} className="text-brand-light" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Hire an Influencer</p>
              <p className="text-xs text-text-secondary">Browse AI talent</p>
            </div>
            <ArrowRight size={16} className="text-text-secondary group-hover:text-brand-light transition-colors" />
          </Link>
          <Link href="/dashboard/orders" className="glass-card glow-border p-5 flex items-center gap-3 hover:border-brand/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Video size={18} className="text-brand-light" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">My Videos</p>
              <p className="text-xs text-text-secondary">{deliveredOrders.length} delivered</p>
            </div>
            <ArrowRight size={16} className="text-text-secondary group-hover:text-brand-light transition-colors" />
          </Link>
          <Link href="/dashboard/tickets" className="glass-card glow-border p-5 flex items-center gap-3 hover:border-brand/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Ticket size={18} className="text-brand-light" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Support</p>
              <p className="text-xs text-text-secondary">Raise a ticket</p>
            </div>
            <ArrowRight size={16} className="text-text-secondary group-hover:text-brand-light transition-colors" />
          </Link>
          <Link href="/dashboard/chats" className="glass-card glow-border p-5 flex items-center gap-3 hover:border-brand/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <MessageSquare size={18} className="text-brand-light" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">My Chats</p>
              <p className="text-xs text-text-secondary">View conversations</p>
            </div>
            <ArrowRight size={16} className="text-text-secondary group-hover:text-brand-light transition-colors" />
          </Link>
        </motion.div>

        {/* Order History */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Order History</h2>
            <Link href="/dashboard/orders" className="text-sm text-brand-light hover:text-brand flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Video size={40} className="text-brand/30 mx-auto mb-3" />
              <p className="text-text-secondary">No orders yet.</p>
              <Link href="/influencers" className="btn-brand mt-4 inline-block">Browse Influencers</Link>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-text-secondary font-medium">Influencer</th>
                      <th className="text-left p-4 text-text-secondary font-medium hidden sm:table-cell">Package</th>
                      <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                      <th className="text-right p-4 text-text-secondary font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 8).map((order) => {
                      const statusCfg = STATUS_CONFIG[order.status];
                      const StatusIcon = statusCfg.icon;
                      return (
                        <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface border border-brand/30 flex items-center justify-center text-xs font-bold gradient-text">
                                {order.influencer?.name?.charAt(0) ?? '?'}
                              </div>
                              <div>
                                <p className="font-medium truncate max-w-[120px]">{order.influencer?.name}</p>
                                <p className="text-xs text-text-secondary">{fmtDate(order.createdAt)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 hidden sm:table-cell text-text-secondary">{order.package.replace(/_/g, ' ')}</td>
                          <td className="p-4">
                            <span className={cn('flex items-center gap-1.5 text-xs font-medium w-fit', statusCfg.color)}>
                              <StatusIcon size={12} /> {statusCfg.label}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {order.videoUrl && order.status === 'DELIVERED' && (
                                <a href={order.videoUrl} download className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-brand-light transition-colors" title="Download">
                                  <Download size={14} />
                                </a>
                              )}
                              <Link href={`/dashboard/tickets?orderId=${order.id}`}
                                className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-brand-light transition-colors" title="Raise Ticket">
                                <Ticket size={14} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    )
  );
}
