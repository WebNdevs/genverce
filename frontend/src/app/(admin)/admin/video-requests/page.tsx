'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Video,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  ExternalLink,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Sparkles,
  Search,
  Filter,
  Calendar,
  Users,
  User,
  Layers,
  DollarSign,
  BadgeCheck,
  RefreshCw,
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Quote,
  Info,
  LayoutList,
  LayoutGrid,
  Copy,
  Edit,
  Film,
  CalendarDays,
  ShieldCheck,
  Building,
  Mail,
  FileText,
  Truck,
  Flame,
  Send,
  History,
  Wand2,
  MessageSquare,
  RotateCcw,
  CheckCheck,
  Share2,
} from 'lucide-react';
import { GET_ALL_ORDERS } from '@/graphql/queries/order';
import {
  ADMIN_UPDATE_ORDER,
  ADMIN_GENERATE_ORDER_VIDEO,
  ADMIN_SEND_ORDER_VIDEO_TO_CLIENT,
} from '@/graphql/mutations/order';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { connectSocket } from '@/lib/socket';

// ─── Constants & Metadata ───────────────────────────────────────────────────

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'GENERATING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'DELIVERED'
  | 'REJECTED'
  | 'REFUNDED'
  | 'CANCELLED';

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeCls: string; dotCls: string; description: string }
> = {
  PENDING_PAYMENT: {
    label: 'Pending Payment',
    badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotCls: 'bg-amber-400',
    description: 'Awaiting customer payment',
  },
  PAID: {
    label: 'Paid / Queued',
    badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dotCls: 'bg-blue-400',
    description: 'Payment verified, in production queue',
  },
  GENERATING: {
    label: 'Generating Video',
    badgeCls: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dotCls: 'bg-purple-400 animate-pulse',
    description: 'AI model rendering video content',
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    badgeCls: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    dotCls: 'bg-orange-400',
    description: 'Ready for admin QA / review approval',
  },
  APPROVED: {
    label: 'Approved',
    badgeCls: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    dotCls: 'bg-teal-400',
    description: 'Quality check passed, ready for delivery',
  },
  DELIVERED: {
    label: 'Delivered',
    badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotCls: 'bg-emerald-400',
    description: 'Completed video delivered to client',
  },
  REJECTED: {
    label: 'Rejected',
    badgeCls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dotCls: 'bg-rose-400',
    description: 'Rejected during QA review',
  },
  REFUNDED: {
    label: 'Refunded',
    badgeCls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dotCls: 'bg-rose-400',
    description: 'Payment was refunded to customer',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeCls: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    dotCls: 'bg-gray-400',
    description: 'Request was cancelled',
  },
};

const PACKAGE_LABELS: Record<string, string> = {
  SINGLE: 'Single Video',
  PACK_5: 'Pack of 5 Videos',
  PACK_10: 'Pack of 10 Videos',
  MONTHLY_STARTER: 'Monthly Starter',
  MONTHLY_GROWTH: 'Monthly Growth',
  CUSTOM: 'Custom Project',
};

const SAMPLE_VIDEOS = [
  {
    name: 'Big Buck Bunny (Sample HD)',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://placehold.co/480x270/1a1a2e/7c3aed?text=Video+Sample+1',
  },
  {
    name: 'Elephants Dream (Sample HD)',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://placehold.co/480x270/1a1a2e/7c3aed?text=Video+Sample+2',
  },
  {
    name: 'For Bigger Blazes (Sample HD)',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://placehold.co/480x270/1a1a2e/7c3aed?text=Video+Sample+3',
  },
  {
    name: 'Subaru Showcase (Sample HD)',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    thumbnail: 'https://placehold.co/480x270/1a1a2e/7c3aed?text=Video+Sample+4',
  },
];

// ─── Avatar Components (No Hardcoded Influencer/Client) ──────────────────────

function InfluencerAvatar({
  influencer,
  avatar,
  name,
  size = 'md',
  className = '',
}: {
  influencer?: any;
  avatar?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const finalAvatar = influencer?.avatar ?? avatar;
  const finalName = influencer?.name ?? name ?? 'Influencer';
  const sizeCls =
    size === 'xs'
      ? 'w-5 h-5 text-[9px]'
      : size === 'sm'
      ? 'w-7 h-7 text-[10px]'
      : size === 'md'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-11 h-11 text-sm'
      : 'w-14 h-14 text-base';

  if (finalAvatar && typeof finalAvatar === 'string' && finalAvatar.trim()) {
    return (
      <img
        src={finalAvatar}
        alt={finalName}
        className={cn('rounded-full object-cover border border-brand/30 flex-shrink-0', sizeCls, className)}
      />
    );
  }
  const initials =
    (finalName || 'Influencer')
      .split(' ')
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AI';
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-tr from-purple-600 via-brand to-pink-500 text-white flex items-center justify-center font-bold border border-white/20 flex-shrink-0 shadow-sm select-none',
        sizeCls,
        className,
      )}
    >
      {initials}
    </div>
  );
}

function ClientAvatar({
  customer,
  avatar,
  name,
  size = 'md',
  className = '',
}: {
  customer?: any;
  avatar?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const finalAvatar = customer?.avatar ?? avatar;
  const finalName = customer?.name ?? customer?.email ?? name ?? 'Client';
  const sizeCls =
    size === 'xs'
      ? 'w-5 h-5 text-[9px]'
      : size === 'sm'
      ? 'w-7 h-7 text-[10px]'
      : size === 'md'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-11 h-11 text-sm'
      : 'w-14 h-14 text-base';

  if (finalAvatar && typeof finalAvatar === 'string' && finalAvatar.trim()) {
    return (
      <img
        src={finalAvatar}
        alt={finalName}
        className={cn('rounded-full object-cover border border-border flex-shrink-0', sizeCls, className)}
      />
    );
  }
  const initial = (finalName || 'Client').trim().charAt(0).toUpperCase() || 'C';
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-brand text-white flex items-center justify-center font-bold border border-white/10 flex-shrink-0 shadow-sm select-none',
        sizeCls,
        className,
      )}
    >
      {initial}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toBriefObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return { notes: String(value) };
  }
}

function getOriginalRequest(brief: Record<string, any>): string {
  if (brief.originalRequest && typeof brief.originalRequest === 'string' && brief.originalRequest.trim()) {
    return brief.originalRequest.trim();
  }
  if (brief.userRequestText && typeof brief.userRequestText === 'string' && brief.userRequestText.trim()) {
    return brief.userRequestText.trim();
  }
  if (brief.videoDetails?.originalRequest && typeof brief.videoDetails.originalRequest === 'string') {
    return brief.videoDetails.originalRequest.trim();
  }
  if (brief.videoDetails?.userRequirements && typeof brief.videoDetails.userRequirements === 'string') {
    return brief.videoDetails.userRequirements.trim();
  }
  if (Array.isArray(brief.videoRequests) && brief.videoRequests.length > 0) {
    const lastReq = brief.videoRequests[brief.videoRequests.length - 1];
    if (lastReq?.originalRequest) return String(lastReq.originalRequest).trim();
    if (lastReq?.userMessage) return String(lastReq.userMessage).trim();
  }
  if (brief.notes && typeof brief.notes === 'string') return brief.notes.trim();
  return '';
}

function getInfluencerScript(brief: Record<string, any>): string {
  if (brief.influencerScript && typeof brief.influencerScript === 'string' && brief.influencerScript.trim()) {
    return brief.influencerScript.trim();
  }
  if (brief.script && typeof brief.script === 'string' && brief.script.trim()) {
    return brief.script.trim();
  }
  if (brief.videoDetails?.script && typeof brief.videoDetails.script === 'string') {
    return brief.videoDetails.script.trim();
  }
  if (brief.videoDetails?.influencerScript && typeof brief.videoDetails.influencerScript === 'string') {
    return brief.videoDetails.influencerScript.trim();
  }
  if (Array.isArray(brief.videoRequests) && brief.videoRequests.length > 0) {
    const lastReq = brief.videoRequests[brief.videoRequests.length - 1];
    if (lastReq?.influencerScript) return String(lastReq.influencerScript).trim();
    if (lastReq?.script) return String(lastReq.script).trim();
  }
  return '';
}

function getAutoGeneratedPrompt(brief: Record<string, any>): string {
  if (brief.autoGeneratedPrompt && typeof brief.autoGeneratedPrompt === 'string' && brief.autoGeneratedPrompt.trim()) {
    return brief.autoGeneratedPrompt.trim();
  }
  if (brief.videoPrompt && typeof brief.videoPrompt === 'string' && brief.videoPrompt.trim()) {
    return brief.videoPrompt.trim();
  }
  if (brief.videoDetails?.fullPrompt && typeof brief.videoDetails.fullPrompt === 'string') {
    return brief.videoDetails.fullPrompt.trim();
  }
  if (Array.isArray(brief.videoRequests) && brief.videoRequests.length > 0) {
    const lastReq = brief.videoRequests[brief.videoRequests.length - 1];
    if (lastReq?.autoGeneratedPrompt) return String(lastReq.autoGeneratedPrompt).trim();
    if (lastReq?.videoPrompt) return String(lastReq.videoPrompt).trim();
  }
  return '';
}

function formatDisplayOrderId(id?: string | null): string {
  if (!id) return '#ORD-0000';
  const clean = id.trim();
  if (clean.toLowerCase().startsWith('ord-demo-') || clean.toLowerCase().startsWith('demo-')) {
    const parts = clean.split('-');
    const suffix = parts[parts.length - 1] || '1';
    const num = parts[parts.length - 2] || '';
    const uniquePart = (num.slice(-4) + suffix).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `#ORD-${uniquePart.slice(0, 6)}`;
  }
  if (clean.toLowerCase().startsWith('ord-')) {
    const withoutPrefix = clean.slice(4).replace(/[^a-zA-Z0-9]/g, '');
    return `#ORD-${withoutPrefix.slice(0, 6).toUpperCase()}`;
  }
  const alphanumeric = clean.replace(/[^a-zA-Z0-9]/g, '');
  return `#${(alphanumeric.slice(0, 8) || clean.slice(0, 8)).toUpperCase()}`;
}

function buildCompleteTaskPrompt(task: any): string {
  if (!task) return '';
  const b = toBriefObject(task.projectBrief);
  const autoPrompt = getAutoGeneratedPrompt(b);
  const origReq = getOriginalRequest(b);
  const script = getInfluencerScript(b);
  const details = b.videoDetails || {};

  const sections: string[] = [];

  // 1. Primary AI Video Generation Prompt
  if (autoPrompt) {
    sections.push(autoPrompt);
  } else if (b.videoPrompt) {
    sections.push(b.videoPrompt);
  } else if (details.fullPrompt) {
    sections.push(details.fullPrompt);
  } else {
    const title = b.productName || task.influencer?.name || 'AI Video Production';
    sections.push(
      `High-end cinematic video featuring AI influencer ${task.influencer?.name || 'influencer'} presenting ${title}. Professional studio lighting, seamless camera movement, ultra-realistic motion, and engaging persona delivery.`,
    );
  }

  // 2. Customer Original Request
  if (origReq) {
    sections.push(`[CUSTOMER ORIGINAL REQUEST]\n${origReq}`);
  }

  // 3. Influencer Script & Storyboard
  if (script) {
    sections.push(`[INFLUENCER SCRIPT & STORYBOARD]\n${script}`);
  }

  // 4. Creative Requirements & Technical Specifications
  const reqLines: string[] = [];
  if (b.productName) reqLines.push(`• Product / Topic: ${b.productName}`);
  if (b.keyMessage) reqLines.push(`• Key Message / Core Hook: ${b.keyMessage}`);
  if (b.targetAudience) reqLines.push(`• Target Audience: ${b.targetAudience}`);
  if (b.tone) reqLines.push(`• Tone & Style: ${b.tone}`);

  const inclusions = Array.isArray(b.inclusions)
    ? b.inclusions.filter(Boolean).join(', ')
    : typeof b.inclusions === 'string' && b.inclusions.trim()
    ? b.inclusions.trim()
    : '';
  if (inclusions) reqLines.push(`• Key Inclusions: ${inclusions}`);

  const duration = details.duration || b.duration || '15s';
  const aspectRatio = details.aspectRatio || b.aspectRatio || '9:16';
  const language = details.language || 'English';
  const mood = details.mood;

  reqLines.push(
    `• Technical Specs: Duration: ${duration} | Aspect Ratio: ${aspectRatio} | Language: ${language}${mood ? ` | Mood: ${mood}` : ''}`,
  );

  if (b.additionalNotes) {
    reqLines.push(`• Additional Requirements & Notes: ${b.additionalNotes}`);
  }

  if (reqLines.length > 0) {
    sections.push(`[CREATIVE REQUIREMENTS & SPECIFICATIONS]\n${reqLines.join('\n')}`);
  }

  return sections.join('\n\n').trim();
}

function getConversationContext(brief: Record<string, any>): Array<{
  id?: string;
  role: string;
  senderName?: string;
  content: string;
  createdAt?: string;
}> {
  if (Array.isArray(brief.conversationContext) && brief.conversationContext.length > 0) {
    return brief.conversationContext;
  }
  if (Array.isArray(brief.videoDetails?.conversationContext) && brief.videoDetails.conversationContext.length > 0) {
    return brief.videoDetails.conversationContext;
  }
  if (Array.isArray(brief.videoRequests) && brief.videoRequests.length > 0) {
    const lastReq = brief.videoRequests[brief.videoRequests.length - 1];
    if (Array.isArray(lastReq?.conversationContext) && lastReq.conversationContext.length > 0) {
      return lastReq.conversationContext;
    }
  }
  return [];
}

function isPendingOrderStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase();
  if (['DELIVERED', 'APPROVED', 'REJECTED', 'REFUNDED', 'CANCELLED'].includes(s)) {
    return false;
  }
  return true;
}

function isVideoOrder(o: any): boolean {
  if (!o) return false;
  const brief = toBriefObject(o.projectBrief);
  if (
    brief.videoPrompt ||
    brief.videoDetails ||
    (Array.isArray(brief.videoRequests) && brief.videoRequests.length > 0) ||
    brief.originalRequest ||
    brief.influencerScript ||
    brief.autoGeneratedPrompt ||
    brief.source === 'INFLUENCER_CHAT' ||
    brief.type === 'VIDEO_REQUEST' ||
    brief.type === 'VIDEO'
  ) {
    return true;
  }
  const svc = o.influencer?.serviceType;
  if (svc === 'VIDEO_CREATION') return true;
  if (Boolean(o.videoUrl)) return true;
  if (Number(o.videosOrdered) > 0) {
    return true;
  }
  if (['SINGLE', 'PACK_5', 'PACK_10'].includes(o.package)) return true;
  return false;
}

