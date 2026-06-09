'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';

import { GET_INFLUENCERS } from '@/graphql/queries/influencer';
import { COMPLETE_ONBOARDING } from '@/graphql/mutations/user';
import { START_CHAT } from '@/graphql/mutations/chat';
import { CREATE_TICKET } from '@/graphql/mutations/ticket';

import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';

import RequestForm from '@/components/custom-avatar/request-form';

const TONES = [
  'Professional',
  'Friendly & Casual',
  'Humorous',
  'Inspirational',
  'Authoritative',
  'Empathetic',
  'Sarcastic',
];

export default function OnboardingPage() {
  const router = useRouter();

  const { user, updateUser, isAuthenticated } =
    useAuthStore();

  const [step, setStep] = useState(1);

  /* STEP 1 */
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [goal, setGoal] = useState('');

  /* STEP 2 */
  const [targetAudience, setTargetAudience] =
    useState('');

  const [tone, setTone] = useState('');

  const [platforms, setPlatforms] = useState<
    string[]
  >([]);

  const [contentTypes, setContentTypes] =
    useState<string[]>([]);

  /* STEP 3 */
  const [selectedInfluencer, setSelectedInfluencer] =
    useState('');

  const [showCustomForm, setShowCustomForm] =
    useState(false);

  const [
    customRequestSubmitted,
    setCustomRequestSubmitted,
  ] = useState(false);

  /* TOGGLES */
  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const toggleContentType = (type: string) => {
    setContentTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  /* PROTECT ROUTE */
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.isOnboarded) {
      router.push(
        user.role === 'ADMIN'
          ? '/admin'
          : '/dashboard'
      );
    }
  }, [user, isAuthenticated, router]);

  /* QUERIES */
  const {
    data: influencersData,
    loading: loadingInfluencers,
  } = useQuery(GET_INFLUENCERS, {
    variables: {
      filter: {
        page: 1,
        limit: 12,
      },
    },
    skip: step !== 3,
  });

  /* MUTATIONS */
  const [
    completeOnboarding,
    { loading: loadingOnboarding },
  ] = useMutation(COMPLETE_ONBOARDING);

  const [startChat, { loading: loadingChat }] =
    useMutation(START_CHAT);

  const [createTicket, { loading: loadingTicket }] =
    useMutation(CREATE_TICKET);

  /* HELPERS */
  const handleNext = () =>
    setStep((s) => Math.min(s + 1, 3));

  const handlePrev = () =>
    setStep((s) => Math.max(s - 1, 1));

  /* SUBMIT */
  const handleSubmit = async () => {
    if (
      !selectedInfluencer &&
      !customRequestSubmitted
    ) {
      toast({
        title: 'Please select an AI Influencer',
        variant: 'error',
      });

      return;
    }

    try {
      const { data: onboardingData } =
        await completeOnboarding({
          variables: {
            input: {
              brandName,
              productName: brandName,

              website,
              targetAudience,
              tone,

              industry,
              goal,
              platforms,
              contentTypes,
              requestedCustomInfluencer: customRequestSubmitted,
            },
          },
        });

      updateUser(onboardingData.completeOnboarding);

      if (!customRequestSubmitted) {
        await startChat({
          variables: {
            influencerId: selectedInfluencer,
          },
        });
      }

      toast({
        title: 'Onboarding Complete!',
        variant: 'success',
      });

      router.push('/dashboard');
    } catch (err: any) {
      toast({
        title: 'Something went wrong',
        description: err.message,
        variant: 'error',
      });
    }
  };

  /* CUSTOM AI REQUEST */
  const handleCustomSubmit = async (data: any) => {
    try {
      const issue = `
Customer: ${user?.name}
Brand: ${data.brandName}

Guidelines:
${data.guidelines}

Requirements:
${data.requirements}
`;

      await createTicket({
        variables: { issue },
      });

      toast({
        title: 'Request Submitted Successfully',
        variant: 'success',
      });

      setCustomRequestSubmitted(true);

      setShowCustomForm(false);

      setSelectedInfluencer('custom-request');
    } catch (e: any) {
      toast({
        title: 'Submission failed',
        description: e.message,
        variant: 'error',
      });
    }
  };

  /* VALUES */
  const influencers =
    influencersData?.influencers?.influencers || [];

  const isSubmitting =
    loadingOnboarding ||
    loadingChat ||
    loadingTicket;

  if (user?.isOnboarded || !isAuthenticated)
    return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">

        {/* HEADER */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold mb-2">
            Welcome to Genverce
          </h1>

          <p className="text-text-secondary">
            Let&apos;s personalize your experience
          </p>

          {/* PROGRESS */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    step === i
                      ? 'bg-brand text-white'
                      : step > i
                      ? 'bg-brand/20 text-brand'
                      : 'bg-background-light text-text-secondary'
                  }`}
                >
                  {step > i ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    i
                  )}
                </div>

                {i < 3 && (
                  <div
                    className={`h-1 w-16 rounded-full ${
                      step > i
                        ? 'bg-brand'
                        : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CARD */}
        <div className="glass-card overflow-hidden min-h-[600px] flex flex-col">

          {/* BODY */}
          <div className="p-8 flex-grow">

            <AnimatePresence mode="wait">

              {/* STEP 1 */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Tell us about your brand
                    </h2>

                    <p className="text-text-secondary">
                      This helps us personalize your AI
                      influencer experience.
                    </p>
                  </div>

                  {/* BRAND */}
                  <div>
                    <label className="block mb-2 text-sm text-text-secondary">
                      Brand Name
                    </label>

                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) =>
                        setBrandName(e.target.value)
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                      placeholder="Nike"
                    />
                  </div>

                  {/* INDUSTRY */}
                  <div>
                    <label className="block mb-3 text-sm text-text-secondary">
                      Select Industry
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        'Fashion',
                        'Fitness',
                        'Tech',
                        'Beauty',
                        'Gaming',
                        'Finance',
                      ].map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() =>
                            setIndustry(item)
                          }
                          className={`px-4 py-3 rounded-xl border transition-all ${
                            industry === item
                              ? 'border-brand bg-brand text-white'
                              : 'border-border bg-background-light hover:border-brand'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* GOALS */}
                  <div>
                    <label className="block mb-3 text-sm text-text-secondary">
                      What do you want to achieve?
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        'Grow Social Media',
                        'Promote Products',
                        'Create Viral Content',
                        'Run Ads',
                      ].map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setGoal(item)}
                          className={`px-4 py-4 rounded-xl border text-left transition-all ${
                            goal === item
                              ? 'border-brand bg-brand text-white'
                              : 'border-border bg-background-light hover:border-brand'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* WEBSITE */}
                  <div>
                    <label className="block mb-2 text-sm text-text-secondary">
                      Website URL
                    </label>

                    <input
                      type="url"
                      value={website}
                      onChange={(e) =>
                        setWebsite(e.target.value)
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                      placeholder="https://yourbrand.com"
                    />
                  </div>
                </motion.div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Content Preferences
                    </h2>

                    <p className="text-text-secondary">
                      Choose your AI content preferences.
                    </p>
                  </div>

                  {/* PLATFORMS */}
                  <div>
                    <label className="block mb-3 text-sm text-text-secondary">
                      Preferred Platforms
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        'Instagram',
                        'TikTok',
                        'YouTube',
                        'LinkedIn',
                        'X',
                      ].map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() =>
                            togglePlatform(item)
                          }
                          className={`px-4 py-3 rounded-xl border transition-all ${
                            platforms.includes(item)
                              ? 'border-brand bg-brand text-white'
                              : 'border-border bg-background-light hover:border-brand'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CONTENT TYPE */}
                  <div>
                    <label className="block mb-3 text-sm text-text-secondary">
                      Content Type
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        'Reels',
                        'Shorts',
                        'UGC Style',
                        'Product Showcase',
                        'Educational',
                        'Storytelling',
                      ].map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() =>
                            toggleContentType(item)
                          }
                          className={`px-4 py-4 rounded-xl border text-left transition-all ${
                            contentTypes.includes(
                              item
                            )
                              ? 'border-brand bg-brand text-white'
                              : 'border-border bg-background-light hover:border-brand'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* TONE */}
                  <div>
                    <label className="block mb-3 text-sm text-text-secondary">
                      Brand Tone
                    </label>

                    <div className="flex flex-wrap gap-3">
                      {TONES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className={`px-4 py-2 rounded-full border transition-all ${
                            tone === t
                              ? 'bg-brand border-brand text-white'
                              : 'border-border bg-background-light hover:border-brand'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AUDIENCE */}
                  <div>
                    <label className="block mb-2 text-sm text-text-secondary">
                      Target Audience
                    </label>

                    <textarea
                      value={targetAudience}
                      onChange={(e) =>
                        setTargetAudience(
                          e.target.value
                        )
                      }
                      className="w-full h-32 resize-none px-4 py-3 bg-background border border-border rounded-xl"
                      placeholder="Describe your target audience..."
                    />
                  </div>
                </motion.div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Choose AI Influencer
                    </h2>

                    <p className="text-text-secondary">
                      Select your first AI influencer.
                    </p>
                  </div>

                  {loadingInfluencers ? (
                    <div className="flex justify-center py-20">
                      <Loader2 className="animate-spin text-brand" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        {influencers.map((inf: any) => (
                          <div
                            key={inf.id}
                            onClick={() => {
                              setSelectedInfluencer(
                                inf.id
                              );

                              setShowCustomForm(
                                false
                              );
                            }}
                            className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${
                              selectedInfluencer ===
                              inf.id
                                ? 'border-brand'
                                : 'border-border'
                            }`}
                          >
                            <div className="h-40 bg-background-light overflow-hidden">
                              <img
                                src={inf.avatar}
                                alt={inf.name}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="p-4">
                              <h3 className="font-semibold">
                                {inf.name}
                              </h3>
                            </div>
                          </div>
                        ))}

                        {/* CUSTOM */}
                        <div
                          onClick={() => {
                            setSelectedInfluencer(
                              ''
                            );

                            setShowCustomForm(true);
                          }}
                          className={`cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 min-h-[250px] ${
                            showCustomForm
                              ? 'border-brand'
                              : 'border-border'
                          }`}
                        >
                          <UserPlus className="mb-4 text-brand" />

                          <h3 className="font-semibold mb-2">
                            Request Custom AI
                          </h3>

                          <p className="text-sm text-center text-text-secondary">
                            Create a fully custom AI
                            influencer.
                          </p>
                        </div>
                      </div>

                      {showCustomForm && (
                        <div className="mt-8">
                          <RequestForm
                            loading={loadingTicket}
                            onSubmit={
                              handleCustomSubmit
                            }
                            onCancel={() =>
                              setShowCustomForm(
                                false
                              )
                            }
                          />
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* FOOTER */}
          <div className="p-6 border-t border-border flex items-center justify-between">

            {/* BACK */}
            <button
              onClick={handlePrev}
              disabled={step === 1}
              className={`flex items-center gap-2 ${
                step === 1
                  ? 'opacity-0'
                  : ''
              }`}
            >
              <ArrowLeft size={18} />
              Back
            </button>

            {/* NEXT / SUBMIT */}
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 1 &&
                    (!brandName ||
                      !industry ||
                      !goal)) ||

                  (step === 2 &&
                    (!targetAudience ||
                      !tone ||
                      platforms.length === 0 ||
                      contentTypes.length === 0))
                }
                className="btn-brand flex items-center gap-2 px-6 disabled:opacity-50"
              >
                Continue
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={
                  !selectedInfluencer ||
                  isSubmitting
                }
                className="btn-brand px-8 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  'Complete Onboarding'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}