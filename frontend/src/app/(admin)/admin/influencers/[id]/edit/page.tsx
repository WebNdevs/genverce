'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, XCircle, ChevronDown, ChevronUp, Eye, EyeOff, Camera } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { GET_INFLUENCER_ADMIN_EDIT } from '@/graphql/queries/influencer';
import { UPDATE_INFLUENCER } from '@/graphql/mutations/influencer';
import { toast } from '@/components/ui/toaster';

const VIDEO_AI_SERVICES = [
  { key: 'script', label: 'Script Generation AI',          desc: 'Generates video scripts based on client briefs' },
  { key: 'voice',  label: 'Voice Generation (TTS) AI',     desc: 'Converts scripts to voiceovers' },
  { key: 'video',  label: 'Video Generation AI',           desc: 'Produces the final video output' },
  { key: 'image',  label: 'Thumbnail / Image Generation AI', desc: 'Creates thumbnails and cover images' },
] as const;

const POST_AI_SERVICES = [
  { key: 'post',  label: 'Content Generation AI',  desc: 'Generates SEO-optimized title, description, keywords, and body' },
  { key: 'image', label: 'Image Generation AI',     desc: 'Creates featured images for the post' },
] as const;

const IMAGE_AI_SERVICES = [
  { key: 'image', label: 'Image Generation AI', desc: 'Generates images from text prompts or briefs' },
] as const;


