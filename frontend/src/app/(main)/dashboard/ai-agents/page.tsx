'use client';

import { useLayoutEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot, Sparkles, CheckCircle2, Clock, MessageSquare,
  Search, RefreshCw, FolderOpen,
} from 'lucide-react';
import { GET_MY_HIRED_AGENTS_OVERVIEW } from '@/graphql/queries/user';
import { useAuthStore } from '@/lib/auth';

const SERVICE_TYPE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  POST_CREATION: {
    label: 'Post Creator',
    color: 'text-brand-light',
    bg: 'bg-brand/10',
    border: 'border-brand/30',
  },
  IMAGE_CREATION: {
    label: 'Image Creator',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  VIDEO_CREATION: {
    label: 'Video Creator',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  CHAT_ONLY: {
    label: 'AI Influencer',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

export default function MyAIAgentsPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  useLayoutEffect(() => {
    setMounted(true);
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  const { data, loading, refetch } = useQuery(GET_MY_HIRED_AGENTS_OVERVIEW, {
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const overview = data?.myHiredAgentsOverview;
  const rawAgents: any[] = overview?.agents ?? [];

  const filteredAgents = useMemo(() => {
    return rawAgents.filter((agent) => {
      const matchesSearch =
        !searchQuery ||
        agent.influencerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.serviceType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.bio?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || agent.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rawAgents, searchQuery, statusFilter]);

  return (
    <div className="py-2">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 rounded-xl bg-brand/10 border border-brand/20 text-brand-light">
              <Bot size={22} />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              My AI Agents
            </h1>
            <span className="ml-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-brand/15 text-brand-light border border-brand/25">
              {overview?.totalAgents || 0} Hired
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Overview of your hired AI Agents, active collaboration packages, and remaining deliverables.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={loading}
            title="Refresh Agents & Orders"
            className="p-2.5 rounded-xl border border-border bg-surface text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-brand-light' : ''} />
          </button>
          <Link
            href="/influencers"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-brand text-white font-medium text-sm shadow-lg shadow-brand/20 hover:opacity-95 transition-all"
          >
            <Sparkles size={16} />
            <span>Hire More AI Agents</span>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Agents */}
        <div className="glass-card p-5 border border-border/80 hover:border-brand/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Total AI Agents
            </span>
            <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light">
              <Bot size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text-primary">
              {overview?.totalAgents ?? 0}
            </span>
            <span className="text-xs text-brand-light font-medium">
              {overview?.activeAgents ?? 0} active
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">Hired for content creation</p>
        </div>

        {/* Remaining Orders */}
        <div className="glass-card p-5 border border-border/80 hover:border-brand/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Remaining Deliverables
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400">
              {overview?.totalRemainingOrders ?? 0}
            </span>
            <span className="text-xs text-text-secondary font-medium">deliverables left</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">Available to generate in chat</p>
        </div>

        {/* Completed Orders */}
        <div className="glass-card p-5 border border-border/80 hover:border-brand/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Completed Deliverables
            </span>
            <div className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-success">
              {overview?.totalCompletedOrders ?? 0}
            </span>
            <span className="text-xs text-text-secondary font-medium">completed</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">Delivered and ready to use</p>
        </div>

        {/* In Progress / Pending */}
        <div className="glass-card p-5 border border-border/80 hover:border-brand/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              In Progress / Pending
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Clock size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-400">
              {overview?.totalPendingOrders ?? 0}
            </span>
            <span className="text-xs text-text-secondary font-medium">in queue</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">Generating or under review</p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="glass-card p-3.5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search agents by name or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-brand/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab
                  ? 'bg-brand text-white shadow-sm shadow-brand/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background'
              }`}
            >
              {tab === 'ALL' ? 'All Agents' : tab === 'ACTIVE' ? 'Active Collaboration' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid List */}
      {(!mounted || loading) && rawAgents.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 h-56 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="glass-card p-12 text-center border border-border/80">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-4 text-brand-light">
            <Bot size={32} />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">
            {searchQuery || statusFilter !== 'ALL' ? 'No matching AI Agents found' : 'No AI Agents Hired Yet'}
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try adjusting your search terms or status filter to see other hired agents.'
              : 'Explore our catalog of AI Influencers and hire an agent to start generating posts, images, and content directly.'}
          </p>
          <Link
            href="/influencers"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-brand text-white font-medium text-sm shadow-lg shadow-brand/20 hover:opacity-95 transition-all"
          >
            <Sparkles size={16} />
            <span>Explore AI Influencers</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredAgents.map((agent) => {
            const serviceMeta = SERVICE_TYPE_LABELS[agent.serviceType || ''] || {
              label: agent.serviceType || 'AI Creator',
              color: 'text-brand-light',
              bg: 'bg-brand/10',
              border: 'border-brand/30',
            };

            const totalOrdered = agent.totalOrderedUnits || agent.totalOrders || 1;
            const totalDelivered = agent.totalDeliveredUnits || agent.completedOrders || 0;
            const pct = Math.min(100, Math.round((totalDelivered / totalOrdered) * 100));

            return (
              <motion.div
                key={agent.influencerId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 sm:p-6 border border-border/80 hover:border-brand/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {agent.avatar ? (
                        <img
                          src={agent.avatar}
                          alt={agent.influencerName}
                          className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-cover border border-border bg-surface flex-shrink-0"
                        />
                      ) : (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-surface border border-brand/30 flex items-center justify-center font-bold text-lg gradient-text flex-shrink-0">
                          {agent.influencerName?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-bold text-text-primary truncate">
                            {agent.influencerName}
                          </h3>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${serviceMeta.bg} ${serviceMeta.color} border ${serviceMeta.border}`}>
                            {serviceMeta.label}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary truncate max-w-xs">
                          {agent.bio || 'AI Creator collaborating on your custom projects.'}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 flex items-center gap-1.5 ${
                        agent.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
                      {agent.status === 'ACTIVE' ? 'Active' : 'Completed'}
                    </span>
                  </div>

                  {/* Deliverables Breakdown Box */}
                  <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-background/60 border border-border/60 mb-4">
                    {/* Remaining */}
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-400">
                        {agent.remainingOrders}
                      </p>
                      <p className="text-[11px] font-medium text-text-secondary">Remaining</p>
                    </div>
                    {/* Completed */}
                    <div className="text-center border-x border-border/60">
                      <p className="text-lg font-bold text-success">
                        {agent.completedOrders}
                      </p>
                      <p className="text-[11px] font-medium text-text-secondary">Completed</p>
                    </div>
                    {/* Pending */}
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-400">
                        {agent.pendingOrders}
                      </p>
                      <p className="text-[11px] font-medium text-text-secondary">Pending</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                      <span>Delivery Progress</span>
                      <span className="font-semibold text-text-primary">
                        {totalDelivered} / {totalOrdered} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border/60">
                      <div
                        className="h-full bg-gradient-brand transition-all duration-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3.5 border-t border-border/70 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-text-secondary">
                    Last active: {fmtDate(agent.latestOrderDate)}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* View Deliverables */}
                    <Link
                      href={`/dashboard/orders/influencer/${agent.influencerId}`}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-brand/40 text-text-secondary hover:text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <FolderOpen size={13} />
                      <span>Deliverables</span>
                    </Link>

                    {/* Chat & Create Button */}
                    <Link
                      href={`/chat/${agent.influencerId}`}
                      className="px-3.5 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shadow-brand/20"
                    >
                      <MessageSquare size={13} />
                      <span>Collaborate</span>
                    </Link>
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
