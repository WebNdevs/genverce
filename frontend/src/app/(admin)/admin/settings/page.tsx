'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Volume2,
  Video,
  Eye,
  EyeOff,
  Save,
  Cpu,
  Globe,
  Key,
  Settings2,
  Sparkles,
  CheckCircle2,
  Layers,
  Radio,
  Film,
  Mic,
  Sliders,
  Check,
  Plus,
  Trash2,
  Edit3,
  SlidersHorizontal,
  AlertCircle,
  X,
  Clock,
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { GET_SITE_SETTINGS } from '@/graphql/queries/settings';
import { UPDATE_SITE_SETTINGS } from '@/graphql/mutations/settings';
import {
  CHAT_PROVIDERS,
  AUDIO_PROVIDERS,
  VIDEO_PROVIDERS,
  getAIProvider,
  getAudioProvider,
  getVideoProvider,
  detectProviderFrontend,
  detectAudioProviderFrontend,
  detectVideoProviderFrontend,
  AIProvider,
} from '@/lib/ai-providers';

export interface CustomVideoEngine {
  id: string;
  name: string;
  model: string;
  apiUrl?: string;
  apiKey?: string;
  minDuration: number;
  maxDuration: number;
  description?: string;
  badge?: string;
  badgeColor?: string;
}

