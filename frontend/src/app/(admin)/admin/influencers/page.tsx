'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Power, PowerOff, Star, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff, LayoutDashboard, Trash2, RotateCcw, ArrowLeft, Camera } from 'lucide-react';

const PAGE_SIZE = 10;
import { GET_INFLUENCERS } from '@/graphql/queries/influencer';
import { SOFT_DELETE_INFLUENCER, RESTORE_INFLUENCER } from '@/graphql/mutations/influencer';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { gql } from '@apollo/client';

const DEACTIVATE_INFLUENCER = gql`mutation DeactivateInfluencer($id: String!) { deactivateInfluencer(id: $id) { id isActive } }`;
const ACTIVATE_INFLUENCER = gql`mutation ActivateInfluencer($id: String!) { activateInfluencer(id: $id) { id isActive } }`;
const CREATE_INFLUENCER = gql`
  mutation CreateInfluencer($input: CreateInfluencerInput!) {
    createInfluencer(input: $input) {
      id name bio avatar isActive rating totalProjects serviceType
    }
  }
`;

const VIDEO_AI_SERVICES = [
  { key: 'script', label: 'Script Generation AI', desc: 'Generates video scripts from client briefs' },
  { key: 'voice', label: 'Voice Generation (TTS) AI', desc: 'Converts scripts to voiceovers' },
  { key: 'video', label: 'Video Generation AI', desc: 'Produces the final video output' },
  { key: 'image', label: 'Thumbnail / Image Generation AI', desc: 'Creates thumbnails and cover images' },
] as const;

const POST_AI_SERVICES = [
  { key: 'post', label: 'Content Generation AI', desc: 'Generates SEO-optimized title, description, keywords, and body' },
  { key: 'image', label: 'Image Generation AI', desc: 'Creates featured images for the post' },
] as const;

const IMAGE_AI_SERVICES = [
  { key: 'image', label: 'Image Generation AI', desc: 'Generates images from text prompts or briefs' },
] as const;

const EMPTY_AI = {
  chatApiUrl: '', chatApiKey: '', chatModel: '',
  scriptApiUrl: '', scriptApiKey: '', scriptModel: '',
  voiceApiUrl: '', voiceApiKey: '', voiceModel: '',
  videoApiUrl: '', videoApiKey: '', videoModel: '',
  imageApiUrl: '', imageApiKey: '', imageModel: '',
  postApiUrl: '', postApiKey: '', postModel: '',
};

