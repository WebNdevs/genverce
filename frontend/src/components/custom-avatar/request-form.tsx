'use client';

import { useState } from 'react';
import { Info, Send, X } from 'lucide-react';


const USAGE_RIGHTS = [
  {
    value: 'PRIVATE_EXCLUSIVE',
    label: 'Exclusive',
    desc: 'Private — exclusive to my brand',
  },
  {
    value: 'PRIVATE_INTERNAL',
    label: 'Internal',
    desc: 'Private — internal channels only',
  },
  {
    value: 'PUBLIC_CONSIDERATION',
    label: 'Open to public',
    desc: 'Private now, consider public listing',
  },
];

const COMPLEXITY_OPTIONS = [
  {
    value: 'SIMPLE',
    label: 'Simple',
    desc: 'Basic persona, standard voice',
  },
  {
    value: 'ADVANCED',
    label: 'Advanced',
    desc: 'Custom style, multi-language',
  },
  {
    value: 'ENTERPRISE',
    label: 'Enterprise',
    desc: 'Full brand suite, compliance',
  },
];

const inputCls =
  'w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors';

interface RequestFormProps {
  loading?: boolean;
  onSubmit: (data: {
    brandName: string;
    guidelines: string;
    requirements: string;
    usageRights: string;
    complexity: string;
    assetsUrl: string;
  }) => void;
  onCancel?: () => void;
}

export default function RequestForm({
  loading = false,
  onSubmit,
  onCancel,
}: RequestFormProps) {
  const [brandName, setBrandName] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [requirements, setRequirements] = useState('');
  const [usageRights, setUsageRights] =
    useState('PRIVATE_EXCLUSIVE');
  const [complexity, setComplexity] = useState('SIMPLE');
  const [assetsUrl, setAssetsUrl] = useState('');

  const canSubmit =
    brandName.trim() &&
    guidelines.trim() &&
    requirements.trim();

  return (
    <div className="glass-card p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold mb-2">
          Request Custom AI Influencer
        </h3>

        <p className="text-text-secondary text-sm">
          Create a fully customized AI influencer tailored
          for your business and audience.
        </p>
      </div>

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
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Usage Rights
        </label>

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
              <p className="text-sm font-semibold">
                {opt.label}
              </p>

              <p className="text-xs font-normal mt-0.5 opacity-70 leading-snug">
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Complexity */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Complexity
        </label>

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
              <p className="text-sm font-semibold">
                {opt.label}
              </p>

              <p className="text-xs font-normal mt-0.5 opacity-70 leading-snug">
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Assets URL */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Assets URL{' '}
          <span className="text-text-secondary/50 font-normal">
            (optional)
          </span>
        </label>

        <input
          value={assetsUrl}
          onChange={(e) => setAssetsUrl(e.target.value)}
          placeholder="Google Drive, Dropbox, or any shareable link"
          className={inputCls}
        />

        <p className="text-[11px] text-text-secondary/60 mt-1">
          Share logos, reference images, or style guides
          to help us build your avatar.
        </p>
      </div>

      {/* Info Box */}
      <div className="flex gap-3 p-4 bg-brand/5 border border-brand/20 rounded-xl">
        <Info
          size={16}
          className="text-brand-light flex-shrink-0 mt-0.5"
        />

        <ul className="text-xs text-text-secondary space-y-1">
          <li>
            Requests are reviewed for feasibility and safety.
          </li>

          <li>
            Custom avatars are private by default.
          </li>

          <li>
            Pricing depends on complexity and requirements.
          </li>

          <li>
            You can provide references and branding assets.
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          onClick={() =>
            onSubmit({
              brandName,
              guidelines,
              requirements,
              usageRights,
              complexity,
              assetsUrl,
            })
          }
          disabled={!canSubmit || loading}
          className="btn-brand flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={15} />

          {loading ? 'Submitting…' : 'Submit Request'}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="btn-ghost flex items-center gap-2"
          >
            <X size={15} />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}