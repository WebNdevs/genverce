'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle, DollarSign, Package, Film, Image, Edit,
  FileText, MessageCircle, CalendarDays, Layers, Truck, BadgeCheck,
  User, Star,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { GET_ORDER } from '@/graphql/queries/order';
import { ADMIN_UPDATE_ORDER } from '@/graphql/mutations/order';
import { toast } from '@/components/ui/toaster';
import { APPROVE_ORDER } from '@/graphql/mutations/order';

// ─── Constants ────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'PENDING_PAYMENT' | 'PAID' | 'GENERATING' | 'PENDING_REVIEW'
  | 'APPROVED' | 'DELIVERED' | 'REJECTED' | 'REFUNDED' | 'CANCELLED';

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-yellow-500/10 text-yellow-400',
  PAID:            'bg-blue-500/10 text-blue-400',
  GENERATING:      'bg-purple-500/10 text-purple-400',
  PENDING_REVIEW:  'bg-orange-500/10 text-orange-400',
  APPROVED:        'bg-teal-500/10 text-teal-400',
  DELIVERED:       'bg-success/10 text-success',
  REJECTED:        'bg-error/10 text-error',
  REFUNDED:        'bg-error/10 text-error',
  CANCELLED:       'bg-gray-500/10 text-gray-400',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID:            'Paid',
  GENERATING:      'Generating',
  PENDING_REVIEW:  'Pending Review',
  APPROVED:        'Approved',
  DELIVERED:       'Delivered',
  REJECTED:        'Rejected',
  REFUNDED:        'Refunded',
  CANCELLED:       'Cancelled',
};

const PACKAGE_LABEL: Record<string, string> = {
  SINGLE: 'Single', PACK_5: 'Pack 5', PACK_10: 'Pack 10',
  MONTHLY_STARTER: 'Monthly Starter', MONTHLY_GROWTH: 'Monthly Growth', CUSTOM: 'Custom',
};

const SERVICE_LABEL: Record<string, string> = {
  CHAT_ONLY: 'Chat Only', VIDEO_CREATION: 'Create Video',
  POST_CREATION: 'Create Post', IMAGE_CREATION: 'Create Images',
};

