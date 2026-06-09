'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { InfluencerCard } from '@/components/influencer/influencer-card';
import { GET_INFLUENCERS, GET_FILTER_OPTIONS } from '@/graphql/queries/influencer';
import { Influencer } from '@/types';
import { useAuthStore } from '@/lib/auth';
import AdminLayout from '@/app/(admin)/admin/layout';

const FALLBACK_INFLUENCERS: Influencer[] = [
  { id: '1', name: 'Nova Sterling', bio: 'AI-powered tech influencer specializing in SaaS, fintech, and developer tools. Sharp, data-driven content.', avatar: '', industries: ['Technology', 'SaaS', 'Fintech'], contentStyle: 'Professional & Data-Driven', languages: ['English', 'Spanish'], rating: 4.9, totalProjects: 347, totalReviews: 289, isActive: true, portfolio: [] },
  { id: '2', name: 'Aria Bloom', bio: 'Lifestyle and beauty AI influencer with a warm, relatable personality for beauty brands and wellness products.', avatar: '', industries: ['Beauty', 'Lifestyle', 'Wellness'], contentStyle: 'Warm & Relatable', languages: ['English', 'French'], rating: 4.8, totalProjects: 512, totalReviews: 445, isActive: true, portfolio: [] },
  { id: '3', name: 'Kai Vortex', bio: 'High-energy gaming and entertainment AI influencer for game launches, esports gear and entertainment.', avatar: '', industries: ['Gaming', 'Entertainment', 'Tech Gadgets'], contentStyle: 'High-Energy & Entertaining', languages: ['English', 'Japanese', 'Korean'], rating: 4.7, totalProjects: 623, totalReviews: 534, isActive: true, portfolio: [] },
  { id: '4', name: 'Zara Nexus', bio: 'Fashion-forward AI influencer bridging haute couture with streetwear. Bold, editorial content.', avatar: '', industries: ['Fashion', 'Luxury', 'E-commerce'], contentStyle: 'Bold & Editorial', languages: ['English', 'Italian', 'Portuguese'], rating: 4.9, totalProjects: 298, totalReviews: 267, isActive: true, portfolio: [] },
  { id: '5', name: 'Atlas Prime', bio: 'B2B and enterprise AI influencer focused on corporate messaging and professional services.', avatar: '', industries: ['B2B', 'Enterprise', 'Consulting'], contentStyle: 'Corporate & Authoritative', languages: ['English', 'German', 'Mandarin'], rating: 4.8, totalProjects: 189, totalReviews: 156, isActive: true, portfolio: [] },
  { id: '6', name: 'Luna Spark', bio: 'Health and fitness AI influencer with energetic, motivational personality for fitness and nutrition brands.', avatar: '', industries: ['Fitness', 'Health', 'Nutrition'], contentStyle: 'Motivational & Energetic', languages: ['English', 'Spanish', 'Hindi'], rating: 4.7, totalProjects: 445, totalReviews: 398, isActive: true, portfolio: [] },
  { id: '7', name: 'Rex Cipher', bio: 'Crypto and Web3 AI influencer making blockchain accessible. Covers DeFi, NFTs, and exchanges.', avatar: '', industries: ['Crypto', 'Web3', 'DeFi'], contentStyle: 'Technical & Conversational', languages: ['English', 'Russian', 'Arabic'], rating: 4.6, totalProjects: 334, totalReviews: 278, isActive: true, portfolio: [] },
  { id: '8', name: 'Mira Sol', bio: 'Travel and hospitality AI influencer with cinematic flair for hotels, airlines and destination experiences.', avatar: '', industries: ['Travel', 'Hospitality', 'Food & Beverage'], contentStyle: 'Cinematic & Aspirational', languages: ['English', 'French', 'Thai'], rating: 4.9, totalProjects: 267, totalReviews: 234, isActive: true, portfolio: [] },
];

const ALL_INDUSTRIES = ['Technology', 'SaaS', 'Fintech', 'Beauty', 'Lifestyle', 'Wellness', 'Gaming', 'Entertainment', 'Tech Gadgets', 'Fashion', 'Luxury', 'E-commerce', 'B2B', 'Enterprise', 'Consulting', 'Fitness', 'Health', 'Nutrition', 'Crypto', 'Web3', 'DeFi', 'Travel', 'Hospitality', 'Food & Beverage'];
const ALL_STYLES = ['Professional & Data-Driven', 'Warm & Relatable', 'High-Energy & Entertaining', 'Bold & Editorial', 'Corporate & Authoritative', 'Motivational & Energetic', 'Technical & Conversational', 'Cinematic & Aspirational'];
const ALL_LANGUAGES = ['English', 'Spanish', 'French', 'Italian', 'Portuguese', 'German', 'Mandarin', 'Japanese', 'Korean', 'Russian', 'Arabic', 'Hindi', 'Thai'];