function AIServiceSection({ svc, values, onChange }: {
  svc: { key: string; label: string; desc: string };
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const prefix = svc.key;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-background transition-colors text-left">
        <div>
          <p className="text-sm font-medium">{svc.label}</p>
          <p className="text-xs text-text-secondary mt-0.5">{svc.desc}</p>
        </div>
        {open ? <ChevronUp size={16} className="text-text-secondary flex-shrink-0" /> : <ChevronDown size={16} className="text-text-secondary flex-shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-background/50 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">API URL</label>
                <input value={values[`${prefix}ApiUrl`] ?? ''} onChange={(e) => onChange(`${prefix}ApiUrl`, e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">API Key</label>
                <div className="relative">
                  <input type={showKey ? 'text' : 'password'} value={values[`${prefix}ApiKey`] ?? ''} onChange={(e) => onChange(`${prefix}ApiKey`, e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-9 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                  <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Model / Voice ID</label>
                <input value={values[`${prefix}Model`] ?? ''} onChange={(e) => onChange(`${prefix}Model`, e.target.value)}
                  placeholder="e.g. gpt-4o"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BLANK = {
  name: '', bio: '', avatar: '', coverImage: '', industries: '', contentStyle: '', languages: '',
  systemPrompt: '', voiceId: '', hourlyRate: '', topic: '', outOfTopicMessage: '',
  locationCity: '', locationState: '', locationCountry: '', locationAddress: '', locationPincode: '',
};

export default function AdminInfluencersPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [serviceType, setServiceType] = useState<'CHAT_ONLY' | 'VIDEO_CREATION' | 'POST_CREATION' | 'IMAGE_CREATION'>('CHAT_ONLY');
  const [aiConfig, setAiConfig] = useState<Record<string, string>>(EMPTY_AI);
  const [showChatKey, setShowChatKey] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleUpload = async (file: File | null, type: 'avatar' | 'coverImage') => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === 'avatar') {
      setAvatarPreview(previewUrl);
      setUploadingAvatar(true);
    } else {
      setCoverPreview(previewUrl);
      setUploadingCover(true);
    }

    try {
      const token = localStorage.getItem('genverce_token') || '';
      const data = new FormData();
      data.append('file', file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: data,
        }
      );
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setForm(prev => ({ ...prev, [type]: url }));
    } catch (e: any) {
      toast({ title: 'Image upload failed', description: e.message, variant: 'error' });
      if (type === 'avatar') {
        setAvatarPreview(form.avatar);
      } else {
        setCoverPreview(form.coverImage);
      }
    } finally {
      if (type === 'avatar') {
        setUploadingAvatar(false);
      } else {
        setUploadingCover(false);
      }
    }
  };

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading, refetch, client } = useQuery(GET_INFLUENCERS, { variables: { filter: { limit: 50, includeInactive: true, onlyTrashed: showTrash } } });
  const influencers = data?.influencers?.influencers ?? [];
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    // Search only after 3 characters
    if (q.length > 0 && q.length < 3) {
      return influencers;
    }

    if (!q) return influencers;

    return influencers.filter((inf: any) => {
      const fields = [
        inf.name,
        inf.contentStyle,
        ...(inf.industries ?? []),
        ...(inf.languages ?? []),
      ]
        .filter(Boolean)
        .map(String);

      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [influencers, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [query]);

  const [deactivate] = useMutation(DEACTIVATE_INFLUENCER, {
    onCompleted: (res, vars) => {
      toast({ title: 'Influencer deactivated', variant: 'default' });
      setPendingId(null);
      const updated = res?.deactivateInfluencer;
      if (updated?.id) {
        client.cache.modify({
          fields: {
            influencers(existing) {
              if (!existing?.influencers) return existing;
              const list = existing.influencers.map((i: any) => i.id === updated.id ? { ...i, isActive: false } : i);
              return { ...existing, influencers: list };
            }
          }
        });
      } else {
        refetch();
      }
    },
    onError: (e) => {
      setPendingId(null);
      toast({ title: 'Failed to deactivate', description: e.message, variant: 'error' });
    },
  });
  const [activate] = useMutation(ACTIVATE_INFLUENCER, {
    onCompleted: (res) => {
      toast({ title: 'Influencer activated', variant: 'success' });
      setPendingId(null);
      const updated = res?.activateInfluencer;
      if (updated?.id) {
        client.cache.modify({
          fields: {
            influencers(existing) {
              if (!existing?.influencers) return existing;
              const list = existing.influencers.map((i: any) => i.id === updated.id ? { ...i, isActive: true } : i);
              return { ...existing, influencers: list };
            }
          }
        });
      } else {
        refetch();
      }
    },
    onError: (e) => {
      setPendingId(null);
      toast({ title: 'Failed to activate', description: e.message, variant: 'error' });
    },
  });
  const [createInfluencer, { loading: creating }] = useMutation(CREATE_INFLUENCER, {
    onCompleted: () => {
      toast({ title: 'Influencer created!', variant: 'success' });
      setShowCreate(false);
      setForm(BLANK);
      setAvatarPreview('');
      setCoverPreview('');
      setServiceType('CHAT_ONLY');
      setAiConfig(EMPTY_AI);
      refetch();
    },
    onError: (e) => {
      const detail = (e.graphQLErrors?.[0]?.extensions?.originalError as any)?.message;
      const msg = Array.isArray(detail) ? detail.join(', ') : e.message;
      toast({ title: 'Validation Error', description: msg, variant: 'error' });
    },
  });

  const [softDelete] = useMutation(SOFT_DELETE_INFLUENCER, {
    onCompleted: () => {
      toast({ title: 'Influencer moved to trash', variant: 'success' });
      setPendingId(null);
      refetch();
    },
    onError: (e) => {
      setPendingId(null);
      toast({ title: 'Failed to delete', description: e.message, variant: 'error' });
    },
  });

  const [restore] = useMutation(RESTORE_INFLUENCER, {
    onCompleted: () => {
      toast({ title: 'Influencer restored', variant: 'success' });
      setPendingId(null);
      refetch();
    },
    onError: (e) => {
      setPendingId(null);
      toast({ title: 'Failed to restore', description: e.message, variant: 'error' });
    },
  });

  const handleCreate = () => {
    const errors: string[] = [];
    if (!form.name || form.name.length < 2) errors.push('Name must be at least 2 characters');
    if (!form.avatar.trim()) errors.push('Avatar is required');
    if (form.bio.length < 10) errors.push('Bio must be at least 10 characters');
    if (!form.contentStyle) errors.push('Content Style is required');
    if (!form.industries.trim()) errors.push('At least one Industry is required');
    if (!form.languages.trim()) errors.push('At least one Language is required');
    if (form.systemPrompt.length < 20) errors.push('System Prompt must be at least 20 characters');
    if (errors.length > 0) {
      toast({ title: 'Please fix the following', description: errors.join(' · '), variant: 'error' });
      return;
    }
    const parsedRate = parseFloat(form.hourlyRate);
    const rawAiConfig = {
      chatApiUrl: aiConfig.chatApiUrl || null,
      chatApiKey: aiConfig.chatApiKey || null,
      chatModel: aiConfig.chatModel || null,
      scriptApiUrl: aiConfig.scriptApiUrl || null,
      scriptApiKey: aiConfig.scriptApiKey || null,
      scriptModel: aiConfig.scriptModel || null,
      voiceApiUrl: aiConfig.voiceApiUrl || null,
      voiceApiKey: aiConfig.voiceApiKey || null,
      voiceModel: aiConfig.voiceModel || null,
      videoApiUrl: aiConfig.videoApiUrl || null,
      videoApiKey: aiConfig.videoApiKey || null,
      videoModel: aiConfig.videoModel || null,
      imageApiUrl: aiConfig.imageApiUrl || null,
      imageApiKey: aiConfig.imageApiKey || null,
      imageModel: aiConfig.imageModel || null,
      postApiUrl: aiConfig.postApiUrl || null,
      postApiKey: aiConfig.postApiKey || null,
      postModel: aiConfig.postModel || null,
    };
    const hasAnyConfig = Object.values(rawAiConfig).some(v => v !== null);
    const aiConfigPayload = hasAnyConfig ? rawAiConfig : undefined;
    createInfluencer({
      variables: {
        input: {
          ...form,
          industries: form.industries.split(',').map(s => s.trim()).filter(Boolean),
          languages: form.languages.split(',').map(s => s.trim()).filter(Boolean),
          hourlyRate: !isNaN(parsedRate) && parsedRate >= 0 ? parsedRate : undefined,
          locationCity: form.locationCity.trim() || undefined,
          locationState: form.locationState.trim() || undefined,
          locationCountry: form.locationCountry.trim() || undefined,
          locationAddress: form.locationAddress.trim() || undefined,
          locationPincode: form.locationPincode.trim() || undefined,
          topic: form.topic.trim() || undefined,
          outOfTopicMessage: form.outOfTopicMessage.trim() || undefined,
          coverImage: form.coverImage.trim() || undefined,
          serviceType,
          aiConfig: aiConfigPayload,
        }
      }
    });
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          {showTrash && (
            <button
              onClick={() => setShowTrash(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-light transition-colors mb-2 group"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
              Back to Influencer List
            </button>
          )}
          <h1 className="text-2xl font-semibold">
            {showTrash ? 'Trashed ' : 'Manage '}
            <span className="gradient-text">Influencers</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">{influencers.length} {showTrash ? 'deleted' : 'active'} AI influencers</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowTrash(!showTrash)} className={`px-4 py-2 rounded-lg text-sm transition-colors border ${showTrash ? 'bg-brand/10 border-brand text-brand-light' : 'bg-surface border-border text-text-secondary hover:text-text-primary'}`}>
            {showTrash ? 'View Active' : 'View Trash'}
          </button>
          {!showTrash && (
            <button onClick={() => setShowCreate(!showCreate)} className="btn-brand flex items-center gap-2 flex-shrink-0 text-sm px-3 py-2 sm:px-4">
              <Plus size={16} />
              <span className="hidden sm:inline">Add Influencer</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 sm:p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <h2 className="col-span-full text-lg font-semibold">New AI Influencer</h2>

          {/* Avatar Field */}
          <div className="col-span-full sm:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Avatar Image</label>
            <div className="flex items-center gap-3 mt-1">
              <div className="relative w-14 h-14 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                {avatarPreview || form.avatar ? (
                  <img src={avatarPreview || form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-text-secondary">No Image</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="btn-ghost py-1.5 px-3 cursor-pointer flex items-center gap-1.5 text-xs flex-shrink-0 bg-surface border border-border hover:bg-background rounded-lg transition-colors">
                    <Camera size={14} />
                    {uploadingAvatar ? 'Uploading...' : 'Upload File'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar}
                      onChange={(e) => handleUpload(e.target.files?.[0] ?? null, 'avatar')} />
                  </label>
                  <input
                    value={form.avatar}
                    onChange={(e) => { setForm({ ...form, avatar: e.target.value }); setAvatarPreview(e.target.value); }}
                    placeholder="Or paste avatar URL…"
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <p className="text-[11px] text-text-secondary/60">Upload avatar directly or enter an image URL.</p>
              </div>
            </div>
          </div>

          {/* Cover Image Field */}
          <div className="col-span-full sm:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Cover Image (Optional)</label>
            <div className="flex items-center gap-3 mt-1">
              <div className="relative w-24 h-14 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                {coverPreview || form.coverImage ? (
                  <img src={coverPreview || form.coverImage} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-text-secondary">No Image</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="btn-ghost py-1.5 px-3 cursor-pointer flex items-center gap-1.5 text-xs flex-shrink-0 bg-surface border border-border hover:bg-background rounded-lg transition-colors">
                    <Camera size={14} />
                    {uploadingCover ? 'Uploading...' : 'Upload File'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingCover}
                      onChange={(e) => handleUpload(e.target.files?.[0] ?? null, 'coverImage')} />
                  </label>
                  <input
                    value={form.coverImage}
                    onChange={(e) => { setForm({ ...form, coverImage: e.target.value }); setCoverPreview(e.target.value); }}
                    placeholder="Or paste cover image URL…"
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <p className="text-[11px] text-text-secondary/60">Upload a banner or enter an image URL.</p>
              </div>
            </div>
          </div>

          {[
            { key: 'name', label: 'Name', hint: 'The display name shown to customers (min 2 characters).' },
            { key: 'contentStyle', label: 'Content Style', hint: 'Describe the tone — e.g. Professional & Data-Driven, Warm & Relatable.' },
            { key: 'voiceId', label: 'Voice ID (ElevenLabs)', hint: 'Optional. Paste an ElevenLabs voice ID to enable audio generation for this influencer.' },
            { key: 'industries', label: 'Industries', hint: 'Required. Comma-separated list of niches — e.g. Technology, Beauty, Gaming.' },
            { key: 'locationCity', label: 'City', hint: 'Optional. Influencer location (city).' },
            { key: 'locationState', label: 'State', hint: 'Optional. Influencer location (state).' },
            { key: 'locationCountry', label: 'Country', hint: 'Optional. Influencer location (country).' },
            { key: 'locationPincode', label: 'Pincode', hint: 'Optional. ZIP / postal code.' },
            { key: 'locationAddress', label: 'Address', hint: 'Optional. Full address (street, area, etc.).' },
            { key: 'hourlyRate', label: 'Hourly Rate (USD)', hint: 'Optional. Base pricing shown to customers — e.g. 99.99.' },
            { key: 'languages', label: 'Languages', hint: 'Comma-separated list of supported languages — e.g. English, Spanish.' },
          ].map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
              {key === 'locationAddress' ? (
                <textarea
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none"
                />
              ) : (
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  type={key === 'hourlyRate' ? 'number' : 'text'}
                  min={key === 'hourlyRate' ? '0' : undefined}
                  step={key === 'hourlyRate' ? '0.01' : undefined}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                />
              )}
              <p className="text-[11px] text-text-secondary/60 mt-1">{hint}</p>
            </div>
          ))}
          <div className="col-span-full">
            <label className="block text-xs font-medium text-text-secondary mb-1">Bio</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none" />
            <p className="text-[11px] text-text-secondary/60 mt-1">A short description of the influencer's personality and niche (min 10 characters).</p>
          </div>
          <div className="col-span-full">
            <label className="block text-xs font-medium text-text-secondary mb-1">System Prompt</label>
            <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-none" />
            <p className="text-[11px] text-text-secondary/60 mt-1">Instructions that define this AI's personality, tone, and behavior during chats and content generation (min 20 characters).</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Topic</label>
            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. digital marketing"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors" />
            <p className="text-[11px] text-text-secondary/60 mt-1">The subject this influencer specialises in. Leave blank to allow any topic.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Out-of-Topic Message</label>
            <input value={form.outOfTopicMessage} onChange={(e) => setForm({ ...form, outOfTopicMessage: e.target.value })}
              placeholder="e.g. I only discuss digital marketing topics."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors" />
            <p className="text-[11px] text-text-secondary/60 mt-1">Shown verbatim when a user asks about something unrelated to the topic.</p>
          </div>

          {/* Chat API Integration Override */}
          <div className="col-span-full border border-border rounded-xl p-4 space-y-3 bg-surface/30 mt-2">
            <div>
              <p className="text-sm font-semibold text-text-primary">API Integration Override (Optional)</p>
              <p className="text-xs text-text-secondary">If left blank, this influencer will use the platform's default global Chat AI settings.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Chat API URL</label>
                <input value={aiConfig.chatApiUrl ?? ''} onChange={(e) => setAiConfig(prev => ({ ...prev, chatApiUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors" />
                <p className="text-[11px] text-text-secondary/60 mt-1">Override URL (proxies / custom endpoints).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Chat API Key</label>
                <div className="relative">
                  <input type={showChatKey ? 'text' : 'password'} value={aiConfig.chatApiKey ?? ''} onChange={(e) => setAiConfig(prev => ({ ...prev, chatApiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-9 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors" />
                  <button type="button" onClick={() => setShowChatKey(!showChatKey)} className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary">
                    {showChatKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-text-secondary/60 mt-1">Overrides default platform key.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Chat Model</label>
                <input value={aiConfig.chatModel ?? ''} onChange={(e) => setAiConfig(prev => ({ ...prev, chatModel: e.target.value }))}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors" />
                <p className="text-[11px] text-text-secondary/60 mt-1">Model to use (e.g. gpt-4o-mini).</p>
              </div>
            </div>
          </div>

          {/* Service Type */}
          <div className="col-span-full">
            <label className="block text-xs font-medium text-text-secondary mb-2">Service Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: 'CHAT_ONLY', label: 'Chat Only', desc: 'Text responses only' },
                { value: 'VIDEO_CREATION', label: 'Create Video', desc: 'Full AI video production' },
                { value: 'POST_CREATION', label: 'Create Post', desc: 'SEO-optimized AI posts' },
                { value: 'IMAGE_CREATION', label: 'Create Images', desc: 'AI-generated images from prompts' },
              ] as const).map(({ value, label, desc }) => (
                <button key={value} type="button" onClick={() => setServiceType(value)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${serviceType === value ? 'border-brand bg-brand/10 text-brand-light' : 'border-border bg-surface text-text-secondary hover:border-brand/40'
                    }`}>
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs font-normal mt-0.5 opacity-70">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Config */}
          <AnimatePresence>
            {serviceType === 'VIDEO_CREATION' && (
              <motion.div key="video" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="col-span-full">
                <p className="text-xs font-medium text-text-secondary mb-2">AI Service Integrations</p>
                <div className="space-y-2">
                  {VIDEO_AI_SERVICES.map((svc) => (
                    <AIServiceSection key={svc.key} svc={svc} values={aiConfig}
                      onChange={(k, v) => setAiConfig((prev) => ({ ...prev, [k]: v }))} />
                  ))}
                </div>
              </motion.div>
            )}
            {serviceType === 'POST_CREATION' && (
              <motion.div key="post" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="col-span-full">
                <p className="text-xs font-medium text-text-secondary mb-2">AI Service Integrations</p>
                <div className="space-y-2">
                  {POST_AI_SERVICES.map((svc) => (
                    <AIServiceSection key={svc.key} svc={svc} values={aiConfig}
                      onChange={(k, v) => setAiConfig((prev) => ({ ...prev, [k]: v }))} />
                  ))}
                </div>
              </motion.div>
            )}
            {serviceType === 'IMAGE_CREATION' && (
              <motion.div key="image" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="col-span-full">
                <p className="text-xs font-medium text-text-secondary mb-2">AI Service Integrations</p>
                <div className="space-y-2">
                  {IMAGE_AI_SERVICES.map((svc) => (
                    <AIServiceSection key={svc.key} svc={svc} values={aiConfig}
                      onChange={(k, v) => setAiConfig((prev) => ({ ...prev, [k]: v }))} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="col-span-full flex flex-wrap gap-3">
            <button onClick={handleCreate}
              disabled={creating}
              className="btn-brand disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Influencer'}
            </button>
            <button onClick={() => { setShowCreate(false); setForm(BLANK); setAvatarPreview(''); setCoverPreview(''); setServiceType('CHAT_ONLY'); setAiConfig(EMPTY_AI); }} className="btn-ghost">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search influencers by name, industries, style"
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-text-secondary font-medium">Influencer</th>
                  <th className="text-left p-4 text-text-secondary font-medium hidden md:table-cell">Industries</th>
                  <th className="text-left p-4 text-text-secondary font-medium hidden sm:table-cell">Rating</th>
                  <th className="text-left p-4 text-text-secondary font-medium hidden lg:table-cell">Projects</th>
                  <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                  <th className="text-right p-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((inf: any) => (
                  <tr key={inf.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text">
                          {inf.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{inf.name}</p>
                          <p className="text-xs text-text-secondary">{inf.contentStyle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {inf.industries?.slice(0, 2).map((i: string) => (
                          <span key={i} className="px-1.5 py-0.5 bg-brand/10 text-brand-light rounded text-xs">{i}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-brand-light fill-brand-light" />
                        <span>{inf.rating?.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-text-secondary">{inf.totalProjects}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${inf.deletedAt ? 'bg-error/10 text-error' : inf.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                        {inf.deletedAt ? 'Trashed' : inf.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inf.deletedAt ? (
                          <button
                            onClick={() => { setPendingId(inf.id); restore({ variables: { id: inf.id } }); }}
                            disabled={pendingId === inf.id}
                            className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors" title="Restore">
                            <RotateCcw size={15} />
                          </button>
                        ) : (
                          <>
                            <Link
                              href={`/admin/influencers/${inf.id}`}
                              className="p-1.5 rounded-lg text-text-secondary hover:text-brand-light hover:bg-brand/10 transition-colors"
                              title="Dashboard"
                            >
                              <LayoutDashboard size={15} />
                            </Link>
                            <Link
                              href={`/admin/influencers/${inf.id}/edit`}
                              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                              title="Edit"
                            >
                              <Edit size={15} />
                            </Link>
                            {inf.isActive ? (
                              <button
                                onClick={() => { setPendingId(inf.id); deactivate({ variables: { id: inf.id } }); }}
                                disabled={pendingId === inf.id}
                                className="p-1.5 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors" title="Deactivate">
                                <PowerOff size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => { setPendingId(inf.id); activate({ variables: { id: inf.id } }); }}
                                disabled={pendingId === inf.id}
                                className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors" title="Activate">
                                <Power size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm('Are you sure you want to move this influencer to trash?')) { setPendingId(inf.id); softDelete({ variables: { id: inf.id } }); } }}
                              disabled={pendingId === inf.id}
                              className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors" title="Trash">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border">
              <p className="text-xs text-text-secondary">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page
                        ? 'bg-brand text-white'
                        : 'border border-border text-text-secondary hover:text-text-primary hover:border-brand/50'
                      }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
