'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Edit, ArrowLeft, Plus, X, ChevronDown, Check, Trash2,
  CheckCircle, Clock, XCircle, BarChart2, DollarSign, Package,
  MessageSquare, Search, User, Film, Image, FileText, MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { GET_INFLUENCER_ORDERS } from '@/graphql/queries/order';
import { GET_ALL_USERS } from '@/graphql/queries/user';
import { GET_INFLUENCER_CHATS } from '@/graphql/queries/chat';
import { ADMIN_CREATE_ORDER } from '@/graphql/mutations/order';
import {
  CREATE_INFLUENCER_PACKAGE,
  UPDATE_INFLUENCER_PACKAGE,
  DELETE_INFLUENCER_PACKAGE,
} from '@/graphql/mutations/influencer';
import { toast } from '@/components/ui/toaster';

// ─── Constants ────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'PENDING_PAYMENT' | 'PAID' | 'GENERATING' | 'PENDING_REVIEW'
  | 'APPROVED' | 'DELIVERED' | 'REJECTED' | 'REFUNDED' | 'CANCELLED';

const ONGOING_STATUSES: OrderStatus[] = ['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED'];
const COMPLETED_STATUSES: OrderStatus[] = ['DELIVERED'];
const CANCELLED_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED', 'REJECTED'];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-yellow-500/10 text-yellow-400',
  PAID: 'bg-blue-500/10 text-blue-400',
  GENERATING: 'bg-purple-500/10 text-purple-400',
  PENDING_REVIEW: 'bg-orange-500/10 text-orange-400',
  APPROVED: 'bg-teal-500/10 text-teal-400',
  DELIVERED: 'bg-success/10 text-success',
  REJECTED: 'bg-error/10 text-error',
  REFUNDED: 'bg-error/10 text-error',
  CANCELLED: 'bg-gray-500/10 text-gray-400',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  GENERATING: 'Generating',
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

const PACKAGE_LABEL: Record<string, string> = {
  SINGLE: 'Single', PACK_5: 'Pack 5', PACK_10: 'Pack 10',
  MONTHLY_STARTER: 'Monthly Starter', MONTHLY_GROWTH: 'Monthly Growth', CUSTOM: 'Custom',
};

const SERVICE_LABEL: Record<string, string> = {
  CHAT_ONLY: 'Chat Only', VIDEO_CREATION: 'Create Video',
  POST_CREATION: 'Create Post', IMAGE_CREATION: 'Create Images',
};

