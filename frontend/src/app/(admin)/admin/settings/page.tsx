'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bot, Eye, EyeOff, Save, Cpu, Globe, Key, Settings2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { GET_SITE_SETTINGS } from '@/graphql/queries/settings';
import { UPDATE_SITE_SETTINGS } from '@/graphql/mutations/settings';
import { AI_PROVIDERS, getAIProvider, detectProviderFrontend, AIProvider } from '@/lib/ai-providers';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  // Form state
  const [providerId, setProviderId] = useState<string>('openai');
  const [chatApiUrl, setChatApiUrl] = useState<string>('');
  const [chatApiKey, setChatApiKey] = useState<string>('');
  const [chatModel, setChatModel] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [showCustomUrl, setShowCustomUrl] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading } = useQuery(GET_SITE_SETTINGS);

  useEffect(() => {
    if (data?.siteSettings) {
      const detected = detectProviderFrontend(
        data.siteSettings.chatProvider,
        data.siteSettings.chatApiUrl,
        data.siteSettings.chatModel,
      );

      setProviderId(detected.id);
      const url = data.siteSettings.chatApiUrl ?? '';
      const model = data.siteSettings.chatModel ?? '';
      setChatApiUrl(url);
      setChatApiKey(data.siteSettings.chatApiKey ?? '');
      setChatModel(model);

      // Check if custom model mode should be active
      if (model && detected.models.length > 0 && !detected.models.includes(model)) {
        setIsCustomModel(true);
      } else {
        setIsCustomModel(false);
      }

      // Check if custom URL should be visible
      if (detected.requiresCustomUrl || (url && url !== detected.defaultBaseURL)) {
        setShowCustomUrl(true);
      } else {
        setShowCustomUrl(false);
      }

      setDirty(false);
    }
  }, [data]);

  const currentProvider: AIProvider = getAIProvider(providerId);

  // Handle Provider Selection Change
  const handleProviderChange = (newProviderId: string) => {
    const prov = getAIProvider(newProviderId);
    setProviderId(newProviderId);

    // Auto-fill default base URL and default model unless custom
    if (!prov.requiresCustomUrl) {
      setChatApiUrl(prov.defaultBaseURL);
      setShowCustomUrl(false);
    } else {
      setShowCustomUrl(true);
    }

    setChatModel(prov.defaultModel);
    setIsCustomModel(false);
    setDirty(true);
  };

  // Handle Model Dropdown Change
  const handleModelSelectChange = (val: string) => {
    if (val === '__custom__') {
      setIsCustomModel(true);
      setDirty(true);
    } else {
      setIsCustomModel(false);
      setChatModel(val);
      setDirty(true);
    }
  };

  const [updateSettings, { loading: saving }] = useMutation(UPDATE_SITE_SETTINGS, {
    onCompleted: () => {
      toast({ title: 'AI Settings saved', description: `Configured provider: ${currentProvider.name}`, variant: 'success' });
      setDirty(false);
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message, variant: 'error' }),
  });

  const handleSave = () => {
    updateSettings({
      variables: {
        input: {
          chatProvider: providerId,
          chatApiUrl: chatApiUrl.trim() || null,
          chatApiKey: chatApiKey.trim() || null,
          chatModel: chatModel.trim() || null,
        },
      },
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">Admin <span className="gradient-text">Settings</span></h1>
        <p className="text-sm text-text-secondary mt-1">Manage global AI model providers and platform options</p>
      </motion.div>

      <div className="space-y-6 max-w-3xl">
        {/* Chat AI Configuration Card */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                <Bot size={20} className="text-brand-light" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-base">Chat AI Provider</h2>
                  <span className="px-2 py-0.5 text-[11px] font-medium bg-brand/15 text-brand-light border border-brand/30 rounded-full">
                    {currentProvider.name}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">Primary language model for AI influencers and chat responses</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-11 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. Provider Select */}
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                  <Cpu size={14} className="text-brand-light" />
                  AI Provider
                </label>
                <select
                  value={providerId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-brand transition-colors cursor-pointer"
                >
                  {AI_PROVIDERS.map((prov) => (
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
                  <span className="font-medium text-text-primary">{currentProvider.name} Configured:</span>{' '}
                  Endpoint set to <code className="bg-background px-1.5 py-0.5 rounded text-[11px] text-brand-light">{currentProvider.requiresCustomUrl ? (chatApiUrl || 'Custom URL') : currentProvider.defaultBaseURL}</code>.
                  No manual endpoint coding required.
                </div>
              </div>

              {/* 2. API Key Input */}
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                  <Key size={14} className="text-brand-light" />
                  API Key {!currentProvider.requiresApiKey && <span className="text-text-secondary/60 font-normal">(Optional)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={chatApiKey}
                    onChange={(e) => { setChatApiKey(e.target.value); setDirty(true); }}
                    placeholder={currentProvider.apiKeyPlaceholder || 'Enter API Key...'}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(s => !s)}
                    className="absolute right-3 top-3 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-text-secondary/80 mt-1.5">
                  {currentProvider.apiKeyHint || 'Leave blank to use environment variable defaults on the server.'}
                </p>
              </div>

              {/* 3. Model Select / Custom Input */}
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                  <Bot size={14} className="text-brand-light" />
                  Model Selection
                </label>
                
                {currentProvider.models.length > 0 && (
                  <div className="mb-2">
                    <select
                      value={isCustomModel ? '__custom__' : chatModel}
                      onChange={(e) => handleModelSelectChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-brand transition-colors cursor-pointer"
                    >
                      {currentProvider.models.map((m) => (
                        <option key={m} value={m}>
                          {m} {m === currentProvider.defaultModel ? '(Recommended)' : ''}
                        </option>
                      ))}
                      <option value="__custom__">Custom / Other Model...</option>
                    </select>
                  </div>
                )}

                {(isCustomModel || currentProvider.models.length === 0) && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={chatModel}
                      onChange={(e) => { setChatModel(e.target.value); setDirty(true); }}
                      placeholder={currentProvider.defaultModel || 'e.g. gpt-4o-mini'}
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                    <p className="text-[11px] text-text-secondary/80 mt-1">
                      Type exact model ID string recognized by {currentProvider.name}.
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Optional / Custom Base URL Field */}
              {(currentProvider.requiresCustomUrl || showCustomUrl) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                    <Globe size={14} className="text-brand-light" />
                    API Endpoint Base URL {currentProvider.requiresCustomUrl && <span className="text-error">*</span>}
                  </label>
                  <input
                    type="text"
                    value={chatApiUrl}
                    onChange={(e) => { setChatApiUrl(e.target.value); setDirty(true); }}
                    placeholder={currentProvider.baseUrlHint || 'https://api.example.com/v1'}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                  />
                  <p className="text-[11px] text-text-secondary/80 mt-1">
                    {currentProvider.baseUrlHint || 'Base URL for requests. Leave empty for provider default.'}
                  </p>
                </motion.div>
              )}

              {/* Advanced Endpoint Toggle for non-custom providers */}
              {!currentProvider.requiresCustomUrl && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCustomUrl(s => !s)}
                    className="text-xs text-brand-light hover:underline flex items-center gap-1 font-medium"
                  >
                    <Settings2 size={13} />
                    {showCustomUrl ? 'Hide Custom Base URL' : 'Override Base Endpoint URL (Advanced)'}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="btn-brand flex items-center gap-2 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-medium"
                >
                  <Save size={16} />
                  {saving ? 'Saving Settings…' : 'Save Settings'}
                </button>

                {!dirty && !saving && data?.siteSettings && (
                  <span className="text-xs text-success flex items-center gap-1 font-medium">
                    <CheckCircle2 size={14} /> Saved & Active
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