function isPendingVideoOrder(o: any): boolean {
  return isVideoOrder(o) && isPendingOrderStatus(o?.status);
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHrs > 0) return `${diffHrs}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'Just now';
  } catch {
    return '';
  }
}

// ─── Video Player & Management Modal ───────────────────────────────────────

interface ModalProps {
  request: any;
  allOrders?: any[];
  initialTab?: 'overview' | 'create-video' | 'send-client' | 'history';
  onClose: () => void;
  onUpdated: (updatedOrder?: any) => void;
  onSelectRequest?: (req: any) => void;
}

function VideoRequestModal({
  request,
  allOrders = [],
  initialTab = 'overview',
  onClose,
  onUpdated,
  onSelectRequest,
}: ModalProps) {
  const [currentRequest, setCurrentRequest] = useState<any>(request);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'create-video' | 'send-client' | 'history'
  >(initialTab);

  const [ordersList, setOrdersList] = useState<any[]>(allOrders || []);

  useEffect(() => {
    if (Array.isArray(allOrders)) {
      setOrdersList(allOrders);
    }
  }, [allOrders]);

  const handleOrderMutated = (updatedOrder: any) => {
    if (!updatedOrder) return;
    setOrdersList((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)),
    );
  };

  // Sync if prop changes
  useEffect(() => {
    setCurrentRequest(request);
  }, [request]);

  const brief = useMemo(
    () => toBriefObject(currentRequest?.projectBrief),
    [currentRequest?.projectBrief],
  );

  const generatedVideos = useMemo(() => {
    return Array.isArray(brief.generatedVideos) ? brief.generatedVideos : [];
  }, [brief.generatedVideos]);

  const historyList = useMemo(() => {
    return Array.isArray(brief.history) ? brief.history : [];
  }, [brief.history]);

  // All video requests across the system (merging ordersList and currentRequest)
  const videoRequestsList = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(ordersList)) {
      ordersList.forEach((o) => {
        if (o?.id && isVideoOrder(o)) map.set(o.id, o);
      });
    }
    if (currentRequest?.id) {
      map.set(currentRequest.id, {
        ...(map.get(currentRequest.id) || {}),
        ...currentRequest,
      });
    }
    return Array.from(map.values());
  }, [ordersList, currentRequest]);

  // Group by Influencer: all influencers who have video requests
  const influencersWithRequests = useMemo(() => {
    const map = new Map<string, { influencer: any; requests: any[] }>();

    videoRequestsList.forEach((req) => {
      const infId = req.influencer?.id || req.influencerId;
      if (!infId) return;
      const inf = req.influencer || {
        id: infId,
        name: req.influencer?.name || 'Influencer',
        avatar: req.influencer?.avatar || null,
        serviceType: req.influencer?.serviceType || 'VIDEO_CREATION',
      };

      if (!map.has(infId)) {
        map.set(infId, {
          influencer: inf,
          requests: [req],
        });
      } else {
        const existing = map.get(infId)!;
        if (!existing.requests.some((r) => r.id === req.id)) {
          existing.requests.push(req);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      (a.influencer.name || '').localeCompare(b.influencer.name || ''),
    );
  }, [videoRequestsList]);

  // ─── 3-Step Cascading Selection State ──────────────────────────────────────
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>(
    currentRequest?.influencer?.id || currentRequest?.influencerId || '',
  );
  const [selectedClientId, setSelectedClientId] = useState<string>(
    currentRequest?.customer?.id || currentRequest?.customerId || currentRequest?.customer?.email || '',
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    currentRequest?.id || '',
  );

  // Sync cascading selectors when currentRequest changes
  useEffect(() => {
    if (!currentRequest) return;
    const infId = currentRequest.influencer?.id || currentRequest.influencerId;
    if (infId && infId !== selectedInfluencerId) {
      setSelectedInfluencerId(infId);
    }
    const cId =
      currentRequest.customer?.id ||
      currentRequest.customerId ||
      currentRequest.customer?.email;
    if (cId && cId !== selectedClientId) {
      setSelectedClientId(cId);
    }
    if (currentRequest.id && currentRequest.id !== selectedTaskId) {
      setSelectedTaskId(currentRequest.id);
    }
  }, [
    currentRequest?.id,
    currentRequest?.influencer?.id,
    currentRequest?.influencerId,
    currentRequest?.customer?.id,
    currentRequest?.customerId,
  ]);

  // Step 2: Clients who have video tasks for the selected influencer
  const clientsForSelectedInfluencer = useMemo(() => {
    if (!selectedInfluencerId) return [];

    const reqsForInfluencer = videoRequestsList.filter((r) => {
      const infId = r.influencer?.id || r.influencerId;
      return infId === selectedInfluencerId;
    });

    const clientMap = new Map<string, { customer: any; requests: any[] }>();
    reqsForInfluencer.forEach((r) => {
      const cust = r.customer || {
        id: r.customerId || 'client-' + r.id.slice(0, 6),
        name: r.customer?.name || (r.customerId ? `Client #${r.customerId.slice(0, 8)}` : 'Client'),
        email: r.customer?.email || '',
      };
      const key = cust.id || cust.email || cust.name || r.customerId || 'anonymous';
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          customer: cust,
          requests: [r],
        });
      } else {
        const existing = clientMap.get(key)!;
        if (!existing.requests.some((item) => item.id === r.id)) {
          existing.requests.push(r);
        }
      }
    });

    return Array.from(clientMap.values()).sort((a, b) =>
      (a.customer.name || a.customer.email || '').localeCompare(
        b.customer.name || b.customer.email || '',
      ),
    );
  }, [videoRequestsList, selectedInfluencerId]);

  // Step 3: Video tasks/requests for the selected Client & Influencer
  const tasksForSelectedClient = useMemo(() => {
    if (!selectedInfluencerId || !selectedClientId) return [];

    return videoRequestsList.filter((r) => {
      const infId = r.influencer?.id || r.influencerId;
      if (infId !== selectedInfluencerId) return false;
      const cust = r.customer;
      const key = cust?.id || r.customerId || cust?.email || cust?.name || 'anonymous';
      return (
        key === selectedClientId ||
        cust?.id === selectedClientId ||
        r.customerId === selectedClientId ||
        cust?.email === selectedClientId
      );
    });
  }, [videoRequestsList, selectedInfluencerId, selectedClientId]);

  // The targeted task from the 3-step selector
  const targetTask = useMemo(() => {
    return (
      tasksForSelectedClient.find((t) => t.id === selectedTaskId) ||
      tasksForSelectedClient[0] ||
      currentRequest
    );
  }, [tasksForSelectedClient, selectedTaskId, currentRequest]);

  // Active entries for display
  const activeInfluencerEntry = useMemo(() => {
    return (
      influencersWithRequests.find(
        (entry) => entry.influencer.id === selectedInfluencerId,
      ) ||
      (currentRequest?.influencer
        ? { influencer: currentRequest.influencer, requests: [currentRequest] }
        : null)
    );
  }, [influencersWithRequests, selectedInfluencerId, currentRequest]);

  const activeClientEntry = useMemo(() => {
    return (
      clientsForSelectedInfluencer.find(
        (entry) =>
          entry.customer.id === selectedClientId ||
          entry.customer.email === selectedClientId,
      ) ||
      (currentRequest?.customer
        ? { customer: currentRequest.customer, requests: [currentRequest] }
        : null)
    );
  }, [clientsForSelectedInfluencer, selectedClientId, currentRequest]);

  // Dropdown states & click-outside handling
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'influencer' | 'client' | 'task' | null>(null);
  const [influencerSearch, setInfluencerSearch] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (flowContainerRef.current && !flowContainerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Filtered influencers for search in dropdown
  const filteredInfluencers = useMemo(() => {
    if (!influencerSearch.trim()) return influencersWithRequests;
    const q = influencerSearch.toLowerCase().trim();
    return influencersWithRequests.filter(
      (entry) =>
        entry.influencer.name?.toLowerCase().includes(q) ||
        entry.influencer.handle?.toLowerCase().includes(q),
    );
  }, [influencersWithRequests, influencerSearch]);

  const handleApplyTask = (taskToApply: any, showToast = false) => {
    if (!taskToApply) return;

    setCurrentRequest(taskToApply);
    if (onSelectRequest) {
      onSelectRequest(taskToApply);
    }

    const taskBrief = toBriefObject(taskToApply.projectBrief);
    const takes = Array.isArray(taskBrief.generatedVideos) ? taskBrief.generatedVideos : [];
    const completePrompt = buildCompleteTaskPrompt(taskToApply);

    setGenPrompt(completePrompt);
    setPromptText(completePrompt);
    setSelectedStatus((taskToApply.status as OrderStatus) || 'PAID');
    setVideoUrlInput(taskToApply.videoUrl || '');
    setThumbnailUrlInput(taskToApply.thumbnailUrl || '');
    setPriceInput(typeof taskToApply.price === 'number' ? String(taskToApply.price) : '');
    setPreviewVideoUrl(taskToApply.videoUrl || takes[0]?.url || '');
    setSelectedTakeId(takes[0]?.id || '');
    setLatestGeneratedVideo(takes[0] || null);
    setSendSuccessInfo(null);

    const dur =
      taskBrief.videoDetails?.duration ||
      completePrompt.match(/(?:^|\n)\s*-\s*Duration(?:\s*\([^)]*\))?:\s*([^\n]+)/i)?.[1]?.trim() ||
      '15s';
    setGenDuration(
      dur.includes('30')
        ? '30s'
        : dur.includes('60')
        ? '60s'
        : dur.includes('10')
        ? '10s'
        : dur.includes('5')
        ? '5s'
        : '15s',
    );

    const asp =
      taskBrief.videoDetails?.aspectRatio ||
      completePrompt.match(/(?:^|\n)\s*-\s*Aspect\s*Ratio:\s*([^\n]+)/i)?.[1]?.trim() ||
      '9:16';
    setGenAspectRatio(asp.includes('16:9') ? '16:9' : asp.includes('1:1') ? '1:1' : '9:16');

    const prov =
      taskBrief.videoDetails?.targetVideoProvider ||
      taskBrief.videoDetails?.videoProvider ||
      'Runway Gen-3';
    setGenProvider(prov);

    const mod =
      taskBrief.videoDetails?.targetVideoModel ||
      taskBrief.videoDetails?.videoModel ||
      'gen3-alpha';
    setGenModel(mod);

    const customerName = taskToApply.customer?.name || 'there';
    const productName = taskBrief.productName || 'your custom video project';
    const influencerName = taskToApply.influencer?.name || 'Influencer';

    setClientMessageText(
      `🎬 Hey ${customerName}! Here is your completed video for "${productName}". ` +
        `I've crafted it to match your creative vision, tone, and requirements. ` +
        `Check out the preview above and let me know your thoughts! Hope you love it! ✨\n\n` +
        `Best regards,\n${influencerName}`,
    );

    if (showToast) {
      toast({
        title: '✨ Video Task Selected',
        description: `Switched to Task ${formatDisplayOrderId(taskToApply.id)} for ${customerName} as ${influencerName}.`,
        variant: 'success',
      });
    }
  };

  const handleSelectInfluencerFromDropdown = (infId: string) => {
    setSelectedInfluencerId(infId);
    setOpenDropdown(null);
    const reqsForInf = videoRequestsList.filter((r) => (r.influencer?.id || r.influencerId) === infId);
    const firstReq = reqsForInf[0];
    if (firstReq) {
      const nextCustId = firstReq.customer?.id || firstReq.customerId || firstReq.customer?.email || '';
      setSelectedClientId(nextCustId);
      setSelectedTaskId(firstReq.id);
      handleApplyTask(firstReq, true);
    }
  };

  const handleSelectClientFromDropdown = (clientId: string) => {
    setSelectedClientId(clientId);
    setOpenDropdown(null);
    const tasksForClient = videoRequestsList.filter((r) => {
      const infMatch = (r.influencer?.id || r.influencerId) === selectedInfluencerId;
      const cust = r.customer;
      const custMatch =
        cust?.id === clientId ||
        r.customerId === clientId ||
        cust?.email === clientId;
      return infMatch && custMatch;
    });
    const firstTask = tasksForClient[0];
    if (firstTask) {
      setSelectedTaskId(firstTask.id);
      handleApplyTask(firstTask, true);
    }
  };

  const handleSelectTaskFromDropdown = (taskId: string) => {
    setSelectedTaskId(taskId);
    setOpenDropdown(null);
    const target = videoRequestsList.find((r) => r.id === taskId);
    if (target) {
      handleApplyTask(target, true);
    }
  };

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(
    (currentRequest?.status as OrderStatus) || 'PAID',
  );
  const [videoUrlInput, setVideoUrlInput] = useState<string>(currentRequest?.videoUrl || '');
  const [thumbnailUrlInput, setThumbnailUrlInput] = useState<string>(
    currentRequest?.thumbnailUrl || '',
  );
  const [priceInput, setPriceInput] = useState<string>(
    typeof currentRequest?.price === 'number' ? String(currentRequest.price) : '',
  );
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string>(
    currentRequest?.videoUrl || generatedVideos[0]?.url || '',
  );
  const [selectedTakeId, setSelectedTakeId] = useState<string>(
    generatedVideos[0]?.id || '',
  );
  const [copiedId, setCopiedId] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const originalReq = useMemo(() => getOriginalRequest(brief), [brief]);
  const influencerScript = useMemo(() => getInfluencerScript(brief), [brief]);
  const autoPrompt = useMemo(() => getAutoGeneratedPrompt(brief), [brief]);
  const conversationContext = useMemo(() => getConversationContext(brief), [brief]);

  const [showChatContext, setShowChatContext] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const handleCopyOriginal = () => {
    if (!originalReq) return;
    navigator.clipboard.writeText(originalReq);
    setCopiedOriginal(true);
    toast({
      title: 'Original Request Copied',
      description: "Customer's original video request copied to clipboard.",
      variant: 'success',
    });
    setTimeout(() => setCopiedOriginal(false), 2000);
  };

  const handleCopyScript = () => {
    if (!influencerScript) return;
    navigator.clipboard.writeText(influencerScript);
    setCopiedScript(true);
    toast({
      title: 'Script Copied',
      description: "Influencer's video script and storyboard copied to clipboard.",
      variant: 'success',
    });
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Prompt state
  const promptValue =
    buildCompleteTaskPrompt(currentRequest) ||
    autoPrompt ||
    brief.videoPrompt ||
    brief.videoDetails?.fullPrompt ||
    '';
  const [promptText, setPromptText] = useState<string>(promptValue);
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // ─── Video Generation Studio State ─────────────────────────────────────────
  const initialDuration =
    brief.videoDetails?.duration ||
    promptText.match(/(?:^|\n)\s*-\s*Duration(?:\s*\([^)]*\))?:\s*([^\n]+)/i)?.[1]?.trim() ||
    '15s';
  const initialAspect =
    brief.videoDetails?.aspectRatio ||
    promptText.match(/(?:^|\n)\s*-\s*Aspect\s*Ratio:\s*([^\n]+)/i)?.[1]?.trim() ||
    '9:16';

  const [genPrompt, setGenPrompt] = useState<string>(promptValue);
  const [genDuration, setGenDuration] = useState<string>(
    initialDuration.includes('30') ? '30s' : initialDuration.includes('60') ? '60s' : '15s',
  );
  const [genAspectRatio, setGenAspectRatio] = useState<string>(
    initialAspect.includes('16:9') ? '16:9' : initialAspect.includes('1:1') ? '1:1' : '9:16',
  );
  const [genProvider, setGenProvider] = useState<string>(
    brief.videoDetails?.targetVideoProvider || brief.videoDetails?.videoProvider || 'Runway Gen-3',
  );
  const [genModel, setGenModel] = useState<string>(
    brief.videoDetails?.targetVideoModel || brief.videoDetails?.videoModel || 'gen3-alpha',
  );
  const [genStepIndex, setGenStepIndex] = useState<number>(0);
  const [latestGeneratedVideo, setLatestGeneratedVideo] = useState<any | null>(null);

  // ─── Send to Client State ──────────────────────────────────────────────────
  const custName = currentRequest.customer?.name || 'there';
  const prodName = brief.productName || 'your custom video project';
  const defaultClientMessage =
    `🎬 Hey ${custName}! Here is your completed video for "${prodName}". ` +
    `I've crafted it to match your creative vision, tone, and requirements. ` +
    `Check out the preview above and let me know your thoughts! Hope you love it! ✨`;

  const [clientMessageText, setClientMessageText] = useState<string>(defaultClientMessage);
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [sendSuccessInfo, setSendSuccessInfo] = useState<{
    sentAt: string;
    chatId: string;
    deliveredAs: string;
  } | null>(null);

  // Sync all form and generator states when currentRequest changes
  useEffect(() => {
    if (!currentRequest) return;
    const reqBrief = toBriefObject(currentRequest.projectBrief);
    const newPrompt =
      buildCompleteTaskPrompt(currentRequest) ||
      getAutoGeneratedPrompt(reqBrief) ||
      reqBrief.videoPrompt ||
      reqBrief.videoDetails?.fullPrompt ||
      reqBrief.additionalNotes ||
      '';
    const takes = Array.isArray(reqBrief.generatedVideos) ? reqBrief.generatedVideos : [];

    setPromptText(newPrompt);
    setGenPrompt(newPrompt);
    setSelectedStatus((currentRequest.status as OrderStatus) || 'PAID');
    setVideoUrlInput(currentRequest.videoUrl || '');
    setThumbnailUrlInput(currentRequest.thumbnailUrl || '');
    setPriceInput(
      typeof currentRequest.price === 'number' ? String(currentRequest.price) : '',
    );
    setPreviewVideoUrl(currentRequest.videoUrl || takes[0]?.url || '');
    setSelectedTakeId(takes[0]?.id || '');
    setLatestGeneratedVideo(takes[0] || null);
    setSendSuccessInfo(null);

    const dur =
      reqBrief.videoDetails?.duration ||
      newPrompt.match(/(?:^|\n)\s*-\s*Duration(?:\s*\([^)]*\))?:\s*([^\n]+)/i)?.[1]?.trim() ||
      '15s';
    setGenDuration(
      dur.includes('30')
        ? '30s'
        : dur.includes('60')
        ? '60s'
        : dur.includes('10')
        ? '10s'
        : dur.includes('5')
        ? '5s'
        : '15s',
    );

    const asp =
      reqBrief.videoDetails?.aspectRatio ||
      newPrompt.match(/(?:^|\n)\s*-\s*Aspect\s*Ratio:\s*([^\n]+)/i)?.[1]?.trim() ||
      '9:16';
    setGenAspectRatio(
      asp.includes('16:9') ? '16:9' : asp.includes('1:1') ? '1:1' : '9:16',
    );

    const prov =
      reqBrief.videoDetails?.targetVideoProvider ||
      reqBrief.videoDetails?.videoProvider ||
      'Runway Gen-3';
    setGenProvider(prov);

    const mod =
      reqBrief.videoDetails?.targetVideoModel ||
      reqBrief.videoDetails?.videoModel ||
      'gen3-alpha';
    setGenModel(mod);

    const customerName = currentRequest.customer?.name || 'there';
    const productName = reqBrief.productName || 'your custom video project';
    setClientMessageText(
      `🎬 Hey ${customerName}! Here is your completed video for "${productName}". ` +
        `I've crafted it to match your creative vision, tone, and requirements. ` +
        `Check out the preview above and let me know your thoughts! Hope you love it! ✨`,
    );
  }, [currentRequest?.id]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const [adminUpdateOrder, { loading: saving }] = useMutation(ADMIN_UPDATE_ORDER, {
    onCompleted: (data) => {
      const updated = data?.adminUpdateOrder;
      toast({
        title: 'Changes Saved Successfully',
        description: `Video Request ${formatDisplayOrderId(currentRequest.id)} updated successfully.`,
        variant: 'success',
      });
      if (updated) {
        const merged = {
          ...currentRequest,
          ...updated,
          influencer: updated.influencer || currentRequest.influencer,
          customer: updated.customer || currentRequest.customer,
        };
        setCurrentRequest(merged);
        handleOrderMutated(merged);
        onUpdated(merged);
      } else {
        onUpdated();
      }
    },
    onError: (err) => {
      const errMsg =
        err.graphQLErrors?.[0]?.message ||
        err.networkError?.message ||
        err.message ||
        'Failed to save changes. Please try again.';
      toast({
        title: 'Save Failed',
        description: errMsg,
        variant: 'error',
      });
    },
  });

  const [adminGenerateVideo, { loading: isGenerating }] = useMutation(
    ADMIN_GENERATE_ORDER_VIDEO,
    {
      onCompleted: (data) => {
        const updated = data.adminGenerateOrderVideo;
        const merged = {
          ...currentRequest,
          ...updated,
          influencer: updated?.influencer || currentRequest?.influencer,
          customer: updated?.customer || currentRequest?.customer,
        };
        setCurrentRequest(merged);
        handleOrderMutated(merged);
        const updatedBrief = toBriefObject(merged.projectBrief);
        const takes = Array.isArray(updatedBrief.generatedVideos)
          ? updatedBrief.generatedVideos
          : [];
        const latest = takes[0] || { url: merged.videoUrl };
        setLatestGeneratedVideo(latest);
        setPreviewVideoUrl(merged.videoUrl);
        setVideoUrlInput(merged.videoUrl);
        setSelectedStatus(merged.status);
        toast({
          title: '🎬 Video Generated Successfully!',
          description: `Take #${takes.length} generated and saved to history.`,
          variant: 'success',
        });
        onUpdated(merged);
      },
      onError: (err) => {
        toast({
          title: 'Generation Failed',
          description: err.message,
          variant: 'error',
        });
      },
    },
  );

  const [adminSendOrderVideo, { loading: isSending }] = useMutation(
    ADMIN_SEND_ORDER_VIDEO_TO_CLIENT,
    {
      onCompleted: (data) => {
        const updated = data.adminSendOrderVideoToClient;
        const merged = {
          ...currentRequest,
          ...updated,
          influencer: updated?.influencer || currentRequest?.influencer,
          customer: updated?.customer || currentRequest?.customer,
        };
        setCurrentRequest(merged);
        handleOrderMutated(merged);
        setSelectedStatus('DELIVERED');
        const updatedBrief = toBriefObject(merged.projectBrief);
        const lastHist = updatedBrief.history?.[0];
        const infName = merged.influencer?.name || 'Influencer';
        const clientName = merged.customer?.name || 'Client';
        setSendSuccessInfo({
          sentAt: new Date().toLocaleTimeString(),
          chatId: lastHist?.chatId || '',
          deliveredAs: infName,
        });
        toast({
          title: '✉ Video Sent to Client!',
          description: `Delivered to ${clientName} as ${infName}. Order marked as DELIVERED.`,
          variant: 'success',
        });
        onUpdated(merged);
      },
      onError: (err) => {
        toast({
          title: 'Send to Client Failed',
          description: err.message,
          variant: 'error',
        });
      },
    },
  );

  // Cycling generation status steps animation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      setGenStepIndex(0);
      timer = setInterval(() => {
        setGenStepIndex((prev) => (prev + 1) % 5);
      }, 1800);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  const GENERATION_STEPS = [
    'Connecting to AI Video Engine…',
    'Translating prompt into motion vectors…',
    'Rendering influencer visual frames…',
    'Synthesizing lighting, pacing, and motion…',
    'Finalizing and encoding high-definition MP4…',
  ];

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentRequest.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyPrompt = () => {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    toast({
      title: 'Prompt Copied',
      description: 'Complete video generation prompt copied to clipboard.',
      variant: 'success',
    });
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleApplyPreset = (preset: (typeof SAMPLE_VIDEOS)[0]) => {
    setVideoUrlInput(preset.url);
    setThumbnailUrlInput(preset.thumbnail);
    setPreviewVideoUrl(preset.url);
  };

  const handleSaveChanges = () => {
    const parsedPrice = priceInput.trim() ? Number(priceInput) : undefined;
    const currentPrompt = promptText.trim() || genPrompt.trim();
    const updatedBrief = {
      ...brief,
      videoPrompt: currentPrompt,
      autoGeneratedPrompt: currentPrompt,
      videoDetails: {
        ...(brief.videoDetails || {}),
        fullPrompt: currentPrompt,
        duration: genDuration,
        aspectRatio: genAspectRatio,
        targetVideoProvider: genProvider,
        targetVideoModel: genModel,
      },
    };
    adminUpdateOrder({
      variables: {
        input: {
          id: currentRequest.id,
          status: selectedStatus,
          videoUrl: videoUrlInput.trim() || '',
          thumbnailUrl: thumbnailUrlInput.trim() || '',
          ...(typeof parsedPrice === 'number' && !Number.isNaN(parsedPrice)
            ? { price: parsedPrice }
            : {}),
          projectBrief: updatedBrief,
        },
      },
    });
  };

  const handleQuickMarkDelivered = () => {
    setSelectedStatus('DELIVERED');
    if (!videoUrlInput.trim() && SAMPLE_VIDEOS[0].url) {
      setVideoUrlInput(SAMPLE_VIDEOS[0].url);
      setThumbnailUrlInput(SAMPLE_VIDEOS[0].thumbnail);
    }
    const parsedPrice = priceInput.trim() ? Number(priceInput) : undefined;
    adminUpdateOrder({
      variables: {
        input: {
          id: currentRequest.id,
          status: 'DELIVERED',
          videoUrl: videoUrlInput.trim() || SAMPLE_VIDEOS[0].url,
          thumbnailUrl: thumbnailUrlInput.trim() || SAMPLE_VIDEOS[0].thumbnail,
          ...(typeof parsedPrice === 'number' && !Number.isNaN(parsedPrice)
            ? { price: parsedPrice }
            : {}),
        },
      },
    });
  };

  const handleTriggerGenerate = () => {
    if (!genPrompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please provide or generate a video prompt first.',
        variant: 'error',
      });
      return;
    }
    adminGenerateVideo({
      variables: {
        orderId: currentRequest.id,
        prompt: genPrompt.trim(),
        duration: genDuration,
        aspectRatio: genAspectRatio,
        videoProvider: genProvider,
        videoModel: genModel,
      },
    });
  };

  const handleTriggerSendToClient = () => {
    const videoToSend =
      previewVideoUrl.trim() ||
      currentRequest.videoUrl ||
      generatedVideos[0]?.url;

    if (!videoToSend) {
      toast({
        title: 'No Video Available',
        description:
          'Please generate a video in the "Create Video" tab or attach a video URL first.',
        variant: 'error',
      });
      return;
    }

    adminSendOrderVideo({
      variables: {
        orderId: currentRequest.id,
        videoUrl: videoToSend,
        customMessage: clientMessageText.trim(),
        notes: deliveryNotes.trim() || undefined,
      },
    });
  };

  const statusCfg = STATUS_CONFIG[selectedStatus] || STATUS_CONFIG.PAID;
  const currentStatusCfg = STATUS_CONFIG[currentRequest.status] || STATUS_CONFIG.PAID;

  const inclusions = Array.isArray(brief?.inclusions)
    ? brief.inclusions
    : typeof brief?.inclusions === 'string'
    ? brief.inclusions.split(',').map((s: string) => s.trim())
    : [];

  const details = brief?.videoDetails || {};
  const duration =
    details.duration ||
    promptText.match(/(?:^|\n)\s*-\s*Duration(?:\s*\([^)]*\))?:\s*([^\n]+)/i)?.[1]?.trim() ||
    'Not specified';
  const aspectRatio =
    details.aspectRatio ||
    promptText.match(/(?:^|\n)\s*-\s*Aspect\s*Ratio:\s*([^\n]+)/i)?.[1]?.trim() ||
    'Not specified';
  const language =
    details.language ||
    promptText.match(/(?:^|\n)\s*-\s*Language:\s*([^\n]+)/i)?.[1]?.trim() ||
    'Not specified';
  const mood =
    details.mood ||
    promptText.match(/(?:^|\n)\s*-\s*Mood:\s*([^\n]+)/i)?.[1]?.trim() ||
    'Not specified';
  const videoProvider =
    details.targetVideoProvider ||
    details.videoProvider ||
    brief?.videoRequests?.[0]?.videoProvider;
  const videoModel =
    details.targetVideoModel ||
    details.videoModel ||
    brief?.videoRequests?.[0]?.videoModel;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-background border border-border rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light flex-shrink-0">
              <Video size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg truncate text-text-primary">
                  {brief.productName || 'Video Request Details'}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                    currentStatusCfg.badgeCls,
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', currentStatusCfg.dotCls)} />
                  {currentStatusCfg.label}
                </span>
                {generatedVideos.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    <Film size={10} /> {generatedVideos.length} Take{generatedVideos.length > 1 ? 's' : ''} Saved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                <span className="font-mono">{formatDisplayOrderId(currentRequest.id)}</span>
                <button
                  onClick={handleCopyId}
                  className="hover:text-text-primary transition-colors inline-flex items-center gap-1"
                  title="Copy full request ID"
                >
                  {copiedId ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                </button>
                <span>•</span>
                <span>Requested {fmtDateTime(currentRequest.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border bg-surface/50 px-6 py-2 overflow-x-auto">
          <button
            type="button"
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'overview'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/80',
            )}
          >
            <Eye size={14} /> Overview & Specs
          </button>
          <button
            type="button"
            id="tab-create-video"
            onClick={() => setActiveTab('create-video')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'create-video'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/80',
            )}
          >
            <Wand2 size={14} /> Create Video Studio
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-400/20 text-purple-200 border border-purple-400/30">
              AI Engine
            </span>
          </button>
          <button
            type="button"
            id="tab-send-client"
            onClick={() => setActiveTab('send-client')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'send-client'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/80',
            )}
          >
            <Send size={14} /> Send to Client
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
              As Influencer
            </span>
          </button>
          <button
            type="button"
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap',
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/80',
            )}
          >
            <History size={14} /> History & Takes
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-400/20 text-blue-200 border border-blue-400/30">
              {generatedVideos.length}
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: OVERVIEW & SPECS
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Deliverable Video Player & Controls */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Film size={18} className="text-brand-light" />
                    <h3 className="font-semibold text-sm text-text-primary">
                      Completed Video Deliverable
                    </h3>
                  </div>

                  {previewVideoUrl ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={previewVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                      >
                        <ExternalLink size={13} /> Open in New Tab
                      </a>
                      <a
                        href={previewVideoUrl}
                        download
                        className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                      >
                        <Download size={13} /> Download MP4
                      </a>
                      <button
                        type="button"
                        onClick={() => setActiveTab('send-client')}
                        className="btn-brand text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm"
                      >
                        <Send size={13} /> Send to Client
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
                        No Video Attached Yet
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create-video')}
                        className="btn-brand text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Wand2 size={13} /> Generate Video Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Multiple Takes Selector Bar */}
                {generatedVideos.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-border/60">
                    <span className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider whitespace-nowrap">
                      Generated Takes ({generatedVideos.length}):
                    </span>
                    {generatedVideos.map((take: any, idx: number) => {
                      const isSelected = previewVideoUrl === take.url;
                      return (
                        <button
                          key={take.id || idx}
                          type="button"
                          onClick={() => {
                            setPreviewVideoUrl(take.url);
                            setVideoUrlInput(take.url);
                            setSelectedTakeId(take.id || '');
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border whitespace-nowrap',
                            isSelected
                              ? 'bg-brand/20 border-brand text-brand-light font-semibold ring-1 ring-brand/40 shadow-sm'
                              : 'bg-surface/60 border-border text-text-secondary hover:text-text-primary hover:border-brand/30',
                          )}
                        >
                          <Film size={11} />
                          <span>Take #{generatedVideos.length - idx}</span>
                          <span className="text-[10px] opacity-75">
                            ({take.duration || '15s'})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Video Player */}
                {previewVideoUrl ? (
                  <div className="rounded-xl overflow-hidden bg-black/90 border border-border relative aspect-video max-h-[360px] flex items-center justify-center">
                    <video
                      ref={videoRef}
                      controls
                      playsInline
                      src={previewVideoUrl}
                      poster={thumbnailUrlInput || currentRequest.thumbnailUrl || undefined}
                      className="w-full h-full object-contain max-h-[360px]"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-surface/30 p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-brand/10 text-brand-light mx-auto flex items-center justify-center">
                      <Video size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        No Completed Video Attached Yet
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        Generate a video directly using the AI Studio tab, paste a URL below, or
                        select a demo sample preset.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('create-video')}
                        className="btn-brand text-xs px-4 py-2 inline-flex items-center gap-1.5"
                      >
                        <Wand2 size={13} /> Open AI Video Generation Studio
                      </button>
                    </div>
                  </div>
                )}

                {/* Video URL & Thumbnail Editor */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                        Completed Video URL (MP4 / WebM)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://storage.googleapis.com/.../video.mp4"
                          value={videoUrlInput}
                          onChange={(e) => setVideoUrlInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono text-text-primary focus:outline-none focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewVideoUrl(videoUrlInput.trim())}
                          className="btn-ghost text-xs px-3 py-2 border border-border hover:border-brand/40"
                          title="Load and test player with this URL"
                        >
                          Load
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                        Thumbnail Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://.../thumbnail.jpg"
                        value={thumbnailUrlInput}
                        onChange={(e) => setThumbnailUrlInput(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono text-text-primary focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  {/* Sample Presets for Testing */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-text-secondary font-medium">
                      Quick Demo Samples:
                    </span>
                    {SAMPLE_VIDEOS.map((sample) => (
                      <button
                        key={sample.name}
                        type="button"
                        onClick={() => handleApplyPreset(sample)}
                        className="px-2 py-1 rounded bg-surface border border-border text-[11px] text-text-secondary hover:text-brand-light hover:border-brand/30 transition-colors"
                      >
                        + {sample.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════════
                  COMPLETE VIDEO TASK CONTEXT & CREATIVE RECORD
              ════════════════════════════════════════════════════════════════ */}
              <div className="space-y-4">
                {/* 2-Column Grid: Customer Original Request + Influencer Suggested Script */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Card 1: Customer's Original Video Request */}
                  <div className="glass-card p-5 border border-blue-500/30 rounded-2xl bg-gradient-to-br from-blue-950/20 via-surface/60 to-surface/90 space-y-3 relative overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-blue-500/20 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                          <Quote size={15} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-text-primary">Customer's Original Request</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              Client Intent
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5">
                            Original message and requirements as requested by {currentRequest.customer?.name || 'the customer'}
                          </p>
                        </div>
                      </div>

                      {originalReq && (
                        <button
                          type="button"
                          onClick={handleCopyOriginal}
                          className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-blue-400/40 transition-colors flex items-center gap-1"
                          title="Copy Customer's Original Request"
                        >
                          {copiedOriginal ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedOriginal ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {originalReq ? (
                      <div className="p-3.5 rounded-xl bg-black/40 border border-blue-500/15 text-xs text-slate-200 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap selection:bg-blue-500/30 font-medium">
                        "{originalReq}"
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-secondary">
                        {brief.productName ? `Video requested: ${brief.productName}` : 'No separate customer prompt recorded.'}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-text-secondary/70 pt-1">
                      <span>Client: <strong className="text-text-primary">{currentRequest.customer?.name || 'Customer'}</strong></span>
                      <span>{fmtDate(currentRequest.createdAt)}</span>
                    </div>
                  </div>

                  {/* Card 2: Influencer's Suggested Script & Storyboard */}
                  <div className="glass-card p-5 border border-purple-500/30 rounded-2xl bg-gradient-to-br from-purple-950/20 via-surface/60 to-surface/90 space-y-3 relative overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                          <Film size={15} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-text-primary">Influencer Script & Storyboard</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              {influencerScript ? 'Script Ready' : 'Pending Script'}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5">
                            Suggested dialogue, hook, scene structure, and creator cues
                          </p>
                        </div>
                      </div>

                      {influencerScript && (
                        <button
                          type="button"
                          onClick={handleCopyScript}
                          className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-purple-400/40 transition-colors flex items-center gap-1"
                          title="Copy Influencer's Video Script"
                        >
                          {copiedScript ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {influencerScript ? (
                      <div className="p-3.5 rounded-xl bg-black/40 border border-purple-500/15 text-xs text-purple-100 font-mono leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap selection:bg-purple-500/30">
                        {influencerScript}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-secondary">
                        Script generated automatically inside the Auto-Generated Production Prompt below.
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-text-secondary/70 pt-1">
                      <span>Creator: <strong className="text-text-primary">{currentRequest.influencer?.name || 'Influencer'}</strong></span>
                      <span className="font-mono text-purple-300 text-[10px]">{brief.videoDetails?.mood || 'Creative Script'}</span>
                    </div>
                  </div>
                </div>

                {/* Conversation Context Chat Log */}
                {conversationContext.length > 0 && (
                  <div className="glass-card p-4 sm:p-5 border border-border/80 rounded-2xl bg-surface/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={16} className="text-brand-light" />
                        <h4 className="font-semibold text-xs sm:text-sm text-text-primary">
                          Recorded Conversation Context ({conversationContext.length} messages)
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowChatContext((prev) => !prev)}
                        className="px-3 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors flex items-center gap-1.5"
                      >
                        {showChatContext ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{showChatContext ? 'Collapse Chat' : 'Expand Full Chat'}</span>
                      </button>
                    </div>

                    {showChatContext && (
                      <div className="max-h-80 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-black/50 border border-border/60 custom-scrollbar">
                        {conversationContext.map((msg, i) => {
                          const isAssistant = msg.role?.toUpperCase() === 'ASSISTANT';
                          return (
                            <div
                              key={msg.id || i}
                              className={cn(
                                'flex flex-col text-xs max-w-[85%] rounded-xl p-3 space-y-1',
                                isAssistant
                                  ? 'ml-auto bg-purple-950/40 border border-purple-500/30 text-purple-100'
                                  : 'mr-auto bg-surface/80 border border-border text-slate-200'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-text-secondary/80">
                                <span>{isAssistant ? currentRequest.influencer?.name || 'Influencer' : currentRequest.customer?.name || 'Customer'}</span>
                                <span>{fmtDateTime(msg.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Detailed Video-Generation Prompt */}
              <div className="glass-card p-5 border border-brand/30 rounded-xl space-y-4 bg-gradient-to-br from-surface/90 via-brand/5 to-surface/90 relative overflow-hidden shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center text-brand-light shadow-sm">
                      <Sparkles size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-text-primary">
                          Auto-Generated Production Video Prompt
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Sparkles size={10} /> Ready for AI Generation
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Synthesized from customer requirements, script/storyboard, and creator style.
                      </p>
                    </div>
                  </div>

                  {/* Top prompt action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5',
                        isEditingPrompt
                          ? 'bg-brand text-white border-brand'
                          : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-brand/40',
                      )}
                    >
                      <Edit size={12} />
                      {isEditingPrompt ? 'Preview Mode' : 'Edit Prompt'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      disabled={!promptText}
                      className="btn-brand text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-sm"
                    >
                      {copiedPrompt ? (
                        <Check size={13} className="text-emerald-300" />
                      ) : (
                        <Copy size={13} />
                      )}
                      {copiedPrompt ? 'Copied to Clipboard!' : 'Copy Full Prompt'}
                    </button>
                  </div>
                </div>

                {/* Technical Specifications Parameter Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-background/60 border border-border flex flex-col justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Duration
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold border font-mono truncate',
                          duration === 'Not specified'
                            ? 'bg-surface text-amber-400/90 border-amber-500/20'
                            : 'bg-brand/10 text-brand-light border-brand/30',
                        )}
                      >
                        ⏱ {duration}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border flex flex-col justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Aspect Ratio
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold border font-mono truncate',
                          aspectRatio === 'Not specified'
                            ? 'bg-surface text-amber-400/90 border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/30',
                        )}
                      >
                        📐 {aspectRatio}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border flex flex-col justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Language
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold border font-mono truncate',
                          language === 'Not specified'
                            ? 'bg-surface text-amber-400/90 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                        )}
                      >
                        🌐 {language}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border flex flex-col justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Mood
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold border font-mono truncate',
                          mood === 'Not specified'
                            ? 'bg-surface text-amber-400/90 border-amber-500/20'
                            : 'bg-teal-500/10 text-teal-400 border-teal-500/30',
                        )}
                      >
                        🎭 {mood}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target AI Video Engine Banner */}
                {(videoProvider || videoModel) && (
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between text-xs">
                    <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                      <Film size={14} className="text-purple-400" />
                      Configured AI Video Engine:
                    </span>
                    <span className="font-mono text-[11px] text-purple-300 font-semibold uppercase">
                      {videoProvider || 'Default'} {videoModel ? `(${videoModel})` : ''}
                    </span>
                  </div>
                )}

                {/* Prompt Content View / Textarea */}
                {isEditingPrompt ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-text-secondary uppercase">
                        Edit Production Prompt:
                      </label>
                      <span className="text-[11px] text-brand-light">
                        Changes will be saved to this order brief when you click "Save Changes"
                      </span>
                    </div>
                    <textarea
                      rows={14}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="w-full px-3.5 py-3 bg-black/80 border border-brand/40 rounded-xl font-mono text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand leading-relaxed"
                      placeholder="Enter or paste video generation prompt..."
                    />
                  </div>
                ) : (
                  <div className="relative group/box">
                    <div className="rounded-xl overflow-hidden bg-black/80 border border-white/10 shadow-inner">
                      <div className="flex items-center justify-between px-3.5 py-2 bg-white/5 border-b border-white/10 text-[11px] font-mono text-text-secondary">
                        <span className="flex items-center gap-1.5 text-text-primary font-medium">
                          <Film size={12} className="text-brand-light" />
                          production_video_prompt.txt
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-secondary/70">
                            {promptText ? `${promptText.length} characters` : 'No prompt text'}
                          </span>
                        </div>
                      </div>
                      <pre className="p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto selection:bg-brand/40 selection:text-white">
                        {promptText ||
                          'No video generation prompt has been generated for this request yet.'}
                      </pre>
                    </div>

                    {promptText && (
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        className="absolute top-10 right-3 px-2.5 py-1 rounded-lg bg-surface/90 backdrop-blur border border-border text-xs text-text-secondary hover:text-text-primary hover:border-brand/40 shadow transition-all flex items-center gap-1 opacity-80 group-hover/box:opacity-100"
                        title="Copy full prompt to clipboard"
                      >
                        {copiedPrompt ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Status Management & Quick Actions */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={18} className="text-brand-light" />
                    <h3 className="font-semibold text-sm text-text-primary">
                      Update Request Status
                    </h3>
                  </div>
                  <span className="text-xs text-text-secondary">
                    Current: <strong className="text-text-primary">{currentRequest.status}</strong>
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                      Change Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand"
                    >
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <option key={val} value={val}>
                          {cfg.label} ({val})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">{statusCfg.description}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                      Price (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-text-secondary text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Status Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <span className="text-xs text-text-secondary font-medium mr-1">
                    Quick Actions:
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickMarkDelivered}
                    disabled={saving}
                    className="btn-brand text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} /> Mark Delivered & Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('PENDING_REVIEW')}
                    className="px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-medium hover:bg-orange-500/20 transition-colors flex items-center gap-1"
                  >
                    <Clock size={12} /> Send to Review Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('GENERATING')}
                    className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                  >
                    <Loader2 size={12} /> Set to Generating
                  </button>
                </div>
              </div>

              {/* Client & Influencer Profiles */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Influencer Card */}
                <div className="glass-card p-4 border border-border rounded-xl space-y-3">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                    Target AI Influencer
                  </span>
                  {currentRequest.influencer ? (
                    <div className="flex items-start gap-3">
                      <InfluencerAvatar
                        avatar={currentRequest.influencer.avatar}
                        name={currentRequest.influencer.name}
                        className="w-12 h-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-text-primary truncate">
                          {currentRequest.influencer.name}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-brand/10 text-brand-light">
                          {currentRequest.influencer.serviceType || 'VIDEO_CREATION'}
                        </span>
                        {currentRequest.influencer.rating > 0 && (
                          <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                            ★ {currentRequest.influencer.rating.toFixed(1)} rating
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/admin/influencers/${currentRequest.influencer.id}`}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-brand-light border border-border hover:border-brand/40 transition-colors"
                        title="View Influencer Details"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary">Influencer information unavailable</p>
                  )}
                </div>

                {/* Client Card */}
                <div className="glass-card p-4 border border-border rounded-xl space-y-3">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                    Requesting Client
                  </span>
                  {currentRequest.customer ? (
                    <div className="flex items-start gap-3">
                      <ClientAvatar
                        avatar={currentRequest.customer.avatar}
                        name={currentRequest.customer.name}
                        className="w-12 h-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-text-primary truncate">
                          {currentRequest.customer.name || 'Anonymous Client'}
                        </p>
                        <p className="text-xs text-text-secondary truncate flex items-center gap-1.5 mt-0.5">
                          <Mail size={11} /> {currentRequest.customer.email || '—'}
                        </p>
                        {currentRequest.customer.company && (
                          <p className="text-xs text-text-secondary truncate flex items-center gap-1.5 mt-0.5">
                            <Building size={11} /> {currentRequest.customer.company}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/admin/users`}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-brand-light border border-border hover:border-brand/40 transition-colors"
                        title="View Users List"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary">Client information unavailable</p>
                  )}
                </div>
              </div>

              {/* Video Specifications & Creative Brief */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-brand-light" />
                  <h3 className="font-semibold text-sm text-text-primary">
                    Video Specifications & Creative Brief
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface/40 border border-border/80">
                  <div>
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                      Package
                    </span>
                    <p className="text-xs font-semibold text-text-primary mt-0.5">
                      {PACKAGE_LABELS[currentRequest.package] || currentRequest.package}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                      Delivery Mode
                    </span>
                    <p className="text-xs font-semibold text-text-primary mt-0.5 flex items-center gap-1">
                      <Truck size={12} className="text-brand-light" />
                      {currentRequest.deliveryType === 'QUALITY_CHECKED'
                        ? 'Quality Checked'
                        : 'Instant'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                      Videos Delivered
                    </span>
                    <p className="text-xs font-semibold text-text-primary mt-0.5">
                      {currentRequest.videosDelivered || 0} / {currentRequest.videosOrdered || 1}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                      Delivered At
                    </span>
                    <p className="text-xs font-semibold text-text-primary mt-0.5">
                      {fmtDate(currentRequest.deliveredAt)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {brief.productName && (
                    <div>
                      <span className="text-[11px] font-semibold text-text-secondary uppercase">
                        Product / Brand
                      </span>
                      <p className="text-sm font-medium text-text-primary mt-0.5">
                        {brief.productName}
                      </p>
                    </div>
                  )}
                  {brief.keyMessage && (
                    <div>
                      <span className="text-[11px] font-semibold text-text-secondary uppercase">
                        Key Message / Core Hook
                      </span>
                      <p className="text-sm text-text-primary mt-0.5 p-3 rounded-lg bg-surface/50 border border-border">
                        {brief.keyMessage}
                      </p>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {brief.targetAudience && (
                      <div>
                        <span className="text-[11px] font-semibold text-text-secondary uppercase">
                          Target Audience
                        </span>
                        <p className="text-xs text-text-primary mt-0.5">
                          {brief.targetAudience}
                        </p>
                      </div>
                    )}
                    {brief.tone && (
                      <div>
                        <span className="text-[11px] font-semibold text-text-secondary uppercase">
                          Video Tone & Style
                        </span>
                        <p className="text-xs text-text-primary mt-0.5">{brief.tone}</p>
                      </div>
                    )}
                  </div>
                  {inclusions.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-text-secondary uppercase block mb-1">
                        Key Inclusions
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {inclusions.map((item: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-xs bg-brand/10 text-brand-light border border-brand/20"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {brief.additionalNotes && (
                    <div>
                      <span className="text-[11px] font-semibold text-text-secondary uppercase">
                        Additional Instructions / Script Notes
                      </span>
                      <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap p-2.5 rounded-lg bg-surface/30 border border-border">
                        {brief.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: CREATE VIDEO STUDIO (AI Generation)
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'create-video' && (
            <div className="space-y-6">
              {/* Studio Header Banner */}
              {/* ── 3-STEP CASCADING TASK SELECTOR & PROMPT GENERATOR ── */}
              <div
                ref={flowContainerRef}
                className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-surface/85 to-purple-950/40 border border-purple-500/30 relative z-30 shadow-xl space-y-4"
              >
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md shadow-purple-500/10 flex-shrink-0">
                      <Wand2 size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-text-primary flex items-center gap-2">
                        Create Video Studio — Task Prompt Workflow
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          3-Step Flow
                        </span>
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Select an influencer, choose their client, pick a pending video task, and click Apply to auto-fill the complete prompt.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-950/60 border border-purple-500/30 text-purple-200 flex items-center gap-1.5 shadow-sm">
                      <Clock size={12} className="text-purple-400" />
                      {videoRequestsList.length} Video Tasks Total
                    </span>
                  </div>
                </div>

                {/* 3 Step Selectors + Apply Button Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* STEP 1: SELECT INFLUENCER */}
                  <div className="md:col-span-3 space-y-1.5 relative">
                    <label className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      Select Influencer
                    </label>

                    {/* Trigger Button */}
                    <button
                      type="button"
                      id="step-influencer-btn"
                      onClick={() => setOpenDropdown((prev) => (prev === 'influencer' ? null : 'influencer'))}
                      disabled={influencersWithRequests.length === 0}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm',
                        openDropdown === 'influencer'
                          ? 'bg-purple-600/30 border-purple-400 text-white ring-1 ring-purple-400/50'
                          : 'bg-surface/90 hover:bg-surface border-border hover:border-purple-400/50 text-text-primary',
                        influencersWithRequests.length === 0 && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {activeInfluencerEntry ? (
                          <>
                            <InfluencerAvatar
                              influencer={activeInfluencerEntry.influencer}
                              size="sm"
                            />
                            <span className="truncate">{activeInfluencerEntry.influencer?.name}</span>
                          </>
                        ) : (
                          <>
                            <Users size={14} className="text-purple-300 flex-shrink-0" />
                            <span className="text-text-secondary truncate">Select Influencer</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {activeInfluencerEntry && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/25 text-purple-200 border border-purple-400/30">
                            {activeInfluencerEntry.requests.length} task{activeInfluencerEntry.requests.length > 1 ? 's' : ''}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          className={cn(
                            'text-text-secondary transition-transform duration-200',
                            openDropdown === 'influencer' && 'rotate-180 text-purple-300',
                          )}
                        />
                      </div>
                    </button>

                    {/* Popover */}
                    <AnimatePresence>
                      {openDropdown === 'influencer' && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 rounded-2xl bg-surface/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl p-2.5 z-50 space-y-2"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 px-1 text-xs font-bold text-text-primary">
                            <span className="flex items-center gap-1.5">
                              <Sparkles size={12} className="text-purple-400" />
                              Influencers with Video Requests
                            </span>
                            <span className="text-[10px] font-mono text-purple-300">
                              {influencersWithRequests.length} active
                            </span>
                          </div>

                          {influencersWithRequests.length > 3 && (
                            <div className="relative">
                              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                              <input
                                type="text"
                                value={influencerSearch}
                                onChange={(e) => setInfluencerSearch(e.target.value)}
                                placeholder="Filter influencers..."
                                className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-background/80 border border-border text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-400"
                              />
                            </div>
                          )}

                          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                            {filteredInfluencers.map(({ influencer, requests }) => {
                              const isSelected = influencer.id === selectedInfluencerId;
                              return (
                                <button
                                  key={influencer.id}
                                  type="button"
                                  onClick={() => handleSelectInfluencerFromDropdown(influencer.id)}
                                  className={cn(
                                    'w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all',
                                    isSelected
                                      ? 'bg-purple-600/20 border-purple-500/50 text-text-primary'
                                      : 'bg-surface/50 hover:bg-surface border-border hover:border-purple-400/40 text-text-secondary hover:text-text-primary',
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <InfluencerAvatar
                                      influencer={influencer}
                                      size="md"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-text-primary truncate">{influencer.name}</p>
                                      {influencer.handle && (
                                        <p className="text-[10px] text-text-secondary/70 truncate">@{influencer.handle}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                      {requests.length} task{requests.length > 1 ? 's' : ''}
                                    </span>
                                    {isSelected && <Check size={13} className="text-purple-400" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* STEP 2: SELECT CLIENT */}
                  <div className="md:col-span-3 space-y-1.5 relative">
                    <label className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      Select Client
                    </label>

                    {/* Trigger Button */}
                    <button
                      type="button"
                      id="step-client-btn"
                      onClick={() => setOpenDropdown((prev) => (prev === 'client' ? null : 'client'))}
                      disabled={clientsForSelectedInfluencer.length === 0}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm',
                        openDropdown === 'client'
                          ? 'bg-purple-600/30 border-purple-400 text-white ring-1 ring-purple-400/50'
                          : 'bg-surface/90 hover:bg-surface border-border hover:border-purple-400/50 text-text-primary',
                        clientsForSelectedInfluencer.length === 0 && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {activeClientEntry ? (
                          <>
                            <ClientAvatar customer={activeClientEntry.customer} size="sm" />
                            <span className="truncate">{activeClientEntry.customer.name || activeClientEntry.customer.email || 'Client'}</span>
                          </>
                        ) : (
                          <>
                            <User size={14} className="text-purple-300 flex-shrink-0" />
                            <span className="text-text-secondary truncate">
                              {clientsForSelectedInfluencer.length === 0 ? 'No Clients with Tasks' : 'Select Client'}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {activeClientEntry && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/25 text-purple-200 border border-purple-400/30">
                            {activeClientEntry.requests.length} task{activeClientEntry.requests.length > 1 ? 's' : ''}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          className={cn(
                            'text-text-secondary transition-transform duration-200',
                            openDropdown === 'client' && 'rotate-180 text-purple-300',
                          )}
                        />
                      </div>
                    </button>

                    {/* Popover */}
                    <AnimatePresence>
                      {openDropdown === 'client' && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 rounded-2xl bg-surface/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl p-2.5 z-50 space-y-2"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 px-1 text-xs font-bold text-text-primary">
                            <span className="flex items-center gap-1.5">
                              <User size={12} className="text-purple-400" />
                              Clients for {activeInfluencerEntry?.influencer?.name || 'Influencer'}
                            </span>
                            <span className="text-[10px] font-mono text-purple-300">
                              {clientsForSelectedInfluencer.length} client{clientsForSelectedInfluencer.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                            {clientsForSelectedInfluencer.map(({ customer, requests }) => {
                              const isSelected =
                                customer.id === selectedClientId ||
                                customer.email === selectedClientId;
                              return (
                                <button
                                  key={customer.id || customer.email || 'client'}
                                  type="button"
                                  onClick={() => handleSelectClientFromDropdown(customer.id || customer.email || '')}
                                  className={cn(
                                    'w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all',
                                    isSelected
                                      ? 'bg-purple-600/20 border-purple-500/50 text-text-primary'
                                      : 'bg-surface/50 hover:bg-surface border-border hover:border-purple-400/40 text-text-secondary hover:text-text-primary',
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ClientAvatar customer={customer} size="md" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-text-primary truncate">
                                        {customer.name || 'Anonymous Client'}
                                      </p>
                                      {customer.email && (
                                        <p className="text-[10px] text-text-secondary/70 truncate">{customer.email}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                      {requests.length} task{requests.length > 1 ? 's' : ''}
                                    </span>
                                    {isSelected && <Check size={13} className="text-purple-400" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* STEP 3: SELECT VIDEO TASK */}
                  <div className="md:col-span-4 space-y-1.5 relative">
                    <label className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                      Video Task
                    </label>

                    {/* Trigger Button */}
                    <button
                      type="button"
                      id="step-task-btn"
                      onClick={() => setOpenDropdown((prev) => (prev === 'task' ? null : 'task'))}
                      disabled={tasksForSelectedClient.length === 0}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm',
                        openDropdown === 'task'
                          ? 'bg-purple-600/30 border-purple-400 text-white ring-1 ring-purple-400/50'
                          : 'bg-surface/90 hover:bg-surface border-border hover:border-purple-400/50 text-text-primary',
                        tasksForSelectedClient.length === 0 && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Film size={14} className="text-purple-300 flex-shrink-0" />
                        {targetTask ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-purple-300">{formatDisplayOrderId(targetTask.id)}</span>
                            <span className="text-text-secondary">•</span>
                            <span className="truncate">
                              {toBriefObject(targetTask.projectBrief).productName || 'Video Task'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-secondary truncate">
                            {tasksForSelectedClient.length === 0 ? 'No Tasks' : 'Select Task'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {targetTask && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ${targetTask.price}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          className={cn(
                            'text-text-secondary transition-transform duration-200',
                            openDropdown === 'task' && 'rotate-180 text-purple-300',
                          )}
                        />
                      </div>
                    </button>

                    {/* Popover */}
                    <AnimatePresence>
                      {openDropdown === 'task' && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 sm:right-0 top-full mt-1.5 w-80 sm:w-96 rounded-2xl bg-surface/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl p-2.5 z-50 space-y-2"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 px-1 text-xs font-bold text-text-primary">
                            <span className="flex items-center gap-1.5">
                              <Film size={12} className="text-purple-400" />
                              Video Tasks ({tasksForSelectedClient.length})
                            </span>
                            <span className="text-[10px] text-text-secondary">
                              For {activeClientEntry?.customer?.name || 'Selected Client'}
                            </span>
                          </div>

                          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                            {tasksForSelectedClient.map((task) => {
                              const isSelected = task.id === selectedTaskId;
                              const tBrief = toBriefObject(task.projectBrief);
                              const hasScript = Boolean(getInfluencerScript(tBrief));
                              const hasOrig = Boolean(getOriginalRequest(tBrief));
                              const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG.PAID;

                              return (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => handleSelectTaskFromDropdown(task.id)}
                                  className={cn(
                                    'w-full p-2 rounded-xl border text-left transition-all space-y-1',
                                    isSelected
                                      ? 'bg-purple-600/20 border-purple-500/50 text-text-primary'
                                      : 'bg-surface/50 hover:bg-surface border-border hover:border-purple-400/40 text-text-secondary hover:text-text-primary',
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-mono text-xs font-bold text-purple-300">
                                        {formatDisplayOrderId(task.id)}
                                      </span>
                                      <span className="text-xs font-semibold text-text-primary truncate">
                                        {tBrief.productName || 'Custom Video Request'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <span className="font-mono text-xs font-bold text-emerald-400">
                                        ${task.price}
                                      </span>
                                      {isSelected && <Check size={13} className="text-purple-400" />}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                    <span className={cn('px-1.5 py-0.5 rounded-full border font-semibold', statusInfo.badgeCls)}>
                                      {statusInfo.label}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-secondary">
                                      {PACKAGE_LABELS[task.package] || task.package}
                                    </span>
                                    {hasScript && (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                        <Film size={9} /> Script
                                      </span>
                                    )}
                                    {hasOrig && (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                        <Quote size={9} /> Request
                                      </span>
                                    )}
                                    <span className="text-text-secondary/70 ml-auto font-mono">
                                      {fmtDate(task.createdAt)}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* APPLY BUTTON */}
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      id="apply-task-prompt-btn"
                      onClick={() => handleApplyTask(targetTask, true)}
                      disabled={!targetTask}
                      className={cn(
                        'w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md',
                        targetTask
                          ? 'bg-gradient-to-r from-purple-600 via-brand to-purple-600 hover:from-purple-500 hover:to-brand-light text-white shadow-purple-600/30 active:scale-[0.98]'
                          : 'bg-surface border border-border text-text-secondary cursor-not-allowed opacity-60',
                      )}
                      title="Apply selected task and automatically fill Video Prompt with complete details"
                    >
                      <Sparkles size={14} className="text-purple-200" />
                      <span>Apply Prompt</span>
                    </button>
                  </div>
                </div>

                {/* Active Applied Status Feedback Banner */}
                <div className="pt-2 border-t border-purple-500/15 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary text-[11px]">Active Task in Studio:</span>
                    <span className="font-mono font-bold text-purple-300">{formatDisplayOrderId(currentRequest.id)}</span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-primary font-semibold">{currentRequest.influencer?.name}</span>
                    <span className="text-text-secondary">for</span>
                    <span className="text-brand-light font-semibold">{currentRequest.customer?.name || 'Customer'}</span>
                  </div>

                  {targetTask && targetTask.id !== currentRequest.id ? (
                    <span className="text-[11px] text-amber-300 flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
                      <Sparkles size={11} /> Task {formatDisplayOrderId(targetTask.id)} selected — Click "Apply Prompt" to load
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-300 flex items-center gap-1 font-medium">
                      <Check size={12} className="text-emerald-400" /> Video prompt auto-filled with original request, influencer script & requirements
                    </span>
                  )}
                </div>
              </div>

              {/* ── Active Pending Video Request Summary Card ── */}
              <div className="glass-card p-4 sm:p-5 border border-purple-500/25 rounded-2xl bg-gradient-to-br from-purple-950/20 via-surface/40 to-background space-y-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 flex-shrink-0">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-text-primary">
                          {brief.productName || 'Pending Video Request Details'}
                        </h4>
                        <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1.5', currentStatusCfg.badgeCls)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', currentStatusCfg.dotCls)} />
                          {currentStatusCfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary mt-0.5">
                        <span className="font-mono">{formatDisplayOrderId(currentRequest.id)}</span>
                        <span>•</span>
                        <span>
                          Client: <strong className="text-text-primary">{currentRequest.customer?.name || 'Customer'}</strong>
                          {currentRequest.customer?.email ? ` (${currentRequest.customer.email})` : ''}
                        </span>
                        <span>•</span>
                        <span>Package: <strong className="text-text-primary">{PACKAGE_LABELS[currentRequest.package] || currentRequest.package}</strong></span>
                        <span>•</span>
                        <span>Price: <strong className="text-emerald-400 font-mono">${currentRequest.price}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyTask(currentRequest, true)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition-colors"
                      title="Re-apply complete prompt from this task's original request, script and requirements"
                    >
                      <Sparkles size={12} /> Re-apply Complete Prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-surface hover:bg-surface/80 text-text-secondary hover:text-text-primary border border-border flex items-center gap-1 transition-colors"
                      title="View complete specifications and manage order"
                    >
                      <Eye size={12} /> Full Specs
                    </button>
                  </div>
                </div>

                {/* Creative Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-purple-500/15 text-xs">
                  {brief.targetAudience ? (
                    <div className="p-2.5 rounded-xl bg-surface/50 border border-border/60">
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                        Target Audience
                      </span>
                      <p className="text-text-primary font-medium line-clamp-2">{brief.targetAudience}</p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-surface/50 border border-border/60">
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                        Target Audience
                      </span>
                      <p className="text-text-secondary italic">General audience</p>
                    </div>
                  )}

                  {brief.tone ? (
                    <div className="p-2.5 rounded-xl bg-surface/50 border border-border/60">
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                        Tone & Style
                      </span>
                      <p className="text-text-primary font-medium line-clamp-2">{brief.tone}</p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-surface/50 border border-border/60">
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                        Tone & Style
                      </span>
                      <p className="text-text-secondary italic">Natural & engaging</p>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-surface/50 border border-border/60">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                      Delivery Mode
                    </span>
                    <p className="text-text-primary font-medium flex items-center gap-1">
                      <Truck size={12} className="text-purple-400" />
                      {currentRequest.deliveryType === 'QUALITY_CHECKED' ? 'Quality Checked' : 'Instant Delivery'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface/50 border border-border/60">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                      Submission Date
                    </span>
                    <p className="text-text-primary font-medium flex items-center gap-1">
                      <Calendar size={12} className="text-purple-400" />
                      {fmtDate(currentRequest.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Inclusions & Script Notes if present */}
                {(inclusions.length > 0 || brief.additionalNotes || brief.keyMessage) && (
                  <div className="space-y-2 pt-2 border-t border-purple-500/15 text-xs">
                    {brief.keyMessage && (
                      <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20">
                        <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block mb-0.5">
                          Key Message / Core Hook
                        </span>
                        <p className="text-text-primary font-medium">{brief.keyMessage}</p>
                      </div>
                    )}

                    {inclusions.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1">
                          Key Inclusions / Talking Points:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {inclusions.map((item: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {brief.additionalNotes && (
                      <div className="p-2.5 rounded-xl bg-surface/40 border border-border/60">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                          Client Instructions / Script Notes
                        </span>
                        <p className="text-text-secondary whitespace-pre-wrap">{brief.additionalNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Studio Task Context: Customer Request & Influencer Script ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Request Box */}
                <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-300 flex items-center gap-1.5">
                      <Quote size={13} /> Customer's Original Request
                    </span>
                    {originalReq && (
                      <button
                        type="button"
                        onClick={handleCopyOriginal}
                        className="text-[11px] text-text-secondary hover:text-blue-300 flex items-center gap-1"
                        title="Copy original request"
                      >
                        {copiedOriginal ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedOriginal ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-3 bg-black/30 p-2.5 rounded-lg border border-blue-500/10 font-medium">
                    {originalReq ? `"${originalReq}"` : (brief.productName || 'Custom Video Request')}
                  </p>
                </div>

                {/* Influencer Script Box */}
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Film size={13} /> Influencer Suggested Script
                    </span>
                    {influencerScript && (
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="text-[11px] text-text-secondary hover:text-purple-300 flex items-center gap-1"
                        title="Copy influencer script"
                      >
                        {copiedScript ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-purple-200 font-mono line-clamp-3 bg-black/30 p-2.5 rounded-lg border border-purple-500/10">
                    {influencerScript || 'Included inside auto-generated prompt below.'}
                  </p>
                </div>
              </div>

              {/* Conversation Context Drawer in Studio */}
              {conversationContext.length > 0 && (
                <div className="glass-card p-3.5 border border-border rounded-xl bg-surface/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-brand-light" />
                      Conversation History with Client ({conversationContext.length} messages)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowChatContext((prev) => !prev)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors flex items-center gap-1"
                    >
                      {showChatContext ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span>{showChatContext ? 'Hide Context' : 'Show Chat'}</span>
                    </button>
                  </div>

                  {showChatContext && (
                    <div className="max-h-60 overflow-y-auto space-y-2 p-3 rounded-lg bg-black/50 border border-border/60 custom-scrollbar text-xs">
                      {conversationContext.map((msg, i) => {
                        const isAssistant = msg.role?.toUpperCase() === 'ASSISTANT';
                        return (
                          <div
                            key={msg.id || i}
                            className={cn(
                              'p-2.5 rounded-lg max-w-[88%]',
                              isAssistant
                                ? 'ml-auto bg-purple-950/40 border border-purple-500/30 text-purple-100'
                                : 'mr-auto bg-surface/80 border border-border text-slate-200'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-text-secondary/70 mb-0.5">
                              <span>{isAssistant ? currentRequest.influencer?.name || 'Influencer' : currentRequest.customer?.name || 'Customer'}</span>
                              <span>{fmtDateTime(msg.createdAt)}</span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Generation Controls Card */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-5">
                {/* Prompt Section */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} className="text-purple-400" />
                        Video Generation Prompt
                      </label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Auto-Filled & Reviewable
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const complete = buildCompleteTaskPrompt(currentRequest);
                          setGenPrompt(complete);
                          toast({
                            title: 'Prompt Reset & Re-applied',
                            description: `Complete prompt reloaded from Task ${formatDisplayOrderId(currentRequest.id)}.`,
                            variant: 'success',
                          });
                        }}
                        className="text-[11px] text-purple-300 hover:text-purple-200 transition-colors flex items-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded-lg border border-purple-500/25"
                        title="Re-apply complete task prompt including original request, script and requirements"
                      >
                        <RotateCcw size={11} /> Re-apply Complete Prompt
                      </button>
                      <span className="text-[11px] text-text-secondary/70 font-mono">
                        {genPrompt.length} chars
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-secondary mb-2">
                    Review and edit the auto-filled prompt below before generating. You can refine visual descriptions, pacing, camera movements, or dialogue.
                  </p>

                  <textarea
                    rows={9}
                    value={genPrompt}
                    onChange={(e) => setGenPrompt(e.target.value)}
                    placeholder="Enter detailed prompt for the AI video generator..."
                    className="w-full px-4 py-3 bg-black/80 border border-purple-500/30 rounded-xl font-mono text-xs text-text-primary focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 leading-relaxed shadow-inner"
                  />
                </div>

                {/* Model & Parameters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* AI Video Provider / Engine */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                      AI Video Engine
                    </label>
                    <select
                      value={genProvider}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGenProvider(val);
                        if (val.includes('Runway')) setGenModel('gen3-alpha');
                        else if (val.includes('Luma')) setGenModel('dream-machine-v1');
                        else if (val.includes('Sora')) setGenModel('sora-turbo');
                        else if (val.includes('Kling')) setGenModel('kling-1.5');
                        else setGenModel('pika-2.0');
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand"
                    >
                      <option value="Runway Gen-3">Runway Gen-3 Alpha (Recommended)</option>
                      <option value="Luma Dream Machine">Luma Dream Machine (Realistic)</option>
                      <option value="OpenAI Sora">OpenAI Sora (Cinematic)</option>
                      <option value="Kling AI">Kling AI 1.5 (High Fidelity)</option>
                      <option value="Pika 2.0">Pika 2.0 (Dynamic Motion)</option>
                    </select>
                  </div>

                  {/* Duration Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                      Duration
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['5s', '10s', '15s', '30s'].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setGenDuration(dur)}
                          className={cn(
                            'py-2 rounded-lg text-xs font-semibold transition-all border font-mono text-center',
                            genDuration === dur
                              ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                              : 'bg-background border-border text-text-secondary hover:text-text-primary hover:border-purple-400/40',
                          )}
                        >
                          {dur}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: '9:16', label: '9:16 Reel' },
                        { id: '16:9', label: '16:9 Land' },
                        { id: '1:1', label: '1:1 Sq' },
                      ].map((ratio) => (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => setGenAspectRatio(ratio.id)}
                          className={cn(
                            'py-2 rounded-lg text-xs font-semibold transition-all border font-mono text-center',
                            genAspectRatio === ratio.id
                              ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                              : 'bg-background border-border text-text-secondary hover:text-text-primary hover:border-purple-400/40',
                          )}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate Action Button & Active Progress Banner */}
                <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-text-secondary">
                    {isGenerating ? (
                      <div className="flex items-center gap-2 text-purple-400 font-medium animate-pulse">
                        <Loader2 size={15} className="animate-spin text-purple-400" />
                        <span>{GENERATION_STEPS[genStepIndex]}</span>
                      </div>
                    ) : (
                      <span>
                        Generated videos are automatically saved to this request and can be previewed,
                        downloaded, or sent to client immediately.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleTriggerGenerate}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-brand hover:from-purple-500 hover:to-brand-light text-white font-bold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Rendering Video…
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Generate Video
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instant Generated Video Result Preview */}
              {(latestGeneratedVideo || previewVideoUrl) && (
                <div className="glass-card p-5 border border-purple-500/40 rounded-xl space-y-4 bg-purple-950/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="font-bold text-sm text-text-primary">
                        Generated Video Result
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Take #{generatedVideos.length || 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={latestGeneratedVideo?.url || previewVideoUrl}
                        download
                        className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Download size={13} /> Download MP4
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewVideoUrl(latestGeneratedVideo?.url || previewVideoUrl);
                          setActiveTab('send-client');
                        }}
                        className="btn-brand text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-sm"
                      >
                        <Send size={13} /> Send this Take to Client
                      </button>
                    </div>
                  </div>

                  {/* Player */}
                  <div className="rounded-xl overflow-hidden bg-black/90 border border-border aspect-video max-h-[360px] flex items-center justify-center">
                    <video
                      controls
                      playsInline
                      src={latestGeneratedVideo?.url || previewVideoUrl}
                      className="w-full h-full object-contain max-h-[360px]"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>

                  {/* Details strip */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-text-secondary pt-1 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <span>Engine: <strong className="text-text-primary font-mono">{latestGeneratedVideo?.provider || genProvider}</strong></span>
                      <span>Format: <strong className="text-text-primary font-mono">{latestGeneratedVideo?.aspectRatio || genAspectRatio}</strong></span>
                      <span>Duration: <strong className="text-text-primary font-mono">{latestGeneratedVideo?.duration || genDuration}</strong></span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCheck size={13} /> Saved automatically to request history
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: SEND TO CLIENT (As Influencer)
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'send-client' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900/30 via-brand/15 to-emerald-900/30 border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-500/10 flex-shrink-0">
                    <Send size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-text-primary flex items-center gap-2">
                      Send Video Directly to Client
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        As Assigned Influencer
                      </span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      The video and message will be delivered directly into the client's 1-on-1 chat
                      using the assigned influencer's official account and verified persona.
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Success Alert if just sent */}
              {sendSuccessInfo && (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle2 size={16} />
                    <span>Video Deliverable Successfully Sent!</span>
                  </div>
                  <p className="text-xs text-emerald-200/90 leading-relaxed">
                    Message posted to customer chat at <strong>{sendSuccessInfo.sentAt}</strong> as{' '}
                    <strong>{sendSuccessInfo.deliveredAs}</strong>. Order status has been updated to{' '}
                    <strong className="text-emerald-300">DELIVERED</strong> and an in-app
                    notification was dispatched to the client.
                  </p>
                </div>
              )}

              {/* Influencer → Client → Video Request Pipeline Header */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-surface/60 to-emerald-950/30 border border-purple-500/25 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <InfluencerAvatar influencer={currentRequest.influencer} size="sm" />
                    <div>
                      <span className="text-[10px] text-purple-300 uppercase tracking-wider block font-bold">1. Influencer Persona</span>
                      <span className="text-xs font-bold text-text-primary">{currentRequest.influencer?.name || 'Assigned Influencer'}</span>
                    </div>
                  </div>

                  <span className="text-purple-400/50 hidden sm:inline font-bold">→</span>

                  <div className="flex items-center gap-2">
                    <ClientAvatar customer={currentRequest.customer} size="sm" />
                    <div>
                      <span className="text-[10px] text-brand-light uppercase tracking-wider block font-bold">2. Target Client</span>
                      <span className="text-xs font-bold text-text-primary">{currentRequest.customer?.name || 'Client'}</span>
                    </div>
                  </div>

                  <span className="text-purple-400/50 hidden sm:inline font-bold">→</span>

                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-xs font-mono font-bold">
                      #
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-300 uppercase tracking-wider block font-bold">3. Video Task</span>
                      <span className="text-xs font-mono font-bold text-emerald-300">{formatDisplayOrderId(currentRequest.id)}</span>
                    </div>
                  </div>
                </div>

                {videoRequestsList.length > 1 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[11px] text-text-secondary whitespace-nowrap">Switch Task:</span>
                    <select
                      value={currentRequest.id}
                      onChange={(e) => {
                        const target = videoRequestsList.find((r) => r.id === e.target.value);
                        if (target) handleApplyTask(target, true);
                      }}
                      className="px-2.5 py-1 bg-surface border border-purple-500/30 rounded-lg text-xs font-mono text-purple-200 focus:outline-none focus:border-purple-400 max-w-[220px] truncate"
                    >
                      {videoRequestsList.map((req) => (
                        <option key={req.id} value={req.id}>
                          {formatDisplayOrderId(req.id)} • {req.influencer?.name || 'Influencer'} → {req.customer?.name || 'Client'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Identity & Recipient Cards */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Sender Persona Card */}
                <div className="p-4 rounded-xl bg-surface/70 border border-brand/30 space-y-2">
                  <span className="text-[10px] font-bold text-brand-light uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck size={13} /> Sender Persona (Influencer)
                  </span>
                  <div className="flex items-center gap-3">
                    <InfluencerAvatar
                      influencer={currentRequest.influencer}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-text-primary truncate">
                        {currentRequest.influencer?.name || 'Assigned Influencer'}
                      </p>
                      <span className="text-[11px] text-text-secondary block">
                        Verified AI Influencer • {currentRequest.influencer?.serviceType || 'VIDEO_CREATION'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-text-secondary/80 pt-1 border-t border-border/60">
                    The client will receive this message as an authentic response from{' '}
                    <strong className="text-text-primary">{currentRequest.influencer?.name || 'the assigned influencer'}</strong>.
                  </p>
                </div>

                {/* Recipient Client Card */}
                <div className="p-4 rounded-xl bg-surface/70 border border-border space-y-2">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                    <User size={13} /> Recipient Client
                  </span>
                  <div className="flex items-center gap-3">
                    <ClientAvatar
                      customer={currentRequest.customer}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-text-primary truncate">
                        {currentRequest.customer?.name || 'Client'}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {currentRequest.customer?.email}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-text-secondary/80 pt-1 border-t border-border/60 truncate">
                    Order {formatDisplayOrderId(currentRequest.id)} • Package:{' '}
                    {PACKAGE_LABELS[currentRequest.package] || currentRequest.package}
                  </p>
                </div>
              </div>

              {/* Video Attachment Preview & Take Chooser */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <Film size={14} className="text-brand-light" />
                    Video Deliverable to Attach
                  </h4>

                  {generatedVideos.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-text-secondary">Select Take:</span>
                      <select
                        value={previewVideoUrl}
                        onChange={(e) => setPreviewVideoUrl(e.target.value)}
                        className="px-2.5 py-1 bg-background border border-border rounded-lg text-xs font-mono text-text-primary focus:outline-none focus:border-brand"
                      >
                        {generatedVideos.map((take: any, idx: number) => (
                          <option key={take.id || idx} value={take.url}>
                            Take #{generatedVideos.length - idx} ({take.duration || '15s'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {previewVideoUrl ? (
                  <div className="rounded-xl overflow-hidden bg-black/90 border border-border aspect-video max-h-[260px] flex items-center justify-center">
                    <video
                      controls
                      playsInline
                      src={previewVideoUrl}
                      className="w-full h-full object-contain max-h-[260px]"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border bg-surface/30 text-center space-y-2">
                    <AlertCircle size={24} className="text-amber-400 mx-auto" />
                    <p className="text-xs text-text-secondary">
                      No video is currently selected. Please generate a video first in the "Create
                      Video Studio" tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('create-video')}
                      className="btn-brand text-xs px-3 py-1.5"
                    >
                      <Wand2 size={12} /> Generate Video Now
                    </button>
                  </div>
                )}
              </div>

              {/* Message Composer in Influencer Persona */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-emerald-400" />
                    Client Delivery Message (In Influencer Persona)
                  </label>

                  {/* Tone Preset Buttons */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-text-secondary">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setClientMessageText(
                          `Hey ${custName}! 👋 Here is your custom video for "${prodName}". I had so much fun creating this for you! Give it a watch and let me know what you think. Looking forward to our next collaboration! ✨`,
                        )
                      }
                      className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-text-secondary hover:text-text-primary hover:border-brand/40"
                    >
                      Casual
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setClientMessageText(
                          `🔥 What's up ${custName}! Your custom video for "${prodName}" is officially ready and it looks incredible! The lighting, energy, and messaging are on point. Check it out and let's get this live! 🚀🎬`,
                        )
                      }
                      className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-text-secondary hover:text-text-primary hover:border-brand/40"
                    >
                      Hype
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setClientMessageText(
                          `Hello ${custName}, please find the completed video deliverable for "${prodName}" attached above. It has been rendered according to your creative specifications and quality standards. Please review at your convenience. Best regards, ${currentRequest.influencer?.name || 'Influencer'}`,
                        )
                      }
                      className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-text-secondary hover:text-text-primary hover:border-brand/40"
                    >
                      Formal
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={clientMessageText}
                  onChange={(e) => setClientMessageText(e.target.value)}
                  placeholder="Enter message text that will be sent to the client as the influencer..."
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand leading-relaxed"
                />

                {/* Delivery Notes */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                    Internal Admin Notes (Optional - Saved to History)
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="e.g. Sent take #1 after review approval by Admin"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand"
                  />
                </div>

                {/* Send Button */}
                <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isSending || !previewVideoUrl}
                    onClick={handleTriggerSendToClient}
                    className="btn-brand px-6 py-2.5 text-sm flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-600/25 disabled:opacity-60"
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Sending to Client…
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Send Video to Client as {currentRequest.influencer?.name || 'Influencer'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 4: HISTORY & TAKES
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Generated Takes Gallery */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film size={18} className="text-purple-400" />
                    <h3 className="font-bold text-sm text-text-primary">
                      All Generated Video Takes ({generatedVideos.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create-video')}
                    className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                  >
                    <Wand2 size={13} /> Generate New Take
                  </button>
                </div>

                {generatedVideos.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-border bg-surface/30 text-center space-y-3">
                    <Video size={28} className="text-text-secondary/50 mx-auto" />
                    <p className="text-xs text-text-secondary">
                      No video takes have been generated yet for this request.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('create-video')}
                      className="btn-brand text-xs px-4 py-2"
                    >
                      <Wand2 size={13} /> Go to Create Video Studio
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedVideos.map((take: any, idx: number) => {
                      const isCurrent = previewVideoUrl === take.url;
                      return (
                        <div
                          key={take.id || idx}
                          className={cn(
                            'p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all',
                            isCurrent
                              ? 'bg-purple-950/20 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                              : 'bg-surface/50 border-border hover:border-brand/40',
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                                <Film size={13} className="text-purple-400" />
                                Take #{generatedVideos.length - idx}
                              </span>
                              <span className="text-[10px] text-text-secondary font-mono">
                                {fmtDateTime(take.generatedAt)}
                              </span>
                            </div>

                            {/* Take Player */}
                            <div className="rounded-lg overflow-hidden bg-black/90 aspect-video relative max-h-[180px]">
                              <video
                                controls
                                playsInline
                                src={take.url}
                                className="w-full h-full object-contain"
                              />
                            </div>

                            {/* Take Specifications */}
                            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-mono">
                              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                {take.provider || 'AI Engine'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                                ⏱ {take.duration || '15s'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                                📐 {take.aspectRatio || '9:16'}
                              </span>
                            </div>

                            {/* Take Prompt Snippet */}
                            {take.prompt && (
                              <p className="text-[11px] text-text-secondary/80 line-clamp-2 mt-2 italic font-mono bg-black/40 p-2 rounded border border-border/50">
                                "{take.prompt}"
                              </p>
                            )}
                          </div>

                          {/* Take Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/60">
                            <a
                              href={take.url}
                              download
                              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"
                            >
                              <Download size={12} /> Download
                            </a>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewVideoUrl(take.url);
                                  setVideoUrlInput(take.url);
                                  toast({
                                    title: `Take #${generatedVideos.length - idx} Selected`,
                                    description: 'Set as active preview and deliverable.',
                                    variant: 'success',
                                  });
                                }}
                                className={cn(
                                  'text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
                                  isCurrent
                                    ? 'bg-purple-600 text-white border-purple-500 font-semibold'
                                    : 'btn-ghost border-border',
                                )}
                              >
                                {isCurrent ? 'Active Take' : 'Set as Active'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewVideoUrl(take.url);
                                  setActiveTab('send-client');
                                }}
                                className="btn-brand text-xs px-3 py-1.5 flex items-center gap-1"
                              >
                                <Send size={12} /> Send Take
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Complete Chronological History Timeline */}
              <div className="glass-card p-5 border border-border rounded-xl space-y-4">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-blue-400" />
                  <h3 className="font-bold text-sm text-text-primary">
                    Request & Delivery Activity Audit Trail
                  </h3>
                </div>

                <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70 pl-7">
                  {/* Item 1: Deliveries and Generations from historyList */}
                  {historyList.map((hist: any, i: number) => {
                    const isGen = hist.action === 'VIDEO_GENERATED';
                    const isDelivery = hist.action === 'DELIVERED_TO_CLIENT';

                    return (
                      <div key={hist.id || i} className="relative group">
                        {/* Dot icon */}
                        <div
                          className={cn(
                            'absolute -left-7 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white',
                            isGen
                              ? 'bg-purple-600'
                              : isDelivery
                              ? 'bg-emerald-600'
                              : 'bg-brand',
                          )}
                        >
                          {isGen ? <Wand2 size={10} /> : isDelivery ? <Send size={10} /> : <Check size={10} />}
                        </div>

                        <div className="p-3 rounded-xl bg-surface/40 border border-border/80 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary">
                              {isGen
                                ? 'AI Video Generated'
                                : isDelivery
                                ? 'Delivered to Client as Influencer'
                                : hist.action}
                            </span>
                            <span className="text-[10px] text-text-secondary/70">
                              {fmtDateTime(hist.timestamp)}
                            </span>
                          </div>

                          {isGen && (
                            <p className="text-text-secondary text-[11px]">
                              Rendered via {hist.provider || 'AI Engine'} ({hist.model || 'Standard'}).{' '}
                              {hist.prompt && <span className="italic block mt-0.5 font-mono truncate">Prompt: "{hist.prompt}"</span>}
                            </p>
                          )}

                          {isDelivery && (
                            <p className="text-text-secondary text-[11px]">
                              Sent to {hist.clientName || 'Client'} in 1-on-1 chat as{' '}
                              <strong className="text-text-primary">{hist.deliveredAs || currentRequest.influencer?.name}</strong>.{' '}
                              {hist.notes && <span className="block mt-0.5 text-[10px] text-text-secondary/70">Notes: {hist.notes}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Initial Request Placement */}
                  <div className="relative">
                    <div className="absolute -left-7 top-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">
                      <FileText size={10} />
                    </div>
                    <div className="p-3 rounded-xl bg-surface/40 border border-border/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">Video Request Created</span>
                        <span className="text-[10px] text-text-secondary/70">
                          {fmtDateTime(currentRequest.createdAt)}
                        </span>
                      </div>
                      <p className="text-text-secondary text-[11px]">
                        Order {formatDisplayOrderId(currentRequest.id)} requested by{' '}
                        {currentRequest.customer?.name || 'Customer'} for influencer{' '}
                        {currentRequest.influencer?.name}. Package: {PACKAGE_LABELS[currentRequest.package] || currentRequest.package}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/80 sticky bottom-0 z-20">
          <Link
            href={`/admin/orders/${currentRequest.id}`}
            className="text-xs text-brand-light hover:underline flex items-center gap-1"
          >
            Open Full Order Page <ChevronRight size={13} />
          </Link>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
              Close
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveChanges}
              className="btn-brand px-5 py-2 text-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check size={14} /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Admin Video Requests Page ─────────────────────────────────────────

export default function AdminVideoRequestsPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, hydrated } = useAuthStore();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [serviceScope, setServiceScope] = useState<'VIDEO_ONLY' | 'ALL'>('VIDEO_ONLY');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'PRICE_HIGH' | 'PRICE_LOW'>('NEWEST');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Modal inspection state
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<
    'overview' | 'create-video' | 'send-client' | 'history'
  >('overview');

  const handleOpenModal = (
    request: any,
    tab: 'overview' | 'create-video' | 'send-client' | 'history' = 'overview',
  ) => {
    setActiveRequest(request);
    setActiveModalTab(tab);
  };

  // Fetch all orders with fast polling
  const { data, loading, refetch } = useQuery(GET_ALL_ORDERS, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 3000,
  });

  // Real-time synchronization: listen for video requests created & orders updated
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    const handleRealtimeSync = () => {
      refetch();
    };

    socket.on('videoRequestCreated', handleRealtimeSync);
    socket.on('orderUpdated', handleRealtimeSync);
    socket.on('newMessage', handleRealtimeSync);

    return () => {
      socket.off('videoRequestCreated', handleRealtimeSync);
      socket.off('orderUpdated', handleRealtimeSync);
      socket.off('newMessage', handleRealtimeSync);
    };
  }, [token, refetch]);

  // Authentication check
  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (hydrated && isAuthenticated && user?.role === 'ADMIN') {
      refetch();
    }
  }, [hydrated, isAuthenticated, user, refetch]);

  const allOrders: any[] = data?.allOrders ?? [];

  // Filter for video requests: completely unified with isVideoOrder so all influencers and clients are handled dynamically
  const isVideoRequest = (o: any) => {
    if (serviceScope === 'ALL') return true;
    return isVideoOrder(o);
  };

  const videoOrders = useMemo(() => allOrders.filter(isVideoRequest), [allOrders, serviceScope]);

  // Unique Influencers from video requests
  const uniqueInfluencers = useMemo(() => {
    const map = new Map<string, any>();
    videoOrders.forEach((o) => {
      const infId = o.influencer?.id || o.influencerId;
      if (infId && !map.has(infId)) {
        map.set(infId, o.influencer || { id: infId, name: 'Influencer' });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [videoOrders]);

  // Unique Clients from video requests
  const uniqueClients = useMemo(() => {
    const map = new Map<string, any>();
    videoOrders.forEach((o) => {
      const custId = o.customer?.id || o.customerId;
      if (custId && !map.has(custId)) {
        map.set(custId, o.customer || { id: custId, name: (o.customerId ? `Client #${o.customerId.slice(0, 8)}` : 'Client') });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [videoOrders]);

  // Calculate Metrics (KPIs)
  const kpis = useMemo(() => {
    const total = videoOrders.length;
    const pending = videoOrders.filter((o) => isPendingOrderStatus(o.status)).length;
    const completed = videoOrders.filter((o) =>
      ['DELIVERED', 'APPROVED'].includes(o.status),
    ).length;
    const hasVideoAttached = videoOrders.filter((o) => Boolean(o.videoUrl)).length;
    const inReview = videoOrders.filter((o) => o.status === 'PENDING_REVIEW').length;
    const totalVideosDelivered = videoOrders.reduce(
      (sum, o) => sum + (Number(o.videosDelivered) || 0),
      0,
    );
    const totalVideosOrdered = videoOrders.reduce(
      (sum, o) => sum + (Number(o.videosOrdered) || 1),
      0,
    );
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      pending,
      completed,
      hasVideoAttached,
      inReview,
      totalVideosDelivered,
      totalVideosOrdered,
      completionRate,
    };
  }, [videoOrders]);

  // Date filtering logic
  const matchDate = (iso: string) => {
    if (dateFilter === 'ALL') return true;
    const orderDate = new Date(iso);
    const now = new Date();

    if (dateFilter === 'TODAY') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getDate() === now.getDate()
      );
    }
    if (dateFilter === '7DAYS') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      return orderDate >= past7;
    }
    if (dateFilter === '30DAYS') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      return orderDate >= past30;
    }
    if (dateFilter === 'THIS_MONTH') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth()
      );
    }
    if (dateFilter === 'CUSTOM') {
      const start = customStartDate ? new Date(customStartDate) : null;
      const end = customEndDate ? new Date(customEndDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      if (start && orderDate < start) return false;
      if (end && orderDate > end) return false;
      return true;
    }
    return true;
  };

  // Status filtering logic
  const matchStatus = (status: string) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING_GROUP') {
      return ['PENDING_PAYMENT', 'PAID', 'GENERATING', 'PENDING_REVIEW'].includes(status);
    }
    if (statusFilter === 'COMPLETED_GROUP') {
      return ['APPROVED', 'DELIVERED'].includes(status);
    }
    return status === statusFilter;
  };

  // Filtered and Sorted Video Requests List
  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return videoOrders
      .filter((o) => {
        // Status filter
        if (!matchStatus(o.status)) return false;

        // Influencer filter
        if (selectedInfluencerId !== 'ALL' && o.influencer?.id !== selectedInfluencerId) {
          return false;
        }

        // Customer filter
        if (selectedCustomerId !== 'ALL' && o.customer?.id !== selectedCustomerId) {
          return false;
        }

        // Date filter
        if (!matchDate(o.createdAt)) return false;

        // Search Query
        if (q) {
          const brief = toBriefObject(o.projectBrief);
          const fields = [
            o.id,
            o.customer?.name,
            o.customer?.email,
            o.customer?.company,
            o.influencer?.name,
            o.status,
            o.package,
            brief?.productName,
            brief?.keyMessage,
            brief?.notes,
            brief?.additionalNotes,
          ]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase());

          const match = fields.some((f) => f.includes(q));
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'NEWEST') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'OLDEST') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'PRICE_HIGH') {
          return (b.price || 0) - (a.price || 0);
        }
        if (sortBy === 'PRICE_LOW') {
          return (a.price || 0) - (b.price || 0);
        }
        return 0;
      });
  }, [
    videoOrders,
    statusFilter,
    selectedInfluencerId,
    selectedCustomerId,
    dateFilter,
    customStartDate,
    customEndDate,
    searchQuery,
    sortBy,
  ]);

  const activeFiltersCount = [
    statusFilter !== 'ALL',
    selectedInfluencerId !== 'ALL',
    selectedCustomerId !== 'ALL',
    dateFilter !== 'ALL',
    Boolean(searchQuery.trim()),
    serviceScope !== 'VIDEO_ONLY',
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSelectedInfluencerId('ALL');
    setSelectedCustomerId('ALL');
    setDateFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
    setServiceScope('VIDEO_ONLY');
    setSortBy('NEWEST');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-lg shadow-brand/20">
              <Video size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Video <span className="gradient-text">Requests</span>
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                Centralized hub to track, review, and deliver AI influencer video requests
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Scope Toggle */}
          <div className="flex rounded-lg border border-border p-1 bg-surface text-xs font-medium">
            <button
              onClick={() => setServiceScope('VIDEO_ONLY')}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors',
                serviceScope === 'VIDEO_ONLY'
                  ? 'bg-brand text-white shadow'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              Video Only ({videoOrders.length})
            </button>
            <button
              onClick={() => setServiceScope('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors',
                serviceScope === 'ALL'
                  ? 'bg-brand text-white shadow'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              All Requests ({allOrders.length})
            </button>
          </div>

          <button
            onClick={() => {
              const target =
                (selectedInfluencerId !== 'ALL'
                  ? videoOrders.find(
                      (o) =>
                        o.influencer?.id === selectedInfluencerId &&
                        isPendingOrderStatus(o.status),
                    )
                  : null) ||
                videoOrders.find((o) => isPendingOrderStatus(o.status)) ||
                videoOrders[0];
              if (target) {
                handleOpenModal(target, 'create-video');
              } else {
                toast({
                  title: 'No Pending Video Requests Found',
                  description: 'There are currently no pending video requests to generate for.',
                  variant: 'default',
                });
              }
            }}
            className="btn-brand text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-md shadow-brand/20 whitespace-nowrap"
            title="Open Video Generation Studio for next pending request"
          >
            <Wand2 size={13} /> Create Video
          </button>

          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 rounded-lg border border-border bg-surface text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
            title="Refresh Requests"
          >
            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={cn(
            'glass-card p-5 border rounded-2xl cursor-pointer transition-all hover:scale-[1.01] hover:border-brand/40',
            statusFilter === 'ALL' ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/30' : 'border-border',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Total Video Requests
            </span>
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand-light flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-text-primary mt-2">
            {kpis.total}
          </p>
          <div className="flex items-center justify-between text-xs text-text-secondary mt-2">
            <span>{kpis.hasVideoAttached} with ready video</span>
            <span className="text-brand-light font-medium">Click to view all</span>
          </div>
        </div>

        {/* Pending Requests */}
        <div
          onClick={() => setStatusFilter('PENDING_GROUP')}
          className={cn(
            'glass-card p-5 border rounded-2xl cursor-pointer transition-all hover:scale-[1.01] hover:border-amber-500/40',
            statusFilter === 'PENDING_GROUP'
              ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30'
              : 'border-border',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Pending Requests
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2">
            {kpis.pending}
          </p>
          <div className="flex items-center justify-between text-xs text-text-secondary mt-2">
            <span>{kpis.inReview} awaiting review QA</span>
            <span className="text-amber-400 font-medium">Click to filter</span>
          </div>
        </div>

        {/* Completed Requests */}
        <div
          onClick={() => setStatusFilter('COMPLETED_GROUP')}
          className={cn(
            'glass-card p-5 border rounded-2xl cursor-pointer transition-all hover:scale-[1.01] hover:border-emerald-500/40',
            statusFilter === 'COMPLETED_GROUP'
              ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30'
              : 'border-border',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Completed Requests
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2">
            {kpis.completed}
          </p>
          <div className="flex items-center justify-between text-xs text-text-secondary mt-2">
            <span>{kpis.completionRate}% completion rate</span>
            <span className="text-emerald-400 font-medium">Click to filter</span>
          </div>
        </div>

        {/* Video Production Volume */}
        <div className="glass-card p-5 border border-border rounded-2xl hidden lg:block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Videos Produced
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Film size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-text-primary mt-2">
            {kpis.totalVideosDelivered}{' '}
            <span className="text-sm font-normal text-text-secondary">
              / {kpis.totalVideosOrdered} ordered
            </span>
          </p>
          <div className="w-full bg-surface rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-brand h-1.5 rounded-full transition-all"
              style={{
                width: `${
                  kpis.totalVideosOrdered > 0
                    ? Math.min(100, Math.round((kpis.totalVideosDelivered / kpis.totalVideosOrdered) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="glass-card p-4 sm:p-5 border border-border rounded-2xl space-y-4">
        {/* Top Row: Search + View Toggle + Clear Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="text"
              placeholder="Search by client, influencer, request ID, product, or brief..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-brand transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-xs">
              <ArrowUpDown size={14} className="text-text-secondary" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="PRICE_HIGH">Highest Price</option>
                <option value="PRICE_LOW">Lowest Price</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-border bg-background p-1">
              <button
                onClick={() => setViewMode('TABLE')}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  viewMode === 'TABLE'
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                )}
                title="Table View"
              >
                <LayoutList size={16} />
              </button>
              <button
                onClick={() => setViewMode('CARDS')}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  viewMode === 'CARDS'
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                )}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            {/* Clear Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
              >
                <X size={13} /> Clear Filters ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Status Tabs + Influencer + Client + Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_GROUP">All Pending (In Progress / QA)</option>
              <option value="COMPLETED_GROUP">All Completed (Delivered / Approved)</option>
              <option value="PENDING_REVIEW">Pending Review Only</option>
              <option value="GENERATING">Generating Video</option>
              <option value="PAID">Paid / In Queue</option>
              <option value="APPROVED">Approved</option>
              <option value="DELIVERED">Delivered</option>
              <option value="PENDING_PAYMENT">Pending Payment</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Influencer Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Influencer
            </label>
            <select
              value={selectedInfluencerId}
              onChange={(e) => setSelectedInfluencerId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="ALL">All Influencers ({uniqueInfluencers.length})</option>
              {uniqueInfluencers.map((inf) => (
                <option key={inf.id} value={inf.id}>
                  {inf.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Client
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="ALL">All Clients ({uniqueClients.length})</option>
              {uniqueClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name || client.email}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Request Date
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker if active */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-surface/50 border border-border rounded-xl">
            <span className="text-xs text-text-secondary font-medium">Custom Range:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Active Status Filter Quick Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-text-secondary text-xs font-medium whitespace-nowrap">
          Quick Filter:
        </span>
        {[
          { id: 'ALL', label: 'All Video Requests' },
          { id: 'PENDING_GROUP', label: 'Pending Only' },
          { id: 'PENDING_REVIEW', label: 'In Review Queue' },
          { id: 'GENERATING', label: 'Generating' },
          { id: 'DELIVERED', label: 'Delivered' },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'PAID', label: 'Paid / In Queue' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              'px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors font-medium',
              statusFilter === tab.id
                ? 'bg-brand/10 border-brand text-brand-light'
                : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-brand/30',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Results Count Bar ── */}
      <div className="flex items-center justify-between text-xs text-text-secondary px-1">
        <span>
          Showing <strong className="text-text-primary">{filteredRequests.length}</strong> of{' '}
          {videoOrders.length} video requests
        </span>
        {activeFiltersCount > 0 && (
          <button onClick={handleResetFilters} className="text-brand-light hover:underline">
            Reset all filters
          </button>
        )}
      </div>

      {/* ── Content: Loading / Empty / Table / Grid ── */}
      {loading && allOrders.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-4">
          <Loader2 size={36} className="mx-auto text-brand-light animate-spin" />
          <p className="text-sm text-text-secondary">Loading video requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-4">
          <Film size={40} className="mx-auto text-text-secondary/40" />
          <h3 className="font-semibold text-text-primary">No video requests found</h3>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            {activeFiltersCount > 0
              ? 'Try clearing some filters or searching for something else.'
              : 'Video requests from clients will appear here once submitted.'}
          </p>
          {activeFiltersCount > 0 && (
            <button onClick={handleResetFilters} className="btn-secondary text-xs">
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'TABLE' ? (
        /* ── TABLE VIEW ── */
        <div className="glass-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-surface/80 backdrop-blur border-b border-border text-text-secondary text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-3 sm:px-4 w-[22%]">Customer</th>
                  <th className="py-3.5 px-3 sm:px-4 w-[20%]">Influencer</th>
                  <th className="py-3.5 px-3 sm:px-4 w-[22%]">Request / Title</th>
                  <th className="py-3.5 px-3 sm:px-4 w-[12%]">Date & ID</th>
                  <th className="py-3.5 px-3 sm:px-4 w-[11%]">Status</th>
                  <th className="py-3.5 px-3 sm:px-4 w-[13%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRequests.map((request) => {
                  const brief = toBriefObject(request.projectBrief);
                  const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.PAID;
                  const hasVideo = Boolean(request.videoUrl);

                  return (
                    <tr
                      key={request.id}
                      onClick={() => handleOpenModal(request, 'overview')}
                      className="hover:bg-surface/60 transition-colors cursor-pointer group"
                    >
                      {/* 1. Customer */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle">
                        {request.customer ? (
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ClientAvatar customer={request.customer} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs text-text-primary group-hover:text-brand-light transition-colors truncate">
                                {request.customer.name || 'Client'}
                              </p>
                              <p className="text-[11px] text-text-secondary truncate mt-0.5" title={request.customer.email || undefined}>
                                {request.customer.email || '—'}
                              </p>
                              {request.customer.company && (
                                <p className="text-[10px] text-text-secondary/70 truncate">
                                  {request.customer.company}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-secondary text-xs">—</span>
                        )}
                      </td>

                      {/* 2. Influencer */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle">
                        {request.influencer ? (
                          <div className="flex items-center gap-2.5 min-w-0">
                            <InfluencerAvatar
                              influencer={request.influencer}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs text-text-primary group-hover:text-brand-light transition-colors truncate">
                                {request.influencer.name}
                              </p>
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-light bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20 mt-0.5 truncate max-w-full">
                                <Sparkles size={9} className="shrink-0" />
                                <span className="truncate">
                                  {request.influencer.serviceType === 'VIDEO_CREATION'
                                    ? 'Video AI'
                                    : request.influencer.serviceType || 'AI Influencer'}
                                </span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-secondary text-xs">—</span>
                        )}
                      </td>

                      {/* 3. Request/Title */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-semibold text-xs text-text-primary group-hover:text-brand-light transition-colors truncate" title={brief.productName || 'Custom Video Request'}>
                            {brief.productName || 'Custom Video Request'}
                          </p>
                          <span className="inline-block text-[11px] text-text-secondary font-medium">
                            {PACKAGE_LABELS[request.package] || request.package}
                          </span>
                        </div>
                      </td>

                      {/* 4. Date and ID */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-text-primary group-hover:text-brand-light transition-colors">
                          {formatDisplayOrderId(request.id)}
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                          <CalendarDays size={11} className="shrink-0" />
                          <span>{fmtDate(request.createdAt)}</span>
                        </div>
                        <div className="text-[10px] text-text-secondary/60">
                          {timeAgo(request.createdAt)}
                        </div>
                      </td>

                      {/* 5. Status */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle whitespace-nowrap">
                        <div className="space-y-1">
                          <div>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                                statusCfg.badgeCls,
                              )}
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dotCls)} />
                              <span>{statusCfg.label}</span>
                            </span>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            {hasVideo ? (
                              <button
                                type="button"
                                onClick={() => handleOpenModal(request, 'overview')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-brand/10 border border-brand/30 text-brand-light font-medium hover:bg-brand/20 transition-colors"
                              >
                                <Play size={9} className="fill-brand-light" />
                                <span>Video Ready</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-text-secondary/60 inline-flex items-center gap-1 font-mono">
                                <Clock size={9} />
                                <span>In Production</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td
                        className="py-3.5 px-3 sm:px-4 align-middle text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(request, 'create-video')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all shadow-xs"
                            title="Open Video Generation Studio"
                          >
                            <Wand2 size={12} className="shrink-0" />
                            <span>Create</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(request, 'send-client')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all shadow-xs"
                            title="Send Video Directly to Client as Influencer"
                          >
                            <Send size={12} className="shrink-0" />
                            <span>Send</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(request, 'overview')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border hover:bg-surface/80 text-text-secondary hover:text-text-primary transition-all shadow-xs"
                            title="Review & Manage Request"
                          >
                            <Edit size={12} className="shrink-0" />
                            <span>Manage</span>
                          </button>
                          <Link
                            href={`/admin/orders/${request.id}`}
                            className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface/80 text-text-secondary hover:text-brand-light hover:border-brand/40 transition-colors inline-flex items-center justify-center shadow-xs"
                            title="Open Full Details Page"
                          >
                            <ExternalLink size={13} />
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
      ) : (
        /* ── GRID CARDS VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequests.map((request) => {
            const brief = toBriefObject(request.projectBrief);
            const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.PAID;
            const hasVideo = Boolean(request.videoUrl);

            return (
              <div
                key={request.id}
                onClick={() => handleOpenModal(request, 'overview')}
                className="glass-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-brand/50 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div>
                  {/* Top Bar: ID + Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-semibold text-text-secondary group-hover:text-brand-light transition-colors">
                      {formatDisplayOrderId(request.id)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                        statusCfg.badgeCls,
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dotCls)} />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Video Thumbnail / Preview Placeholder */}
                  {hasVideo ? (
                    <div className="rounded-xl overflow-hidden bg-black/90 aspect-video relative mb-3 group/thumb">
                      {request.thumbnailUrl ? (
                        <img
                          src={request.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface">
                          <Video size={32} className="text-brand-light" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover/thumb:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shadow-lg">
                          <Play size={18} className="fill-white translate-x-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white font-medium">
                        Video Ready
                      </span>
                      {Array.isArray(brief.generatedVideos) && brief.generatedVideos.length > 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-950/80 backdrop-blur border border-purple-400/40 text-[10px] text-purple-200 font-semibold flex items-center gap-1">
                          <Film size={10} /> {brief.generatedVideos.length} Take{brief.generatedVideos.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-surface/30 aspect-video flex flex-col items-center justify-center gap-1 mb-3 text-text-secondary">
                      <Film size={24} className="opacity-50" />
                      <span className="text-[11px]">Video in production</span>
                    </div>
                  )}

                  {/* Product Title */}
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <h3 className="font-bold text-sm text-text-primary line-clamp-1">
                      {brief.productName || 'AI Video Request'}
                    </h3>
                  </div>

                  {/* Technical Specifications Chips in Grid */}
                  {(brief.videoDetails?.duration || brief.videoDetails?.aspectRatio) && (
                    <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                      {brief.videoDetails.duration && (
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] border font-mono',
                            brief.videoDetails.duration === 'Not specified'
                              ? 'bg-surface text-amber-400/90 border-amber-500/20'
                              : 'bg-brand/10 text-brand-light border-brand/20',
                          )}
                        >
                          ⏱ {brief.videoDetails.duration}
                        </span>
                      )}
                      {brief.videoDetails.aspectRatio && (
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] border font-mono',
                            brief.videoDetails.aspectRatio === 'Not specified'
                              ? 'bg-surface text-amber-400/90 border-amber-500/20'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                          )}
                        >
                          📐 {brief.videoDetails.aspectRatio.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  )}

                  {brief.keyMessage && (
                    <p className="text-xs text-text-secondary line-clamp-2 mb-2.5">
                      "{brief.keyMessage}"
                    </p>
                  )}

                  {/* Influencer & Client Details */}
                  <div className="space-y-2 py-2 border-t border-border text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary text-[11px] shrink-0">Influencer:</span>
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <InfluencerAvatar influencer={request.influencer} size="sm" />
                        <span className="font-semibold text-text-primary truncate">
                          {request.influencer?.name || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary text-[11px] shrink-0">Client:</span>
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <ClientAvatar customer={request.customer} size="sm" />
                        <span className="font-medium text-text-secondary truncate">
                          {request.customer?.name || request.customer?.email || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary text-[11px]">Package:</span>
                      <span className="text-text-primary font-medium">
                        {PACKAGE_LABELS[request.package] || request.package}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer of Card */}
                <div className="flex items-center justify-between pt-3 border-t border-border mt-3 text-xs">
                  <div>
                    <span className="text-text-secondary text-[11px] block">
                      {fmtDate(request.createdAt)}
                    </span>
                    <span className="font-bold text-sm text-text-primary">
                      ${request.price?.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(request, 'create-video');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                      title="Generate Video in Studio"
                    >
                      <Wand2 size={12} /> Create
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(request, 'send-client');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                      title="Send Video Directly to Client"
                    >
                      <Send size={12} /> Send
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(request, 'overview');
                      }}
                      className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"
                    >
                      {hasVideo ? <Play size={12} className="fill-brand-light" /> : <Edit size={12} />}
                      {hasVideo ? 'Watch' : 'Manage'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Video Request Modal Dialog ── */}
      <AnimatePresence>
        {activeRequest && (
          <VideoRequestModal
            request={activeRequest}
            allOrders={allOrders}
            initialTab={activeModalTab}
            onClose={() => setActiveRequest(null)}
            onSelectRequest={(req) => {
              setActiveRequest(req);
            }}
            onUpdated={(updated) => {
              refetch();
              if (updated && activeRequest && updated.id === activeRequest.id) {
                setActiveRequest(updated);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
