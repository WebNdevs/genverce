'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Send, RotateCcw, MessageSquareDiff, X, Plus } from 'lucide-react';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
import { CREATE_TICKET, REOPEN_TICKET } from '@/graphql/mutations/ticket';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const GET_MY_TICKETS = gql`
  query GetMyTickets {
    myTickets {
      id
      orderId
      issue
      status
      resolution
      reopenNote
      createdAt
      updatedAt
      order {
        id
        influencer { name }
      }
    }
  }
`;

const STATUS_STYLES: Record<string, { label: string; badge: string }> = {
  OPEN:        { label: 'Open',        badge: 'bg-error/10 text-error border-error/20' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-brand/10 text-brand-light border-brand/20' },
  RESOLVED:    { label: 'Resolved',    badge: 'bg-success/10 text-success border-success/20' },
  CLOSED:      { label: 'Closed',      badge: 'bg-surface text-text-secondary border-border' },
};

type ReopenMode = 'reopen' | 'changes';

function SearchParamsReader({ onOrderId }: { onOrderId: (id: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams?.get('orderId') || '';
    if (id) onOrderId(id);
  }, [searchParams]);
  return null;
}

export default function TicketsPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });

  const [issue, setIssue] = useState('');
  const [orderId, setOrderId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [reopenTicketId, setReopenTicketId] = useState<string | null>(null);
  const [reopenMode, setReopenMode] = useState<ReopenMode>('reopen');
  const [reopenNote, setReopenNote] = useState('');

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const { data: ordersData } = useQuery(GET_MY_ORDERS);
  const { data: ticketsData, loading, refetch } = useQuery(GET_MY_TICKETS);

  const tickets = ticketsData?.myTickets ?? [];
  const orders = ordersData?.myOrders ?? [];

  const [createTicket, { loading: submitting }] = useMutation(CREATE_TICKET, {
    onCompleted: () => {
      toast({ title: 'Ticket submitted!', description: 'Our team will respond shortly.', variant: 'success' });
      setIssue('');
      setOrderId('');
      setShowForm(false);
      refetch();
    },
    onError: (e) => toast({ title: 'Failed to submit ticket', description: e.message, variant: 'error' }),
  });

  const [reopenTicketMutation, { loading: reopening }] = useMutation(REOPEN_TICKET, {
    onCompleted: () => {
      toast({ title: 'Ticket reopened', description: 'Our team will review your request.', variant: 'success' });
      setReopenTicketId(null);
      setReopenNote('');
      refetch();
    },
    onError: (e) => toast({ title: 'Failed to reopen ticket', description: e.message, variant: 'error' }),
  });

  const openReopenForm = (id: string, mode: ReopenMode) => {
    setReopenTicketId(id);
    setReopenMode(mode);
    setReopenNote('');
  };

  return (
    <div className="py-2">
      <Suspense fallback={null}>
        <SearchParamsReader onOrderId={(id) => { setOrderId(id); setShowForm(true); }} />
      </Suspense>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            Support <span className="gradient-text">Tickets</span>
          </h1>
          <p className="text-sm text-text-secondary">Raise issues and track resolutions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-brand flex items-center gap-2 flex-shrink-0 text-sm px-3 py-2 sm:px-4"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New Ticket</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* New ticket form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 sm:p-6 mb-6"
          >
            <h2 className="text-base sm:text-lg font-semibold mb-4">Raise a Ticket</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Related Order <span className="font-normal text-text-secondary/60">(optional)</span>
                </label>
                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                >
                  <option value="">General inquiry</option>
                  {orders.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.influencer?.name} — {o.package?.replace(/_/g, ' ')} —{' '}
                      {new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'UTC' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Issue Description <span className="text-error">*</span>
                </label>
                <textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  rows={4}
                  placeholder="Describe your issue in detail..."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => createTicket({ variables: { issue, orderId: orderId || undefined } })}
                  disabled={!issue.trim() || submitting}
                  className="btn-brand flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <Send size={15} /> {submitting ? 'Submitting…' : 'Submit Ticket'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tickets list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Ticket size={36} className="text-brand/30 mx-auto mb-3" />
          <p className="text-text-secondary">No tickets yet. We hope everything is smooth!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const style = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.CLOSED;
            const isReopening = reopenTicketId === ticket.id;

            return (
              <motion.div key={ticket.id} layout className="glass-card overflow-hidden">
                <div className="p-4 sm:p-5">
                  {/* Ticket header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      {ticket.order && (
                        <p className="text-xs text-brand-light mb-1 truncate">
                          {ticket.order.influencer?.name}
                        </p>
                      )}
                      <p className="text-sm text-text-primary leading-relaxed">{ticket.issue}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                      <span className={cn('inline-block text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap', style.badge)}>
                        {style.label}
                      </span>
                      <p className="text-xs text-text-secondary whitespace-nowrap">{fmtDate(ticket.createdAt)}</p>
                    </div>
                  </div>

                  {/* Reopen note */}
                  {ticket.reopenNote && ticket.status !== 'RESOLVED' && (
                    <div className="mt-3 p-3 bg-brand/5 border border-brand/20 rounded-lg">
                      <p className="text-xs text-brand-light font-medium mb-1">Your Reopen Request</p>
                      <p className="text-sm text-text-secondary">{ticket.reopenNote}</p>
                    </div>
                  )}

                  {/* Resolution */}
                  {ticket.resolution && (
                    <div className="mt-3 p-3 bg-success/10 border border-success/20 rounded-lg">
                      <p className="text-xs text-success font-medium mb-1">Admin Response</p>
                      <p className="text-sm text-text-secondary">{ticket.resolution}</p>
                    </div>
                  )}

                  {/* Reopen / Request Changes — only for RESOLVED tickets */}
                  {ticket.status === 'RESOLVED' && !isReopening && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => openReopenForm(ticket.id, 'reopen')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand/30 text-brand-light hover:bg-brand/10 transition-colors"
                      >
                        <RotateCcw size={13} /> Reopen
                      </button>
                      <button
                        onClick={() => openReopenForm(ticket.id, 'changes')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/30 transition-colors"
                      >
                        <MessageSquareDiff size={13} /> Request Changes
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline reopen form */}
                <AnimatePresence>
                  {isReopening && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="p-4 sm:p-5 bg-surface/40">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-text-primary">
                            {reopenMode === 'reopen'
                              ? 'Why are you reopening this ticket?'
                              : 'What changes do you need?'}
                          </p>
                          <button
                            onClick={() => setReopenTicketId(null)}
                            className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <textarea
                          value={reopenNote}
                          onChange={(e) => setReopenNote(e.target.value)}
                          rows={3}
                          autoFocus
                          placeholder={
                            reopenMode === 'reopen'
                              ? 'The issue is still occurring because…'
                              : 'I need the following changes to the resolution…'
                          }
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none mb-3"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => reopenTicketMutation({ variables: { id: ticket.id, note: reopenNote } })}
                            disabled={!reopenNote.trim() || reopening}
                            className="flex items-center gap-2 btn-brand text-sm px-4 py-2 disabled:opacity-50"
                          >
                            <RotateCcw size={14} />
                            {reopening
                              ? 'Submitting…'
                              : reopenMode === 'reopen'
                              ? 'Reopen Ticket'
                              : 'Submit Request'}
                          </button>
                          <button
                            onClick={() => setReopenTicketId(null)}
                            className="btn-ghost text-sm px-4 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
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