const EMPTY_AI = {
  chatApiUrl:   '', chatApiKey:   '', chatModel:    '',
  scriptApiUrl: '', scriptApiKey: '', scriptModel: '',
  voiceApiUrl:  '', voiceApiKey:  '', voiceModel:  '',
  videoApiUrl:  '', videoApiKey:  '', videoModel:  '',
  imageApiUrl:  '', imageApiKey:  '', imageModel:  '',
  postApiUrl:   '', postApiKey:   '', postModel:   '',
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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-background transition-colors text-left"
      >
        <div>
          <p className="text-sm font-medium">{svc.label}</p>
          <p className="text-xs text-text-secondary mt-0.5">{svc.desc}</p>
        </div>
        {open ? <ChevronUp size={16} className="text-text-secondary flex-shrink-0" /> : <ChevronDown size={16} className="text-text-secondary flex-shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 bg-background/50 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">API URL</label>
                <input
                  value={values[`${prefix}ApiUrl`] ?? ''}
                  onChange={(e) => onChange(`${prefix}ApiUrl`, e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={values[`${prefix}ApiKey`] ?? ''}
                    onChange={(e) => onChange(`${prefix}ApiKey`, e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-9 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                  <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Model / Voice ID</label>
                <input
                  value={values[`${prefix}Model`] ?? ''}
                  onChange={(e) => onChange(`${prefix}Model`, e.target.value)}
                  placeholder="e.g. gpt-4o, eleven_multilingual_v2"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-text-secondary/60 mt-1">{hint}</p>}
    </div>
  );
}

export default function EditInfluencerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') { router.push('/dashboard'); }
  }, [hydrated, isAuthenticated, user]);

  const { data, loading: loadingQuery } = useQuery(GET_INFLUENCER_ADMIN_EDIT, { variables: { id } });
  const inf = data?.influencer;

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bio, setBio] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationPincode, setLocationPincode] = useState('');
  const [contentStyle, setContentStyle] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [industries, setIndustries] = useState('');
  const [languages, setLanguages] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [serviceType, setServiceType] = useState<'CHAT_ONLY' | 'VIDEO_CREATION' | 'POST_CREATION' | 'IMAGE_CREATION'>('CHAT_ONLY');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [topic, setTopic] = useState('');
  const [outOfTopicMessage, setOutOfTopicMessage] = useState('');
  const [aiConfig, setAiConfig] = useState<Record<string, string>>(EMPTY_AI);
  const [initialized, setInitialized] = useState(false);
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
      if (type === 'avatar') {
        setAvatar(url);
      } else {
        setCoverImage(url);
      }
    } catch (e: any) {
      toast({ title: 'Image upload failed', description: e.message, variant: 'error' });
      if (type === 'avatar') {
        setAvatarPreview(avatar);
      } else {
        setCoverPreview(coverImage);
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
    if (inf && !initialized) {
      setName(inf.name ?? '');
      setAvatar(inf.avatar ?? '');
      setCoverImage(inf.coverImage ?? '');
      setAvatarPreview(inf.avatar ?? '');
      setCoverPreview(inf.coverImage ?? '');
      setBio(inf.bio ?? '');
      setLocationCity(inf.locationCity ?? '');
      setLocationState(inf.locationState ?? '');
      setLocationCountry(inf.locationCountry ?? '');
      setLocationAddress(inf.locationAddress ?? '');
      setLocationPincode(inf.locationPincode ?? '');
      setContentStyle(inf.contentStyle ?? '');
      setVoiceId(inf.voiceId ?? '');
      setIndustries((inf.industries ?? []).join(', '));
      setLanguages((inf.languages ?? []).join(', '));
      setHourlyRate(inf.hourlyRate ? String(inf.hourlyRate) : '');
      setServiceType(inf.serviceType ?? 'CHAT_ONLY');
      setSystemPrompt(inf.systemPrompt ?? '');
      setTopic(inf.topic ?? '');
      setOutOfTopicMessage(inf.outOfTopicMessage ?? '');
      if (inf.aiConfig) {
        setAiConfig({
          chatApiUrl:   inf.aiConfig.chatApiUrl   ?? '',
          chatApiKey:   inf.aiConfig.chatApiKey   ?? '',
          chatModel:    inf.aiConfig.chatModel    ?? '',
          scriptApiUrl: inf.aiConfig.scriptApiUrl ?? '',
          scriptApiKey: inf.aiConfig.scriptApiKey ?? '',
          scriptModel:  inf.aiConfig.scriptModel  ?? '',
          voiceApiUrl:  inf.aiConfig.voiceApiUrl  ?? '',
          voiceApiKey:  inf.aiConfig.voiceApiKey  ?? '',
          voiceModel:   inf.aiConfig.voiceModel   ?? '',
          videoApiUrl:  inf.aiConfig.videoApiUrl  ?? '',
          videoApiKey:  inf.aiConfig.videoApiKey  ?? '',
          videoModel:   inf.aiConfig.videoModel   ?? '',
          imageApiUrl:  inf.aiConfig.imageApiUrl  ?? '',
          imageApiKey:  inf.aiConfig.imageApiKey  ?? '',
          imageModel:   inf.aiConfig.imageModel   ?? '',
          postApiUrl:   inf.aiConfig.postApiUrl   ?? '',
          postApiKey:   inf.aiConfig.postApiKey   ?? '',
          postModel:    inf.aiConfig.postModel    ?? '',
        });
      }
      setInitialized(true);
    }
  }, [inf, initialized]);

  const [updateInfluencer, { loading: saving }] = useMutation(UPDATE_INFLUENCER, {
    onCompleted: () => {
      toast({ title: 'Influencer updated', variant: 'success' });
      router.push('/admin/influencers');
    },
    onError: (e) => {
      const detail = (e.graphQLErrors?.[0]?.extensions?.originalError as any)?.message;
      const msg = Array.isArray(detail) ? detail.join(', ') : e.message;
      toast({ title: 'Update failed', description: msg, variant: 'error' });
    },
  });

  const save = () => {
    if (!inf) return;
    const input: Record<string, any> = {};
    const trim = (v: string) => v.trim();
    const parseList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);
    const arraysEqual = (a: string[] = [], b: string[] = []) =>
      a.length === b.length && a.every((x, i) => x === b[i]);

    if (trim(name) !== (inf.name ?? '')) input.name = trim(name);
    if (trim(avatar) !== (inf.avatar ?? '')) input.avatar = trim(avatar);
    if (trim(bio) !== (inf.bio ?? '')) input.bio = trim(bio);
    if (trim(contentStyle) !== (inf.contentStyle ?? '')) input.contentStyle = trim(contentStyle);

    const currCity = inf.locationCity ?? '';
    const nextCity = trim(locationCity);
    if (nextCity !== currCity) input.locationCity = nextCity || null;

    const currState = inf.locationState ?? '';
    const nextState = trim(locationState);
    if (nextState !== currState) input.locationState = nextState || null;

    const currCountry = inf.locationCountry ?? '';
    const nextCountry = trim(locationCountry);
    if (nextCountry !== currCountry) input.locationCountry = nextCountry || null;

    const currAddress = inf.locationAddress ?? '';
    const nextAddress = trim(locationAddress);
    if (nextAddress !== currAddress) input.locationAddress = nextAddress || null;

    const currPincode = inf.locationPincode ?? '';
    const nextPincode = trim(locationPincode);
    if (nextPincode !== currPincode) input.locationPincode = nextPincode || null;

    const currentCover = inf.coverImage ?? '';
    const nextCover = trim(coverImage);
    if (nextCover !== currentCover) input.coverImage = nextCover || null;

    const currentVoice = inf.voiceId ?? '';
    const nextVoice = trim(voiceId);
    if (nextVoice !== currentVoice) input.voiceId = nextVoice || null;

    const nextIndustries = parseList(industries);
    const currIndustries = Array.isArray(inf.industries) ? inf.industries : [];
    if (!arraysEqual(nextIndustries, currIndustries)) input.industries = nextIndustries;

    const nextLanguages = parseList(languages);
    const currLanguages = Array.isArray(inf.languages) ? inf.languages : [];
    if (!arraysEqual(nextLanguages, currLanguages)) input.languages = nextLanguages;

    const rate = parseFloat(hourlyRate);
    const currRate = inf.hourlyRate ?? null;
    if (!Number.isNaN(rate) && rate !== currRate) input.hourlyRate = rate;

    if (serviceType !== (inf.serviceType ?? 'CHAT_ONLY')) input.serviceType = serviceType as any;

    if (trim(systemPrompt) !== (inf.systemPrompt ?? '')) input.systemPrompt = trim(systemPrompt);
    if (trim(topic) !== (inf.topic ?? '')) input.topic = trim(topic) || null;
    if (trim(outOfTopicMessage) !== (inf.outOfTopicMessage ?? '')) input.outOfTopicMessage = trim(outOfTopicMessage) || null;

    // Construct final aiConfig object
    const finalAiConfig: Record<string, any> = {
      chatApiUrl:   aiConfig.chatApiUrl   || null,
      chatApiKey:   aiConfig.chatApiKey   || null,
      chatModel:    aiConfig.chatModel    || null,
      scriptApiUrl: aiConfig.scriptApiUrl || null,
      scriptApiKey: aiConfig.scriptApiKey || null,
      scriptModel:  aiConfig.scriptModel  || null,
      voiceApiUrl:  aiConfig.voiceApiUrl  || null,
      voiceApiKey:  aiConfig.voiceApiKey  || null,
      voiceModel:   aiConfig.voiceModel   || null,
      videoApiUrl:  aiConfig.videoApiUrl  || null,
      videoApiKey:  aiConfig.videoApiKey  || null,
      videoModel:   aiConfig.videoModel   || null,
      imageApiUrl:  aiConfig.imageApiUrl  || null,
      imageApiKey:  aiConfig.imageApiKey  || null,
      imageModel:   aiConfig.imageModel   || null,
      postApiUrl:   aiConfig.postApiUrl   || null,
      postApiKey:   aiConfig.postApiKey   || null,
      postModel:    aiConfig.postModel    || null,
    };

    const hasAnyConfig = Object.values(finalAiConfig).some(v => v !== null);
    if (hasAnyConfig) {
      input.aiConfig = finalAiConfig;
    }

    if (Object.keys(input).length === 0) {
      toast({ title: 'No changes to save', variant: 'default' });
      return;
    }

    const errors: string[] = [];
    if (input.name && input.name.length < 2) errors.push('Name must be at least 2 characters');
    if (input.bio && input.bio.length < 10) errors.push('Bio must be at least 10 characters');
    if (typeof input.hourlyRate === 'number' && input.hourlyRate < 0) errors.push('Hourly rate cannot be negative');
    if (parseList(industries).length === 0) errors.push('At least one Industry is required');
    if (errors.length > 0) {
      toast({ title: 'Please fix the following', description: errors.join(' · '), variant: 'error' });
      return;
    }
    updateInfluencer({ variables: { id, input } });
  };


  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">Edit <span className="gradient-text">Influencer</span></h1>
        <p className="text-sm text-text-secondary mt-1">{id}</p>
      </motion.div>

      {loadingQuery ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="glass-card p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" hint="Display name shown to customers (min 2 characters).">
              <input value={name} onChange={(e)=>setName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium text-text-secondary">Avatar Image</label>
              <div className="flex items-center gap-3 mt-1">
                <div className="relative w-14 h-14 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                  {avatarPreview || avatar ? (
                    <img src={avatarPreview || avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-text-secondary">No Image</span>
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
                      value={avatar}
                      onChange={(e) => { setAvatar(e.target.value); setAvatarPreview(e.target.value); }}
                      placeholder="Or paste avatar URL…"
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-text-secondary/60">Upload avatar directly or enter an image URL.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium text-text-secondary">Cover Image (Optional)</label>
              <div className="flex items-center gap-3 mt-1">
                <div className="relative w-24 h-14 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                  {coverPreview || coverImage ? (
                    <img src={coverPreview || coverImage} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-text-secondary">No Image</span>
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
                      value={coverImage}
                      onChange={(e) => { setCoverImage(e.target.value); setCoverPreview(e.target.value); }}
                      placeholder="Or paste cover image URL…"
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-text-secondary/60">Upload a banner or enter an image URL.</p>
                </div>
              </div>
            </div>
            <Field label="City" hint="Optional. Influencer location (city).">
              <input value={locationCity} onChange={(e)=>setLocationCity(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="State" hint="Optional. Influencer location (state).">
              <input value={locationState} onChange={(e)=>setLocationState(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Country" hint="Optional. Influencer location (country).">
              <input value={locationCountry} onChange={(e)=>setLocationCountry(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Pincode" hint="Optional. ZIP / postal code.">
              <input value={locationPincode} onChange={(e)=>setLocationPincode(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Content Style" hint="Tone — e.g. Professional & Data-Driven, Warm & Relatable.">
              <input value={contentStyle} onChange={(e)=>setContentStyle(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Bio" hint="Personality and niche description (min 10 characters).">
                <textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={4}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand resize-none" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Address" hint="Optional. Full address (street, area, etc.).">
                <textarea value={locationAddress} onChange={(e)=>setLocationAddress(e.target.value)} rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand resize-none" />
              </Field>
            </div>
            <Field label="Voice ID" hint="Optional ElevenLabs voice ID for audio generation.">
              <input value={voiceId} onChange={(e)=>setVoiceId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Hourly Rate (USD)" hint="Base pricing shown to customers. Leave blank if not applicable.">
              <input value={hourlyRate} onChange={(e)=>setHourlyRate(e.target.value)}
                type="number" step="0.01" min="0"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Industries" hint="Required. Comma-separated — e.g. Technology, Beauty, Gaming.">
              <input value={industries} onChange={(e)=>setIndustries(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Languages" hint="Comma-separated — e.g. English, Spanish.">
              <input value={languages} onChange={(e)=>setLanguages(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
          </div>

          {/* Service Type */}
          <div className="glass-card p-4 sm:p-6">
            <h2 className="text-base font-semibold mb-1">Service Type</h2>
            <p className="text-xs text-text-secondary mb-4">Select what this influencer can deliver to clients.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              {([
                { value: 'CHAT_ONLY',      label: 'Chat Only',     desc: 'Text chat responses only' },
                { value: 'VIDEO_CREATION', label: 'Create Video',  desc: 'Full AI video production' },
                { value: 'POST_CREATION',  label: 'Create Post',   desc: 'SEO-optimized AI posts' },
                { value: 'IMAGE_CREATION', label: 'Create Images', desc: 'AI-generated images from prompts' },
              ] as const).map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setServiceType(value)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${
                    serviceType === value
                      ? 'border-brand bg-brand/10 text-brand-light'
                      : 'border-border bg-surface text-text-secondary hover:border-brand/40'
                  }`}
                >
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs font-normal mt-0.5 opacity-70">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Chat AI — system prompt, topic, out-of-topic message */}
          <div className="glass-card p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Chat AI</h2>
              <p className="text-xs text-text-secondary mb-4">Configure how this influencer responds in chat conversations.</p>
            </div>
            <Field label="System Prompt" hint="Defines the influencer's personality, tone, and behaviour (min 20 characters).">
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand resize-none" />
            </Field>
            <Field label="Topic" hint="The subject this influencer specialises in — e.g. 'digital marketing', 'fitness'. Leave blank for no restriction.">
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. digital marketing"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>
            <Field label="Out-of-Topic Message" hint="Shown verbatim when a user asks about something unrelated to the topic. Only used when a Topic is set.">
              <input value={outOfTopicMessage} onChange={(e) => setOutOfTopicMessage(e.target.value)}
                placeholder="e.g. I can only help with digital marketing questions."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
            </Field>

            {/* Chat API Integration Override */}
            <div className="border border-border rounded-xl p-4 space-y-3 bg-surface/30 mt-4">
              <div>
                <p className="text-sm font-semibold">API Integration Override (Optional)</p>
                <p className="text-xs text-text-secondary">If left blank, this influencer will use the platform's default global Chat AI settings.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <Field label="Chat API URL" hint="Override URL (useful for proxies or compatible providers).">
                  <input value={aiConfig.chatApiUrl ?? ''} onChange={(e) => setAiConfig(prev => ({ ...prev, chatApiUrl: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                </Field>
                <Field label="Chat API Key" hint="Overrides platform's API Key.">
                  <div className="relative">
                    <input type={showChatKey ? 'text' : 'password'} value={aiConfig.chatApiKey ?? ''} onChange={(e) => setAiConfig(prev => ({ ...prev, chatApiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 pr-9 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                    <button type="button" onClick={() => setShowChatKey(!showChatKey)} className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary">
                      {showChatKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
                <Field label="Chat Model" hint="The specific model ID to use for chat responses.">
                  <input value={aiConfig.chatModel ?? ''} onChange={(e) => setAiConfig(prev => ({ ...prev, chatModel: e.target.value }))}
                    placeholder="gpt-4o-mini"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand" />
                </Field>
              </div>
            </div>
          </div>

          {/* AI Config — visible only for VIDEO_CREATION */}
          <AnimatePresence>
            {serviceType === 'VIDEO_CREATION' && (
              <motion.div key="video" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-1">AI Service Integrations</h2>
                <p className="text-xs text-text-secondary mb-4">
                  Configure the AI APIs used to generate scripts, voiceovers, videos, and thumbnails.
                </p>
                <div className="space-y-3">
                  {VIDEO_AI_SERVICES.map((svc) => (
                    <AIServiceSection key={svc.key} svc={svc} values={aiConfig}
                      onChange={(k, v) => setAiConfig((prev) => ({ ...prev, [k]: v }))} />
                  ))}
                </div>
              </motion.div>
            )}
            {serviceType === 'POST_CREATION' && (
              <motion.div key="post" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-1">AI Service Integrations</h2>
                <p className="text-xs text-text-secondary mb-4">
                  Configure the AI APIs used to generate SEO-optimized post content and featured images.
                </p>
                <div className="space-y-3">
                  {POST_AI_SERVICES.map((svc) => (
                    <AIServiceSection key={svc.key} svc={svc} values={aiConfig}
                      onChange={(k, v) => setAiConfig((prev) => ({ ...prev, [k]: v }))} />
                  ))}
                </div>
              </motion.div>
            )}
            {serviceType === 'IMAGE_CREATION' && (
              <motion.div key="image" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-1">AI Service Integrations</h2>
                <p className="text-xs text-text-secondary mb-4">
                  Configure the AI API used to generate images from prompts or client briefs.
                </p>
                <div className="space-y-3">
                  {IMAGE_AI_SERVICES.map((svc) => (
                    <AIServiceSection key={svc.key} svc={svc} values={aiConfig}
                      onChange={(k, v) => setAiConfig((prev) => ({ ...prev, [k]: v }))} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={saving}
              className="btn-brand flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50">
              <Save size={14}/> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => router.push('/admin/influencers')}
              className="btn-ghost flex items-center gap-2 text-sm px-4 py-2">
              <XCircle size={14}/> Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