export default function InfluencersPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [contentStyle, setContentStyle] = useState('');
  const [language, setLanguage] = useState('');
  const [minRating, setMinRating] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading } = useQuery(GET_INFLUENCERS, {
    variables: {
      filter: {
        search: debouncedSearch.trim().length >= 3
          ? debouncedSearch
          : undefined,
        industry: industry || undefined,
        contentStyle: contentStyle || undefined,
        language: language || undefined,
        minRating: minRating ? parseFloat(minRating) : undefined,
        includeInactive: true,
        page,
        limit: 6,
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  const influencers: Influencer[] = data?.influencers?.influencers ?? FALLBACK_INFLUENCERS;
  const totalPages: number = data?.influencers?.totalPages ?? 1;

  const hasActiveFilters = search || industry || contentStyle || language || minRating;



  const clearFilters = () => {
    setSearch('');
    setIndustry('');
    setContentStyle('');
    setLanguage('');
    setMinRating('');
    setPage(1);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages: (number | '…')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('…');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }
    return (
      <div className="flex items-center justify-center gap-2 mt-12">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-sm disabled:opacity-40 hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-10 text-center text-text-secondary">…</span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p as number)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-brand text-white' : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-sm disabled:opacity-40 hover:text-text-primary transition-colors"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  if (!mounted) return null;

  if (user?.role === 'ADMIN') {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-bold mb-3">
              AI <span className="gradient-text">Influencers</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-text-secondary text-lg">
              Browse our curated collection of AI-powered influencers
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, industry, or style..."
                className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${showFilters || hasActiveFilters
                ? 'border-brand bg-brand/10 text-brand-light'
                : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                }`}
            >
              <SlidersHorizontal size={18} />
              <span className="hidden sm:inline text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <span className="w-5 h-5 rounded-full bg-brand text-white text-xs flex items-center justify-center">!</span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-error/30 bg-error/10 text-error text-sm transition-colors hover:bg-error/20"
              >
                <X size={16} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </motion.div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Industry</label>
                  <select value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors">
                    <option value="">All Industries</option>
                    {ALL_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Content Style</label>
                  <select value={contentStyle} onChange={(e) => { setContentStyle(e.target.value); setPage(1); }} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors">
                    <option value="">All Styles</option>
                    {ALL_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Language</label>
                  <select value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); }} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors">
                    <option value="">All Languages</option>
                    {ALL_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Min. Rating</label>
                  <select value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(1); }} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors">
                    <option value="">Any Rating</option>
                    <option value="4.5">4.5+</option>
                    <option value="4.7">4.7+</option>
                    <option value="4.9">4.9+</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-72 rounded-2xl" />
              ))}
            </div>
          ) : influencers.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-text-secondary text-lg">No influencers found.</p>
              <button onClick={clearFilters} className="btn-brand mt-4">Clear Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {influencers.map((influencer, index) => (
                <motion.div key={influencer.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <InfluencerCard influencer={influencer} />
                </motion.div>
              ))}
            </div>
          )}

          {renderPagination()}
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="py-10">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold mb-3"
            >
              AI <span className="gradient-text">Influencers</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-text-secondary text-lg"
            >
              Browse our curated collection of AI-powered influencers
            </motion.p>
          </div>

          {/* Search + Filter bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3 mb-6"
          >
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, industry, or style..."
                className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${showFilters || hasActiveFilters
                ? 'border-brand bg-brand/10 text-brand-light'
                : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                }`}
            >
              <SlidersHorizontal size={18} />
              <span className="hidden sm:inline text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <span className="w-5 h-5 rounded-full bg-brand text-white text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-error/30 bg-error/10 text-error text-sm transition-colors hover:bg-error/20"
              >
                <X size={16} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </motion.div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-card p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="">All Industries</option>
                    {ALL_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Content Style</label>
                  <select
                    value={contentStyle}
                    onChange={(e) => { setContentStyle(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="">All Styles</option>
                    {ALL_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Language</label>
                  <select
                    value={language}
                    onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="">All Languages</option>
                    {ALL_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Min. Rating</label>
                  <select
                    value={minRating}
                    onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="">Any Rating</option>
                    <option value="4.5">4.5+</option>
                    <option value="4.7">4.7+</option>
                    <option value="4.9">4.9+</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-72 rounded-2xl" />
              ))}
            </div>
          ) : influencers.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-text-secondary text-lg">No influencers found.</p>
              <button onClick={clearFilters} className="btn-brand mt-4">Clear Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {influencers.map((influencer, index) => (
                <motion.div
                  key={influencer.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <InfluencerCard influencer={influencer} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {renderPagination()}
        </div>
      </main>
      <Footer />
    </>
  );
}