// Maps serviceType → { icon, singular, plural, deliveredField }
const SERVICE_META: Record<string, { Icon: React.ElementType; singular: string; plural: string }> = {
  VIDEO_CREATION: { Icon: Film, singular: 'Video', plural: 'Videos' },
  POST_CREATION: { Icon: FileText, singular: 'Post', plural: 'Posts' },
  IMAGE_CREATION: { Icon: Image, singular: 'Image', plural: 'Images' },
  CHAT_ONLY: { Icon: MessageCircle, singular: 'Chat', plural: 'Chats' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7) return new Date(iso).toLocaleDateString([], { weekday: 'short' });
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function toBrief(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="glass-card p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="text-xl font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Form blank ───────────────────────────────────────────────────────────────

const EMPTY_BRIEF = { productName: '', keyMessage: '', targetAudience: '', tone: '', inclusions: '', additionalNotes: '' };
const EMPTY_PACKAGE_FORM = {
  type: 'SINGLE',
  name: '',
  price: '',
  videoCount: '',
  description: '',
  isMonthly: false,
  sortOrder: '0',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InfluencerDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data: infData, loading: loadingInf, refetch: refetchInfluencer } = useQuery(GET_INFLUENCER, { variables: { id } });
  const { data: ordersData, loading: loadingOrders, refetch } = useQuery(GET_INFLUENCER_ORDERS, { variables: { influencerId: id } });
  const { data: chatsData, loading: loadingChats } = useQuery(GET_INFLUENCER_CHATS, { variables: { influencerId: id } });
  const { data: usersData } = useQuery(GET_ALL_USERS);

  const inf = infData?.influencer;
  const orders: any[] = ordersData?.influencerOrders ?? [];
  const chats: any[] = chatsData?.influencerChats ?? [];
  const customers = (usersData?.allUsers ?? []).filter((u: any) => u.role === 'CUSTOMER' && u.isActive);

  const stats = useMemo(() => {
    const completed = orders.filter(o => COMPLETED_STATUSES.includes(o.status)).length;
    const ongoing = orders.filter(o => ONGOING_STATUSES.includes(o.status)).length;
    const cancelled = orders.filter(o => CANCELLED_STATUSES.includes(o.status)).length;
    const revenue = orders.reduce((s: number, o: any) => s + (o.price ?? 0), 0);
    return { total: orders.length, completed, ongoing, cancelled, revenue };
  }, [orders]);

  const [tab, setTab] = useState<'projects' | 'chats'>(
    searchParams.get('tab') === 'chats' ? 'chats' : 'projects'
  );
  const [chatSearch, setChatSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredChats = chatSearch.trim()
    ? chats.filter(c =>
      c.customer?.name?.toLowerCase().includes(chatSearch.toLowerCase()) ||
      c.customer?.email?.toLowerCase().includes(chatSearch.toLowerCase()))
    : chats;

  const packages = useMemo(() => {
    const list = Array.isArray(inf?.packages) ? inf.packages : [];
    return [...list].sort((a: any, b: any) => {
      const aOrder = Number(a?.sortOrder ?? 0);
      const bOrder = Number(b?.sortOrder ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a?.createdAt ?? 0).getTime() - new Date(b?.createdAt ?? 0).getTime();
    });
  }, [inf?.packages]);

  const usedPackageTypes = useMemo(() => {
    return new Set(packages.map((p: any) => String(p?.type ?? '')));
  }, [packages]);

  const availablePackageTypes = useMemo(() => {
    return Object.keys(PACKAGE_LABEL).filter((t) => t === 'CUSTOM' || !usedPackageTypes.has(t));
  }, [usedPackageTypes]);

  const [showAddPackage, setShowAddPackage] = useState(false);
  const [newPackage, setNewPackage] = useState(EMPTY_PACKAGE_FORM);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState(EMPTY_PACKAGE_FORM);

  const [createInfluencerPackage, { loading: addingPackage }] = useMutation(CREATE_INFLUENCER_PACKAGE, {
    onCompleted: async () => {
      toast({ title: 'Package added', variant: 'success' });
      setShowAddPackage(false);
      setNewPackage(EMPTY_PACKAGE_FORM);
      await refetchInfluencer();
    },
    onError: (e) => toast({ title: 'Failed to add package', description: e.message, variant: 'error' }),
  });

  const [updateInfluencerPackage, { loading: updatingPackage }] = useMutation(UPDATE_INFLUENCER_PACKAGE, {
    onCompleted: async () => {
      toast({ title: 'Package updated', variant: 'success' });
      setEditingPackageId(null);
      await refetchInfluencer();
    },
    onError: (e) => toast({ title: 'Failed to update package', description: e.message, variant: 'error' }),
  });

  const [deleteInfluencerPackage, { loading: deletingPackage }] = useMutation(DELETE_INFLUENCER_PACKAGE, {
    onCompleted: async () => {
      toast({ title: 'Package deleted', variant: 'success' });
      await refetchInfluencer();
    },
    onError: (e) => toast({ title: 'Failed to delete package', description: e.message, variant: 'error' }),
  });

  // Create project form
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [pkg, setPkg] = useState('SINGLE');
  const [delivery, setDelivery] = useState('INSTANT');
  const [aiDisclosure, setAiDisclosure] = useState(true);
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [customPrice, setCustomPrice] = useState('');

  const resetForm = () => {
    setSelectedCustomer(''); setPkg('SINGLE'); setDelivery('INSTANT');
    setAiDisclosure(true); setBrief(EMPTY_BRIEF); setCustomPrice('');
  };

  const [adminCreateOrder, { loading: creating }] = useMutation(ADMIN_CREATE_ORDER, {
    onCompleted: () => {
      toast({ title: 'Project created', variant: 'success' });
      setShowCreate(false); resetForm(); refetch();
    },
    onError: (e) => {
      const detail = (e.graphQLErrors?.[0]?.extensions?.originalError as any)?.message;
      toast({ title: 'Failed to create project', description: Array.isArray(detail) ? detail.join(', ') : e.message, variant: 'error' });
    },
  });

  const handleCreate = () => {
    const errors: string[] = [];
    if (!selectedCustomer) errors.push('Select a client');
    if (!brief.productName.trim()) errors.push('Product / project name is required');
    if (!brief.keyMessage.trim()) errors.push('Key message is required');
    if (!brief.targetAudience.trim()) errors.push('Target audience is required');
    if (!brief.tone.trim()) errors.push('Tone is required');
    if (pkg === 'CUSTOM' && (!customPrice || isNaN(parseFloat(customPrice)))) errors.push('Enter a valid price');
    if (errors.length) { toast({ title: 'Please fix the following', description: errors.join(' · '), variant: 'error' }); return; }

    adminCreateOrder({
      variables: {
        input: {
          influencerId: id, customerId: selectedCustomer,
          package: pkg, deliveryType: delivery, aiDisclosure, status: 'PAID',
          ...(pkg === 'CUSTOM' ? { price: parseFloat(customPrice) } : {}),
          projectBrief: {
            productName: brief.productName.trim(),
            keyMessage: brief.keyMessage.trim(),
            targetAudience: brief.targetAudience.trim(),
            tone: brief.tone.trim(),
            inclusions: brief.inclusions.split(',').map(s => s.trim()).filter(Boolean),
            additionalNotes: brief.additionalNotes.trim() || undefined,
          },
        },
      },
    });
  };

  const openEditPackage = (p: any) => {
    setEditingPackageId(p.id);
    setEditingPackage({
      type: p.type,
      name: p.name ?? '',
      price: String(p.price ?? ''),
      videoCount: String(p.videoCount ?? ''),
      description: p.description ?? '',
      isMonthly: !!p.isMonthly,
      sortOrder: String(p.sortOrder ?? 0),
    });
  };

  const submitAddPackage = async () => {
    const price = Number(newPackage.price);
    const videoCount = Number(newPackage.videoCount);
    if (!newPackage.name.trim()) return toast({ title: 'Package name is required', variant: 'error' });
    if (!Number.isFinite(price) || price < 0) return toast({ title: 'Invalid package price', variant: 'error' });
    if (!Number.isFinite(videoCount) || videoCount < 0) return toast({ title: 'Invalid package count', variant: 'error' });
    if (String(newPackage.type) !== 'CUSTOM' && usedPackageTypes.has(String(newPackage.type))) {
      return toast({ title: 'Package type already exists', description: 'Edit the existing package or choose a different type.', variant: 'error' });
    }
    await createInfluencerPackage({
      variables: {
        influencerId: id,
        input: {
          type: newPackage.type,
          name: newPackage.name.trim(),
          price,
          videoCount,
          description: newPackage.description.trim() || null,
          isMonthly: newPackage.isMonthly,
          isActive: true,
          sortOrder: Number(newPackage.sortOrder) || 0,
        },
      },
    });
  };

  const submitUpdatePackage = async () => {
    if (!editingPackageId) return;
    const price = Number(editingPackage.price);
    const videoCount = Number(editingPackage.videoCount);
    if (!editingPackage.name.trim()) return toast({ title: 'Package name is required', variant: 'error' });
    if (!Number.isFinite(price) || price < 0) return toast({ title: 'Invalid package price', variant: 'error' });
    if (!Number.isFinite(videoCount) || videoCount < 0) return toast({ title: 'Invalid package count', variant: 'error' });
    await updateInfluencerPackage({
      variables: {
        id: editingPackageId,
        input: {
          name: editingPackage.name.trim(),
          price,
          videoCount,
          description: editingPackage.description.trim() || null,
          isMonthly: editingPackage.isMonthly,
          isActive: true,
          sortOrder: Number(editingPackage.sortOrder) || 0,
        },
      },
    });
  };

  const submitDeletePackage = async (packageId: string) => {
    if (!window.confirm('Delete this package?')) return;
    await deleteInfluencerPackage({ variables: { id: packageId } });
  };

  const loading = loadingInf || loadingOrders;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/influencers"
          className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">
            {inf ? <><span className="gradient-text">{inf.name}</span> — Dashboard</> : 'Influencer Dashboard'}
          </h1>
          {inf && <p className="text-xs text-text-secondary mt-0.5">{SERVICE_LABEL[inf.serviceType] ?? inf.serviceType}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={`/admin/influencers/${id}/edit`}
            className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-2">
            <Edit size={14} /> Edit
          </Link>
          <button onClick={() => setShowCreate(true)}
            className="btn-brand flex items-center gap-1.5 text-sm px-3 py-2">
            <Plus size={14} /> Create Project
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Influencer card */}
          {inf && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
              <div className="relative flex-shrink-0">
                <img src={inf.avatar} alt={inf.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-brand/30" />
                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${inf.isActive ? 'bg-success' : 'bg-error'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold">{inf.name}</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-brand/10 text-brand-light font-medium">
                    {SERVICE_LABEL[inf.serviceType] ?? inf.serviceType}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${inf.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {inf.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-text-secondary line-clamp-2">{inf.bio}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Star size={11} className="text-brand-light fill-brand-light" />
                    {inf.rating?.toFixed(1)} ({inf.totalReviews} reviews)
                  </span>
                  {inf.industries?.slice(0, 3).map((ind: string) => (
                    <span key={ind} className="px-1.5 py-0.5 bg-brand/10 text-brand-light rounded">{ind}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={BarChart2} label="Total Projects" value={stats.total} color="bg-brand/10 text-brand-light" />
            <StatCard icon={CheckCircle} label="Completed" value={stats.completed} color="bg-success/10 text-success" />
            <StatCard icon={Clock} label="Ongoing" value={stats.ongoing} color="bg-blue-500/10 text-blue-400" />
            <StatCard icon={XCircle} label="Cancelled" value={stats.cancelled} color="bg-error/10 text-error" />
            <StatCard icon={DollarSign} label="Total Revenue" value={`$${stats.revenue.toFixed(2)}`} color="bg-teal-500/10 text-teal-400" />
          </div>

          {/* Tabs */}
          <div className="glass-card overflow-hidden">
            <div className="flex border-b border-border">
              {([
                { key: 'projects', label: 'Client Projects', icon: Package, count: orders.length },
                { key: 'chats', label: 'Chats', icon: MessageSquare, count: chats.length },
              ] as const).map(({ key, label, icon: Icon, count }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-brand text-brand-light' : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}>
                  <Icon size={14} />
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${tab === key ? 'bg-brand/20 text-brand-light' : 'bg-surface text-text-secondary'
                    }`}>{count}</span>
                </button>
              ))}
            </div>

            {/* Projects tab */}
            {tab === 'projects' && (
              orders.length === 0 ? (
                <div className="p-12 text-center">
                  <Package size={32} className="mx-auto text-text-secondary mb-3" />
                  <p className="text-text-secondary text-sm">No projects yet.</p>
                  <button onClick={() => setShowCreate(true)}
                    className="mt-4 btn-brand text-sm px-4 py-2 flex items-center gap-1.5 mx-auto">
                    <Plus size={14} /> Create First Project
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border text-text-secondary">
                        <th className="text-left px-4 py-3 font-medium">Client</th>
                        <th className="text-left px-4 py-3 font-medium">Type</th>
                        <th className="text-left px-4 py-3 font-medium">Delivered</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Price</th>
                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                        <th className="text-left px-4 py-3 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order: any) => {
                        const svcType = order.influencer?.serviceType ?? inf?.serviceType ?? 'VIDEO_CREATION';
                        const meta = SERVICE_META[svcType] ?? SERVICE_META.VIDEO_CREATION;
                        const brief = toBrief(order.projectBrief);
                        const posterPlan = brief.posterPlan && typeof brief.posterPlan === 'object' ? brief.posterPlan : null;
                        const posters = Array.isArray(posterPlan?.posters) ? posterPlan.posters : [];
                        const isExpanded = expandedOrderId === order.id;
                        return (
                          <>
                            <tr key={order.id} className="border-b border-border hover:bg-surface/60 transition-colors group">
                              <td className="px-4 py-3">
                                <Link href={`/admin/orders/${order.id}?from=${id}`} className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
                                    {order.customer?.name?.charAt(0) ?? '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate group-hover:text-brand-light transition-colors">{order.customer?.name ?? '—'}</p>
                                    <p className="text-xs text-text-secondary truncate">{order.customer?.email ?? ''}</p>
                                  </div>
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-1.5 text-text-secondary text-xs">
                                  <meta.Icon size={13} />
                                  {meta.plural}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-text-secondary text-xs">
                                {svcType === 'IMAGE_CREATION'
                                  ? (() => {
                                    const imgs = Array.isArray(order.generatedImages) ? order.generatedImages : [];
                                    const delivered = imgs.filter((x: any) => x?.delivered === true).length;
                                    return `${delivered}/${imgs.length} delivered`;
                                  })()
                                  : `${order.videosDelivered} / ${order.videosOrdered} ${meta.plural}`}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status as OrderStatus] ?? 'bg-gray-500/10 text-gray-400'}`}>
                                  {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell font-medium">${order.price?.toFixed(2)}</td>
                              <td className="px-4 py-3 hidden md:table-cell text-text-secondary">{fmtDate(order.createdAt)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-brand/40 hover:text-brand-light transition-colors"
                                >
                                  {isExpanded ? 'Hide Data' : 'View Data'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="border-b border-border/60 bg-surface/20">
                                <td colSpan={7} className="px-4 py-4">
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-border p-3 bg-background/40">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Saved Client Data</p>
                                      <div className="space-y-1.5 text-sm">
                                        <p><span className="text-text-secondary">Product:</span> {brief.productName || '—'}</p>
                                        <p><span className="text-text-secondary">Key Message:</span> {brief.keyMessage || '—'}</p>
                                        <p><span className="text-text-secondary">Target Audience:</span> {brief.targetAudience || '—'}</p>
                                        <p><span className="text-text-secondary">Tone:</span> {brief.tone || '—'}</p>
                                        <p><span className="text-text-secondary">Notes:</span> {brief.additionalNotes || '—'}</p>
                                        <p><span className="text-text-secondary">Cadence:</span> {posterPlan?.cadence || '—'}</p>
                                        <p>
                                          <span className="text-text-secondary">Poster Count:</span>{' '}
                                          {posterPlan?.postersPerWeek ?? posterPlan?.postersCount ?? posters.length ?? 0}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-border p-3 bg-background/40">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                                        Generated Prompts ({posters.length})
                                      </p>
                                      {posters.length === 0 ? (
                                        <p className="text-sm text-text-secondary">No saved optimized prompts for this project yet.</p>
                                      ) : (
                                        <div className="space-y-3 max-h-72 overflow-auto pr-1">
                                          {posters.map((p: any, idx: number) => (
                                            <div key={p?.id || idx} className="rounded-lg border border-border/80 bg-background/60 p-2.5">
                                              <p className="text-xs text-brand-light mb-1.5 font-medium">
                                                Poster {p?.index || idx + 1} {p?.createdAt ? `• ${fmtDate(p.createdAt)}` : ''}
                                              </p>
                                              <p className="text-[11px] text-text-secondary mb-1">Requirements</p>
                                              <pre className="text-xs whitespace-pre-wrap break-words text-text-secondary/90 mb-2">
                                                {JSON.stringify(p?.requirements ?? {}, null, 2)}
                                              </pre>
                                              <p className="text-[11px] text-text-secondary mb-1">Optimized Prompt</p>
                                              <pre className="text-xs whitespace-pre-wrap break-words">
                                                {String(p?.optimizedPrompt || '—')}
                                              </pre>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Chats tab */}
            {tab === 'chats' && (
              <div className="p-4">
                <div className="relative mb-4 max-w-sm">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input value={chatSearch} onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                </div>
                {loadingChats ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
                ) : filteredChats.length === 0 ? (
                  <div className="py-12 text-center">
                    <MessageSquare size={32} className="mx-auto text-text-secondary mb-3" />
                    <p className="text-text-secondary text-sm">
                      {chats.length === 0 ? 'No chats yet.' : 'No results match your search.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredChats.map((chat: any, i: number) => {
                      const lastMsg = chat.messages?.[0];
                      return (
                        <motion.div key={chat.id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}>
                          <Link href={`/admin/chats/${chat.id}`}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-brand/40 hover:bg-surface/50 transition-colors group">
                            <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
                              {chat.customer?.avatar
                                ? <img src={chat.customer.avatar} alt={chat.customer.name} className="w-full h-full object-cover" />
                                : <User size={14} className="text-text-secondary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{chat.customer?.name ?? 'Unknown'}</span>
                                <span className="text-xs text-text-secondary/60 hidden sm:inline truncate">{chat.customer?.email}</span>
                              </div>
                              {lastMsg ? (
                                <p className="text-xs text-text-secondary truncate">
                                  {lastMsg.role === 'USER' ? `${chat.customer?.name ?? 'User'}: ` : `${inf?.name ?? 'AI'}: `}
                                  {lastMsg.content}
                                </p>
                              ) : (
                                <p className="text-xs text-text-secondary/40 italic">No messages yet</p>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {lastMsg && <p className="text-[11px] text-text-secondary">{fmtTime(lastMsg.createdAt)}</p>}
                              <p className="text-[11px] text-text-secondary/50 mt-0.5">
                                {chat.messages?.length ?? 0} msg{chat.messages?.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold">Packages</h2>
              <button
                onClick={() => {
                  if (!showAddPackage) {
                    setNewPackage({ ...EMPTY_PACKAGE_FORM, type: 'CUSTOM' });
                  }
                  setShowAddPackage((v) => !v);
                  setEditingPackageId(null);
                }}
                className="btn-brand text-sm px-3 py-2 flex items-center gap-1.5"
              >
                <Plus size={14} /> {showAddPackage ? 'Close' : 'Add Package'}
              </button>
            </div>

            {showAddPackage && (
              <div className="rounded-2xl border border-border bg-background/40 p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} placeholder="Package name" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                <select value={newPackage.type} onChange={(e) => setNewPackage({ ...newPackage, type: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand">
                  {availablePackageTypes.map((t) => (
                    <option key={t} value={t}>
                      {PACKAGE_LABEL[t] ?? t}
                    </option>
                  ))}
                </select>
                <input type="number" min="0" step="0.01" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} placeholder="Price" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                <input type="number" min="0" step="1" value={newPackage.videoCount} onChange={(e) => setNewPackage({ ...newPackage, videoCount: e.target.value })} placeholder="Count" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                <input value={newPackage.description} onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })} placeholder="Description" className="md:col-span-2 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                <div className="flex items-center gap-2">
                  <input id="pkg-monthly" type="checkbox" checked={newPackage.isMonthly} onChange={(e) => setNewPackage({ ...newPackage, isMonthly: e.target.checked })} className="w-4 h-4 rounded accent-brand" />
                  <label htmlFor="pkg-monthly" className="text-sm text-text-secondary">Monthly package</label>
                </div>
                <div className="flex justify-end gap-2 md:col-span-2">
                  <button onClick={submitAddPackage} disabled={addingPackage} className="btn-brand text-sm px-4 py-2 disabled:opacity-50">{addingPackage ? 'Saving…' : 'Save Package'}</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {packages.length === 0 ? <p className="text-sm text-text-secondary">No packages found for this influencer.</p> : packages.map((p: any) => {
                const isEditing = editingPackageId === p.id;
                const desc = p.description || `${p.videoCount} ${p.isMonthly ? 'videos/month' : 'videos'}`;
                return (
                  <div key={p.id} className={`glass-card glow-border p-3 relative ${isEditing ? '' : 'flex items-center justify-between'}`}>
                    {isEditing ? (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`edit-${p.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="w-full space-y-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Check size={16} className="text-brand flex-shrink-0" />
                              <p className="text-sm font-semibold truncate">Edit package: {p.name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={submitUpdatePackage}
                                disabled={updatingPackage || deletingPackage}
                                className="p-1.5 rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
                                title="Save"
                                aria-label="Save"
                              >
                                <Check size={16} className="text-success" />
                              </button>
                              <button
                                onClick={() => setEditingPackageId(null)}
                                disabled={updatingPackage || deletingPackage}
                                className="p-1.5 rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
                                title="Cancel"
                                aria-label="Cancel"
                              >
                                <X size={16} className="text-text-secondary" />
                              </button>
                              <button
                                onClick={() => submitDeletePackage(p.id)}
                                disabled={deletingPackage || updatingPackage}
                                className="p-1.5 rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
                                title="Delete"
                                aria-label="Delete"
                              >
                                <Trash2 size={16} className="text-error" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                            <div className="sm:col-span-2 flex items-center gap-2 px-2.5 py-2 bg-background/60 border border-border rounded-lg">
                              <span className="text-xs text-text-secondary flex-shrink-0 w-12">Name</span>
                              <input
                                value={editingPackage.name}
                                onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                                className="flex-1 bg-transparent text-sm focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-1 flex items-center gap-2 px-2.5 py-2 bg-background/60 border border-border rounded-lg">
                              <span className="text-xs text-text-secondary flex-shrink-0 w-12">Price</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingPackage.price}
                                onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })}
                                className="flex-1 bg-transparent text-sm focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-1 flex items-center gap-2 px-2.5 py-2 bg-background/60 border border-border rounded-lg">
                              <span className="text-xs text-text-secondary flex-shrink-0 w-12">Count</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={editingPackage.videoCount}
                                onChange={(e) => setEditingPackage({ ...editingPackage, videoCount: e.target.value })}
                                className="flex-1 bg-transparent text-sm focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-1 flex items-center gap-2 px-2.5 py-2 bg-background/60 border border-border rounded-lg">
                              <span className="text-xs text-text-secondary flex-shrink-0 w-12">Sort</span>
                              <input
                                type="number"
                                step="1"
                                value={editingPackage.sortOrder}
                                onChange={(e) => setEditingPackage({ ...editingPackage, sortOrder: e.target.value })}
                                className="flex-1 bg-transparent text-sm focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-1 flex items-center gap-2 px-2.5 py-2 bg-background/60 border border-border rounded-lg">
                              <span className="text-xs text-text-secondary flex-shrink-0 w-12">Monthly</span>
                              <input
                                id={`pkg-edit-${p.id}`}
                                type="checkbox"
                                checked={editingPackage.isMonthly}
                                onChange={(e) => setEditingPackage({ ...editingPackage, isMonthly: e.target.checked })}
                                className="w-4 h-4 rounded accent-brand"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 px-2.5 py-2 bg-background/60 border border-border rounded-lg">
                            <span className="text-xs text-text-secondary flex-shrink-0 w-12">Desc</span>
                            <input
                              value={editingPackage.description}
                              onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                              className="flex-1 bg-transparent text-sm focus:outline-none"
                            />
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Check size={16} className="text-brand flex-shrink-0" />
                          <p className="text-sm font-semibold truncate">
                            {p.name}
                            <span className="font-normal text-text-secondary"> — {desc}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="font-bold text-base leading-none">
                            ${Number(p.price ?? 0)}
                            {p.isMonthly && <span className="text-xs text-text-secondary font-medium">/mo</span>}
                          </p>
                          <button onClick={() => openEditPackage(p)} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
                            <Edit size={16} className="text-text-secondary" />
                          </button>
                          <button onClick={() => submitDeletePackage(p.id)} disabled={deletingPackage} className="p-1.5 rounded-lg hover:bg-surface transition-colors disabled:opacity-50">
                            <Trash2 size={16} className="text-error" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Project dialog */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowCreate(false); resetForm(); } }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
                <h2 className="font-semibold text-base">Create Project for {inf?.name}</h2>
                <button onClick={() => { setShowCreate(false); resetForm(); }}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Client *</label>
                  <div className="relative">
                    <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full px-3 py-2 pr-8 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand appearance-none">
                      <option value="">— Select a client —</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Package *</label>
                    <div className="relative">
                      <select value={pkg} onChange={(e) => setPkg(e.target.value)}
                        className="w-full px-3 py-2 pr-8 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand appearance-none">
                        {Object.entries(PACKAGE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Delivery Type *</label>
                    <div className="relative">
                      <select value={delivery} onChange={(e) => setDelivery(e.target.value)}
                        className="w-full px-3 py-2 pr-8 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand appearance-none">
                        <option value="INSTANT">Instant</option>
                        <option value="QUALITY_CHECKED">Quality Checked</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    </div>
                  </div>
                </div>
                {pkg === 'CUSTOM' && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Custom Price (USD) *</label>
                    <input type="number" min="0" step="0.01" value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)} placeholder="0.00"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                  </div>
                )}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Project Brief</p>
                  {[
                    { key: 'productName', label: 'Product / Project Name *' },
                    { key: 'keyMessage', label: 'Key Message *' },
                    { key: 'targetAudience', label: 'Target Audience *' },
                    { key: 'tone', label: 'Tone *' },
                    { key: 'inclusions', label: 'Inclusions (comma-separated)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
                      <input value={(brief as any)[key]} onChange={(e) => setBrief({ ...brief, [key]: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Additional Notes</label>
                    <textarea value={brief.additionalNotes} onChange={(e) => setBrief({ ...brief, additionalNotes: e.target.value })}
                      rows={3} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand resize-none" />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={aiDisclosure} onChange={(e) => setAiDisclosure(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand" />
                  <span className="text-sm text-text-secondary">Client consents to AI-generated content disclosure</span>
                </label>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleCreate} disabled={creating}
                    className="btn-brand flex-1 flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-50">
                    {creating ? 'Creating…' : <><Plus size={14} /> Create Project</>}
                  </button>
                  <button onClick={() => { setShowCreate(false); resetForm(); }} className="btn-ghost px-4 text-sm py-2.5">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
