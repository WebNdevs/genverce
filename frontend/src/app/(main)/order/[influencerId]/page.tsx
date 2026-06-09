'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, Shield, Zap, Clock,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { CREATE_ORDER, CREATE_CHECKOUT_SESSION } from '@/graphql/mutations/order';
import { useAuthStore } from '@/lib/auth';
import { PRICING_PACKAGES, PackageType, DeliveryType, Influencer } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';

const TONES = ['Professional', 'Casual & Friendly', 'Energetic & Bold', 'Inspirational', 'Humorous', 'Educational'];
const INCLUSIONS = ['Product Demo', 'Testimonial Style', 'Brand Story', 'Call to Action', 'Statistics/Data', 'Behind the Scenes'];
const STEPS = ['Brief', 'Package', 'Delivery', 'Review'];

const FALLBACK_INFLUENCER = {
  id: '1', name: 'Nova Sterling', avatar: '', industries: ['Technology'],
  contentStyle: 'Professional', rating: 4.9, totalProjects: 347,
};

const inputCls = 'w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors';

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();
  const influencerId = params?.influencerId as string;

  const [step, setStep] = useState(0);
  const [productName, setProductName]     = useState('');
  const [keyMessage, setKeyMessage]       = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone]                   = useState('');
  const [inclusions, setInclusions]       = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [deliveryType, setDeliveryType]   = useState<DeliveryType | null>(null);
  const [aiDisclosure, setAiDisclosure]   = useState(true);

  const { data } = useQuery(GET_INFLUENCER, {
    variables: { id: influencerId },
    skip: !influencerId,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
  });
  const influencer = (data?.influencer ?? FALLBACK_INFLUENCER) as unknown as Influencer;
  const serviceType = (influencer as any)?.serviceType as string | undefined;
  const unit = (() => {
    if (serviceType === 'POST_CREATION') return { singular: 'post', plural: 'posts' };
    if (serviceType === 'IMAGE_CREATION') return { singular: 'image', plural: 'images' };
    if (serviceType === 'VIDEO_CREATION') return { singular: 'video', plural: 'videos' };
    return { singular: 'item', plural: 'items' };
  })();
  const displayPkg = (pkg: any) => {
    if (serviceType === 'POST_CREATION') {
      const count = Number(pkg?.videoCount || 0) || 0;
      const isMonthly = !!pkg?.isMonthly;
      const name =
        pkg?.type === 'SINGLE'
          ? 'Single Post'
          : typeof pkg?.name === 'string'
            ? String(pkg.name).replace(/video/gi, 'post').replace(/\bvideos\b/gi, 'posts')
            : 'Package';
      const customDescription = String(pkg?.description ?? '').trim();
      const description = customDescription || (isMonthly
        ? `${count} posts/month`
        : `${count} post${count === 1 ? '' : 's'} per week`);
      return { name, description };
    }

    if (serviceType === 'IMAGE_CREATION') {
      const count = Number(pkg?.videoCount || 0) || 0;
      const isMonthly = !!pkg?.isMonthly;
      const name =
        pkg?.type === 'SINGLE'
          ? 'Single Image'
          : typeof pkg?.name === 'string'
            ? String(pkg.name).replace(/video/gi, 'image').replace(/\bvideos\b/gi, 'images')
            : 'Package';
      const customDescription = String(pkg?.description ?? '').trim();
      const description = customDescription || (isMonthly
        ? `${count} images/month`
        : `${count} image${count === 1 ? '' : 's'}`);
      return { name, description };
    }

    return { name: String(pkg?.name || ''), description: String(pkg?.description || '') };
  };

  const availablePackages = (() => {
    const pkgs = Array.isArray(influencer.packages) ? influencer.packages : [];
    if (pkgs.length === 0) return PRICING_PACKAGES;
    return pkgs
      .filter((p) => p.isActive)
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((p) => ({
        type: p.type,
        name: p.name,
        price: p.price,
        videoCount: p.videoCount,
        description: String(p.description || ''),
        isMonthly: p.isMonthly,
      }));
  })();

  const [createOrder,   { loading: orderLoading }]    = useMutation(CREATE_ORDER);
  const [createCheckout, { loading: checkoutLoading }] = useMutation(CREATE_CHECKOUT_SESSION);
  const isLoading = orderLoading || checkoutLoading;

  if (!hydrated) return null;
  if (!isAuthenticated) { router.push('/login'); return null; }

  const toggleInclusion = (item: string) =>
    setInclusions((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);

  const canProceed = () => {
    if (step === 0) return productName && keyMessage && targetAudience && tone;
    if (step === 1) return !!selectedPackage;
    if (step === 2) return !!deliveryType;
    return true;
  };

  const handleSubmit = async () => {
    try {
      const { data: orderData } = await createOrder({
        variables: {
          input: {
            influencerId,
            projectBrief: { productName, keyMessage, targetAudience, tone, inclusions, additionalNotes },
            package: selectedPackage,
            deliveryType,
            aiDisclosure,
          },
        },
      });
      const orderId = orderData.createOrder.id;
      const { data: checkoutData } = await createCheckout({ variables: { orderId } });
      if (checkoutData?.createCheckoutSession?.url) {
        window.location.href = checkoutData.createCheckoutSession.url;
      }
    } catch (err: any) {
      toast({ title: 'Order failed', description: err.message, variant: 'error' });
    }
  };

  const selectedPkg = availablePackages.find((p) => p.type === selectedPackage);

  if ((influencer as any)?.isActive === false) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-20 pb-24 flex items-center justify-center px-4">
          <div className="glass-card p-6 text-center max-w-sm w-full">
            <h1 className="text-xl font-semibold mb-2">{influencer.name}</h1>
            <p className="text-text-secondary text-sm">This influencer is currently unavailable.</p>
            <button onClick={() => router.push('/influencers')} className="btn-ghost mt-4 w-full">
              Browse other influencers
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-32 sm:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">

          {/* Header */}
          <div className="py-5 sm:py-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary mb-4 sm:mb-6 text-sm"
            >
              <ArrowLeft size={15} /> Back
            </button>

            {/* Influencer identity */}
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text text-lg sm:text-xl flex-shrink-0">
                {influencer.avatar
                  ? <img src={influencer.avatar} alt={influencer.name} className="w-full h-full rounded-full object-cover" />
                  : influencer.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs text-text-secondary">Hiring</p>
                <h1 className="text-lg sm:text-xl font-bold leading-tight">{influencer.name}</h1>
              </div>
            </div>

            {/* Step progress */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <div className={cn(
                      'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                      i < step  ? 'bg-success text-white' :
                      i === step ? 'bg-brand text-white' :
                                   'bg-surface border border-border text-text-secondary'
                    )}>
                      {i < step ? <Check size={13} /> : i + 1}
                    </div>
                    <span className={cn(
                      'text-xs sm:text-sm whitespace-nowrap',
                      i === step ? 'text-text-primary font-medium' : 'text-text-secondary',
                      i !== step && 'hidden sm:block'
                    )}>
                      {s}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn('flex-1 h-px', i < step ? 'bg-success/50' : 'bg-border')} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── Step 0: Brief ── */}
              {step === 0 && (
                <div className="glass-card p-4 sm:p-6 space-y-4 sm:space-y-5">
                  <h2 className="text-lg sm:text-xl font-semibold">Project Brief</h2>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Product / Brand Name <span className="text-error">*</span>
                    </label>
                    <input value={productName} onChange={(e) => setProductName(e.target.value)}
                      className={inputCls} placeholder="e.g. AcmeCRM, BrewBetter Coffee" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Key Message <span className="text-error">*</span>
                    </label>
                    <textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="What is the one thing you want viewers to remember?" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Target Audience <span className="text-error">*</span>
                    </label>
                    <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                      className={inputCls} placeholder="e.g. SaaS founders, 25-40 year olds, fitness enthusiasts" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Content Tone <span className="text-error">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TONES.map((t) => (
                        <button key={t} onClick={() => setTone(t)}
                          className={cn(
                            'px-3 py-2 rounded-lg text-xs sm:text-sm border transition-colors text-left',
                            tone === t ? 'border-brand bg-brand/10 text-brand-light' : 'border-border bg-background text-text-secondary hover:border-brand/40'
                          )}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Inclusions <span className="text-text-secondary/50 font-normal">(optional)</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {INCLUSIONS.map((item) => (
                        <button key={item} onClick={() => toggleInclusion(item)}
                          className={cn(
                            'px-3 py-2 rounded-lg text-xs sm:text-sm border transition-colors text-left flex items-center gap-1.5',
                            inclusions.includes(item) ? 'border-brand bg-brand/10 text-brand-light' : 'border-border bg-background text-text-secondary hover:border-brand/40'
                          )}>
                          {inclusions.includes(item) && <Check size={11} className="flex-shrink-0" />}
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      Additional Notes <span className="text-text-secondary/50 font-normal">(optional)</span>
                    </label>
                    <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={2}
                      className={`${inputCls} resize-none`}
                      placeholder="Any specific requirements, links, or references..." />
                  </div>
                </div>
              )}

              {/* ── Step 1: Package ── */}
              {step === 1 && (
                <div className="glass-card p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">Select a Package</h2>
                  <div className="space-y-3">
                    {availablePackages.map((pkg) => (
                      <button key={pkg.type} onClick={() => setSelectedPackage(pkg.type)}
                        className={cn(
                          'w-full p-4 sm:p-5 rounded-xl border text-left transition-all',
                          selectedPackage === pkg.type
                            ? 'border-brand bg-brand/10 ring-1 ring-brand/20'
                            : 'border-border bg-background hover:border-brand/40'
                        )}>
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                            selectedPackage === pkg.type ? 'border-brand bg-brand' : 'border-border'
                          )}>
                            {selectedPackage === pkg.type && <Check size={11} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-sm sm:text-base">{displayPkg(pkg).name}</p>
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg sm:text-xl font-bold">${pkg.price.toFixed(0)}</p>
                                {pkg.isMonthly && <p className="text-xs text-text-secondary">/month</p>}
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">{displayPkg(pkg).description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 2: Delivery ── */}
              {step === 2 && (
                <div className="glass-card p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">Delivery Options</h2>
                  <div className="space-y-3">
                    {/* Quality-Checked */}
                    <button onClick={() => setDeliveryType('QUALITY_CHECKED' as DeliveryType)}
                      className={cn(
                        'w-full p-4 sm:p-5 rounded-xl border text-left transition-all',
                        deliveryType === 'QUALITY_CHECKED'
                          ? 'border-brand bg-brand/10 ring-1 ring-brand/20'
                          : 'border-border bg-background hover:border-brand/40'
                      )}>
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                          deliveryType === 'QUALITY_CHECKED' ? 'border-brand bg-brand' : 'border-border'
                        )}>
                          {deliveryType === 'QUALITY_CHECKED' && <Check size={11} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold text-sm sm:text-base">Quality-Checked</p>
                            <span className="px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">Recommended</span>
                          </div>
                          <p className="text-xs sm:text-sm text-text-secondary">Human review before delivery. Up to 24 hours turnaround.</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                            <span className="flex items-center gap-1"><Shield size={11} className="text-success" /> Human reviewed</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> Up to 24h</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Instant */}
                    <button onClick={() => setDeliveryType('INSTANT' as DeliveryType)}
                      className={cn(
                        'w-full p-4 sm:p-5 rounded-xl border text-left transition-all',
                        deliveryType === 'INSTANT'
                          ? 'border-brand bg-brand/10 ring-1 ring-brand/20'
                          : 'border-border bg-background hover:border-brand/40'
                      )}>
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                          deliveryType === 'INSTANT' ? 'border-brand bg-brand' : 'border-border'
                        )}>
                          {deliveryType === 'INSTANT' && <Check size={11} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold text-sm sm:text-base">Instant Delivery</p>
                            <span className="px-2 py-0.5 bg-brand/10 text-brand-light text-xs rounded-full">Fastest</span>
                          </div>
                          <p className="text-xs sm:text-sm text-text-secondary">AI-generated {unit.singular} delivered immediately after payment.</p>
                          <div className="flex items-center gap-1.5 mt-2 p-2 bg-error/10 rounded-lg">
                            <AlertTriangle size={11} className="text-error flex-shrink-0" />
                            <p className="text-xs text-error">Not reviewed by our team before delivery.</p>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-text-secondary">
                            <Zap size={11} className="text-brand-light" /> Instant delivery
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* AI Disclosure toggle */}
                  <div className="mt-4 p-4 bg-background rounded-xl border border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">AI Disclosure Label</p>
                        <p className="text-xs text-text-secondary mt-0.5">Add "AI-generated content" label to your {unit.singular}</p>
                      </div>
                      <button
                        onClick={() => setAiDisclosure(!aiDisclosure)}
                        className={cn('w-12 h-6 rounded-full transition-colors relative flex-shrink-0', aiDisclosure ? 'bg-brand' : 'bg-border')}
                      >
                        <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm', aiDisclosure ? 'translate-x-7' : 'translate-x-1')} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Review ── */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="glass-card p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">Order Summary</h2>

                    {/* Influencer row */}
                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-background rounded-xl mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface border border-brand/30 flex items-center justify-center font-bold gradient-text flex-shrink-0">
                        {influencer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm sm:text-base">{influencer.name}</p>
                        <p className="text-xs text-text-secondary">{influencer.contentStyle}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-0 border border-border rounded-xl overflow-hidden text-sm mb-4">
                      {[
                        ['Product',      productName],
                        ['Audience',     targetAudience],
                        ['Tone',         tone],
                        ['Package',      selectedPkg?.name],
                        [
                          serviceType === 'POST_CREATION'
                            ? selectedPkg?.isMonthly
                              ? 'Posts per month'
                              : 'Posts per week'
                            : unit.plural[0].toUpperCase() + unit.plural.slice(1),
                          selectedPkg?.videoCount,
                        ],
                        ['Delivery',     deliveryType === 'INSTANT' ? 'Instant' : 'Quality-Checked (24h)'],
                        ['AI Disclosure', aiDisclosure ? 'Enabled' : 'Disabled'],
                      ].map(([label, value]) => (
                        <div key={label as string} className="flex items-start justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-border last:border-0 odd:bg-surface/30">
                          <span className="text-text-secondary flex-shrink-0">{label}</span>
                          <span className="font-medium text-right break-words max-w-[55%]">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between p-3 sm:p-4 bg-brand/5 rounded-xl border border-brand/20">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl sm:text-2xl font-bold gradient-text">${selectedPkg?.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {deliveryType === 'INSTANT' && (
                    <div className="p-4 bg-error/10 border border-error/30 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-error">
                        <strong>Instant Delivery:</strong> This {unit.singular} will not be reviewed by our team before delivery. Quality may vary.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation — sticky on mobile, inline on desktop */}
        <div className="fixed bottom-0 left-0 right-0 sm:static sm:max-w-3xl sm:mx-auto sm:px-6 sm:mt-6">
          <div className="flex items-center justify-between gap-3 p-4 sm:p-0 bg-background/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t border-border sm:border-0">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="btn-ghost flex items-center gap-2 disabled:opacity-40 text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="btn-brand flex items-center gap-2 disabled:opacity-40 text-sm"
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="btn-brand flex items-center gap-2 disabled:opacity-40 text-sm"
              >
                {isLoading ? 'Processing…' : `Pay $${selectedPkg?.price.toFixed(2)}`}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