type SettingsTab = 'chat' | 'audio' | 'video' | 'all';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('chat');

  // ─── Chat Section State ──────────────────────────────────────────────────
  const [chatProviderId, setChatProviderId] = useState<string>('openai');
  const [chatApiUrl, setChatApiUrl] = useState<string>('');
  const [chatApiKey, setChatApiKey] = useState<string>('');
  const [chatModel, setChatModel] = useState<string>('');
  const [chatIsCustomModel, setChatIsCustomModel] = useState<boolean>(false);
  const [chatShowCustomUrl, setChatShowCustomUrl] = useState<boolean>(false);
  const [chatShowKey, setChatShowKey] = useState<boolean>(false);

  // ─── Audio Section State ─────────────────────────────────────────────────
  const [audioProviderId, setAudioProviderId] = useState<string>('elevenlabs');
  const [audioApiUrl, setAudioApiUrl] = useState<string>('');
  const [audioApiKey, setAudioApiKey] = useState<string>('');
  const [audioModel, setAudioModel] = useState<string>('');
  const [audioIsCustomModel, setAudioIsCustomModel] = useState<boolean>(false);
  const [audioShowCustomUrl, setAudioShowCustomUrl] = useState<boolean>(false);
  const [audioShowKey, setAudioShowKey] = useState<boolean>(false);

  // ─── Video Section State ─────────────────────────────────────────────────
  const [videoProviderId, setVideoProviderId] = useState<string>('runway');
  const [videoApiUrl, setVideoApiUrl] = useState<string>('');
  const [videoApiKey, setVideoApiKey] = useState<string>('');
  const [videoModel, setVideoModel] = useState<string>('');
  const [videoIsCustomModel, setVideoIsCustomModel] = useState<boolean>(false);
  const [videoShowCustomUrl, setVideoShowCustomUrl] = useState<boolean>(false);
  const [videoShowKey, setVideoShowKey] = useState<boolean>(false);

  // Custom AI Video Engines List & Modal State
  const [customVideoEngines, setCustomVideoEngines] = useState<CustomVideoEngine[]>([]);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);
  const [editingEngineIndex, setEditingEngineIndex] = useState<number | null>(null);
  const [engineForm, setEngineForm] = useState<CustomVideoEngine>({
    id: '',
    name: '',
    model: '',
    apiUrl: '',
    apiKey: '',
    minDuration: 5,
    maxDuration: 30,
    description: '',
    badge: 'Custom Engine',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  });

  const [dirty, setDirty] = useState<boolean>(false);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [hydrated, isAuthenticated, user, router]);

  const { data, loading } = useQuery(GET_SITE_SETTINGS);

  useEffect(() => {
    if (data?.siteSettings) {
      const s = data.siteSettings;

      // 1. Populate Chat
      const detectedChat = detectProviderFrontend(s.chatProvider, s.chatApiUrl, s.chatModel);
      setChatProviderId(detectedChat.id);
      const cUrl = s.chatApiUrl ?? '';
      const cModel = s.chatModel ?? '';
      setChatApiUrl(cUrl);
      setChatApiKey(s.chatApiKey ?? '');
      setChatModel(cModel);
      if (cModel && detectedChat.models.length > 0 && !detectedChat.models.includes(cModel)) {
        setChatIsCustomModel(true);
      } else {
        setChatIsCustomModel(false);
      }
      if (detectedChat.requiresCustomUrl || (cUrl && cUrl !== detectedChat.defaultBaseURL)) {
        setChatShowCustomUrl(true);
      } else {
        setChatShowCustomUrl(false);
      }

      // 2. Populate Audio
      const detectedAudio = detectAudioProviderFrontend(s.audioProvider, s.audioApiUrl, s.audioModel);
      setAudioProviderId(detectedAudio.id);
      const aUrl = s.audioApiUrl ?? '';
      const aModel = s.audioModel ?? '';
      setAudioApiUrl(aUrl);
      setAudioApiKey(s.audioApiKey ?? '');
      setAudioModel(aModel);
      if (aModel && detectedAudio.models.length > 0 && !detectedAudio.models.includes(aModel)) {
        setAudioIsCustomModel(true);
      } else {
        setAudioIsCustomModel(false);
      }
      if (detectedAudio.requiresCustomUrl || (aUrl && aUrl !== detectedAudio.defaultBaseURL)) {
        setAudioShowCustomUrl(true);
      } else {
        setAudioShowCustomUrl(false);
      }

      // 3. Populate Video
      const detectedVideo = detectVideoProviderFrontend(s.videoProvider, s.videoApiUrl, s.videoModel);
      setVideoProviderId(detectedVideo.id);
      const vUrl = s.videoApiUrl ?? '';
      const vModel = s.videoModel ?? '';
      setVideoApiUrl(vUrl);
      setVideoApiKey(s.videoApiKey ?? '');
      setVideoModel(vModel);
      if (vModel && detectedVideo.models.length > 0 && !detectedVideo.models.includes(vModel)) {
        setVideoIsCustomModel(true);
      } else {
        setVideoIsCustomModel(false);
      }
      if (detectedVideo.requiresCustomUrl || (vUrl && vUrl !== detectedVideo.defaultBaseURL)) {
        setVideoShowCustomUrl(true);
      } else {
        setVideoShowCustomUrl(false);
      }

      // 4. Populate Custom Video Engines
      if (s.customVideoEngines) {
        try {
          const parsed = JSON.parse(s.customVideoEngines);
          if (Array.isArray(parsed)) {
            setCustomVideoEngines(parsed);
          } else {
            setCustomVideoEngines([]);
          }
        } catch {
          setCustomVideoEngines([]);
        }
      } else {
        setCustomVideoEngines([]);
      }

      setDirty(false);
    }
  }, [data]);

  const currentChatProvider: AIProvider = useMemo(
    () => getAIProvider(chatProviderId),
    [chatProviderId],
  );
  const currentAudioProvider: AIProvider = useMemo(
    () => getAudioProvider(audioProviderId),
    [audioProviderId],
  );
  const currentVideoProvider: AIProvider = useMemo(
    () => getVideoProvider(videoProviderId),
    [videoProviderId],
  );

  // ─── Provider Change Handlers ─────────────────────────────────────────────

  const handleChatProviderChange = (newId: string) => {
    const prov = getAIProvider(newId);
    setChatProviderId(newId);
    if (!prov.requiresCustomUrl) {
      setChatApiUrl(prov.defaultBaseURL);
      setChatShowCustomUrl(false);
    } else {
      setChatShowCustomUrl(true);
    }
    setChatModel(prov.defaultModel);
    setChatIsCustomModel(false);
    setDirty(true);
  };

  const handleAudioProviderChange = (newId: string) => {
    const prov = getAudioProvider(newId);
    setAudioProviderId(newId);
    if (!prov.requiresCustomUrl) {
      setAudioApiUrl(prov.defaultBaseURL);
      setAudioShowCustomUrl(false);
    } else {
      setAudioShowCustomUrl(true);
    }
    setAudioModel(prov.defaultModel);
    setAudioIsCustomModel(false);
    setDirty(true);
  };

  const handleVideoProviderChange = (newId: string) => {
    const prov = getVideoProvider(newId);
    setVideoProviderId(newId);
    if (!prov.requiresCustomUrl) {
      setVideoApiUrl(prov.defaultBaseURL);
      setVideoShowCustomUrl(false);
    } else {
      setVideoShowCustomUrl(true);
    }
    setVideoModel(prov.defaultModel);
    setVideoIsCustomModel(false);
    setDirty(true);
  };

  // ─── Model Selection Handlers ─────────────────────────────────────────────

  const handleChatModelSelectChange = (val: string) => {
    if (val === '__custom__') {
      setChatIsCustomModel(true);
      setDirty(true);
    } else {
      setChatIsCustomModel(false);
      setChatModel(val);
      setDirty(true);
    }
  };

  const handleAudioModelSelectChange = (val: string) => {
    if (val === '__custom__') {
      setAudioIsCustomModel(true);
      setDirty(true);
    } else {
      setAudioIsCustomModel(false);
      setAudioModel(val);
      setDirty(true);
    }
  };

  const handleVideoModelSelectChange = (val: string) => {
    if (val === '__custom__') {
      setVideoIsCustomModel(true);
      setDirty(true);
    } else {
      setVideoIsCustomModel(false);
      setVideoModel(val);
      setDirty(true);
    }
  };

  // ─── Mutation & Save ──────────────────────────────────────────────────────

  const [updateSettings, { loading: saving }] = useMutation(UPDATE_SITE_SETTINGS, {
    onCompleted: () => {
      toast({
        title: 'Settings Saved Successfully',
        description: 'Chat, Audio, and Video AI configurations updated across the platform.',
        variant: 'success',
      });
      setDirty(false);
    },
    onError: (e) =>
      toast({ title: 'Save failed', description: e.message, variant: 'error' }),
  });

  const handleSave = () => {
    updateSettings({
      variables: {
        input: {
          chatProvider: chatProviderId,
          chatApiUrl: chatApiUrl.trim() || null,
          chatApiKey: chatApiKey.trim() || null,
          chatModel: chatModel.trim() || null,

          audioProvider: audioProviderId,
          audioApiUrl: audioApiUrl.trim() || null,
          audioApiKey: audioApiKey.trim() || null,
          audioModel: audioModel.trim() || null,

          videoProvider: videoProviderId,
          videoApiUrl: videoApiUrl.trim() || null,
          videoApiKey: videoApiKey.trim() || null,
          videoModel: videoModel.trim() || null,
          customVideoEngines: JSON.stringify(customVideoEngines),
        },
      },
    });
  };

  // ─── Custom Video Engine Handlers ──────────────────────────────────────────
  const handleOpenAddEngine = () => {
    setEditingEngineIndex(null);
    setEngineForm({
      id: '',
      name: '',
      model: '',
      apiUrl: '',
      apiKey: '',
      minDuration: 5,
      maxDuration: 30,
      description: '',
      badge: 'Custom Engine',
      badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    });
    setIsEngineModalOpen(true);
  };

  const handleOpenEditEngine = (index: number) => {
    setEditingEngineIndex(index);
    setEngineForm({ ...customVideoEngines[index] });
    setIsEngineModalOpen(true);
  };

  const handleSaveEngineModal = () => {
    if (!engineForm.name.trim()) {
      toast({
        title: 'Engine Name Required',
        description: 'Please enter a name for the custom engine.',
        variant: 'error',
      });
      return;
    }
    if (!engineForm.model.trim()) {
      toast({
        title: 'Model Identifier Required',
        description: 'Please specify the model name/ID (e.g. wan-2.1-t2v-14b).',
        variant: 'error',
      });
      return;
    }
    const minD = Math.max(1, Number(engineForm.minDuration) || 5);
    const maxD = Math.max(minD, Number(engineForm.maxDuration) || 30);
    const engineId = engineForm.id.trim()
      ? engineForm.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      : `custom-${engineForm.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

    const updatedItem: CustomVideoEngine = {
      ...engineForm,
      id: engineId,
      name: engineForm.name.trim(),
      model: engineForm.model.trim(),
      apiUrl: engineForm.apiUrl?.trim() || undefined,
      apiKey: engineForm.apiKey?.trim() || undefined,
      description: engineForm.description?.trim() || undefined,
      minDuration: minD,
      maxDuration: maxD,
      badge: engineForm.badge?.trim() || 'Custom Engine',
      badgeColor: engineForm.badgeColor || 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    };

    if (editingEngineIndex !== null) {
      const next = [...customVideoEngines];
      next[editingEngineIndex] = updatedItem;
      setCustomVideoEngines(next);
      toast({
        title: 'Engine Updated',
        description: `"${updatedItem.name}" updated. Click "Save Settings" to persist.`,
        variant: 'success',
      });
    } else {
      setCustomVideoEngines((prev) => [...prev, updatedItem]);
      toast({
        title: 'Custom Engine Added',
        description: `"${updatedItem.name}" added. Click "Save Settings" to persist.`,
        variant: 'success',
      });
    }

    setDirty(true);
    setIsEngineModalOpen(false);
  };

  const handleDeleteEngine = (index: number) => {
    const item = customVideoEngines[index];
    setCustomVideoEngines((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
    toast({
      title: 'Engine Removed',
      description: `"${item.name}" was removed. Click "Save Settings" to persist changes.`,
      variant: 'success',
    });
  };

  // Render a reusable AI configuration card
  const renderConfigSection = (
    type: 'chat' | 'audio' | 'video',
    config: {
      title: string;
      subtitle: string;
      icon: any;
      iconCls: string;
      badgeCls: string;
      providers: AIProvider[];
      currentProvider: AIProvider;
      providerId: string;
      onProviderChange: (id: string) => void;
      apiKey: string;
      onApiKeyChange: (k: string) => void;
      showKey: boolean;
      onToggleShowKey: () => void;
      model: string;
      onModelSelectChange: (m: string) => void;
      onModelCustomChange: (m: string) => void;
      isCustomModel: boolean;
      apiUrl: string;
      onApiUrlChange: (u: string) => void;
      showCustomUrl: boolean;
      onToggleShowCustomUrl: () => void;
    },
  ) => {
    const Icon = config.icon;
    const { currentProvider } = config;

    return (
      <div className="glass-card p-6 rounded-2xl border border-border/70 relative overflow-hidden transition-all duration-200 hover:border-border">
        {/* Subtle glow header */}
        <div className="flex items-center justify-between pb-5 mb-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-inner ${config.iconCls}`}
            >
              <Icon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base text-text-primary">{config.title}</h2>
                <span
                  className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border shadow-sm ${config.badgeCls}`}
                >
                  {currentProvider.name}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{config.subtitle}</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary bg-surface/80 px-3 py-1.5 rounded-lg border border-border/60">
            <Radio size={12} className="text-brand-light animate-pulse" />
            <span className="font-mono text-[11px]">{config.model || currentProvider.defaultModel || 'Default'}</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-11 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Provider Selection */}
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                <Cpu size={14} className="text-brand-light" />
                API Provider
              </label>
              <select
                value={config.providerId}
                onChange={(e) => config.onProviderChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-brand transition-colors cursor-pointer"
              >
                {config.providers.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name} {prov.description ? `— ${prov.description}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-text-secondary mt-1.5">
                {currentProvider.description}
              </p>
            </div>

            {/* Provider Info Banner */}
            <div className="p-3.5 rounded-xl bg-surface/80 border border-border/80 text-xs flex items-start gap-2.5 text-text-secondary">
              <Sparkles size={16} className="text-brand-light flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-medium text-text-primary">{currentProvider.name}:</span>{' '}
                Endpoint set to{' '}
                <code className="bg-background px-1.5 py-0.5 rounded text-[11px] text-brand-light font-mono">
                  {currentProvider.requiresCustomUrl
                    ? config.apiUrl || 'Enter custom endpoint below'
                    : currentProvider.defaultBaseURL}
                </code>
                . Features using {config.title.toLowerCase()} will automatically route requests through this configuration.
              </div>
            </div>

            {/* 2. API Key */}
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                <Key size={14} className="text-brand-light" />
                API Key{' '}
                {!currentProvider.requiresApiKey && (
                  <span className="text-text-secondary/60 font-normal">(Optional)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={config.showKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => {
                    config.onApiKeyChange(e.target.value);
                    setDirty(true);
                  }}
                  placeholder={currentProvider.apiKeyPlaceholder || 'Enter API Key...'}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={config.onToggleShowKey}
                  className="absolute right-3 top-3 text-text-secondary hover:text-text-primary transition-colors"
                >
                  {config.showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-[11px] text-text-secondary/80 mt-1.5">
                {currentProvider.apiKeyHint ||
                  'Leave blank to rely on server environment variables if available.'}
              </p>
            </div>

            {/* 3. Model Selection */}
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                <Icon size={14} className="text-brand-light" />
                Model Selection
              </label>

              {currentProvider.models.length > 0 && (
                <div className="mb-2">
                  <select
                    value={config.isCustomModel ? '__custom__' : config.model}
                    onChange={(e) => config.onModelSelectChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-brand transition-colors cursor-pointer"
                  >
                    {currentProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m} {m === currentProvider.defaultModel ? '(Default / Recommended)' : ''}
                      </option>
                    ))}
                    <option value="__custom__">Custom / Other Model...</option>
                  </select>
                </div>
              )}

              {(config.isCustomModel || currentProvider.models.length === 0) && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => {
                      config.onModelCustomChange(e.target.value);
                      setDirty(true);
                    }}
                    placeholder={currentProvider.defaultModel || 'e.g. custom-model-id'}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors font-mono"
                  />
                  <p className="text-[11px] text-text-secondary/80 mt-1">
                    Type exact model identifier string recognized by {currentProvider.name}.
                  </p>
                </div>
              )}
            </div>

            {/* 4. API Endpoint Base URL (Override or Required) */}
            {(currentProvider.requiresCustomUrl || config.showCustomUrl) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5"
              >
                <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                  <Globe size={14} className="text-brand-light" />
                  API Endpoint Base URL{' '}
                  {currentProvider.requiresCustomUrl && <span className="text-error">*</span>}
                </label>
                <input
                  type="text"
                  value={config.apiUrl}
                  onChange={(e) => {
                    config.onApiUrlChange(e.target.value);
                    setDirty(true);
                  }}
                  placeholder={
                    currentProvider.baseUrlHint || 'https://api.example.com/v1'
                  }
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors font-mono text-xs"
                />
                <p className="text-[11px] text-text-secondary/80">
                  {currentProvider.baseUrlHint ||
                    'Custom endpoint base URL for routing requests. Leave empty for provider default.'}
                </p>
              </motion.div>
            )}

            {/* Advanced Base URL Toggle for Standard Providers */}
            {!currentProvider.requiresCustomUrl && (
              <div>
                <button
                  type="button"
                  onClick={config.onToggleShowCustomUrl}
                  className="text-xs text-brand-light hover:underline flex items-center gap-1 font-medium transition-colors"
                >
                  <Settings2 size={13} />
                  {config.showCustomUrl
                    ? 'Hide Custom Base URL'
                    : 'Override Base Endpoint URL (Advanced)'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Admin <span className="gradient-text">Settings</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure dedicated AI providers and models separately for Chat, Audio, and Video
          </p>
        </div>

        {/* Global Save Button in Header */}
        <div className="flex items-center gap-3">
          {!dirty && !saving && data?.siteSettings && (
            <span className="hidden sm:inline-flex text-xs text-success items-center gap-1.5 font-medium px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <CheckCircle2 size={14} /> Synchronized & Active
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn-brand flex items-center gap-2 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg hover:shadow-brand/20 transition-all cursor-pointer"
          >
            <Save size={16} />
            {saving ? 'Saving Changes…' : 'Save All Settings'}
          </button>
        </div>
      </motion.div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-border/60 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-brand text-white shadow-md shadow-brand/25'
              : 'bg-surface/60 hover:bg-surface text-text-secondary hover:text-text-primary border border-border/50'
          }`}
        >
          <Bot size={16} className={activeTab === 'chat' ? 'text-white' : 'text-brand-light'} />
          Chat AI
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
              activeTab === 'chat' ? 'bg-white/20 text-white' : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            {currentChatProvider.name}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'audio'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
              : 'bg-surface/60 hover:bg-surface text-text-secondary hover:text-text-primary border border-border/50'
          }`}
        >
          <Volume2 size={16} className={activeTab === 'audio' ? 'text-white' : 'text-amber-400'} />
          Audio & Voice AI
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
              activeTab === 'audio' ? 'bg-white/20 text-white' : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            {currentAudioProvider.name}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('video')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'video'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
              : 'bg-surface/60 hover:bg-surface text-text-secondary hover:text-text-primary border border-border/50'
          }`}
        >
          <Video size={16} className={activeTab === 'video' ? 'text-white' : 'text-purple-400'} />
          Video AI
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
              activeTab === 'video' ? 'bg-white/20 text-white' : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            {currentVideoProvider.name}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-surface text-text-primary border border-brand/40 shadow-sm'
              : 'bg-surface/60 hover:bg-surface text-text-secondary hover:text-text-primary border border-border/50'
          }`}
        >
          <Layers size={16} className="text-text-secondary" />
          View All 3 Sections
        </button>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6 max-w-4xl pb-12">
        {/* CHAT AI SECTION */}
        {(activeTab === 'chat' || activeTab === 'all') && (
          <motion.div
            key="chat-section"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderConfigSection('chat', {
              title: 'Chat AI Configuration',
              subtitle: 'Primary conversational model for AI Influencers, chat sessions, and reasoning',
              icon: Bot,
              iconCls: 'bg-brand/10 border-brand/25 text-brand-light',
              badgeCls: 'bg-brand/15 text-brand-light border-brand/30',
              providers: CHAT_PROVIDERS,
              currentProvider: currentChatProvider,
              providerId: chatProviderId,
              onProviderChange: handleChatProviderChange,
              apiKey: chatApiKey,
              onApiKeyChange: setChatApiKey,
              showKey: chatShowKey,
              onToggleShowKey: () => setChatShowKey((s) => !s),
              model: chatModel,
              onModelSelectChange: handleChatModelSelectChange,
              onModelCustomChange: setChatModel,
              isCustomModel: chatIsCustomModel,
              apiUrl: chatApiUrl,
              onApiUrlChange: setChatApiUrl,
              showCustomUrl: chatShowCustomUrl,
              onToggleShowCustomUrl: () => setChatShowCustomUrl((s) => !s),
            })}
          </motion.div>
        )}

        {/* AUDIO & VOICE AI SECTION */}
        {(activeTab === 'audio' || activeTab === 'all') && (
          <motion.div
            key="audio-section"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderConfigSection('audio', {
              title: 'Audio & Voice AI Configuration',
              subtitle: 'Text-to-speech, speech synthesis, and voice cloning engine for AI Influencers',
              icon: Volume2,
              iconCls: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
              badgeCls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              providers: AUDIO_PROVIDERS,
              currentProvider: currentAudioProvider,
              providerId: audioProviderId,
              onProviderChange: handleAudioProviderChange,
              apiKey: audioApiKey,
              onApiKeyChange: setAudioApiKey,
              showKey: audioShowKey,
              onToggleShowKey: () => setAudioShowKey((s) => !s),
              model: audioModel,
              onModelSelectChange: handleAudioModelSelectChange,
              onModelCustomChange: setAudioModel,
              isCustomModel: audioIsCustomModel,
              apiUrl: audioApiUrl,
              onApiUrlChange: setAudioApiUrl,
              showCustomUrl: audioShowCustomUrl,
              onToggleShowCustomUrl: () => setAudioShowCustomUrl((s) => !s),
            })}
          </motion.div>
        )}

        {/* VIDEO GENERATION AI SECTION */}
        {(activeTab === 'video' || activeTab === 'all') && (
          <motion.div
            key="video-section"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderConfigSection('video', {
              title: 'Video Generation AI Configuration',
              subtitle: 'Generative video models for producing cinematic influencer video deliverables',
              icon: Video,
              iconCls: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
              badgeCls: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
              providers: VIDEO_PROVIDERS,
              currentProvider: currentVideoProvider,
              providerId: videoProviderId,
              onProviderChange: handleVideoProviderChange,
              apiKey: videoApiKey,
              onApiKeyChange: setVideoApiKey,
              showKey: videoShowKey,
              onToggleShowKey: () => setVideoShowKey((s) => !s),
              model: videoModel,
              onModelSelectChange: handleVideoModelSelectChange,
              onModelCustomChange: setVideoModel,
              isCustomModel: videoIsCustomModel,
              apiUrl: videoApiUrl,
              onApiUrlChange: setVideoApiUrl,
              showCustomUrl: videoShowCustomUrl,
              onToggleShowCustomUrl: () => setVideoShowCustomUrl((s) => !s),
            })}

            {/* Custom Video Engines Manager Card */}
            <div className="mt-6 glass-card p-6 rounded-2xl border border-border/70 relative overflow-hidden transition-all duration-200 hover:border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner bg-cyan-500/10 border-cyan-500/25 text-cyan-400">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-text-primary">
                        Custom AI Video Engines & Pipelines
                      </h3>
                      <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full border shadow-sm bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-mono">
                        {customVideoEngines.length} Configured
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Add any custom or self-hosted video engines (e.g. Wan 2.1, Veo 2, CogVideoX, Hunyuan). They automatically appear in the Video Generator for selection.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddEngine}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  <Plus size={15} />
                  <span>Add Custom Video Engine</span>
                </button>
              </div>

              {/* List of Custom Engines */}
              {customVideoEngines.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border/80 text-center bg-surface/40">
                  <Film size={28} className="mx-auto text-text-secondary/50 mb-2" />
                  <p className="text-xs font-semibold text-text-primary">No Custom Video Engines Added Yet</p>
                  <p className="text-[11px] text-text-secondary mt-1 max-w-md mx-auto">
                    The platform currently uses built-in engines (RunwayML, Luma, Sora, Kling, Pika, Haiper). Click the button above to add custom self-hosted or proxy AI video engines.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customVideoEngines.map((engine, idx) => (
                    <div
                      key={engine.id || idx}
                      className="p-4 rounded-xl bg-surface border border-border/80 flex flex-col justify-between gap-3 hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span className="text-sm font-bold text-text-primary">{engine.name}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border bg-cyan-500/15 text-cyan-400 border-cyan-500/30 inline-block mt-1">
                            {engine.badge || 'Custom Engine'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditEngine(idx)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background border border-transparent hover:border-border transition-colors"
                            title="Edit Engine"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEngine(idx)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                            title="Delete Engine"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {engine.description && (
                        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                          {engine.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-border/50 text-[11px] font-mono flex items-center justify-between text-text-secondary">
                        <span className="text-text-primary font-semibold truncate max-w-[60%]">Model: {engine.model}</span>
                        <span className="text-cyan-400/90 font-semibold">{engine.minDuration || 5}s – {engine.maxDuration || 30}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            {!dirty && !saving && data?.siteSettings ? (
              <span className="text-xs text-success flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={15} /> All 3 AI modules configured & synchronized
              </span>
            ) : dirty ? (
              <span className="text-xs text-amber-400 flex items-center gap-1.5 font-medium">
                <Sliders size={14} /> Unsaved changes in configuration
              </span>
            ) : null}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn-brand flex items-center gap-2 disabled:opacity-50 px-6 py-2.5 rounded-xl text-sm font-medium shadow-md cursor-pointer"
          >
            <Save size={16} />
            {saving ? 'Saving Settings…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Modal: Add / Edit Custom Video Engine */}
      <AnimatePresence>
        {isEngineModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <SlidersHorizontal size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      {editingEngineIndex !== null ? 'Edit Custom Video Engine' : 'Add Custom Video Engine'}
                    </h3>
                    <p className="text-[11px] text-text-secondary">
                      Configure custom AI video generation engine parameters
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEngineModalOpen(false)}
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Engine Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">
                    Engine / Provider Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Wan 2.1 Video, Veo 2, CogVideoX"
                    value={engineForm.name}
                    onChange={(e) => setEngineForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                {/* Model Identifier */}
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">
                    Model Identifier <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. wan-2.1-t2v-14b, veo-2.0, cogvideox-5b"
                    value={engineForm.model}
                    onChange={(e) => setEngineForm((prev) => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary font-mono focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                {/* API Base URL */}
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">
                    API Base URL / Endpoint <span className="text-text-secondary font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://api.my-video-engine.com/v1"
                    value={engineForm.apiUrl || ''}
                    onChange={(e) => setEngineForm((prev) => ({ ...prev, apiUrl: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary font-mono focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">
                    API Key <span className="text-text-secondary font-normal">(Optional)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Optional bearer token or API key"
                    value={engineForm.apiKey || ''}
                    onChange={(e) => setEngineForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary font-mono focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                {/* Min & Max Duration in Seconds */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-text-primary flex items-center gap-1">
                      <Clock size={12} className="text-cyan-400" />
                      <span>Min Duration (seconds)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={engineForm.minDuration}
                      onChange={(e) =>
                        setEngineForm((prev) => ({
                          ...prev,
                          minDuration: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary font-mono focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-text-primary flex items-center gap-1">
                      <Clock size={12} className="text-cyan-400" />
                      <span>Max Duration (seconds)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={engineForm.maxDuration}
                      onChange={(e) =>
                        setEngineForm((prev) => ({
                          ...prev,
                          maxDuration: Math.max(1, parseInt(e.target.value, 10) || 30),
                        }))
                      }
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary font-mono focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">
                    Description / Feature Highlights <span className="text-text-secondary font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ultra high quality photorealistic scene dynamics"
                    value={engineForm.description || ''}
                    onChange={(e) => setEngineForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-text-primary focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEngineModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary bg-background border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEngineModal}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-black shadow-md transition-all cursor-pointer"
                >
                  {editingEngineIndex !== null ? 'Update Engine' : 'Add Engine'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
