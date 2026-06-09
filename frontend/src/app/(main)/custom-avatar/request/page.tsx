'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useMutation } from '@apollo/client';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { CREATE_TICKET } from '@/graphql/mutations/ticket';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import AdminLayout from '@/app/(admin)/admin/layout';
import { UserPlus, Info, Send, X } from 'lucide-react';

const USAGE_RIGHTS = [
  { value: 'PRIVATE_EXCLUSIVE',    label: 'Exclusive',          desc: 'Private — exclusive to my brand' },
  { value: 'PRIVATE_INTERNAL',     label: 'Internal',           desc: 'Private — internal channels only' },
  { value: 'PUBLIC_CONSIDERATION', label: 'Open to public',     desc: 'Private now, consider public listing' },
];

const COMPLEXITY_OPTIONS = [
  { value: 'SIMPLE',     label: 'Simple',     desc: 'Basic persona, standard voice' },
  { value: 'ADVANCED',   label: 'Advanced',   desc: 'Custom style, multi-language' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: 'Full brand suite, compliance' },
];

const inputCls = 'w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors';

function RequestForm({
  loading,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  onSubmit: (data: {
    brandName: string;
    guidelines: string;
    requirements: string;
    usageRights: string;
    complexity: string;
    assetsUrl: string;
  }) => void;
  onCancel: () => void;
}) {
  const [brandName, setBrandName]     = useState('');
  const [guidelines, setGuidelines]   = useState('');
  const [requirements, setRequirements] = useState('');
  const [usageRights, setUsageRights] = useState('PRIVATE_EXCLUSIVE');
  const [complexity, setComplexity]   = useState('SIMPLE');
  const [assetsUrl, setAssetsUrl]     = useState('');

  const canSubmit = brandName.trim() && guidelines.trim() && requirements.trim();

  return (
    <div className="glass-card p-4 sm:p-6 space-y-5">

      {/* Brand Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Brand Name <span className="text-error">*</span>
        </label>
        <input
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="e.g. Acme Corp"
          className={inputCls}
        />
      </div>

      {/* Brand Guidelines */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Brand Guidelines <span className="text-error">*</span>
        </label>
        <textarea
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          rows={4}
          placeholder="Tone of voice, visual style, compliance requirements, reference examples…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Content Requirements */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Content Requirements <span className="text-error">*</span>
        </label>
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          rows={4}
          placeholder="Deliverables, formats, languages, persona traits, posting frequency…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Usage Rights */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Usage Rights</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {USAGE_RIGHTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setUsageRights(opt.value)}
              className={`px-3 py-3 rounded-xl border text-left transition-colors ${
                usageRights === opt.value
                  ? 'border-brand bg-brand/10 text-brand-light'
                  : 'border-border bg-surface text-text-secondary hover:border-brand/40'
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs font-normal mt-0.5 opacity-70 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Complexity */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Complexity</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {COMPLEXITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setComplexity(opt.value)}
              className={`px-3 py-3 rounded-xl border text-left transition-colors ${
                complexity === opt.value
                  ? 'border-brand bg-brand/10 text-brand-light'
                  : 'border-border bg-surface text-text-secondary hover:border-brand/40'
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs font-normal mt-0.5 opacity-70 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Assets URL */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Assets URL <span className="text-text-secondary/50 font-normal">(optional)</span>
        </label>
        <input
          value={assetsUrl}
          onChange={(e) => setAssetsUrl(e.target.value)}
          placeholder="Google Drive, Dropbox, or any shareable link"
          className={inputCls}
        />
        <p className="text-[11px] text-text-secondary/60 mt-1">
          Share logos, reference images, or style guides to help us build your avatar.
        </p>
      </div>

      {/* Info box */}
      <div className="flex gap-3 p-4 bg-brand/5 border border-brand/20 rounded-xl">
        <Info size={16} className="text-brand-light flex-shrink-0 mt-0.5" />
        <ul className="text-xs text-text-secondary space-y-1">
          <li>Requests are reviewed by Genverce for feasibility and safety.</li>
          <li>Custom avatars are private by default — only your account can use them.</li>
          <li>Genverce may propose adding an avatar to the public marketplace.</li>
          <li>Pricing is scoped after review, based on complexity and usage rights.</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          onClick={() => onSubmit({ brandName, guidelines, requirements, usageRights, complexity, assetsUrl })}
          disabled={!canSubmit || loading}
          className="btn-brand flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={15} />
          {loading ? 'Submitting…' : 'Submit Request'}
        </button>
        <button onClick={onCancel} className="btn-ghost flex items-center gap-2">
          <X size={15} /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function CustomAvatarRequestPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const [createTicket, { loading }] = useMutation(CREATE_TICKET, {
    onCompleted: () => {
      toast({ title: 'Request submitted!', description: 'Our team will contact you to scope pricing and next steps.', variant: 'success' });
      router.push('/dashboard/tickets');
    },
    onError: (e) => toast({ title: 'Submission failed', description: e.message, variant: 'error' }),
  });

  const handleSubmit = (data: {
    brandName: string; guidelines: string; requirements: string;
    usageRights: string; complexity: string; assetsUrl: string;
  }) => {
    const issue = [
      '--- Custom AI Influencer Request ---',
      `Customer: ${user?.name} (${user?.email})`,
      `Brand: ${data.brandName}`,
      `Guidelines: ${data.guidelines}`,
      `Requirements: ${data.requirements}`,
      `Usage Rights: ${data.usageRights}`,
      `Complexity: ${data.complexity}`,
      data.assetsUrl ? `Assets: ${data.assetsUrl}` : '',
      '---',
      'Notes:',
      '- Custom avatars are private and available only to this customer.',
      '- Genverce will decide if any avatar becomes public.',
      '- Pricing will be scoped based on complexity and usage rights.',
    ].filter(Boolean).join('\n');

    createTicket({ variables: { issue } });
  };

  if (!mounted) return null;

  const header = (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
          <UserPlus size={20} className="text-brand-light" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Request Custom <span className="gradient-text">AI Influencer</span>
        </h1>
      </div>
      <p className="text-text-secondary text-sm sm:text-base mt-1">
        Submit brand guidelines and requirements for a private, custom-built avatar.
      </p>
    </motion.div>
  );

  if (user?.role === 'ADMIN') {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto">
          {header}
          <RequestForm loading={loading} onSubmit={handleSubmit} onCancel={() => router.push('/dashboard')} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {header}
          <RequestForm loading={loading} onSubmit={handleSubmit} onCancel={() => router.push('/dashboard')} />
        </div>
      </main>
      <Footer />
    </>
  );
}
