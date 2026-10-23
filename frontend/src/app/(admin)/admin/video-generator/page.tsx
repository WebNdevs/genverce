'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Sparkles,
  Play,
  Pause,
  Download,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Clock,
  Maximize2,
  Tv,
  Smartphone,
  Square,
  AlertCircle,
  Eye,
  X,
  Layers,
  Wand2,
  LayoutGrid,
  LayoutList,
  Info,
  Calendar,
  Zap,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Dices,
  ShieldCheck,
  AlertTriangle,
  Settings2,
  Ratio,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import {
  ADMIN_GENERATE_STANDALONE_VIDEO,
  ADMIN_DELETE_STANDALONE_VIDEO,
} from '@/graphql/mutations/video';
import { ADMIN_GET_STANDALONE_VIDEOS } from '@/graphql/queries/video';
import { GET_SITE_SETTINGS } from '@/graphql/queries/settings';

// ─── Constants & Presets ──────────────────────────────────────────────────────

export interface VideoEngineOption {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  defaultModel: string;
  description: string;
  minDuration?: number;
  maxDuration?: number;
  isBuiltin?: boolean;
  supportsCustomAspect?: boolean;
}

const BUILTIN_VIDEO_PROVIDERS: VideoEngineOption[] = [
  {
    id: 'runway',
    name: 'RunwayML',
    badge: 'Recommended',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    defaultModel: 'gen3a_turbo',
    description: 'Cinematic temporal consistency & photorealistic fluid motion',
    minDuration: 5,
    maxDuration: 16,
    isBuiltin: true,
    supportsCustomAspect: false,
  },
  {
    id: 'luma',
    name: 'Luma Dream Machine',
    badge: 'Fast Render',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    defaultModel: 'ray-2',
    description: 'High-energy physical dynamics and rich camera kinetics',
    minDuration: 5,
    maxDuration: 20,
    isBuiltin: true,
    supportsCustomAspect: false,
  },
  {
    id: 'sora',
    name: 'OpenAI Sora',
    badge: 'Ultra HD',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    defaultModel: 'sora-1.0',
    description: 'Multi-shot narrative scene depth with world coherence',
    minDuration: 5,
    maxDuration: 60,
    isBuiltin: true,
    supportsCustomAspect: true,
  },
  {
    id: 'kling',
    name: 'Kling AI',
    badge: 'Expressive',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    defaultModel: 'kling-v1-6',
    description: 'Detailed character gestures & ultra high-frame-rate realism',
    minDuration: 5,
    maxDuration: 30,
    isBuiltin: true,
    supportsCustomAspect: false,
  },
  {
    id: 'pika',
    name: 'Pika Effects',
    badge: 'Stylized',
    badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    defaultModel: 'pika-2.0',
    description: 'Dynamic cinematic transforms & stylized camera perspectives',
    minDuration: 3,
    maxDuration: 15,
    isBuiltin: true,
    supportsCustomAspect: false,
  },
  {
    id: 'haiper',
    name: 'Haiper AI',
    badge: 'Viral Motion',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    defaultModel: 'haiper-video-2',
    description: 'Perceptual video foundation model for creator content',
    minDuration: 4,
    maxDuration: 15,
    isBuiltin: true,
    supportsCustomAspect: false,
  },
];

const ASPECT_RATIOS = [
  {
    id: '16:9',
    label: '16:9 Landscape',
    sub: 'YouTube, Web, TV',
    icon: Tv,
    aspectClass: 'w-7 h-4',
  },
  {
    id: '9:16',
    label: '9:16 Portrait',
    sub: 'TikTok, Reels, Shorts',
    icon: Smartphone,
    aspectClass: 'w-4 h-7',
  },
  {
    id: '1:1',
    label: '1:1 Square',
    sub: 'Instagram, Feed Ads',
    icon: Square,
    aspectClass: 'w-5 h-5',
  },
];

const DURATIONS = [
  { id: '5s', label: '5s', sub: 'Micro Clip', seconds: 5 },
  { id: '10s', label: '10s', sub: 'Short Reel', seconds: 10 },
  { id: '15s', label: '15s', sub: 'Standard Ad', seconds: 15 },
  { id: '30s', label: '30s', sub: 'Commercial', seconds: 30 },
];

// Per-provider API duration bounds and guidance
const PROVIDER_DURATION_LIMITS: Record<
  string,
  { min: number; max: number; defaultCustom: number; label: string; note: string; quickOptions: number[] }
> = {
  runway: {
    min: 5,
    max: 16,
    defaultCustom: 10,
    label: '5s – 16s',
    note: 'RunwayML (Gen-3) supports clip durations from 5s to 16s.',
    quickOptions: [5, 8, 10, 12, 16],
  },
  luma: {
    min: 5,
    max: 20,
    defaultCustom: 10,
    label: '5s – 20s',
    note: 'Luma Dream Machine supports clip durations from 5s to 20s.',
    quickOptions: [5, 10, 15, 20],
  },
  sora: {
    min: 5,
    max: 60,
    defaultCustom: 20,
    label: '5s – 60s',
    note: 'OpenAI Sora supports extended scene durations from 5s up to 60s.',
    quickOptions: [5, 10, 20, 30, 45, 60],
  },
  kling: {
    min: 5,
    max: 30,
    defaultCustom: 15,
    label: '5s – 30s',
    note: 'Kling AI supports sequence durations from 5s up to 30s.',
    quickOptions: [5, 10, 15, 20, 30],
  },
  pika: {
    min: 3,
    max: 15,
    defaultCustom: 8,
    label: '3s – 15s',
    note: 'Pika Effects supports animation clips from 3s to 15s.',
    quickOptions: [3, 5, 8, 12, 15],
  },
  haiper: {
    min: 4,
    max: 15,
    defaultCustom: 6,
    label: '4s – 15s',
    note: 'Haiper AI supports dynamic creator video clips from 4s to 15s.',
    quickOptions: [4, 6, 8, 12, 15],
  },
  custom: {
    min: 3,
    max: 60,
    defaultCustom: 15,
    label: '3s – 60s',
    note: 'Custom Video API pipeline duration limits.',
    quickOptions: [5, 10, 15, 20, 30, 45, 60],
  },
};

// Per-provider Aspect Ratio configurations & custom aspect ratio capabilities
interface ProviderAspectConfig {
  supportsCustom: boolean;
  minRatio: number;
  maxRatio: number;
  minRatioLabel: string;
  maxRatioLabel: string;
  defaultW: number;
  defaultH: number;
  note: string;
  quickPresets: { w: number; h: number; label: string; sub: string }[];
}

