'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Star, Briefcase, MessageSquare, ArrowRight, Shield,
  Zap, Clock, Globe, Play, CheckCircle
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GET_INFLUENCER } from '@/graphql/queries/influencer';
import { useAuthStore } from '@/lib/auth';
import { PRICING_PACKAGES, Influencer } from '@/types';

// Demo fallback data (used when API is unreachable or in mock mode)
const FALLBACKS: Influencer[] = [
  { id: '1', name: 'Nova Sterling', bio: 'AI-powered tech influencer specializing in SaaS, fintech, and developer tools. Sharp, data-driven content that converts.', avatar: '', industries: ['Technology', 'SaaS', 'Fintech'], contentStyle: 'Professional & Data-Driven', languages: ['English', 'Spanish'], rating: 4.9, totalProjects: 347, totalReviews: 289, isActive: true, portfolio: [] as any },
  { id: '2', name: 'Aria Bloom', bio: 'Lifestyle and beauty AI influencer with a warm, relatable personality for beauty brands and wellness products.', avatar: '', industries: ['Beauty', 'Lifestyle', 'Wellness'], contentStyle: 'Warm & Relatable', languages: ['English', 'French'], rating: 4.8, totalProjects: 512, totalReviews: 445, isActive: true, portfolio: [] as any },
  { id: '3', name: 'Kai Vortex', bio: 'High-energy gaming and entertainment AI influencer for game launches, esports gear and entertainment.', avatar: '', industries: ['Gaming', 'Entertainment', 'Tech Gadgets'], contentStyle: 'High-Energy & Entertaining', languages: ['English', 'Japanese', 'Korean'], rating: 4.7, totalProjects: 623, totalReviews: 534, isActive: true, portfolio: [] as any },
  { id: '4', name: 'Zara Nexus', bio: 'Fashion-forward AI influencer bridging haute couture with streetwear. Bold, editorial content.', avatar: '', industries: ['Fashion', 'Luxury', 'E-commerce'], contentStyle: 'Bold & Editorial', languages: ['English', 'Italian', 'Portuguese'], rating: 4.9, totalProjects: 298, totalReviews: 267, isActive: true, portfolio: [] as any },
  { id: '5', name: 'Atlas Prime', bio: 'B2B and enterprise AI influencer focused on corporate messaging and professional services.', avatar: '', industries: ['B2B', 'Enterprise', 'Consulting'], contentStyle: 'Corporate & Authoritative', languages: ['English', 'German', 'Mandarin'], rating: 4.8, totalProjects: 189, totalReviews: 156, isActive: true, portfolio: [] as any },
  { id: '6', name: 'Luna Spark', bio: 'Health and fitness AI influencer with energetic, motivational personality for fitness and nutrition brands.', avatar: '', industries: ['Fitness', 'Health', 'Nutrition'], contentStyle: 'Motivational & Energetic', languages: ['English', 'Spanish', 'Hindi'], rating: 4.7, totalProjects: 445, totalReviews: 398, isActive: true, portfolio: [] as any },
  { id: '7', name: 'Rex Cipher', bio: 'Crypto and Web3 AI influencer making blockchain accessible. Covers DeFi, NFTs, and exchanges.', avatar: '', industries: ['Crypto', 'Web3', 'DeFi'], contentStyle: 'Technical & Conversational', languages: ['English', 'Russian', 'Arabic'], rating: 4.6, totalProjects: 334, totalReviews: 278, isActive: true, portfolio: [] as any },
  { id: '8', name: 'Mira Sol', bio: 'Travel and hospitality AI influencer with cinematic flair for hotels, airlines and destination experiences.', avatar: '', industries: ['Travel', 'Hospitality', 'Food & Beverage'], contentStyle: 'Cinematic & Aspirational', languages: ['English', 'French', 'Thai'], rating: 4.9, totalProjects: 267, totalReviews: 234, isActive: true, portfolio: [] as any },
];

