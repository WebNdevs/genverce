'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, Shield, ShieldCheck, Zap, Clock, Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
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
  const { isAuthenticated, hydrated, user } = useAuthStore();
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

  const [hasReusedBrief, setHasReusedBrief] = useState(false);
  const [isInitialized, setIsInitialized]   = useState(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const pkgParam = searchParams.get('package') || searchParams.get('packageType');
      if (pkgParam && Object.values(PackageType).includes(pkgParam as PackageType)) {
        setSelectedPackage(pkgParam as PackageType);
      }
    }
  }, []);

  const { data: myOrdersData, loading: ordersLoading } = useQuery(GET_MY_ORDERS, {
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

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
    const pkgs = Array.isArray((influencer as any).packages) ? (influencer as any).packages : [];
    if (pkgs.length === 0) return PRICING_PACKAGES;
    return pkgs
      .filter((p: any) => p.isActive)
      .slice()
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((p: any) => ({
        type: p.type,
        name: p.name,
        price: p.price,
        videoCount: p.videoCount,
        description: String(p.description || ''),
        isMonthly: p.isMonthly,
      }));
  })();

  const previousAgentOrders = useMemo(() => {
    const orders = myOrdersData?.myOrders || [];
    return orders
      .filter(
        (o: any) =>
          (o.influencerId === influencerId || o.influencer?.id === influencerId) &&
          ['PAID', 'GENERATING', 'PENDING_REVIEW', 'APPROVED', 'DELIVERED'].includes(o.status),
      )
      .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [myOrdersData, influencerId]);

  const usageStats = useMemo(() => {
    if (previousAgentOrders.length === 0) {
      return { isHired: false, hasRemainingUsage: false, remainingUnits: 0, totalOrdered: 0, totalDelivered: 0 };
    }

    let totalOrdered = 0;
    let totalDelivered = 0;
    for (const o of previousAgentOrders) {
      let postsDelivered = 0;
      let imagesDelivered = 0;
      if (o.projectBrief) {
        try {
          const brief = typeof o.projectBrief === 'string' ? JSON.parse(o.projectBrief) : o.projectBrief;
          if (Array.isArray(brief?.generatedPosts)) postsDelivered = brief.generatedPosts.length;
          if (Array.isArray(brief?.generatedImages)) imagesDelivered = brief.generatedImages.length;
        } catch {}
      }
      const effective = Math.max(o.videosDelivered || 0, postsDelivered, imagesDelivered);
      const ordered = o.videosOrdered > 0 ? o.videosOrdered : 1;
      const deliveredForOrder = Math.min(ordered, effective);
      totalOrdered += ordered;
      totalDelivered += deliveredForOrder;
    }

    const remainingUnits = Math.max(0, totalOrdered - totalDelivered);
    return {
      isHired: true,
      hasRemainingUsage: remainingUnits > 0,
      remainingUnits,
      totalOrdered,
      totalDelivered,
    };
  }, [previousAgentOrders]);

  const existingBriefData = useMemo(() => {
    for (const o of previousAgentOrders) {
      if (!o.projectBrief) continue;
      try {
        const brief = typeof o.projectBrief === 'string' ? JSON.parse(o.projectBrief) : o.projectBrief;
        if (brief && typeof brief === 'object') {
          const pName = brief.productName || brief.brandName || user?.productName || user?.brandName || '';
          const kMsg = brief.keyMessage || brief.notes || '';
          const tAud = brief.targetAudience || user?.targetAudience || '';
          const tn = brief.tone || user?.tone || '';
          const inc = Array.isArray(brief.inclusions) ? brief.inclusions : [];
          const notes = brief.additionalNotes || (brief.notes && brief.notes !== kMsg ? brief.notes : '') || '';

          if (pName || kMsg || tAud || tn) {
            return {
              productName: pName,
              keyMessage: kMsg || 'Engage target audience and showcase brand value',
              targetAudience: tAud || 'Target audience',
              tone: tn || 'Professional',
              inclusions: inc,
              additionalNotes: notes,
            };
          }
        }
      } catch {}
    }

    if (user?.brandName || user?.productName || user?.targetAudience || user?.tone) {
      return {
        productName: user?.productName || user?.brandName || '',
        keyMessage: 'Engage target audience and showcase brand value',
        targetAudience: user?.targetAudience || 'Target audience',
        tone: user?.tone || 'Professional',
        inclusions: [],
        additionalNotes: '',
      };
    }
    return null;
  }, [previousAgentOrders, user]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if (hasInitializedRef.current) return;
    if (ordersLoading && !myOrdersData) return;

    hasInitializedRef.current = true;
    setIsInitialized(true);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forceStep = searchParams?.get('step');
    const isAddUsageMode = searchParams?.get('mode') === 'add-usage';

    // If client has already hired this AI agent once:
    // If they have used all of its available usage (or adding more usage):
    // Do not ask for the Project Brief again.
    // Automatically reuse and pre-fill the existing information, and take them directly to Step 2: Package (step index 1).
    if (usageStats.isHired) {
      if (existingBriefData) {
        setProductName(existingBriefData.productName || '');
        setKeyMessage(existingBriefData.keyMessage || '');
        setTargetAudience(existingBriefData.targetAudience || '');
        setTone(existingBriefData.tone || 'Professional');
        setInclusions(existingBriefData.inclusions || []);
        setAdditionalNotes(existingBriefData.additionalNotes || '');
        setHasReusedBrief(true);
      }

      const shouldSkipBrief =
        forceStep === null &&
        (usageStats.remainingUnits <= 0 || !usageStats.hasRemainingUsage || isAddUsageMode || true);

      if (shouldSkipBrief) {
        setStep(1); // Directly to Step 2: Package
      } else if (forceStep) {
        setStep(parseInt(forceStep, 10) || 0);
      }
    } else {
      if (user?.brandName || user?.productName) {
        setProductName(user?.productName || user?.brandName || '');
      }
      if (user?.targetAudience) {
        setTargetAudience(user.targetAudience);
      }
      if (user?.tone) {
        setTone(user.tone);
      }
      if (forceStep) {
        setStep(parseInt(forceStep, 10) || 0);
      }
    }
  }, [hydrated, isAuthenticated, ordersLoading, myOrdersData, usageStats, existingBriefData, user]);

  const [createOrder,   { loading: orderLoading }]    = useMutation(CREATE_ORDER);
  const [createCheckout, { loading: checkoutLoading }] = useMutation(CREATE_CHECKOUT_SESSION);
  const isLoading = orderLoading || checkoutLoading;

  if (!hydrated || !isAuthenticated) return null;

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

  const selectedPkg = availablePackages.find((p: any) => p.type === selectedPackage);

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
                <div className="flex items-center gap-2">
                  <p className="text-xs text-text-secondary">
                    {usageStats.isHired ? 'Add Usage for' : 'Hiring'}
                  </p>
                  {hasReusedBrief && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand-light border border-brand/20">
                      Existing Client
                    </span>
                  )}
                </div>
                <h1 className="text-lg sm:text-xl font-bold leading-tight">{influencer.name}</h1>
              </div>
            </div>

            {/* Step progress */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {STEPS.map((s, i) => {
                const isCompleted = i < step;
                const isCurrent = i === step;
                const canNavigate = isCompleted || (i === 0 && hasReusedBrief);
                return (
                  <div key={s} className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none">
                    <button
                      type="button"
                      onClick={() => {
                        if (canNavigate) setStep(i);
                      }}
                      disabled={!canNavigate && !isCurrent}
                      className={cn(
                        'flex items-center gap-1.5 sm:gap-2 flex-shrink-0 text-left transition-all',
                        canNavigate ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                        isCompleted ? 'bg-success text-white' :
                        isCurrent   ? 'bg-brand text-white shadow-sm' :
                                      'bg-surface border border-border text-text-secondary'
                      )}>
                        {isCompleted ? <Check size={13} /> : i + 1}
                      </div>
                      <span className={cn(
                        'text-xs sm:text-sm whitespace-nowrap',
                        isCurrent ? 'text-text-primary font-medium' : 'text-text-secondary',
                        !isCurrent && 'hidden sm:block'
                      )}>
                        {s}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={cn('flex-1 h-px', i < step ? 'bg-success/50' : 'bg-border')} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Loading state while checking previous orders */}
          {!isInitialized && ordersLoading && !myOrdersData ? (
            <div className="glass-card p-6 sm:p-8 space-y-4 animate-pulse">
              <div className="h-5 bg-border/60 rounded-lg w-1/3" />
              <div className="space-y-3 pt-2">
                <div className="h-14 bg-surface rounded-xl border border-border/50" />
                <div className="h-14 bg-surface rounded-xl border border-border/50" />
                <div className="h-14 bg-surface rounded-xl border border-border/50" />
              </div>
              <p className="text-xs text-text-secondary text-center pt-2">
                Checking your previous project details…
              </p>
            </div>
          ) : (
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
                    {hasReusedBrief && (
                      <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-success min-w-0">
                          <Check size={15} className="flex-shrink-0" />
                          <span className="font-medium truncate">
                            Pre-filled with your saved project brief for {influencer.name}.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="self-start sm:self-auto text-xs font-semibold text-brand hover:underline flex-shrink-0"
                        >
                          Return to Packages →
                        </button>
                      </div>
                    )}
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
                  {hasReusedBrief && (
                    <div className="mb-5 p-3.5 sm:p-4 rounded-xl bg-brand/10 border border-brand/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-brand/20 text-brand-light flex items-center justify-center flex-shrink-0">
                          <Check size={13} className="text-brand-light" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary">
                            Project Brief automatically reused
                          </p>
                          <p className="text-text-secondary text-xs truncate">
                            Using saved brief from your previous project with {influencer.name}: <span className="font-medium text-text-primary">{productName || 'Your Project'}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="self-start sm:self-auto text-xs font-semibold text-brand-light hover:underline flex-shrink-0"
                      >
                        Review / Edit Brief →
                      </button>
                    </div>
                  )}
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">Select a Package</h2>
                  <div className="space-y-3">
                    {availablePackages.map((pkg: any) => (
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
                  <div className="mt-5 glass-card p-4 sm:p-5 rounded-2xl border border-border/80 hover:border-brand/30 transition-all duration-200 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light flex-shrink-0 mt-0.5 sm:mt-0">
                          <ShieldCheck size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <p className="text-sm font-semibold text-text-primary">AI Disclosure Label</p>
                            <span className={cn('px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-colors border', aiDisclosure ? 'bg-success/10 text-success border-success/30' : 'bg-surface text-text-secondary border-border')}>
                              {aiDisclosure ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                            Add an &quot;AI-generated content&quot; label to your {unit.singular} for transparency and platform compliance.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={aiDisclosure}
                        aria-label="Toggle AI Disclosure Label"
                        onClick={() => setAiDisclosure(!aiDisclosure)}
                        className={cn(
                          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background',
                          aiDisclosure ? 'bg-brand' : 'bg-border/80 hover:bg-border'
                        )}
                      >
                        <span className="sr-only">Toggle AI Disclosure</span>
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                            aiDisclosure ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
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
        )}
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