const SERVICE_META: Record<string, { Icon: React.ElementType; singular: string; plural: string }> = {
  VIDEO_CREATION: { Icon: Film,          singular: 'Video',  plural: 'Videos'  },
  POST_CREATION:  { Icon: FileText,      singular: 'Post',   plural: 'Posts'   },
  IMAGE_CREATION: { Icon: Image,         singular: 'Image',  plural: 'Images'  },
  CHAT_ONLY:      { Icon: MessageCircle, singular: 'Chat',   plural: 'Chats'   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toBriefObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toGeneratedImageInputList(list: any[]) {
  return (Array.isArray(list) ? list : [])
    .map((x: any) => {
      const raw = x && typeof x === 'object' ? x : {};
      const { __typename, ...rest } = raw as any;
      const url = typeof rest.url === 'string' ? rest.url : String(rest.url ?? '');
      const messageId = typeof rest.messageId === 'string' ? rest.messageId : String(rest.messageId ?? '');
      const createdAt = typeof rest.createdAt === 'string' ? rest.createdAt : String(rest.createdAt ?? '');
      const deliveredAt = rest.deliveredAt ?? null;
      const delivered = typeof rest.delivered === 'boolean' ? rest.delivered : null;
      return {
        url,
        messageId,
        createdAt: createdAt || new Date().toISOString(),
        delivered,
        deliveredAt,
      };
    })
    .filter((x: any) => x.url && x.messageId);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id }         = useParams<{ id: string }>();
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading, refetch } = useQuery(GET_ORDER, { variables: { id } });
  const order = data?.order;
  const [adminUpdateOrder, { loading: saving }] = useMutation(ADMIN_UPDATE_ORDER, {
    onCompleted: () => {
      toast({ title: 'Project updated', variant: 'success' });
      refetch();
    },
    onError: (e) => {
      toast({ title: 'Failed to update project', description: e.message, variant: 'error' });
    },
  });
  const [approveOrder, { loading: approving }] = useMutation(APPROVE_ORDER, {
    onCompleted: () => {
      toast({ title: 'Marked as delivered', variant: 'success' });
      refetch();
    },
    onError: (e) => {
      toast({ title: 'Failed to mark delivered', description: e.message, variant: 'error' });
    },
  });

  // Back link — prefer coming from influencer dashboard
  const fromInfluencer = searchParams.get('from');
  const backHref  = fromInfluencer
    ? `/admin/influencers/${fromInfluencer}`
    : '/admin/orders';
  const backLabel = fromInfluencer ? 'Back to Dashboard' : 'Back to Orders';

  const serviceType = order?.influencer?.serviceType ?? 'VIDEO_CREATION';
  const meta        = SERVICE_META[serviceType] ?? SERVICE_META.VIDEO_CREATION;
  const brief       = useMemo(() => toBriefObject(order?.projectBrief), [order?.id, order?.projectBrief]);
  const posterPlan = brief?.posterPlan && typeof brief.posterPlan === 'object' ? (brief.posterPlan as any) : null;
  const posterEntries: any[] = Array.isArray(posterPlan?.posters) ? posterPlan.posters : [];
  type GeneratedImage = { url: string; messageId: string; createdAt: string; delivered?: boolean | null; deliveredAt?: string | null };
  const generatedImages: GeneratedImage[] = Array.isArray(order?.generatedImages)
    ? (order.generatedImages as GeneratedImage[])
    : [];
  const deliveredCount = generatedImages.filter((x) => x.delivered === true).length;
  const totalImages = generatedImages.length;
  const pct = (() => {
    const delivered = serviceType === 'IMAGE_CREATION' ? deliveredCount : (order?.videosDelivered ?? 0);
    const total = serviceType === 'IMAGE_CREATION' ? totalImages : (order?.videosOrdered ?? 0);
    if (!total) return 0;
    return Math.min(100, Math.round((delivered / total) * 100));
  })();
  const [editImagesOpen, setEditImagesOpen] = useState(false);
  const [imagesDraft, setImagesDraft] = useState<GeneratedImage[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [posterDrafts, setPosterDrafts] = useState<
    Array<{ id: string; index: number; requirementsText: string; optimizedPrompt: string; scheduleText: string }>
  >([]);
  const initialBrief = useMemo(() => {
    const b: Record<string, unknown> = brief && typeof brief === 'object' ? (brief as Record<string, unknown>) : {};
    const inclusionsRaw = b.inclusions;
    const inclusions = Array.isArray(inclusionsRaw)
      ? inclusionsRaw.filter((x): x is string => typeof x === 'string')
      : [];
    return {
      productName: typeof b.productName === 'string' ? b.productName : '',
      keyMessage: typeof b.keyMessage === 'string' ? b.keyMessage : '',
      targetAudience: typeof b.targetAudience === 'string' ? b.targetAudience : '',
      tone: typeof b.tone === 'string' ? b.tone : '',
      inclusionsText: inclusions.join(', '),
      additionalNotes: typeof b.additionalNotes === 'string' ? b.additionalNotes : '',
    };
  }, [order?.id]);

  const [form, setForm] = useState(() => initialBrief);
  const [status, setStatus] = useState<OrderStatus>('PAID');
  const [price, setPrice] = useState<string>('');

  useEffect(() => {
    if (!order) return;
    setForm(initialBrief);
    setStatus((order.status as OrderStatus) || 'PAID');
    setPrice(typeof order.price === 'number' ? String(order.price) : '');
    setImagesDraft(generatedImages);
    const posters = Array.isArray((brief as any)?.posterPlan?.posters) ? (brief as any).posterPlan.posters : [];
    setPosterDrafts(
      posters.map((p: any, i: number) => ({
        id: String(p?.id || `poster-${i + 1}`),
        index: Number(p?.index || i + 1),
        requirementsText: JSON.stringify(p?.requirements ?? {}, null, 2),
        optimizedPrompt: String(p?.optimizedPrompt ?? ''),
        scheduleText: String(p?.requirements?.schedule ?? p?.schedule?.raw ?? ''),
      })),
    );
  }, [order?.id]);

  return (
    <div className="max-w-3xl mx-auto">

      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref}
          className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="text-sm text-text-secondary">{backLabel}</span>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      ) : !order ? (
        <div className="glass-card p-12 text-center">
          <Package size={40} className="mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary">Project not found.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-6">

          {/* ── Header card ── */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">
                  {brief.productName ?? 'Project Details'}
                </h1>
                <p className="text-sm text-text-secondary mt-0.5">
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </p>
                  <p className="text-xs text-text-secondary/60 mt-1">
                    {order.deliveredAt ? `Delivered: ${fmtDate(order.deliveredAt)}` : 'Not delivered yet'}
                  </p>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-2"
              >
                <Edit size={14} /> Edit Project
              </button>
              {serviceType === 'IMAGE_CREATION' ? (
                totalImages > 0 && deliveredCount < totalImages && (
                  <button
                    disabled={saving}
                    onClick={() => {
                      const nowIso = new Date().toISOString();
                      const next = generatedImages.map((x) => ({
                        ...x,
                        delivered: true,
                        deliveredAt: x.deliveredAt || nowIso,
                      }));
                      adminUpdateOrder({ variables: { input: { id: order.id, generatedImages: toGeneratedImageInputList(next) } } });
                    }}
                    className="btn-brand flex items-center gap-1.5 text-sm px-3 py-2 disabled:opacity-60"
                  >
                    <BadgeCheck size={14} /> {saving ? 'Marking…' : 'Mark All Delivered'}
                  </button>
                )
              ) : (
                !order.deliveredAt && (
                  <button
                    disabled={approving}
                    onClick={() => approveOrder({ variables: { id: order.id } })}
                    className="btn-brand flex items-center gap-1.5 text-sm px-3 py-2 disabled:opacity-60"
                  >
                    <BadgeCheck size={14} /> {approving ? 'Marking…' : 'Mark Delivered'}
                  </button>
                )
              )}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status as OrderStatus] ?? 'bg-gray-500/10 text-gray-400'}`}>
                  {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand-light flex items-center gap-1.5">
                  <meta.Icon size={11} />
                  {SERVICE_LABEL[serviceType] ?? serviceType}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface text-text-secondary">
                  {PACKAGE_LABEL[order.package] ?? order.package}
                </span>
              </div>
            </div>

            {/* Delivery metric */}
            <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand/10 flex-shrink-0">
                <meta.Icon size={22} className="text-brand-light" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-secondary">
                  {serviceType === 'IMAGE_CREATION' ? 'Images Delivered' : `${meta.plural} Delivered`}
                </p>
                <p className="text-2xl font-bold">
                  {serviceType === 'IMAGE_CREATION' ? deliveredCount : order.videosDelivered}
                  <span className="text-base font-normal text-text-secondary">
                    {' '}
                    / {serviceType === 'IMAGE_CREATION' ? totalImages : order.videosOrdered}
                  </span>
                </p>
              </div>
              {(serviceType === 'IMAGE_CREATION' ? totalImages : order.videosOrdered) > 0 && (
                <div className="flex-1">
                  <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-brand transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1 text-right">{pct}% complete</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Details grid ── */}
          <div className="glass-card p-6">
            <Section title="Project Info">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                <InfoRow label="Price" value={
                  <span className="flex items-center gap-1">
                    <DollarSign size={12} className="text-text-secondary" />
                    {order.price?.toFixed(2)}
                  </span>
                } />
                <InfoRow label="Package" value={
                  <span className="flex items-center gap-1.5">
                    <Layers size={12} className="text-text-secondary" />
                    {PACKAGE_LABEL[order.package] ?? order.package}
                  </span>
                } />
                <InfoRow label="Delivery Type" value={
                  <span className="flex items-center gap-1.5">
                    <Truck size={12} className="text-text-secondary" />
                    {order.deliveryType === 'QUALITY_CHECKED' ? 'Quality Checked' : 'Instant'}
                  </span>
                } />
                <InfoRow label="Created" value={
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={12} className="text-text-secondary" />
                    {fmtDate(order.createdAt)}
                  </span>
                } />
                <InfoRow label="Delivered" value={
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck size={12} className={order.deliveredAt ? 'text-success' : 'text-text-secondary'} />
                    {fmtDate(order.deliveredAt)}
                  </span>
                } />
                <InfoRow label="AI Disclosure" value={
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={12} className={order.aiDisclosure ? 'text-success' : 'text-error'} />
                    {order.aiDisclosure ? 'Confirmed' : 'Not confirmed'}
                  </span>
                } />
              </div>
            </Section>
          </div>

          {/* ── Influencer + Client ── */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Influencer */}
            {order.influencer && (
              <div className="glass-card p-5 space-y-3">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Influencer</h3>
                <Link href={`/admin/influencers/${order.influencer.id}`}
                  className="flex items-center gap-3 group">
                  <img src={order.influencer.avatar} alt={order.influencer.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-brand/20 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm group-hover:text-brand-light transition-colors truncate">
                      {order.influencer.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {SERVICE_LABEL[order.influencer.serviceType] ?? order.influencer.serviceType}
                    </p>
                    {order.influencer.industries?.slice(0, 2).map((ind: string) => (
                      <span key={ind} className="inline-block mr-1 mt-1 px-1.5 py-0.5 bg-brand/10 text-brand-light rounded text-[10px]">
                        {ind}
                      </span>
                    ))}
                  </div>
                </Link>
              </div>
            )}

            {/* Client */}
            {order.customer && (
              <div className="glass-card p-5 space-y-3">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Client</h3>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-background border border-border flex items-center justify-center font-bold gradient-text text-sm flex-shrink-0">
                    {order.customer.name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{order.customer.name}</p>
                    <p className="text-xs text-text-secondary truncate">{order.customer.email}</p>
                    {order.customer.company && (
                      <p className="text-xs text-text-secondary/60 truncate">{order.customer.company}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Project brief ── */}
          {brief.productName && (
            <div className="glass-card p-6 space-y-4">
              <Section title="Project Brief">
                <div className="space-y-4">
                  {[
                    { label: 'Product / Project', value: brief.productName },
                    { label: 'Key Message',        value: brief.keyMessage },
                    { label: 'Target Audience',    value: brief.targetAudience },
                    { label: 'Tone',               value: brief.tone },
                    { label: 'Additional Notes',   value: brief.additionalNotes },
                  ].map(({ label, value }) => value ? (
                    <InfoRow key={label} label={label} value={value} />
                  ) : null)}
                  {brief.inclusions?.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Inclusions</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(brief.inclusions) ? brief.inclusions : [brief.inclusions]).map((inc: string) => (
                          <span key={inc} className="px-2 py-0.5 bg-brand/10 text-brand-light rounded text-xs">{inc}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* ── Complete Client Data + Prompts ── */}
          <div className="glass-card p-6 space-y-4">
            <Section title="Client Data & Generated Prompts">
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface/40 p-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                    Generated Prompts ({posterEntries.length})
                  </p>
                  {posterEntries.length === 0 ? (
                    <p className="text-sm text-text-secondary">No saved prompts for this project yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {posterEntries.map((p: any, idx: number) => (
                        <div key={String(p?.id || idx)} className="rounded-lg border border-border/70 bg-background/60 p-3">
                          <p className="text-xs text-brand-light font-medium mb-2">
                            Poster {p?.index || idx + 1} {p?.schedule?.nextRunAt ? `• Next: ${fmtDate(p.schedule.nextRunAt)}` : ''}
                          </p>
                          <p className="text-[11px] text-text-secondary uppercase tracking-wide mb-1">Requirements</p>
                          <pre className="text-xs whitespace-pre-wrap break-words text-text-secondary/90 mb-2">
{JSON.stringify(p?.requirements ?? {}, null, 2)}
                          </pre>
                          <p className="text-[11px] text-text-secondary uppercase tracking-wide mb-1">Optimized Prompt</p>
                          <pre className="text-xs whitespace-pre-wrap break-words">
{String(p?.optimizedPrompt || '—')}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </div>

          {/* ── Review notes ── */}
          {order.reviewNotes && (
            <div className="p-4 rounded-xl bg-error/5 border border-error/20">
              <p className="text-xs font-semibold text-error mb-1">Review Notes</p>
              <p className="text-sm text-text-secondary">{order.reviewNotes}</p>
              {order.reviewedBy && (
                <p className="text-[11px] text-text-secondary/60 mt-1">
                  Reviewed by {order.reviewedBy} · {fmtDate(order.reviewedAt)}
                </p>
              )}
            </div>
          )}

          {/* ── Generated images (saved in uploads) ── */}
          {generatedImages.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <Section title="Generated Images">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => { setImagesDraft(generatedImages); setEditImagesOpen(true); }}
                    className="btn-ghost text-sm px-3 py-2"
                  >
                    Edit Images
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generatedImages.map((img) => (
                    <div
                      key={img.messageId}
                      className="rounded-xl border border-border overflow-hidden hover:border-brand/40 transition-colors bg-surface"
                    >
                      <a href={img.url} target="_blank" rel="noreferrer" className="block">
                        <img src={img.url} alt="Generated" className="w-full h-56 object-cover" />
                      </a>
                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-text-secondary truncate">
                          {fmtDate(img.createdAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${img.delivered ? 'text-success' : 'text-text-secondary'}`}>
                            {img.delivered ? 'Delivered' : 'Pending'}
                          </span>
                          <button
                            disabled={saving}
                            onClick={() => {
                              const nowIso = new Date().toISOString();
                              const next = generatedImages.map((x) =>
                                x.messageId === img.messageId
                                  ? { ...x, delivered: !x.delivered, deliveredAt: !x.delivered ? nowIso : null }
                                  : x,
                              );
                              adminUpdateOrder({ variables: { input: { id: order.id, generatedImages: toGeneratedImageInputList(next) } } });
                            }}
                            className="text-xs text-brand-light hover:underline disabled:opacity-60"
                          >
                            {img.delivered ? 'Undo' : 'Mark Delivered'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

        </motion.div>
      )}

      {editOpen && order && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <h2 className="font-semibold text-base">Edit Project</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  >
                    {Object.keys(STATUS_LABEL).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s as OrderStatus]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Price (USD)</label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Product / Project Name</label>
                  <input
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tone</label>
                  <input
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Key Message</label>
                <input
                  value={form.keyMessage}
                  onChange={(e) => setForm({ ...form, keyMessage: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Target Audience</label>
                <input
                  value={form.targetAudience}
                  onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Inclusions (comma-separated)</label>
                <input
                  value={form.inclusionsText}
                  onChange={(e) => setForm({ ...form, inclusionsText: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Additional Notes</label>
                <textarea
                  value={form.additionalNotes}
                  onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand resize-none"
                />
              </div>

              {posterDrafts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Poster Data & Prompts</p>
                  {posterDrafts.map((p, idx) => (
                    <div key={p.id} className="rounded-xl border border-border p-3 bg-surface/30 space-y-2">
                      <p className="text-xs font-medium text-brand-light">Poster {p.index || idx + 1}</p>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Schedule (day/date + time + timezone)</label>
                        <input
                          value={p.scheduleText}
                          onChange={(e) =>
                            setPosterDrafts((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, scheduleText: e.target.value } : x)),
                            )
                          }
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Requirements (JSON)</label>
                        <textarea
                          rows={5}
                          value={p.requirementsText}
                          onChange={(e) =>
                            setPosterDrafts((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, requirementsText: e.target.value } : x)),
                            )
                          }
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-brand font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Optimized Prompt</label>
                        <textarea
                          rows={7}
                          value={p.optimizedPrompt}
                          onChange={(e) =>
                            setPosterDrafts((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, optimizedPrompt: e.target.value } : x)),
                            )
                          }
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setEditOpen(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => {
                    const inclusions = form.inclusionsText
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const parsedPrice = price.trim() ? Number(price) : undefined;
                    const existingBrief = toBriefObject(order.projectBrief);
                    const existingPlan =
                      existingBrief?.posterPlan && typeof existingBrief.posterPlan === 'object'
                        ? { ...(existingBrief.posterPlan as any) }
                        : null;
                    let nextPosterPlan = existingPlan;
                    if (existingPlan && Array.isArray(existingPlan.posters) && posterDrafts.length > 0) {
                      const sourcePosters = existingPlan.posters as any[];
                      const draftById = new Map(posterDrafts.map((x) => [String(x.id), x]));
                      nextPosterPlan = {
                        ...existingPlan,
                        posters: sourcePosters.map((src: any, idx: number) => {
                          const key = String(src?.id || `poster-${idx + 1}`);
                          const d = draftById.get(key);
                          if (!d) return src;
                          let parsedReq: any = src?.requirements && typeof src.requirements === 'object' ? { ...src.requirements } : {};
                          try {
                            const req = JSON.parse(d.requirementsText || '{}');
                            parsedReq = req && typeof req === 'object' ? req : parsedReq;
                          } catch {}
                          if (d.scheduleText && d.scheduleText.trim()) {
                            parsedReq.schedule = d.scheduleText.trim();
                          }
                          return {
                            ...src,
                            requirements: parsedReq,
                            optimizedPrompt: d.optimizedPrompt,
                            // Let backend scheduler recompute nextRunAt from updated raw schedule text.
                            schedule: undefined,
                          };
                        }),
                        updatedAt: new Date().toISOString(),
                      };
                    }
                    adminUpdateOrder({
                      variables: {
                        input: {
                          id: order.id,
                          status,
                          ...(typeof parsedPrice === 'number' && !Number.isNaN(parsedPrice) ? { price: parsedPrice } : {}),
                          projectBrief: {
                            productName: form.productName.trim() || 'AI Influencer Project',
                            keyMessage: form.keyMessage.trim(),
                            targetAudience: form.targetAudience.trim(),
                            tone: form.tone.trim(),
                            inclusions,
                            additionalNotes: form.additionalNotes.trim() || null,

                            ...(nextPosterPlan
                              ? { posterPlan: JSON.stringify(nextPosterPlan) }
                              : {}),
                          },
                        },
                      },
                    }).then(() => setEditOpen(false));
                  }}
                  className="btn-brand px-4 py-2 text-sm disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editImagesOpen && order && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditImagesOpen(false); }}
        >
          <div className="bg-background border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <h2 className="font-semibold text-base">Edit Images</h2>
              <button
                onClick={() => setEditImagesOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {imagesDraft.length === 0 ? (
                <p className="text-sm text-text-secondary">No images saved for this project yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imagesDraft.map((img) => (
                    <div key={img.messageId} className="rounded-xl border border-border overflow-hidden bg-surface">
                      <img src={img.url} alt="Generated" className="w-full h-56 object-cover" />
                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-text-secondary truncate">{fmtDate(img.createdAt)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const nowIso = new Date().toISOString();
                              setImagesDraft(
                                imagesDraft.map((x) =>
                                  x.messageId === img.messageId
                                    ? { ...x, delivered: !x.delivered, deliveredAt: !x.delivered ? nowIso : null }
                                    : x,
                                ),
                              );
                            }}
                            className="text-xs text-brand-light hover:underline"
                          >
                            {img.delivered ? 'Undo' : 'Mark Delivered'}
                          </button>
                          <button
                            onClick={() => setImagesDraft(imagesDraft.filter((x) => x.messageId !== img.messageId))}
                            className="text-xs text-error hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setEditImagesOpen(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => {
                    adminUpdateOrder({
                      variables: {
                        input: {
                          id: order.id,
                          generatedImages: toGeneratedImageInputList(imagesDraft),
                        },
                      },
                    }).then(() => setEditImagesOpen(false));
                  }}
                  className="btn-brand px-4 py-2 text-sm disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