const PROVIDER_ASPECT_CONFIG: Record<string, ProviderAspectConfig> = {
  sora: {
    supportsCustom: true,
    minRatio: 0.33,
    maxRatio: 3.0,
    minRatioLabel: '1:3 (Portrait)',
    maxRatioLabel: '3:1 (Ultrawide)',
    defaultW: 21,
    defaultH: 9,
    note: 'OpenAI Sora supports flexible custom canvas aspect ratios from 1:3 (0.33) up to 3:1 (3.00).',
    quickPresets: [
      { w: 21, h: 9, label: '21:9', sub: 'Ultrawide' },
      { w: 4, h: 3, label: '4:3', sub: 'Standard' },
      { w: 4, h: 5, label: '4:5', sub: 'IG Portrait' },
      { w: 3, h: 2, label: '3:2', sub: 'Classic 35mm' },
      { w: 2.39, h: 1, label: '2.39:1', sub: 'Anamorphic' },
    ],
  },
  custom: {
    supportsCustom: true,
    minRatio: 0.25,
    maxRatio: 4.0,
    minRatioLabel: '1:4',
    maxRatioLabel: '4:1',
    defaultW: 21,
    defaultH: 9,
    note: 'Custom Video API pipeline supports custom canvas width × height ratios from 1:4 (0.25) up to 4:1 (4.00).',
    quickPresets: [
      { w: 21, h: 9, label: '21:9', sub: 'Ultrawide' },
      { w: 4, h: 3, label: '4:3', sub: 'Standard' },
      { w: 4, h: 5, label: '4:5', sub: 'Social' },
      { w: 3, h: 2, label: '3:2', sub: 'Classic' },
      { w: 18, h: 9, label: '18:9', sub: 'Mobile' },
    ],
  },
  runway: {
    supportsCustom: false,
    minRatio: 0.56,
    maxRatio: 1.78,
    minRatioLabel: '9:16',
    maxRatioLabel: '16:9',
    defaultW: 16,
    defaultH: 9,
    note: 'RunwayML Gen-3 strictly supports fixed standard aspect ratios (16:9, 9:16, 1:1).',
    quickPresets: [],
  },
  luma: {
    supportsCustom: false,
    minRatio: 0.56,
    maxRatio: 1.78,
    minRatioLabel: '9:16',
    maxRatioLabel: '16:9',
    defaultW: 16,
    defaultH: 9,
    note: 'Luma Dream Machine strictly supports fixed standard aspect ratios (16:9, 9:16, 1:1).',
    quickPresets: [],
  },
  kling: {
    supportsCustom: false,
    minRatio: 0.56,
    maxRatio: 1.78,
    minRatioLabel: '9:16',
    maxRatioLabel: '16:9',
    defaultW: 16,
    defaultH: 9,
    note: 'Kling AI strictly supports fixed standard aspect ratios (16:9, 9:16, 1:1).',
    quickPresets: [],
  },
  pika: {
    supportsCustom: false,
    minRatio: 0.56,
    maxRatio: 1.78,
    minRatioLabel: '9:16',
    maxRatioLabel: '16:9',
    defaultW: 16,
    defaultH: 9,
    note: 'Pika Effects strictly supports fixed standard aspect ratios (16:9, 9:16, 1:1).',
    quickPresets: [],
  },
  haiper: {
    supportsCustom: false,
    minRatio: 0.56,
    maxRatio: 1.78,
    minRatioLabel: '9:16',
    maxRatioLabel: '16:9',
    defaultW: 16,
    defaultH: 9,
    note: 'Haiper AI strictly supports fixed standard aspect ratios (16:9, 9:16).',
    quickPresets: [],
  },
};

