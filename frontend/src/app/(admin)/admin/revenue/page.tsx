'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, ShoppingCart, RefreshCw } from 'lucide-react';
import { GET_ALL_ORDERS } from '@/graphql/queries/order';
import { useAuthStore } from '@/lib/auth';

export default function AdminRevenuePage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading } = useQuery(GET_ALL_ORDERS);
  const orders = data?.allOrders ?? [];

  const paidOrders = orders.filter((o: any) => ['DELIVERED', 'APPROVED', 'PENDING_REVIEW', 'GENERATING'].includes(o.status));
  const refundedOrders = orders.filter((o: any) => o.status === 'REFUNDED');
  const totalRevenue = paidOrders.reduce((s: number, o: any) => s + (o.price || 0), 0);
  const totalRefunded = refundedOrders.reduce((s: number, o: any) => s + (o.price || 0), 0);
  const netRevenue = totalRevenue - totalRefunded;

  const now = new Date();
  const thisMonth = orders.filter((o: any) => {
    const d = new Date(o.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() &&
      ['DELIVERED', 'APPROVED', 'PENDING_REVIEW', 'GENERATING'].includes(o.status);
  });
  const monthlyRevenue = thisMonth.reduce((s: number, o: any) => s + (o.price || 0), 0);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">Revenue <span className="gradient-text">Overview</span></h1>
        <p className="text-sm text-text-secondary mt-1">Financial performance and payment data</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-success' },
          { label: 'Monthly Revenue', value: `$${monthlyRevenue.toFixed(2)}`, icon: TrendingUp, color: 'text-brand-light' },
          { label: 'Total Refunded', value: `$${totalRefunded.toFixed(2)}`, icon: RefreshCw, color: 'text-error' },
          { label: 'Net Revenue', value: `$${netRevenue.toFixed(2)}`, icon: ShoppingCart, color: 'text-brand-light' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
                <stat.icon size={16} className={stat.color} />
              </div>
              <p className="text-xs text-text-secondary">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Payment History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-text-secondary font-medium">Customer</th>
              <th className="text-left p-4 text-text-secondary font-medium hidden sm:table-cell">Influencer</th>
              <th className="text-left p-4 text-text-secondary font-medium hidden md:table-cell">Package</th>
              <th className="text-left p-4 text-text-secondary font-medium">Status</th>
              <th className="text-right p-4 text-text-secondary font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(loading ? [] : orders).map((order: any) => (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                <td className="p-4">
                  <p className="font-medium truncate">{order.customer?.name}</p>
                  <p className="text-xs text-text-secondary">{fmtDate(order.createdAt)}</p>
                </td>
                <td className="p-4 hidden sm:table-cell text-text-secondary">{order.influencer?.name}</td>
                <td className="p-4 hidden md:table-cell text-text-secondary">{order.package?.replace(/_/g,' ')}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.status === 'DELIVERED' ? 'bg-success/10 text-success' :
                    order.status === 'REFUNDED' ? 'bg-error/10 text-error' :
                    'bg-brand/10 text-brand-light'
                  }`}>
                    {order.status?.replace(/_/g,' ')}
                  </span>
                </td>
                <td className="p-4 text-right font-semibold">${order.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
