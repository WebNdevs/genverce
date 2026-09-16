'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search, Users, Filter, ArrowUpRight,
  Package, DollarSign, CheckCircle2, Clock, Loader2,
  ChevronDown, ChevronUp, UserCheck,
  ShieldCheck
} from 'lucide-react';
import { GET_ALL_ORDERS } from '@/graphql/queries/order';
import { GET_INFLUENCERS } from '@/graphql/queries/influencer';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  'ALL',
  'PENDING_PAYMENT',
  'PAID',
  'GENERATING',
  'PENDING_REVIEW',
  'APPROVED',
  'DELIVERED',
  'REFUNDED',
  'CANCELLED',
];

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PAID: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  GENERATING: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  PENDING_REVIEW: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  APPROVED: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  REFUNDED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const SERVICE_LABEL: Record<string, string> = {
  CHAT_ONLY: 'Chat Only',
  VIDEO_CREATION: 'Video Creation',
  POST_CREATION: 'Post Creation',
  IMAGE_CREATION: 'Image Creation',
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState('ALL');

  const handleStatusFilterChange = (nextTab: string) => {
    setStatusFilter(nextTab);
  };
  const [selectedInfluencerId, setSelectedInfluencerId] = useState('ALL');
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, router]);

  // Fetch all orders
  const { data: ordersData, loading: loadingOrders } = useQuery(GET_ALL_ORDERS, {
    fetchPolicy: 'cache-and-network',
  });

  // Fetch all influencers including inactive ones
  const { data: influencersData } = useQuery(GET_INFLUENCERS, {
    variables: { filter: { limit: 100, includeInactive: true } },
  });

  const orders: any[] = ordersData?.allOrders ?? [];
  const fetchedInfluencers: any[] = influencersData?.influencers?.influencers ?? [];

  // Master list of all unique influencers (combining database list + influencers from orders)
  const allInfluencers = useMemo(() => {
    const map = new Map<string, any>();
    fetchedInfluencers.forEach((inf: any) => {
      if (inf?.id) map.set(inf.id, inf);
    });
    orders.forEach((o: any) => {
      if (o.influencer?.id && !map.has(o.influencer.id)) {
        map.set(o.influencer.id, o.influencer);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [fetchedInfluencers, orders]);

  // Check if an order matches the search query
  const orderMatchesQuery = (o: any, q: string) => {
    if (!q) return true;
    const cleanQ = q.startsWith('#') ? q.slice(1).trim() : q;
    const orderId = String(o.id || '').toLowerCase();
    if (cleanQ && orderId.includes(cleanQ)) return true;

    const fields = [
      o.customer?.name,
      o.customer?.email,
      o.influencer?.name,
      o.package,
      o.status,
      o.deliveryType,
      typeof o.projectBrief === 'string' ? o.projectBrief : o.projectBrief?.notes,
    ]
      .filter(Boolean)
      .map((val) => String(val).toLowerCase());

    return fields.some((f) => f.includes(q) || f.replace(/_/g, ' ').includes(q));
  };

  // Check if an influencer itself matches the search query
  const influencerMatchesQuery = (inf: any, q: string) => {
    if (!q) return true;
    const fields = [
      inf.id,
      inf.name,
      inf.bio,
      inf.serviceType,
      inf.serviceType ? SERVICE_LABEL[inf.serviceType] : '',
    ]
      .filter(Boolean)
      .map((val) => String(val).toLowerCase());

    return fields.some((f) => f.includes(q) || f.replace(/_/g, ' ').includes(q));
  };

  // Target influencers based on dropdown selection
  const targetInfluencers = useMemo(() => {
    if (selectedInfluencerId === 'ALL') {
      return allInfluencers;
    }
    return allInfluencers.filter((inf) => inf.id === selectedInfluencerId);
  }, [allInfluencers, selectedInfluencerId]);

  // Group orders by displayed influencers with filtering & search applied
  const groupedOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: { influencer: any; orders: any[] }[] = [];

    targetInfluencers.forEach((inf) => {
      // Find orders for this influencer that match the status filter
      const infOrdersForStatus = orders.filter((o: any) => {
        const infId = o.influencerId || o.influencer?.id;
        if (infId !== inf.id) return false;
        if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
        return true;
      });

      if (q) {
        const infMatches = influencerMatchesQuery(inf, q);
        const matchingOrders = infOrdersForStatus.filter((o) => orderMatchesQuery(o, q));

        // If the influencer itself matches the search (e.g. search by influencer name):
        // show this influencer with their matching orders (or all their orders for the status if no order-level match)
        if (infMatches) {
          const ordersToShow = matchingOrders.length > 0 ? matchingOrders : infOrdersForStatus;
          result.push({ influencer: inf, orders: ordersToShow });
        } else if (matchingOrders.length > 0) {
          // If the influencer didn't match directly, but has orders matching the search (e.g. customer name/email, order ID):
          // show this influencer with ONLY those matching orders
          result.push({ influencer: inf, orders: matchingOrders });
        }
        // If neither the influencer matches nor any order matches: excluded!
      } else {
        // No search query: Include this influencer with all their orders for current status
        result.push({ influencer: inf, orders: infOrdersForStatus });
      }
    });

    // Sort: Influencers with orders first, sorted by order count descending, then alphabetical
    return result.sort((a, b) => {
      if (b.orders.length !== a.orders.length) {
        return b.orders.length - a.orders.length;
      }
      return (a.influencer.name || '').localeCompare(b.influencer.name || '');
    });
  }, [targetInfluencers, orders, statusFilter, query]);

  // Overall Super Admin KPIs (computed from the displayed orders across all matching influencers)
  const kpis = useMemo(() => {
    const displayedOrders = groupedOrders.flatMap((g) => g.orders);
    const total = displayedOrders.length;
    const totalRev = displayedOrders.reduce((acc: number, o: any) => acc + (o.price ?? 0), 0);
    const active = displayedOrders.filter((o: any) =>
      ['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED'].includes(o.status)
    ).length;
    const delivered = displayedOrders.filter((o: any) => o.status === 'DELIVERED').length;
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    return { total, totalRev, active, delivered, deliveryRate };
  }, [groupedOrders]);

  const toggleGroupCollapse = (infId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [infId]: !prev[infId] }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Super Admin Title & Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand-light border border-brand/20 flex items-center gap-1">
              <ShieldCheck size={13} />
              Super Admin Console
            </span>
          </div>
          <h1 className="text-2xl font-semibold">
            Influencer <span className="gradient-text">Orders & Performance</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Track order volume, revenue performance, and fulfillment across all AI Influencers.
          </p>
        </div>


      </motion.div>

      {/* Super Admin Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand/10 text-brand-light">
            <Package size={18} />
          </div>
          <div>
            <p className="text-xs text-text-secondary font-medium">Total Orders Handled</p>
            <p className="text-xl font-bold mt-0.5">{kpis.total}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xs text-text-secondary font-medium">Total Generated Revenue</p>
            <p className="text-xl font-bold mt-0.5">${kpis.totalRev.toFixed(2)}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs text-text-secondary font-medium">Active In-Progress</p>
            <p className="text-xl font-bold mt-0.5">{kpis.active}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-xs text-text-secondary font-medium">Delivery Rate</p>
            <p className="text-xl font-bold mt-0.5">{kpis.deliveryRate}% <span className="text-xs font-normal text-text-secondary">({kpis.delivered})</span></p>
          </div>
        </div>
      </div>


      {/* Control Bar: Filters & Search */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order ID, client name/email, influencer, or package..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          {/* Influencer Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary font-medium whitespace-nowrap flex items-center gap-1.5">
              <Users size={14} className="text-brand-light" />
              Influencer:
            </span>
            <select
              value={selectedInfluencerId}
              onChange={(e) => setSelectedInfluencerId(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-xl text-sm text-text-primary font-medium focus:outline-none focus:border-brand transition-colors min-w-[220px]"
            >
              <option value="ALL">All Influencers ({allInfluencers.length})</option>
              {allInfluencers.map((inf: any) => (
                <option key={inf.id} value={inf.id}>
                  {inf.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div role="tablist" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-border/50 pt-3">
          <span className="text-xs text-text-secondary font-medium mr-1 flex items-center gap-1 flex-shrink-0">
            <Filter size={12} />
            Status:
          </span>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={statusFilter === tab}
              onClick={() => handleStatusFilterChange(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                statusFilter === tab
                  ? 'bg-brand text-white border-brand shadow-sm'
                  : 'bg-surface/50 border-border text-text-secondary hover:text-text-primary hover:bg-surface'
              )}
            >
              {tab === 'ALL' ? 'All Statuses' : tab.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loadingOrders && orders.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : groupedOrders.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package size={36} className="mx-auto text-text-secondary mb-3 opacity-60" />
          <h3 className="text-base font-semibold mb-1">No orders or influencers match your search or filter</h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Try clearing your search query or choosing another status or influencer.
          </p>
          {(statusFilter !== 'ALL' || selectedInfluencerId !== 'ALL' || query) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setSelectedInfluencerId('ALL');
                setQuery('');
              }}
              className="mt-4 btn-brand text-xs px-4 py-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* ─── All Influencers Performance & Orders View ─── */
        <div className="space-y-6">
          {groupedOrders.map(({ influencer, orders: infOrders }) => {
            const infId = influencer.id;
            const isCollapsed = !!collapsedGroups[infId];
            const infRev = infOrders.reduce((sum, o) => sum + (o.price ?? 0), 0);
            const infActive = infOrders.filter((o) =>
              ['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED'].includes(o.status)
            ).length;
            const infDelivered = infOrders.filter((o) => o.status === 'DELIVERED').length;
            const avgOrderValue = infOrders.length > 0 ? infRev / infOrders.length : 0;

            return (
              <motion.div
                key={infId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden border border-border/80"
              >
                {/* Group Header & Performance Metrics */}
                <div className="p-5 bg-surface/40 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {influencer.avatar ? (
                      <img
                        src={influencer.avatar}
                        alt={influencer.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-brand/40 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-lg font-bold text-brand-light flex-shrink-0">
                        {influencer.name?.charAt(0) ?? '?'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{influencer.name}</h2>
                        {influencer.serviceType && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand/10 text-brand-light border border-brand/20">
                            {SERVICE_LABEL[influencer.serviceType] ?? influencer.serviceType}
                          </span>
                        )}
                        {influencer.rating > 0 && (
                          <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                            ★ {influencer.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Performance Overview · {infOrders.length} Order{infOrders.length !== 1 ? 's' : ''} Assigned
                      </p>
                    </div>
                  </div>

                  {/* Super Admin Performance Metrics */}
                  <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="px-3 py-1.5 rounded-xl bg-background/80 border border-border text-center">
                        <p className="text-[10px] text-text-secondary uppercase">Revenue</p>
                        <p className="font-bold text-emerald-400">${infRev.toFixed(2)}</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-background/80 border border-border text-center">
                        <p className="text-[10px] text-text-secondary uppercase">Avg Order</p>
                        <p className="font-bold text-brand-light">${avgOrderValue.toFixed(2)}</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-background/80 border border-border text-center">
                        <p className="text-[10px] text-text-secondary uppercase">Active / Del.</p>
                        <p className="font-bold text-purple-400">{infActive} / {infDelivered}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/influencers/${infId}`}
                        className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <UserCheck size={13} />
                        Influencer Dashboard
                      </Link>
                      <button
                        onClick={() => toggleGroupCollapse(infId)}
                        className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                        aria-label="Toggle orders section"
                      >
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Group Body */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {infOrders.length === 0 ? (
                        <div className="p-8 text-center text-text-secondary text-sm">
                          No orders for {influencer.name} matching current filter criteria.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/60 text-text-secondary text-xs uppercase tracking-wider">
                                <th className="text-left px-5 py-3 font-medium">Order ID</th>
                                <th className="text-left px-5 py-3 font-medium">Client</th>
                                <th className="text-left px-5 py-3 font-medium">Package</th>
                                <th className="text-left px-5 py-3 font-medium">Status</th>
                                <th className="text-left px-5 py-3 font-medium">Progress</th>
                                <th className="text-left px-5 py-3 font-medium">Date</th>
                                <th className="text-right px-5 py-3 font-medium">Price</th>
                                <th className="text-center px-5 py-3 font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {infOrders.map((order: any) => (
                                <tr
                                  key={order.id}
                                  className="border-b border-border/40 last:border-0 hover:bg-surface/30 transition-colors"
                                >
                                  <td className="px-5 py-3.5 font-mono text-xs">
                                    <Link
                                      href={`/admin/orders/${order.id}`}
                                      className="text-brand-light font-medium hover:underline"
                                    >
                                      #{order.id.slice(0, 8).toUpperCase()}
                                    </Link>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <p className="font-medium text-xs">{order.customer?.name ?? '—'}</p>
                                    <p className="text-[11px] text-text-secondary">{order.customer?.email}</p>
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-text-secondary">
                                    {order.package?.replace(/_/g, ' ')}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span
                                      className={cn(
                                        'text-xs px-2.5 py-0.5 rounded-full font-medium border inline-flex items-center gap-1',
                                        STATUS_STYLES[order.status] ?? 'bg-surface text-text-secondary'
                                      )}
                                    >
                                      {order.status === 'GENERATING' && <Loader2 size={10} className="animate-spin" />}
                                      {order.status?.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-xs">
                                    {order.videosOrdered > 0 ? (
                                      <div className="w-24">
                                        <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                                          <span>
                                            {order.videosDelivered}/{order.videosOrdered}
                                          </span>
                                          <span>{Math.round((order.videosDelivered / order.videosOrdered) * 100)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-brand rounded-full transition-all"
                                            style={{
                                              width: `${Math.min(100, (order.videosDelivered / order.videosOrdered) * 100)}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-text-secondary">
                                    {fmtDate(order.createdAt)}
                                  </td>
                                  <td className="px-5 py-3.5 text-right font-semibold text-xs">
                                    ${order.price?.toFixed(2)}
                                  </td>
                                  <td className="px-5 py-3.5 text-center">
                                    <Link
                                      href={`/admin/orders/${order.id}?from=${infId}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-brand-light hover:border-brand/40 transition-colors"
                                    >
                                      View Project
                                      <ArrowUpRight size={12} />
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