export default function InfluencerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const id = params?.id as string;
  const { data, loading } = useQuery(GET_INFLUENCER, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
  });

  const fallbackById = FALLBACKS.find((i) => i.id === id) ?? FALLBACKS[0];
  const influencer: Influencer = (data?.influencer as Influencer) ?? fallbackById;
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

  const handleChat = () => {
    if (!isAuthenticated) { router.push('/login'); return; }
    router.push(`/chat/${influencer.id}`);
  };

  const handleHire = () => {
    if (!isAuthenticated) { router.push('/login'); return; }
    router.push(`/order/${influencer.id}`);
  };

  const singlePackage = influencer?.packages?.find(
    (pkg: any) => pkg.type === 'SINGLE' && pkg.isActive
  );

  const startingPrice = singlePackage?.price || 0;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="space-y-4 w-full max-w-4xl px-4">
            <div className="skeleton h-64 rounded-2xl" />
            <div className="skeleton h-32 rounded-2xl" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        {/* Cover */}
        <div className="px-5">
          <div className="relative h-[320px] sm:h-[380px] lg:h-[420px] overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            {influencer.coverImage ? (
              <img
                src={influencer.coverImage}
                alt={`${influencer.name} Cover`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-surface to-background" />
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: Sticky sidebar */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 lg:top-24"
              >
                {/* Avatar */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="avatar-glow rounded-full mb-4 border-4 border-background">
                    <div className="w-24 h-24 rounded-full bg-surface border-2 border-brand/30 flex items-center justify-center text-4xl font-bold gradient-text overflow-hidden">
                      {influencer.avatar ? (
                        <img src={influencer.avatar} alt={influencer.name} className="w-full h-full object-cover" />
                      ) : (
                        influencer.name.charAt(0)
                      )}
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold">{influencer.name}</h1>
                  <p className="text-text-secondary text-sm mt-1">{influencer.contentStyle}</p>

                  <div className="flex items-center gap-1 mt-2">
                    <Star size={16} className="text-brand-light fill-brand-light" />
                    <span className="font-semibold">{influencer.rating.toFixed(1)}</span>
                    <span className="text-text-secondary text-sm">({influencer.totalReviews} reviews)</span>
                  </div>

                  <div className={`text-sm mt-3 px-2 py-1 rounded-full font-medium ${influencer.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {influencer.isActive ? 'Available Now' : 'Unavailable'}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-background rounded-xl p-3 text-center">
                    <div className="text-xl font-bold gradient-text">{influencer.totalProjects}</div>
                    <div className="text-xs text-text-secondary mt-0.5">Projects</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center">
                    <div className="text-xl font-bold gradient-text">{influencer.rating.toFixed(1)}</div>
                    <div className="text-xs text-text-secondary mt-0.5">Rating</div>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="space-y-2 mb-6">
                  {[
                    { icon: Shield, label: 'Human Reviewed Content' },
                    { icon: Zap, label: 'AI Powered' },
                    { icon: Clock, label: '24/7 Available' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Icon size={14} className="text-brand-light" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                {!influencer.isActive && (
                  <div className="p-3 rounded-lg bg-error/10 text-error text-sm mb-2">
                    This influencer is currently unavailable.
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    onClick={handleChat}
                    disabled={!influencer.isActive}
                    className="w-full btn-brand flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <MessageSquare size={18} />
                    Chat with {influencer.name.split(' ')[0]}
                  </button>
                  <button
                    onClick={handleHire}
                    disabled={!influencer.isActive}
                    className="w-full btn-ghost flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Hire Now
                    <ArrowRight size={18} />
                  </button>
                </div>

                {/* Quick pricing */}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-text-secondary text-center">Starting from</p>
                  <p className="text-center text-lg font-bold mt-1">${startingPrice} <span className="text-sm text-text-secondary font-normal">/ {unit.singular}</span></p>
                </div>
              </motion.div>
            </div>

            {/* RIGHT: Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bio */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-3">About</h2>
                <p className="text-text-secondary leading-relaxed">{influencer.bio}</p>
              </motion.div>

              {/* Industries & Languages */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">Industries</h3>
                  <div className="flex flex-wrap gap-2">
                    {influencer.industries.map((ind: string) => (
                      <span key={ind} className="tag-pill">{ind}</span>
                    ))}
                  </div>
                </div>
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Globe size={14} /> Languages
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {influencer.languages.map((lang: string) => (
                      <span key={lang} className="tag-pill">{lang}</span>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Portfolio */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Portfolio</h2>
                {influencer.portfolio.length === 0 ? (
                  <p className="text-text-secondary text-sm">No portfolio items yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {influencer.portfolio.map((item: any) => (
                      <div key={item.id} className="relative group rounded-xl overflow-hidden bg-background aspect-video border border-border cursor-pointer">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-brand/10 to-surface flex items-center justify-center">
                            <Play size={32} className="text-brand/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-brand/80 flex items-center justify-center">
                            <Play size={20} className="text-white ml-1" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-white text-xs font-medium truncate">{item.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Packages */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Packages</h2>
                <div className="space-y-3">
                  {(Array.isArray(influencer.packages) && influencer.packages.length > 0
                    ? influencer.packages
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
                      }))
                    : PRICING_PACKAGES).map((pkg) => (
                      <div key={pkg.type} className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-brand/40 transition-colors group">
                        <div className="flex items-center gap-3">
                          <CheckCircle size={16} className="text-brand-light" />
                          <div>
                            <p className="text-sm font-medium">{displayPkg(pkg).name}</p>
                            <p className="text-xs text-text-secondary">{displayPkg(pkg).description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${pkg.price}</p>
                          {pkg.isMonthly && <p className="text-xs text-text-secondary">/mo</p>}
                        </div>
                      </div>
                    ))}
                </div>
                <button onClick={handleHire} className="w-full btn-brand mt-4 flex items-center justify-center gap-2">
                  Hire {influencer.name.split(' ')[0]}
                  <ArrowRight size={18} />
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