const PROMPT_INSPIRATIONS = [
  {
    title: 'Cyberpunk Drone Hyperlapse',
    prompt:
      'Ultra-cinematic 4K FPV drone dive soaring through futuristic neon cyber-city skyscrapers in dense rainfall with holographic billboards and warm lens flares.',
  },
  {
    title: 'Luxury Perfume Commercial',
    prompt:
      'High-end studio commercial shot of an artisanal golden perfume bottle surrounded by floating water droplets and soft radiant sunlight in slow motion 120fps.',
  },
  {
    title: 'High-Energy Fitness Action',
    prompt:
      'Dynamic athlete sprint training on an urban rooftop track at golden hour sunset, cinematic camera tracking shot with dramatic sweat highlights and anamorphic lens.',
  },
  {
    title: 'Volcanic Island Sunrise',
    prompt:
      'Breathtaking 8K cinematic aerial sweep across mist-covered volcanic emerald peaks as golden sunrise rays break through morning ocean cloud banks.',
  },
  {
    title: 'SaaS Hologram Studio',
    prompt:
      'Futuristic tech workspace where an engineer interacts with luminous translucent glass diagrams and glowing neon data streams in high-tech minimalist studio.',
  },
];

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getUTCMonth()];
    const day = d.getUTCDate();
    const yr = d.getUTCFullYear();
    const hr = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${mon} ${day}, ${yr} • ${hr}:${min} UTC`;
  } catch {
    return String(iso);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminVideoGeneratorPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generator Form State
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('runway');
  const [selectedModel, setSelectedModel] = useState('gen3a_turbo');
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  const [isCustomAspect, setIsCustomAspect] = useState(false);
  const [customAspectWidth, setCustomAspectWidth] = useState<number | string>(21);
  const [customAspectHeight, setCustomAspectHeight] = useState<number | string>(9);

  // Duration State: Presets vs Custom
  const [selectedDuration, setSelectedDuration] = useState('15s');
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationSeconds, setCustomDurationSeconds] = useState(12);

  // Generation UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [latestGeneratedVideo, setLatestGeneratedVideo] = useState<any>(null);

  // Library / Search / View State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModel, setFilterModel] = useState('ALL');
  const [filterAspect, setFilterAspect] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewModalVideo, setPreviewModalVideo] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Video player ref
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const theaterSectionRef = useRef<HTMLDivElement | null>(null);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewModalVideo(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auth Protection
  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, router]);

  // GraphQL: Fetch Site Settings (Built-in + Custom Engines from Admin Settings)
  const { data: settingsData } = useQuery(GET_SITE_SETTINGS, {
    skip: !hydrated || !isAuthenticated || user?.role !== 'ADMIN',
    fetchPolicy: 'cache-and-network',
  });

  // Dynamic Video Engines list: Built-in + Custom Engines from Admin Settings
  const videoEngines = useMemo<VideoEngineOption[]>(() => {
    const list = BUILTIN_VIDEO_PROVIDERS.map((p) => ({ ...p }));
    const s = settingsData?.siteSettings;

    // 1. If admin configured a custom video model for a built-in provider in Settings:
    if (s?.videoProvider && s?.videoModel) {
      const match = list.find((p) => p.id === s.videoProvider.toLowerCase());
      if (match) {
        match.defaultModel = s.videoModel;
      }
    }

    // 2. If main settings has a standalone custom video engine configured:
    if (s?.videoProvider && s.videoProvider.toLowerCase() === 'custom') {
      const customModel = s.videoModel || 'custom-video-v1';
      list.push({
        id: 'custom',
        name: 'Custom Video API',
        badge: 'Custom Engine',
        badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
        defaultModel: customModel,
        description: s.videoApiUrl
          ? `Self-hosted or proxy endpoint: ${s.videoApiUrl}`
          : 'Configured custom AI video generation engine from Admin Settings',
        minDuration: 3,
        maxDuration: 60,
        isBuiltin: false,
        supportsCustomAspect: true,
      });
    }

    // 3. Add all custom video engines configured in Admin Settings:
    if (s?.customVideoEngines) {
      try {
        const customEngines: any[] = JSON.parse(s.customVideoEngines);
        if (Array.isArray(customEngines)) {
          customEngines.forEach((c) => {
            if (c.name && c.model) {
              const engineId = c.id || `custom-${c.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
              if (!list.some((item) => item.id === engineId)) {
                list.push({
                  id: engineId,
                  name: c.name,
                  badge: c.badge || 'Custom Engine',
                  badgeColor: c.badgeColor || 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
                  defaultModel: c.model,
                  description:
                    c.description ||
                    (c.apiUrl ? `Endpoint: ${c.apiUrl}` : 'Custom video rendering engine configured in Admin Settings'),
                  minDuration: c.minDuration || 5,
                  maxDuration: c.maxDuration || 30,
                  isBuiltin: false,
                  supportsCustomAspect: true,
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('Failed to parse customVideoEngines in Video Generator:', err);
      }
    }

    return list;
  }, [settingsData]);

  // Provider Limits Helper (computed from dynamic videoEngines)
  const currentProviderObj =
    videoEngines.find((p) => p.id === selectedProvider) || videoEngines[0] || BUILTIN_VIDEO_PROVIDERS[0];

  const currentProviderLimits = useMemo(() => {
    const predefined = PROVIDER_DURATION_LIMITS[selectedProvider];
    if (predefined) return predefined;

    const min = currentProviderObj.minDuration || 5;
    const max = currentProviderObj.maxDuration || 30;
    const step = max > 30 ? 10 : 5;
    const quick: number[] = [];
    for (let s = min; s <= max; s += step) {
      quick.push(s);
    }
    if (!quick.includes(max)) quick.push(max);

    return {
      min,
      max,
      defaultCustom: Math.min(15, max),
      label: `${min}s – ${max}s`,
      note: currentProviderObj.isBuiltin
        ? `${currentProviderObj.name} supports clip durations from ${min}s to ${max}s.`
        : `Custom engine duration limits: ${min}s to ${max}s.`,
      quickOptions: quick,
    };
  }, [selectedProvider, currentProviderObj]);

  // Clamping custom duration when provider changes
  useEffect(() => {
    const limits = PROVIDER_DURATION_LIMITS[selectedProvider];
    if (limits && isCustomDuration) {
      if (customDurationSeconds > limits.max) {
        setCustomDurationSeconds(limits.max);
        toast({
          title: 'Duration Adjusted',
          description: `Custom duration set to ${limits.max}s to match ${currentProviderObj.name} limit.`,
          variant: 'default',
        });
      } else if (customDurationSeconds < limits.min) {
        setCustomDurationSeconds(limits.min);
      }
    }
  }, [selectedProvider, isCustomDuration]);

  // Derived effective duration string to send to API
  const effectiveDuration = isCustomDuration
    ? `${customDurationSeconds}s`
    : selectedDuration;

  // Provider Aspect Ratio Limits Helper (computed from dynamic videoEngines & presets)
  const currentAspectLimits = useMemo<ProviderAspectConfig>(() => {
    const predefined = PROVIDER_ASPECT_CONFIG[selectedProvider];
    if (predefined) return predefined;

    // Any custom video engines configured in Admin Settings
    if (!currentProviderObj.isBuiltin || currentProviderObj.supportsCustomAspect) {
      return {
        supportsCustom: true,
        minRatio: 0.25,
        maxRatio: 4.0,
        minRatioLabel: '1:4 (Portrait)',
        maxRatioLabel: '4:1 (Panoramic)',
        defaultW: 21,
        defaultH: 9,
        note: `${currentProviderObj.name} custom video pipeline supports flexible canvas ratios from 1:4 to 4:1.`,
        quickPresets: [
          { w: 21, h: 9, label: '21:9', sub: 'Ultrawide' },
          { w: 4, h: 3, label: '4:3', sub: 'Standard' },
          { w: 4, h: 5, label: '4:5', sub: 'Social' },
          { w: 3, h: 2, label: '3:2', sub: 'Classic' },
        ],
      };
    }

    return {
      supportsCustom: false,
      minRatio: 0.56,
      maxRatio: 1.78,
      minRatioLabel: '9:16',
      maxRatioLabel: '16:9',
      defaultW: 16,
      defaultH: 9,
      note: `${currentProviderObj.name} only supports standard fixed ratios (16:9, 9:16, 1:1).`,
      quickPresets: [],
    };
  }, [selectedProvider, currentProviderObj]);

  const supportsCustomAspect = currentAspectLimits.supportsCustom;

  // Custom aspect ratio numeric values and bounds check
  const numAspectWidth =
    typeof customAspectWidth === 'number'
      ? customAspectWidth
      : parseFloat(String(customAspectWidth)) || 0;
  const numAspectHeight =
    typeof customAspectHeight === 'number'
      ? customAspectHeight
      : parseFloat(String(customAspectHeight)) || 0;
  const customRatioValue =
    numAspectWidth > 0 && numAspectHeight > 0
      ? numAspectWidth / numAspectHeight
      : 1;

  const isCustomAspectOutOfBounds =
    isCustomAspect &&
    (numAspectWidth <= 0 ||
      numAspectHeight <= 0 ||
      customRatioValue < currentAspectLimits.minRatio ||
      customRatioValue > currentAspectLimits.maxRatio);

  // Automatically reset custom aspect ratio if switching to an unsupported provider
  useEffect(() => {
    if (!currentAspectLimits.supportsCustom && isCustomAspect) {
      setIsCustomAspect(false);
      setSelectedAspect('16:9');
      toast({
        title: 'Aspect Ratio Reset to 16:9',
        description: `${currentProviderObj.name} does not support custom canvas ratios. Reverted to standard 16:9 Landscape.`,
        variant: 'default',
      });
    }
  }, [selectedProvider, currentAspectLimits.supportsCustom, isCustomAspect, currentProviderObj.name]);

  // Derived effective aspect ratio string to send to API
  const effectiveAspect = isCustomAspect
    ? `${numAspectWidth}:${numAspectHeight}`
    : selectedAspect;

  // GraphQL: Fetch Standalone Videos
  const { data, loading, refetch } = useQuery(ADMIN_GET_STANDALONE_VIDEOS, {
    skip: !hydrated || !isAuthenticated || user?.role !== 'ADMIN',
    fetchPolicy: 'cache-and-network',
  });

  const videos: any[] = data?.adminGetStandaloneVideos ?? [];

  // GraphQL: Generate Mutation
  const [generateVideoMutation] = useMutation(ADMIN_GENERATE_STANDALONE_VIDEO, {
    onCompleted: (res) => {
      const vid = res.adminGenerateStandaloneVideo;
      setGenerationStage(3);
      setTimeout(() => {
        setIsGenerating(false);
        setLatestGeneratedVideo(vid);
        refetch();
        toast({
          title: '🎬 Video Generated Successfully!',
          description: `"${vid.title}" (${vid.duration || effectiveDuration}) is ready and saved to your library.`,
          variant: 'success',
        });
        setTimeout(() => {
          theaterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      }, 1000);
    },
    onError: (err) => {
      setIsGenerating(false);
      toast({
        title: 'Video Generation Failed',
        description: err.message || 'An error occurred while generating the video.',
        variant: 'error',
      });
    },
  });

  // GraphQL: Delete Mutation
  const [deleteVideoMutation] = useMutation(ADMIN_DELETE_STANDALONE_VIDEO, {
    onCompleted: () => {
      refetch();
      toast({
        title: 'Video Deleted',
        description: 'The video has been removed from your library.',
        variant: 'success',
      });
      if (previewModalVideo) setPreviewModalVideo(null);
    },
    onError: (err) => {
      toast({
        title: 'Delete Failed',
        description: err.message,
        variant: 'error',
      });
    },
  });

  // Timer & stage progression during generation
  useEffect(() => {
    let interval: any;
    let timerInterval: any;

    if (isGenerating) {
      setElapsedSecs(0);
      setGenerationStage(0);

      timerInterval = setInterval(() => {
        setElapsedSecs((prev) => prev + 1);
      }, 1000);

      interval = setInterval(() => {
        setGenerationStage((prev) => (prev < 3 ? prev + 1 : prev));
      }, 1500);
    }

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, [isGenerating]);

  // Handle Generate Video Submit with Duration & Aspect Ratio Validation
  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please enter a description or prompt for the video.',
        variant: 'error',
      });
      return;
    }

    // Validate Custom Duration based on model API limits
    if (isCustomDuration) {
      if (
        !customDurationSeconds ||
        isNaN(customDurationSeconds) ||
        customDurationSeconds < currentProviderLimits.min ||
        customDurationSeconds > currentProviderLimits.max
      ) {
        toast({
          title: 'Invalid Custom Duration',
          description: `Custom duration for ${currentProviderObj.name} must be between ${currentProviderLimits.min}s and ${currentProviderLimits.max}s.`,
          variant: 'error',
        });
        return;
      }
    } else {
      // If a preset was selected that exceeds the model's max limit
      const presetSecs = parseInt(selectedDuration, 10);
      if (presetSecs > currentProviderLimits.max || presetSecs < currentProviderLimits.min) {
        toast({
          title: 'Duration Exceeds Model Limits',
          description: `${selectedDuration} is outside the supported range (${currentProviderLimits.label}) for ${currentProviderObj.name}. Please select a valid duration or use Custom.`,
          variant: 'error',
        });
        return;
      }
    }

    // Validate Custom Aspect Ratio according to selected API/model supported limits
    if (isCustomAspect) {
      if (!currentAspectLimits.supportsCustom) {
        toast({
          title: 'Custom Aspect Ratio Unsupported',
          description: `${currentProviderObj.name} does not support custom aspect ratios. Please select 16:9, 9:16, or 1:1.`,
          variant: 'error',
        });
        return;
      }

      if (
        !numAspectWidth ||
        !numAspectHeight ||
        isNaN(numAspectWidth) ||
        isNaN(numAspectHeight) ||
        numAspectWidth <= 0 ||
        numAspectHeight <= 0
      ) {
        toast({
          title: 'Invalid Custom Aspect Ratio',
          description: 'Please enter positive numbers for custom canvas width and height.',
          variant: 'error',
        });
        return;
      }

      if (customRatioValue < currentAspectLimits.minRatio) {
        toast({
          title: 'Aspect Ratio Below Minimum Limit',
          description: `Aspect ratio ${numAspectWidth}:${numAspectHeight} (${customRatioValue.toFixed(2)}) is narrower than the supported minimum for ${currentProviderObj.name} (${currentAspectLimits.minRatioLabel}).`,
          variant: 'error',
        });
        return;
      }

      if (customRatioValue > currentAspectLimits.maxRatio) {
        toast({
          title: 'Aspect Ratio Exceeds Maximum Limit',
          description: `Aspect ratio ${numAspectWidth}:${numAspectHeight} (${customRatioValue.toFixed(2)}) is wider than the supported maximum for ${currentProviderObj.name} (${currentAspectLimits.maxRatioLabel}).`,
          variant: 'error',
        });
        return;
      }
    } else {
      // Check standard presets against provider constraints (e.g. Haiper only supports 16:9 and 9:16)
      if (selectedProvider === 'haiper' && selectedAspect === '1:1') {
        toast({
          title: 'Aspect Ratio Unsupported by Haiper',
          description: 'Haiper AI only supports 16:9 Landscape and 9:16 Portrait aspect ratios.',
          variant: 'error',
        });
        return;
      }
    }

    setIsGenerating(true);
    generateVideoMutation({
      variables: {
        prompt: prompt.trim(),
        title: title.trim() || undefined,
        duration: effectiveDuration,
        aspectRatio: effectiveAspect,
        videoProvider: selectedProvider,
        videoModel: selectedModel,
      },
    });
  };

  // Quick prompt reuse
  const handleReusePrompt = (videoItem: any) => {
    setPrompt(videoItem.prompt || '');
    if (videoItem.title) setTitle(`${videoItem.title} (Variation)`);
    if (videoItem.duration) {
      const isPreset = DURATIONS.some((d) => d.id === videoItem.duration);
      if (isPreset) {
        setSelectedDuration(videoItem.duration);
        setIsCustomDuration(false);
      } else {
        const parsed = parseInt(videoItem.duration, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setIsCustomDuration(true);
          setCustomDurationSeconds(parsed);
        } else {
          setSelectedDuration(videoItem.duration);
          setIsCustomDuration(false);
        }
      }
    }
    if (videoItem.aspectRatio) {
      const isPresetAspect = ASPECT_RATIOS.some((a) => a.id === videoItem.aspectRatio);
      if (isPresetAspect) {
        setSelectedAspect(videoItem.aspectRatio);
        setIsCustomAspect(false);
      } else {
        // Custom ratio reuse
        const parts = String(videoItem.aspectRatio).split(':');
        if (parts.length === 2) {
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);
          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            setCustomAspectWidth(w);
            setCustomAspectHeight(h);
            setIsCustomAspect(true);
          } else {
            setSelectedAspect(videoItem.aspectRatio);
            setIsCustomAspect(false);
          }
        } else {
          setSelectedAspect(videoItem.aspectRatio);
          setIsCustomAspect(false);
        }
      }
    }
    if (videoItem.provider) {
      const p = videoEngines.find((vp) => vp.id.toLowerCase() === videoItem.provider.toLowerCase());
      if (p) {
        setSelectedProvider(p.id);
        setSelectedModel(videoItem.model || p.defaultModel);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: 'Prompt & Settings Loaded',
      description: 'Studio parameters populated from selected video.',
      variant: 'success',
    });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Copied to Clipboard',
      description: 'Text copied successfully.',
      variant: 'success',
    });
  };

  // Random Inspiration Picker
  const handleRandomInspiration = () => {
    const randomPreset =
      PROMPT_INSPIRATIONS[Math.floor(Math.random() * PROMPT_INSPIRATIONS.length)];
    setPrompt(randomPreset.prompt);
    setTitle(randomPreset.title);
    toast({
      title: `Applied "${randomPreset.title}"`,
      description: 'Creative inspiration loaded into prompt field.',
      variant: 'success',
    });
  };

  // Custom aspect ratios present in the video history
  const customRatiosInVideos = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v: any) => {
      if (v.aspectRatio && !['16:9', '9:16', '1:1'].includes(v.aspectRatio)) {
        set.add(v.aspectRatio);
      }
    });
    return Array.from(set);
  }, [videos]);

  // Filtered Library
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (v.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.prompt || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.provider || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.model || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesModel =
        filterModel === 'ALL' ||
        (v.provider || '').toLowerCase().includes(filterModel.toLowerCase()) ||
        (v.model || '').toLowerCase().includes(filterModel.toLowerCase());

      const matchesAspect = filterAspect === 'ALL' || v.aspectRatio === filterAspect;

      return matchesSearch && matchesModel && matchesAspect;
    });
  }, [videos, searchQuery, filterModel, filterAspect]);

  const stages = [
    { title: 'Analyzing Prompt Semantics', sub: 'Extracting camera motion, mood, keyframes & pacing' },
    { title: `Connecting to ${selectedProvider.toUpperCase()} Engine`, sub: 'Routing payload to neural diffusion render clusters' },
    { title: 'Motion Synthesis & Temporal Interpolation', sub: 'Rendering coherent multi-frame high-FPS sequence' },
    { title: 'Master Encoding & Delivery', sub: 'Compressing photorealistic MP4 stream' },
  ];

  // Check if current preset exceeds active model limit
  const currentPresetSeconds = parseInt(selectedDuration, 10);
  const isCurrentPresetOutOfBounds =
    !isCustomDuration &&
    (currentPresetSeconds > currentProviderLimits.max || currentPresetSeconds < currentProviderLimits.min);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Page Header ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-6"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand-light border border-brand/20 flex items-center gap-1">
              <Film size={13} />
              Admin Production Studio
            </span>
            <span className="text-xs text-text-secondary/60">•</span>
            <span className="text-xs text-text-secondary">Standalone AI Video Pipeline</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-lg shadow-brand/20">
              <Film size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Video <span className="text-brand-light">Generator</span>
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                Generate high-definition AI cinematic video deliverables directly without selecting an influencer or client.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats & Actions Header Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-surface border border-border flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers size={14} />
            </div>
            <div>
              <div className="text-[11px] text-text-secondary leading-none">Total Videos</div>
              <div className="text-sm font-bold text-text-primary mt-0.5 leading-none">
                {mounted ? videos.length : 0} Videos
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              refetch();
              toast({ title: 'Library Refreshed', description: 'Updated video records from database.', variant: 'success' });
            }}
            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface/80 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center shadow-sm"
            title="Refresh Library"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </motion.div>

      {/* ─── SECTION 1: Video Prompt & Creative Concept (Full Width) ──── */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light">
              <Wand2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>1. Creative Prompt & Title</span>
                <span className="text-[11px] font-normal text-text-secondary">
                  (Define narrative, camera motion, and visual aesthetic)
                </span>
              </h2>
            </div>
          </div>

          {/* Inspiration Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRandomInspiration}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary bg-background border border-border hover:border-brand/40 transition-colors flex items-center gap-1.5"
              title="Load a random creative inspiration"
            >
              <Dices size={13} className="text-brand-light" />
              <span>Surprise Me</span>
            </button>

            {(prompt || title) && (
              <button
                type="button"
                onClick={() => {
                  setPrompt('');
                  setTitle('');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-red-400 bg-background border border-border hover:border-red-400/40 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Optional Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
              <span>Video Title / Label (Optional)</span>
              <span className="text-[10px] text-text-secondary/70">Auto-named from prompt if left empty</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cyberpunk Drone Hyperlapse in Tokyo Rainfall"
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 transition-all"
            />
          </div>

          {/* Prompt Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <span>Creative Scene Prompt</span>
                <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px] font-mono text-text-secondary/70">
                {prompt.length} characters
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe your scene in detail: subjects, camera movement (drone, dolly, pan), lighting, mood, color palette, speed, and environment..."
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 transition-all resize-y leading-relaxed font-sans"
            />
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: Video Settings (Full Width) ───────────────────── */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>2. Video Settings</span>
                <span className="text-[11px] font-normal text-text-secondary">
                  (Choose rendering engine, canvas ratio, and clip duration)
                </span>
              </h2>
            </div>
          </div>

          <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Engine: {currentProviderObj.name}
          </span>
        </div>

        {/* AI Video Provider / Engine Selector - dynamic grid across full width */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <span>Select AI Rendering Engine</span>
              <span className="text-[11px] font-normal text-text-secondary/70">
                (Built-in & Custom Engines from Admin Settings)
              </span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                {videoEngines.length} Available ({videoEngines.filter((e) => !e.isBuiltin).length} Custom)
              </span>
              <Link
                href="/admin/settings"
                className="text-[11px] text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 transition-colors"
                title="Configure or add custom engines in Admin Settings"
              >
                <Settings2 size={12} />
                <span>Manage in Settings</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {videoEngines.map((prov) => {
              const isSelected = selectedProvider === prov.id;
              const limits =
                PROVIDER_DURATION_LIMITS[prov.id] || {
                  label: `${prov.minDuration || 5}s – ${prov.maxDuration || 30}s`,
                };
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(prov.id);
                    setSelectedModel(prov.defaultModel);
                  }}
                  className={cn(
                    'p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between relative group cursor-pointer',
                    isSelected
                      ? 'bg-purple-500/10 border-purple-500/60 shadow-sm shadow-purple-500/10'
                      : 'bg-background border-border text-text-secondary hover:border-border/90 hover:text-text-primary',
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isSelected ? 'bg-purple-400' : 'bg-border',
                        )}
                      />
                      <span className={cn('text-xs font-bold truncate max-w-[170px]', isSelected ? 'text-text-primary' : 'text-text-secondary')}>
                        {prov.name}
                      </span>
                    </div>
                  </div>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border self-start mb-2', prov.badgeColor)}>
                    {prov.badge}
                  </span>
                  <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                    {prov.description}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary/70 mt-2 pt-2 border-t border-border/40 gap-1">
                    <span className="truncate max-w-[62%] text-text-primary/90 font-medium">Model: {prov.defaultModel}</span>
                    <span className="text-text-secondary/90 font-semibold shrink-0">{limits.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas Aspect Ratio & Duration Grid (2 balanced columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/60">
          {/* Aspect Ratio Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary block">
                Canvas Aspect Ratio
              </label>
              {supportsCustomAspect ? (
                <span className="text-[11px] font-mono text-purple-400 flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>Custom Ratio Enabled</span>
                </span>
              ) : (
                <span className="text-[11px] font-mono text-text-secondary/70">
                  Fixed Standard Ratios
                </span>
              )}
            </div>

            {/* Grid of Aspect Ratio Options (Existing 3 Presets + Conditional Custom Option) */}
            <div
              className={cn(
                'grid gap-2.5',
                supportsCustomAspect ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3',
              )}
            >
              {ASPECT_RATIOS.map((aspect) => {
                const Icon = aspect.icon;
                const isSelected = !isCustomAspect && selectedAspect === aspect.id;
                return (
                  <button
                    key={aspect.id}
                    type="button"
                    onClick={() => {
                      setIsCustomAspect(false);
                      setSelectedAspect(aspect.id);
                    }}
                    className={cn(
                      'p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5',
                      isSelected
                        ? 'bg-brand/15 border-brand text-brand-light font-bold shadow-sm'
                        : 'bg-background border-border text-text-secondary hover:border-border/80 hover:text-text-primary',
                    )}
                  >
                    <div className="h-8 flex items-center justify-center">
                      <div
                        className={cn(
                          'rounded-sm border-2 transition-all',
                          aspect.aspectClass,
                          isSelected ? 'border-brand-light bg-brand/20' : 'border-text-secondary/40',
                        )}
                      />
                    </div>
                    <span className="text-xs font-semibold">{aspect.id}</span>
                    <span className="text-[10px] text-text-secondary truncate w-full text-center">
                      {aspect.label.split(' ')[1] || aspect.id}
                    </span>
                  </button>
                );
              })}

              {/* Custom Aspect Ratio Option Button (Only shown when selected API/model supports custom aspect ratios) */}
              {supportsCustomAspect && (
                <button
                  type="button"
                  onClick={() => setIsCustomAspect(true)}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 relative',
                    isCustomAspect
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300 font-bold shadow-sm'
                      : 'bg-background border-border text-text-secondary hover:border-border/80 hover:text-text-primary',
                  )}
                >
                  <div className="h-8 flex items-center justify-center">
                    <div
                      className={cn(
                        'w-7 h-5 rounded-sm border-2 transition-all flex items-center justify-center',
                        isCustomAspect ? 'border-purple-400 bg-purple-500/25' : 'border-text-secondary/40',
                      )}
                    >
                      <Ratio size={12} className={isCustomAspect ? 'text-purple-300' : 'text-text-secondary/70'} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold">Custom</span>
                  <span className="text-[10px] text-text-secondary truncate w-full text-center font-mono">
                    {isCustomAspect ? `${numAspectWidth}:${numAspectHeight}` : 'W × H'}
                  </span>
                </button>
              )}
            </div>

            {/* Note when Custom Ratio is hidden/disabled for the current API/model */}
            {!supportsCustomAspect && (
              <div className="p-2.5 rounded-xl bg-surface border border-border/70 text-text-secondary text-[11px] flex items-center gap-2">
                <Info size={13} className="text-text-secondary/70 shrink-0" />
                <span>
                  {currentProviderObj.name} does not support custom aspect ratios. Switch to <strong className="text-text-primary">OpenAI Sora</strong> or <strong className="text-text-primary">Custom Video API</strong> to set custom canvas ratios.
                </span>
              </div>
            )}

            {/* Custom Aspect Ratio Input Drawer & Live Visualizer */}
            <AnimatePresence>
              {isCustomAspect && supportsCustomAspect && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-background border border-purple-500/30 space-y-3 mt-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        Custom Canvas Ratio:
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {numAspectWidth}:{numAspectHeight} ({customRatioValue.toFixed(2)}:1)
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-text-secondary flex items-center gap-1.5">
                      <Info size={12} className="text-purple-400 shrink-0" />
                      <span>
                        {currentProviderObj.name} limit:{' '}
                        <strong className="text-text-primary">
                          {currentAspectLimits.minRatioLabel} to {currentAspectLimits.maxRatioLabel}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Width × Height Inputs and Live Visualizer */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* W × H Inputs */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20">
                        <label className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider block mb-1">
                          Width
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="any"
                          value={customAspectWidth}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                            setCustomAspectWidth(val);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-border text-center font-mono text-xs font-bold text-text-primary focus:outline-none focus:border-purple-500"
                          placeholder="W"
                        />
                      </div>

                      <span className="text-text-secondary font-bold text-sm pt-4">×</span>

                      <div className="w-20">
                        <label className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider block mb-1">
                          Height
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="any"
                          value={customAspectHeight}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                            setCustomAspectHeight(val);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-border text-center font-mono text-xs font-bold text-text-primary focus:outline-none focus:border-purple-500"
                          placeholder="H"
                        />
                      </div>
                    </div>

                    {/* Live Canvas Preview Frame */}
                    <div className="flex-1 flex items-center gap-3 p-2 rounded-lg bg-surface border border-border/70 min-h-[50px]">
                      <div className="w-14 h-10 flex items-center justify-center bg-black/40 rounded border border-border/50 shrink-0 overflow-hidden p-1">
                        <div
                          className={cn(
                            'border-2 transition-all duration-200 max-w-full max-h-full rounded-[2px]',
                            isCustomAspectOutOfBounds
                              ? 'border-red-400 bg-red-500/20'
                              : 'border-purple-400 bg-purple-500/25',
                          )}
                          style={{
                            aspectRatio:
                              numAspectWidth > 0 && numAspectHeight > 0
                                ? `${numAspectWidth} / ${numAspectHeight}`
                                : '1 / 1',
                            width: numAspectWidth >= numAspectHeight ? '100%' : 'auto',
                            height: numAspectHeight > numAspectWidth ? '100%' : 'auto',
                          }}
                        />
                      </div>
                      <div className="text-xs space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 font-medium">
                          {isCustomAspectOutOfBounds ? (
                            <span className="text-red-400 flex items-center gap-1 font-semibold text-[11px]">
                              <AlertCircle size={12} />
                              Ratio Out of Bounds
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                              <CheckCircle2 size={12} />
                              Valid Canvas Ratio
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-secondary truncate">
                          {isCustomAspectOutOfBounds
                            ? `Supported range: ${currentAspectLimits.minRatioLabel} to ${currentAspectLimits.maxRatioLabel}`
                            : `${numAspectWidth}:${numAspectHeight} (${customRatioValue.toFixed(2)}:1) will be used`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Out of bounds alert */}
                  {isCustomAspectOutOfBounds && (
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle size={13} className="shrink-0 text-red-400" />
                      <span>
                        Ratio {customRatioValue.toFixed(2)} is outside {currentProviderObj.name} supported bounds ({currentAspectLimits.minRatioLabel} to {currentAspectLimits.maxRatioLabel}). Please adjust width or height.
                      </span>
                    </div>
                  )}

                  {/* Popular Quick Aspect Presets */}
                  {currentAspectLimits.quickPresets.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                        Quick Ratio Presets:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {currentAspectLimits.quickPresets.map((p) => {
                          const isActive =
                            numAspectWidth === p.w && numAspectHeight === p.h;
                          return (
                            <button
                              key={`${p.w}:${p.h}`}
                              type="button"
                              onClick={() => {
                                setCustomAspectWidth(p.w);
                                setCustomAspectHeight(p.h);
                              }}
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1',
                                isActive
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                                  : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-border/80',
                              )}
                            >
                              <span className="font-mono font-bold">{p.label}</span>
                              <span className="text-[9px] text-text-secondary">({p.sub})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Video Duration Selector (Presets + Custom Option) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary block">
                Video Duration
              </label>
              <span className="text-[11px] font-mono text-text-secondary flex items-center gap-1">
                <span>{currentProviderObj.name} limit:</span>
                <strong className="text-text-primary font-bold">{currentProviderLimits.label}</strong>
              </span>
            </div>

            {/* Duration Buttons Grid (4 Presets + 1 Custom Button) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {DURATIONS.map((dur) => {
                const isSelected = !isCustomDuration && selectedDuration === dur.id;
                const isExceeded =
                  dur.seconds > currentProviderLimits.max ||
                  dur.seconds < currentProviderLimits.min;

                return (
                  <button
                    key={dur.id}
                    type="button"
                    onClick={() => {
                      setIsCustomDuration(false);
                      setSelectedDuration(dur.id);
                    }}
                    className={cn(
                      'py-3 px-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 relative',
                      isSelected
                        ? 'bg-brand/15 border-brand text-brand-light font-bold shadow-sm'
                        : 'bg-background border-border text-text-secondary hover:border-border/80 hover:text-text-primary',
                      isExceeded && !isSelected && 'opacity-65',
                    )}
                  >
                    <span className="text-sm font-bold">{dur.label}</span>
                    <span className="text-[10px] text-text-secondary truncate w-full text-center">
                      {dur.sub}
                    </span>

                    {/* Exceeded limit dot indicator */}
                    {isExceeded && (
                      <span
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400"
                        title={`Exceeds ${currentProviderObj.name} standard limit (${currentProviderLimits.label})`}
                      />
                    )}
                  </button>
                );
              })}

              {/* Custom Duration Button */}
              <button
                type="button"
                onClick={() => {
                  setIsCustomDuration(true);
                  // Ensure custom duration is within current provider bounds
                  if (customDurationSeconds > currentProviderLimits.max) {
                    setCustomDurationSeconds(currentProviderLimits.max);
                  } else if (customDurationSeconds < currentProviderLimits.min) {
                    setCustomDurationSeconds(currentProviderLimits.min);
                  }
                }}
                className={cn(
                  'py-3 px-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1',
                  isCustomDuration
                    ? 'bg-purple-500/15 border-purple-500 text-purple-300 font-bold shadow-sm'
                    : 'bg-background border-border text-text-secondary hover:border-border/80 hover:text-text-primary',
                )}
              >
                <div className="flex items-center gap-1">
                  <SlidersHorizontal size={13} className={isCustomDuration ? 'text-purple-400' : 'text-text-secondary'} />
                  <span className="text-sm font-bold">Custom</span>
                </div>
                <span className="text-[10px] text-text-secondary truncate w-full text-center">
                  {isCustomDuration ? `${customDurationSeconds}s` : 'Set seconds'}
                </span>
              </button>
            </div>

            {/* Out-of-bounds warning for selected preset */}
            {isCurrentPresetOutOfBounds && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {selectedDuration} exceeds the standard limit for {currentProviderObj.name} ({currentProviderLimits.label}). Consider choosing a supported preset or Custom duration.
                </span>
              </div>
            )}

            {/* Custom Duration Input & Slider Drawer */}
            <AnimatePresence>
              {isCustomDuration && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-background border border-purple-500/30 space-y-3 mt-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        Custom Duration (seconds):
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {customDurationSeconds}s
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-text-secondary flex items-center gap-1.5">
                      <Info size={12} className="text-purple-400" />
                      <span>
                        Allowed for {currentProviderObj.name}: <strong className="text-text-primary">{currentProviderLimits.min}s – {currentProviderLimits.max}s</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stepper + Range Slider + Direct Input */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCustomDurationSeconds((prev) => Math.max(currentProviderLimits.min, prev - 1))}
                      className="w-9 h-9 rounded-lg bg-surface border border-border hover:bg-surface/80 text-text-primary flex items-center justify-center font-bold text-base transition-colors shrink-0 disabled:opacity-50"
                      disabled={customDurationSeconds <= currentProviderLimits.min}
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min={currentProviderLimits.min}
                      max={currentProviderLimits.max}
                      step={1}
                      value={Math.min(currentProviderLimits.max, Math.max(currentProviderLimits.min, customDurationSeconds))}
                      onChange={(e) => setCustomDurationSeconds(Number(e.target.value))}
                      className="flex-1 accent-purple-500 cursor-pointer h-2 bg-surface rounded-lg"
                    />

                    <button
                      type="button"
                      onClick={() => setCustomDurationSeconds((prev) => Math.min(currentProviderLimits.max, prev + 1))}
                      className="w-9 h-9 rounded-lg bg-surface border border-border hover:bg-surface/80 text-text-primary flex items-center justify-center font-bold text-base transition-colors shrink-0 disabled:opacity-50"
                      disabled={customDurationSeconds >= currentProviderLimits.max}
                    >
                      +
                    </button>

                    <div className="relative w-24 shrink-0">
                      <input
                        type="number"
                        min={currentProviderLimits.min}
                        max={currentProviderLimits.max}
                        value={customDurationSeconds}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setCustomDurationSeconds(val);
                          else setCustomDurationSeconds(0);
                        }}
                        className="w-full pl-3 pr-7 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary font-mono pointer-events-none">
                        s
                      </span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons for Custom Range */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-text-secondary font-semibold">
                      Quick Picks:
                    </span>
                    {currentProviderLimits.quickOptions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setCustomDurationSeconds(q)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] font-mono transition-colors border',
                          customDurationSeconds === q
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                            : 'bg-surface text-text-secondary border-border hover:text-text-primary',
                        )}
                      >
                        {q}s
                      </button>
                    ))}
                  </div>

                  {/* Live Validation Feedback */}
                  {customDurationSeconds < currentProviderLimits.min || customDurationSeconds > currentProviderLimits.max ? (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 pt-1">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>
                        Custom duration must be between {currentProviderLimits.min}s and {currentProviderLimits.max}s for {currentProviderObj.name}.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check size={12} />
                        <span>Valid custom duration ({customDurationSeconds}s) for {currentProviderObj.name}</span>
                      </span>
                      <span className="text-text-secondary/70">
                        {currentProviderLimits.note}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: Generate Video Action Card (Full Width) ───────── */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="font-medium text-text-primary">Ready to Render:</span>
            <span className="px-2.5 py-0.5 rounded bg-background border border-border font-mono text-[11px] text-text-primary">
              {currentProviderObj.name} • {effectiveAspect}{isCustomAspect ? ' (Custom)' : ''} • {effectiveDuration}{isCustomDuration ? ' (Custom)' : ''}
            </span>
          </div>
          <div className="text-[11px] text-text-secondary">
            Deliverable will be saved automatically to library
          </div>
        </div>

        <button
          type="button"
          disabled={isGenerating || !prompt.trim()}
          onClick={handleGenerate}
          className={cn(
            'w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md',
            isGenerating || !prompt.trim()
              ? 'bg-surface text-text-secondary/60 border border-border cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-purple-600 via-brand to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/25 hover:shadow-purple-600/40 hover:scale-[1.005] active:scale-[0.995]',
          )}
        >
          {isGenerating ? (
            <>
              <RefreshCw size={17} className="animate-spin" />
              <span>Rendering Video ({effectiveDuration}) With {currentProviderObj.name} ({elapsedSecs}s elapsed)...</span>
            </>
          ) : (
            <>
              <Sparkles size={17} />
              <span>Generate Video Directly ({effectiveDuration})</span>
            </>
          )}
        </button>

        {!prompt.trim() && (
          <p className="text-[11px] text-center text-text-secondary/70">
            Please enter a creative scene prompt in Section 1 to enable video generation.
          </p>
        )}
      </div>

      {/* ─── SECTION 4: Video Preview / Workspace (Full Width) ────────── */}
      <div ref={theaterSectionRef} className="space-y-4">
        {/* Active Generation Progress Card (During Rendering) */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              className="bg-surface border border-purple-500/50 rounded-2xl p-6 shadow-xl space-y-5 relative overflow-hidden"
            >
              {/* Glow accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-brand to-pink-500 animate-pulse" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                  <RefreshCw size={16} className="animate-spin text-purple-400" />
                  <span>Synthesizing Video Stream With {currentProviderObj.name} ({effectiveDuration})</span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {elapsedSecs}s elapsed
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (generationStage + 1) * 25)}%` }}
                />
              </div>

              {/* Stages Horizontal / Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stages.map((stg, idx) => {
                  const isDone = generationStage > idx;
                  const isCurrent = generationStage === idx;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'p-3 rounded-xl border transition-all flex items-start gap-3',
                        isCurrent
                          ? 'bg-purple-500/15 border-purple-500/60 shadow-sm'
                          : isDone
                          ? 'bg-surface border-border/60 opacity-80'
                          : 'bg-surface/30 border-border/30 opacity-40',
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5',
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isCurrent
                            ? 'bg-purple-500 text-white animate-pulse'
                            : 'bg-background text-text-secondary border border-border',
                        )}
                      >
                        {isDone ? <Check size={11} /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-primary">
                          {stg.title}
                        </div>
                        <div className="text-[10px] text-text-secondary truncate">
                          {stg.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prominent Video Preview Theater Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
          {/* Header of Preview Card */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Film size={16} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-primary">
                  3. Generated Video Preview & Workspace
                </h3>
                <p className="text-[11px] text-text-secondary">
                  {latestGeneratedVideo ? 'Active deliverable ready for inspection and download' : 'Playback theater and management'}
                </p>
              </div>
            </div>

            {latestGeneratedVideo ? (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Render Complete
              </span>
            ) : (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-background border border-border text-text-secondary">
                Studio Standby
              </span>
            )}
          </div>

          {/* Video Player Display */}
          {mounted && latestGeneratedVideo && !isGenerating ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left / Main: Video Player Frame (7 cols) */}
              <div className="lg:col-span-7 bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-border/80 shadow-inner relative group">
                <video
                  ref={liveVideoRef}
                  src={latestGeneratedVideo.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
                {/* Floating Expand button */}
                <button
                  onClick={() => setPreviewModalVideo(latestGeneratedVideo)}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                  title="Fullscreen Theater View"
                >
                  <Maximize2 size={16} />
                </button>
              </div>

              {/* Right: Video Details & Actions Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <h4 className="font-bold text-base text-text-primary line-clamp-1">
                    {latestGeneratedVideo.title || 'Untitled Render'}
                  </h4>
                  <div className="mt-2 space-y-1">
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                      Prompt Used:
                    </span>
                    <p className="text-xs text-text-secondary font-mono line-clamp-3 leading-relaxed bg-background p-3 rounded-xl border border-border select-all">
                      "{latestGeneratedVideo.prompt}"
                    </p>
                  </div>
                </div>

                {/* Metadata Chips Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <span className="text-[10px] text-text-secondary block">ENGINE & MODEL</span>
                    <span className="font-bold text-text-primary truncate block">
                      {latestGeneratedVideo.provider} ({latestGeneratedVideo.model})
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <span className="text-[10px] text-text-secondary block">DURATION & RATIO</span>
                    <span className="font-bold text-text-primary block">
                      {latestGeneratedVideo.duration} • {latestGeneratedVideo.aspectRatio}
                    </span>
                  </div>
                </div>

                {/* Primary Actions: Download & Copy */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={latestGeneratedVideo.videoUrl}
                    download="generated-video.mp4"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download size={14} /> Download MP4
                  </a>

                  <button
                    onClick={() => handleCopy(latestGeneratedVideo.videoUrl, 'live-video-url')}
                    className="px-4 py-2.5 rounded-xl bg-background hover:bg-surface border border-border text-xs font-semibold text-text-primary flex items-center justify-center gap-2 transition-colors"
                  >
                    {copiedId === 'live-video-url' ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Secondary Actions: Reuse & Fullscreen */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleReusePrompt(latestGeneratedVideo)}
                    className="px-3 py-2 rounded-xl bg-background hover:bg-surface border border-border text-xs text-text-secondary hover:text-text-primary flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw size={13} />
                    <span>Reuse in Studio</span>
                  </button>

                  <button
                    onClick={() => setPreviewModalVideo(latestGeneratedVideo)}
                    className="px-3 py-2 rounded-xl bg-background hover:bg-surface border border-border text-xs text-text-secondary hover:text-text-primary flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye size={13} />
                    <span>Expand Modal</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Standby State when no video generated yet */
            !isGenerating && (
              <div className="py-10 px-6 text-center space-y-3 bg-background/50 border border-border/60 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
                  <Film size={22} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-text-primary">
                    Studio Ready for Rendering
                  </h4>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    Fill in your prompt in Section 1, choose your engine, ratio, and duration in Section 2, then click Generate Video. Your rendered result will appear here.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-text-secondary/80">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>Direct standalone rendering</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-purple-400" />
                    <span>{videoEngines.length} AI video engines online</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-blue-400" />
                    <span>Custom & preset durations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-teal-400" />
                    <span>Instant MP4 download</span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ─── SECTION 5: Generated Videos & History Library (Full Width) ─ */}
      <div className="space-y-5 pt-4 border-t border-border">
        {/* Section Header & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Layers size={16} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
                <span>Generated Videos & History</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface border border-border text-text-secondary">
                  {filteredVideos.length} of {videos.length}
                </span>
              </h2>
            </div>
            <p className="text-xs text-text-secondary">
              Review, play, download, or reuse prompts from past standalone video generations.
            </p>
          </div>

          {/* Filter, Search & View Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompt, title, or engine..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-border text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            {/* Model Filter */}
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="ALL">All AI Engines ({videoEngines.length})</option>
              {videoEngines.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} {!eng.isBuiltin ? '(Custom)' : ''}
                </option>
              ))}
            </select>

            {/* Aspect Ratio Filter */}
            <select
              value={filterAspect}
              onChange={(e) => setFilterAspect(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="ALL">All Ratios</option>
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="1:1">1:1 Square</option>
              {customRatiosInVideos.map((r) => (
                <option key={r} value={r}>
                  {r} (Custom)
                </option>
              ))}
            </select>

            {/* View Mode Toggle (Grid vs. List) */}
            <div className="flex items-center p-1 rounded-xl bg-surface border border-border">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  viewMode === 'grid'
                    ? 'bg-brand/20 text-brand-light'
                    : 'text-text-secondary hover:text-text-primary',
                )}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  viewMode === 'list'
                    ? 'bg-brand/20 text-brand-light'
                    : 'text-text-secondary hover:text-text-primary',
                )}
                title="List View"
              >
                <LayoutList size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Video Cards Grid / List */}
        {!mounted || loading ? (
          <div className="text-center py-16 bg-surface/50 border border-border rounded-2xl">
            <RefreshCw size={24} className="animate-spin text-purple-400 mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Loading standalone video library...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-16 bg-surface/30 border border-border rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mx-auto">
              <Film size={22} />
            </div>
            <h3 className="font-bold text-sm text-text-primary">
              No Standalone Videos Found
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {searchQuery || filterModel !== 'ALL' || filterAspect !== 'ALL'
                ? 'No videos match your active filter criteria. Try resetting filters.'
                : 'You have not generated any standalone videos yet. Use the studio above to create your first video!'}
            </p>
            {(searchQuery || filterModel !== 'ALL' || filterAspect !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterModel('ALL');
                  setFilterAspect('ALL');
                }}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface/80 border border-border text-xs font-semibold text-text-primary transition-colors inline-block mt-2"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow-xl"
              >
                {/* Video Thumbnail / Preview Container */}
                <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    src={video.videoUrl}
                    preload="metadata"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Overlay Play Button */}
                  <button
                    onClick={() => setPreviewModalVideo(video)}
                    className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition-colors group/play"
                  >
                    <div className="w-11 h-11 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg group-hover/play:scale-110 transition-transform">
                      <Play size={18} className="ml-0.5" />
                    </div>
                  </button>

                  {/* Badges on Thumbnail */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/75 text-white backdrop-blur-sm border border-white/10">
                      {video.duration || '15s'} • {video.aspectRatio || '16:9'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/90 text-white backdrop-blur-sm">
                      {video.provider || 'AI Video'}
                    </span>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-xs text-text-primary line-clamp-1 group-hover:text-purple-300 transition-colors">
                      {video.title || 'Untitled Video'}
                    </h3>
                    <p className="text-[11px] text-text-secondary font-mono line-clamp-2 leading-relaxed bg-background/50 p-2 rounded-lg border border-border/60">
                      "{video.prompt}"
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span>Model: {video.model || 'gen3a_turbo'}</span>
                      <span>{fmtDateTime(video.createdAt)}</span>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => setPreviewModalVideo(video)}
                        className="flex-1 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors border border-purple-500/20"
                      >
                        <Eye size={12} /> Preview
                      </button>

                      <a
                        href={video.videoUrl}
                        download="video.mp4"
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary transition-colors"
                        title="Download MP4"
                      >
                        <Download size={13} />
                      </a>

                      <button
                        onClick={() => handleReusePrompt(video)}
                        className="p-1.5 rounded-lg bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary transition-colors"
                        title="Reuse prompt & settings"
                      >
                        <RotateCcw size={13} />
                      </button>

                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${video.title || 'this video'}" from your library?`,
                            )
                          ) {
                            deleteVideoMutation({ variables: { id: video.id } });
                          }
                        }}
                        className="p-1.5 rounded-lg bg-surface hover:bg-red-500/20 border border-border hover:border-red-500/40 text-text-secondary hover:text-red-400 transition-colors"
                        title="Delete video"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View (Table / Row format) */
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y divide-border/60">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="p-4 hover:bg-background/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Mini thumbnail */}
                    <div
                      onClick={() => setPreviewModalVideo(video)}
                      className="w-24 h-14 bg-black rounded-lg overflow-hidden shrink-0 relative cursor-pointer group flex items-center justify-center border border-border"
                    >
                      <video
                        src={video.videoUrl}
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                        <Play size={14} className="text-white ml-0.5" />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-text-primary truncate">
                          {video.title || 'Untitled Video'}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {video.provider || 'AI'}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary font-mono truncate max-w-md">
                        "{video.prompt}"
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary/70">
                        <span>{video.duration || '15s'}</span>
                        <span>•</span>
                        <span>{video.aspectRatio || '16:9'}</span>
                        <span>•</span>
                        <span>{video.model || 'gen3a_turbo'}</span>
                        <span>•</span>
                        <span>{fmtDateTime(video.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => setPreviewModalVideo(video)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-purple-500/20"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>

                    <a
                      href={video.videoUrl}
                      download="video.mp4"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-background hover:bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
                      title="Download MP4"
                    >
                      <Download size={14} />
                    </a>

                    <button
                      onClick={() => handleReusePrompt(video)}
                      className="p-1.5 rounded-lg bg-background hover:bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
                      title="Reuse prompt & settings"
                    >
                      <RotateCcw size={14} />
                    </button>

                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Are you sure you want to delete "${video.title || 'this video'}" from your library?`,
                          )
                        ) {
                          deleteVideoMutation({ variables: { id: video.id } });
                        }
                      }}
                      className="p-1.5 rounded-lg bg-background hover:bg-red-500/20 border border-border hover:border-red-500/40 text-text-secondary hover:text-red-400 transition-colors"
                      title="Delete video"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── High-Fidelity Theater Preview Modal ────────────────────────── */}
      <AnimatePresence>
        {previewModalVideo && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewModalVideo(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-background border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
                <div className="flex items-center gap-2.5">
                  <Film size={18} className="text-purple-400" />
                  <h3 className="font-bold text-sm text-text-primary truncate">
                    {previewModalVideo.title || 'Standalone Video Preview'}
                  </h3>
                </div>
                <button
                  onClick={() => setPreviewModalVideo(null)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Video Player */}
              <div className="bg-black aspect-video flex items-center justify-center relative">
                <video
                  src={previewModalVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Modal Body Info */}
              <div className="p-6 space-y-4 bg-surface/40">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">
                      PROMPT
                    </span>
                    <button
                      onClick={() => handleCopy(previewModalVideo.prompt, 'modal-prompt')}
                      className="text-[11px] text-brand-light hover:underline flex items-center gap-1"
                    >
                      {copiedId === 'modal-prompt' ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedId === 'modal-prompt' ? 'Copied' : 'Copy Prompt'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border border-border text-xs text-text-primary font-mono leading-relaxed select-all">
                    {previewModalVideo.prompt}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-text-secondary block">ENGINE</span>
                    <span className="font-bold text-text-primary">
                      {previewModalVideo.provider || 'AI'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-text-secondary block">MODEL</span>
                    <span className="font-bold text-text-primary">
                      {previewModalVideo.model || 'gen3a_turbo'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-text-secondary block">DURATION & RATIO</span>
                    <span className="font-bold text-text-primary">
                      {previewModalVideo.duration} • {previewModalVideo.aspectRatio}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-text-secondary block">DATE</span>
                    <span className="font-bold text-text-primary">
                      {fmtDateTime(previewModalVideo.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${previewModalVideo.title || 'this video'}" permanently?`,
                        )
                      ) {
                        deleteVideoMutation({
                          variables: { id: previewModalVideo.id },
                        });
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={13} /> Delete Video
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleReusePrompt(previewModalVideo);
                        setPreviewModalVideo(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface/80 border border-border text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw size={13} /> Reuse Prompt
                    </button>

                    <a
                      href={previewModalVideo.videoUrl}
                      download="generated-video.mp4"
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                    >
                      <Download size={13} /> Download MP4
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
