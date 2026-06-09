'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bot, Eye, EyeOff, Save } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { GET_SITE_SETTINGS } from '@/graphql/queries/settings';
import { UPDATE_SITE_SETTINGS } from '@/graphql/mutations/settings';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();

  // Chat AI form state
  const [chatApiUrl, setChatApiUrl] = useState('');
  const [chatApiKey, setChatApiKey] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const { data, loading } = useQuery(GET_SITE_SETTINGS);

  useEffect(() => {
    if (data?.siteSettings) {
      setChatApiUrl(data.siteSettings.chatApiUrl ?? '');
      setChatApiKey(data.siteSettings.chatApiKey ?? '');
      setChatModel(data.siteSettings.chatModel ?? '');
      setDirty(false);
    }
  }, [data]);

  const [updateSettings, { loading: saving }] = useMutation(UPDATE_SITE_SETTINGS, {
    onCompleted: () => {
      toast({ title: 'Settings saved', variant: 'success' });
      setDirty(false);
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message, variant: 'error' }),
  });

  const handleSave = () => {
    updateSettings({
      variables: {
        input: {
          chatApiUrl: chatApiUrl.trim() || null,
          chatApiKey: chatApiKey.trim() || null,
          chatModel: chatModel.trim() || null,
        },
      },
    });
  };

  function field(label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; hint?: string; type?: 'text' | 'password'; showToggle?: boolean; show?: boolean; onToggle?: () => void }) {
    return (
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
        <div className="relative">
          <input
            type={opts?.type === 'password' && !opts?.show ? 'password' : 'text'}
            value={value}
            onChange={(e) => { onChange(e.target.value); setDirty(true); }}
            placeholder={opts?.placeholder}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors pr-9"
          />
          {opts?.showToggle && (
            <button type="button" onClick={opts.onToggle} className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary">
              {opts.show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
        {opts?.hint && <p className="text-[11px] text-text-secondary/60 mt-1">{opts.hint}</p>}
      </div>
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">Admin <span className="gradient-text">Settings</span></h1>
        <p className="text-sm text-text-secondary mt-1">Manage platform configuration</p>
      </motion.div>

      <div className="space-y-4 max-w-2xl">
        {/* Chat AI */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Bot size={18} className="text-brand-light" />
            </div>
            <div>
              <p className="font-semibold">Chat AI</p>
              <p className="text-xs text-text-secondary">API used by all influencer chat conversations</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {field('API URL', chatApiUrl, setChatApiUrl, {
                placeholder: 'https://api.anthropic.com (leave blank to use default)',
                hint: 'Override the base URL — useful for proxies or compatible providers. Leave blank to use the Anthropic default.',
              })}
              {field('API Key', chatApiKey, setChatApiKey, {
                placeholder: 'sk-ant-... (leave blank to use server env key)',
                hint: 'Overrides the ANTHROPIC_API_KEY set on the server. Leave blank to keep using the environment variable.',
                type: 'password',
                showToggle: true,
                show: showKey,
                onToggle: () => setShowKey(s => !s),
              })}
              {field('Model', chatModel, setChatModel, {
                placeholder: 'claude-sonnet-4-6 (default)',
                hint: 'The model ID to use for chat responses. Defaults to claude-sonnet-4-6 if left blank.',
              })}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="btn-brand flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {!dirty && !saving && data?.siteSettings && (
                  <span className="text-xs text-text-secondary">All changes saved</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
