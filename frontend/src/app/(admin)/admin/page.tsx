'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { Video, DollarSign, Ticket, ArrowRight, TrendingUp } from 'lucide-react';
import { GET_ALL_ORDERS } from '@/graphql/queries/order';
import { GET_ALL_TICKETS } from '@/graphql/queries/ticket';
import { useAuthStore } from '@/lib/auth';

import RevenueChart from '@/components/charts/RevenueChart';
import OrderStatusCard from '@/components/charts/OrderStatusCard';
import TicketOverview from '@/components/charts/TicketOverview';



const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-success/10 text-success',
  PENDING_REVIEW: 'bg-brand/10 text-brand-light',
  REFUNDED: 'bg-error/10 text-error',
};

export default function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') { router.push('/dashboard'); return; }
    if (pathname === '/admin') {
      router.replace('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, pathname]);

  const { data } = useQuery(GET_ALL_ORDERS);
  const orders = data?.allOrders ?? [];

  const totalRevenue = orders
    .filter((o: any) => ['DELIVERED', 'APPROVED'].includes(o.status))
    .reduce((sum: number, o: any) => sum + (o.price || 0), 0);

  const pendingReview = orders.filter((o: any) => o.status === 'PENDING_REVIEW').length;
  const generating = orders.filter((o: any) => o.status === 'GENERATING').length;

  const { data: ticketsData } = useQuery(GET_ALL_TICKETS);
  const tickets = ticketsData?.allTickets ?? [];

  const activeTickets = tickets.filter(
    (ticket: any) =>
      ticket.status === 'OPEN' ||
      ticket.status === 'IN_PROGRESS'
  ).length;

  const stats = [
    { label: 'Total Orders', value: orders.length, icon: Video, color: 'text-brand-light', bg: 'bg-brand/10', href: '/admin/orders' },
    { label: 'Total Revenue', value: `$${totalRevenue.toFixed(0)}`, icon: DollarSign, color: 'text-success', bg: 'bg-success/10', href: '/admin/revenue' },
    { label: 'Active Tickets', value: activeTickets, icon: Ticket, color: 'text-brand', bg: 'bg-brand/10', href: '/admin/tickets' },
    { label: 'Generating', value: generating, icon: TrendingUp, color: 'text-brand-light', bg: 'bg-brand/10', href: '/admin/orders' },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 12400 },
    { month: 'Feb', revenue: 18700 },
    { month: 'Mar', revenue: 24300 },
    { month: 'Apr', revenue: 32100 },
    { month: 'May', revenue: 42800 },
    { month: 'Jun', revenue: 48600 },
  ];

  const orderStatusData = [
    {
      label: 'Delivered',
      value: 652,
      color: 'bg-emerald-500',
    },
    {
      label: 'Pending Review',
      value: 286,
      color: 'bg-violet-500',
    },
    {
      label: 'Generating',
      value: 198,
      color: 'bg-amber-500',
    },
    {
      label: 'Approved',
      value: 76,
      color: 'bg-blue-500',
    },
    {
      label: 'Cancelled',
      value: 36,
      color: 'bg-red-500',
    },
  ];

  const ticketData = [
    {
      label: 'Open',
      value: tickets.filter(
        (t: any) => t.status === 'OPEN'
      ).length,
      color: '#8B5CF6',
      description: 'Require immediate attention',
    },

    {
      label: 'In Progress',
      value: tickets.filter(
        (t: any) => t.status === 'IN_PROGRESS'
      ).length,
      color: '#F59E0B',
      description: 'Being actively worked on',
    },
    {
      label: 'Resolved',
      value: tickets.filter(
        (t: any) =>
          t.status === 'RESOLVED' ||
          t.status === 'CLOSED'
      ).length,
      color: '#22C55E',
      description: 'Successfully resolved',
    },
  ];

  return (
    <section className="flex-1 min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Admin <span className="gradient-text">Dashboard</span>
        </h1>
        <p className="text-sm text-text-secondary mt-1">Overview and management</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="glass-card p-4 flex flex-col gap-3 hover:border-brand/30 transition-colors group">
            <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon size={17} className={stat.color} />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold leading-tight">{stat.value}</p>
              <p className="text-xs text-text-secondary leading-tight mt-0.5">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue Trend */}

      <RevenueChart data={revenueData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <OrderStatusCard data={orderStatusData} />
        <TicketOverview data={ticketData} />
      </div>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-brand-light flex items-center gap-1 hover:underline">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {orders.slice(0, 10).map((order: any) => (
              <div key={order.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{order.customer?.name ?? '—'}</p>
                    <p className="text-xs text-text-secondary truncate">{order.influencer?.name ?? '—'}</p>
                  </div>
                  <p className="font-semibold text-sm flex-shrink-0">${order.price}</p>
                </div>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[order.status] ?? 'bg-surface text-text-secondary'}`}>
                  {order.status?.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-text-secondary font-medium">Customer</th>
                    <th className="text-left p-4 text-text-secondary font-medium hidden md:table-cell">Influencer</th>
                    <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                    <th className="text-right p-4 text-text-secondary font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((order: any) => (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="p-4 text-text-primary font-medium">{order.customer?.name ?? '—'}</td>
                      <td className="p-4 text-text-secondary hidden md:table-cell">{order.influencer?.name ?? '—'}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[order.status] ?? 'bg-surface text-text-secondary'}`}>
                          {order.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold">${order.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
