'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { GET_ALL_ORDERS } from '@/graphql/queries/order';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

const STATUS_TABS = ['ALL', 'PENDING_REVIEW', 'GENERATING', 'DELIVERED', 'REFUNDED'];

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [filter, setFilter] = useState('ALL');
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading } = useQuery(GET_ALL_ORDERS, {
    variables: { status: filter === 'ALL' ? undefined : filter },
  });

  const orders = data?.allOrders ?? [];
  const [query, setQuery] = useState('');
  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o: any) => {
      const fields = [
        o.id,
        o.customer?.name,
        o.customer?.email,
        o.influencer?.name,
        o.package,
      ].filter(Boolean).map(String);
      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [orders, query]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">All <span className="gradient-text">Orders</span></h1>
        <p className="text-sm text-text-secondary mt-1">{filteredOrders.length} orders</p>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              filter === tab
                ? 'bg-brand text-white'
                : 'bg-surface border border-border text-text-secondary hover:text-text-primary')}>
            {tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders by ID, customer, influencer, package"
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="skeleton h-14 rounded-xl"/>)}</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-text-secondary font-medium">Customer</th>
                <th className="text-left p-4 text-text-secondary font-medium hidden sm:table-cell">Influencer</th>
                <th className="text-left p-4 text-text-secondary font-medium hidden md:table-cell">Package</th>
                <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                <th className="text-left p-4 text-text-secondary font-medium hidden lg:table-cell">Date</th>
                <th className="text-right p-4 text-text-secondary font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order: any) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="p-4">
                    <p className="font-medium">{order.customer?.name}</p>
                    <p className="text-xs text-text-secondary">{order.customer?.email}</p>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-text-secondary">{order.influencer?.name}</td>
                  <td className="p-4 hidden md:table-cell text-text-secondary">{order.package?.replace(/_/g,' ')}</td>
                  <td className="p-4">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      order.status === 'DELIVERED' ? 'bg-success/10 text-success' :
                      order.status === 'PENDING_REVIEW' ? 'bg-brand/10 text-brand-light' :
                      order.status === 'REFUNDED' ? 'bg-error/10 text-error' :
                      'bg-surface text-text-secondary')}>
                      {order.status?.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-xs text-text-secondary">{fmtDate(order.createdAt)}</td>
                  <td className="p-4 text-right font-semibold">${order.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="text-center py-12 text-text-secondary">No orders found.</div>
          )}
        </div>
      )}
    </>
  );
}
