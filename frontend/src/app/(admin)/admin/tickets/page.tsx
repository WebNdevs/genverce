'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { gql } from '@apollo/client';
import {
  Send, Search, Ticket, User, Calendar, ShoppingBag,
  CheckCircle2, Clock, XCircle, AlertCircle, X, Mail,
  RotateCcw, MessageSquareDiff,
} from 'lucide-react';
import { RESOLVE_TICKET, UPDATE_TICKET_STATUS } from '@/graphql/mutations/ticket';

const GET_ALL_TICKETS = gql`
  query GetAllTickets {
    allTickets {
      id issue status resolution reopenNote createdAt updatedAt
      customer { id name email }
      order { id influencer { name } }
    }
  }
`;

const STATUS_CONFIG: Record<string, { label: string; icon: any; border: string; badge: string }> = {
  OPEN: { label: 'Open', icon: AlertCircle, border: 'border-l-error', badge: 'bg-error/10 text-error border-error/20' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock, border: 'border-l-brand', badge: 'bg-brand/10 text-brand-light border-brand/20' },
  RESOLVED: { label: 'Resolved', icon: CheckCircle2, border: 'border-l-success', badge: 'bg-success/10 text-success border-success/20' },
};

const FILTER_TABS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-text-primary">{value}</div>
      </div>
    </div>
  );
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [selected, setSelected] = useState<any | null>(null);
  const [resolution, setResolution] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });

  const fmtShort = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading, refetch } = useQuery(GET_ALL_TICKETS, { fetchPolicy: 'cache-and-network' });
  const tickets: any[] = data?.allTickets ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (q.length > 0 && q.length < 3) {
      return tickets.filter((t) =>
        statusFilter === 'ALL' || t.status === statusFilter
      );
    }

    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;

      return [
        t.id,
        t.status,
        t.issue,
        t.reopenNote,
        t.reopenNote ? 'reopened' : '',
        t.customer?.name,
        t.customer?.email,
        t.order?.influencer?.name,
      ]
        .filter(Boolean)
        .map(String)
        .some((f) => f.toLowerCase().includes(q));
    });
  }, [tickets, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tickets.length, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    tickets.forEach((t) => { if (c[t.status] !== undefined) c[t.status]++; });
    return c;
  }, [tickets]);

  const syncSelected = (updated: any) =>
    setSelected((prev: any) => (prev ? { ...prev, ...updated } : null));

  const [resolveTicket, { loading: resolving }] = useMutation(RESOLVE_TICKET, {
    onCompleted: (res) => {
      toast({ title: 'Ticket resolved!', variant: 'success' });
      setShowResolveForm(false);
      setResolution('');
      syncSelected(res.resolveTicket);
      refetch();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'error' }),
  });

  const [updateStatus, { loading: updatingStatus }] = useMutation(UPDATE_TICKET_STATUS, {
    onCompleted: (res) => {
      const label = STATUS_CONFIG[res.updateTicketStatus.status]?.label ?? res.updateTicketStatus.status;
      toast({ title: `Status updated to ${label}`, variant: 'success' });
      syncSelected(res.updateTicketStatus);
      refetch();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'error' }),
  });

  const openTicket = (ticket: any) => {
    setSelected(ticket);
    setShowResolveForm(false);
    setResolution('');
  };

  const closePanel = () => {
    setSelected(null);
    setShowResolveForm(false);
    setResolution('');
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selected) return;
    if (newStatus === 'RESOLVED') {
      setShowResolveForm(true);
    } else {
      updateStatus({ variables: { id: selected.id, status: newStatus } });
    }
  };

  return (
    <>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">Support <span className="gradient-text">Tickets</span></h1>
        <p className="text-sm text-text-secondary mt-1">
          {counts.OPEN} open · {counts.IN_PROGRESS} in progress · {counts.RESOLVED} resolved
        </p>
      </motion.div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const cfg = tab !== 'ALL' ? STATUS_CONFIG[tab] : null;
          const Icon = cfg?.icon;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors',
                statusFilter === tab
                  ? tab === 'ALL' ? 'bg-brand text-white border-brand' : cn(cfg?.badge, 'border')
                  : 'bg-background text-text-secondary border-border hover:border-brand/40 hover:text-text-primary'
              )}
            >
              {Icon && <Icon size={12} />}
              {tab === 'ALL' ? 'All' : STATUS_CONFIG[tab].label}
              <span className={cn('ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold', statusFilter === tab ? 'bg-white/20' : 'bg-surface')}>
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer, email, issue, influencer…"
          className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-14 text-center">
          <Ticket size={36} className="mx-auto text-text-secondary/30 mb-3" />
          <p className="text-text-secondary text-sm font-medium">No tickets found</p>
          <p className="text-text-secondary/50 text-xs mt-1">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket: any, i: number) => {
            const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.CLOSED;
            const StatusIcon = cfg.icon;
            const isActive = selected?.id === ticket.id;
            return (
              <motion.button
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openTicket(ticket)}
                className={cn(
                  'w-full text-left glass-card border-l-4 px-4 py-3.5 transition-all hover:shadow-md',
                  cfg.border,
                  isActive && 'ring-2 ring-brand/40'
                )}
              >
                <div className="flex items-center gap-3">
                  <StatusIcon size={16} className={cfg.badge.split(' ').find((c: string) => c.startsWith('text-'))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.badge)}>
                        {cfg.label}
                      </span>
                      <span className="text-xs font-medium text-text-primary truncate">
                        {ticket.customer?.name ?? 'Unknown user'}
                      </span>
                      {ticket.order && (
                        <span className="text-[11px] text-brand-light hidden sm:inline">
                          · {ticket.order.influencer?.name}
                        </span>
                      )}
                      {ticket.reopenNote && (
                        <span className="text-[11px] text-amber-400/80 hidden sm:inline">· Reopened</span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary truncate">{ticket.issue}</p>
                  </div>
                  <span className="text-[11px] text-text-secondary/60 flex-shrink-0 hidden sm:block">
                    {new Date(ticket.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', timeZone: 'UTC',
                    })}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (() => {
          const cfg = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.CLOSED;
          const StatusIcon = cfg.icon;
          return (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40"
                onClick={closePanel}
              />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-background border-l border-border z-50 flex flex-col shadow-2xl"
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center">
                      <Ticket size={17} className="text-brand-light" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Ticket Details</p>
                      <p className="text-[11px] text-text-secondary font-mono">{selected.id.slice(0, 12)}…</p>
                    </div>
                  </div>
                  <button
                    onClick={closePanel}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* Status banner */}
                  <div className={cn('flex items-center gap-2.5 px-4 py-3 rounded-xl border', cfg.badge)}>
                    <StatusIcon size={16} />
                    <span className="font-semibold text-sm">{cfg.label}</span>
                    <span className="ml-auto text-[11px] opacity-70">
                      Updated {fmtShort(selected.updatedAt ?? selected.createdAt)}
                    </span>
                  </div>

                  {/* Status controls */}
                  <div className="glass-card p-4">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Change Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => {
                        const sCfg = STATUS_CONFIG[s];
                        const SIcon = sCfg.icon;
                        const isCurrent = selected.status === s;
                        return (
                          <button
                            key={s}
                            disabled={isCurrent || updatingStatus || resolving}
                            onClick={() => handleStatusChange(s)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              isCurrent
                                ? cn(sCfg.badge, 'border cursor-default')
                                : 'border-border text-text-secondary hover:border-brand/40 hover:text-text-primary disabled:opacity-40'
                            )}
                          >
                            <SIcon size={12} />
                            {isCurrent ? `${sCfg.label} (current)` : sCfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="glass-card p-4 space-y-3">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Customer</p>
                    <DetailRow icon={User} label="Name" value={selected.customer?.name ?? '—'} />
                    <DetailRow icon={Mail} label="Email" value={<span className="text-brand-light">{selected.customer?.email ?? '—'}</span>} />
                    <DetailRow icon={Calendar} label="Submitted" value={fmtDate(selected.createdAt)} />
                    {selected.order && (
                      <DetailRow icon={ShoppingBag} label="Related Order" value={
                        <span className="px-2 py-0.5 bg-brand/10 border border-brand/20 rounded text-brand-light text-xs">
                          {selected.order.influencer?.name}
                        </span>
                      } />
                    )}
                  </div>

                  {/* Issue */}
                  <div className="glass-card p-4">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Issue / Requirement</p>
                    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap bg-background border border-border rounded-lg px-4 py-3">
                      {selected.issue}
                    </p>
                  </div>

                  {/* Reopen note */}
                  {selected.reopenNote && (
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <RotateCcw size={13} className="text-amber-400" />
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Customer Reopen Request</p>
                      </div>
                      <div className="flex gap-3 bg-amber-400/8 border border-amber-400/20 rounded-xl px-4 py-3">
                        <MessageSquareDiff size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.reopenNote}</p>
                      </div>
                    </div>
                  )}

                  {/* Existing resolution */}
                  {selected.resolution && (
                    <div className="glass-card p-4">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Resolution</p>
                      <div className="flex gap-3 bg-success/8 border border-success/20 rounded-xl px-4 py-3">
                        <CheckCircle2 size={16} className="text-success flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected.resolution}</p>
                      </div>
                    </div>
                  )}

                  {/* Respond & Resolve form */}
                  {selected.status !== 'RESOLVED' && (
                    <div className="glass-card p-4">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Admin Response</p>
                      {showResolveForm ? (
                        <div className="space-y-3">
                          <textarea
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            rows={4}
                            autoFocus
                            placeholder="Write your response or resolution here…"
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none leading-relaxed"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => resolveTicket({ variables: { id: selected.id, resolution } })}
                              disabled={!resolution.trim() || resolving}
                              className="flex items-center gap-2 btn-brand text-sm px-5 py-2.5 disabled:opacity-50"
                            >
                              <Send size={14} /> {resolving ? 'Sending…' : 'Resolve Ticket'}
                            </button>
                            <button
                              onClick={() => { setShowResolveForm(false); setResolution(''); }}
                              className="btn-ghost text-sm px-4 py-2.5"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowResolveForm(true)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-brand/30 text-brand-light text-sm font-medium hover:border-brand/60 hover:bg-brand/5 transition-colors"
                        >
                          <Send size={15} /> Respond &amp; Resolve
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
