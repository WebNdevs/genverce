'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { ParticleBackground } from './particle-background';
import { useAuthStore } from '@/lib/auth';

export function HeroSection() {
  const mock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
  const { isAuthenticated } = useAuthStore();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-background">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/5 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-brand/5 blur-[120px] animate-pulse" />
      </div>

      {!mock && <ParticleBackground />}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand/30 bg-brand/5 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-brand-light font-medium">
            AI-Powered Influencer Platform
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-hero font-bold leading-tight mb-6"
        >
          The Future of{' '}
          <br className="hidden sm:block" />
          Influence is{' '}
          <span className="gradient-text">AI</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10"
        >
          Hire AI influencers. Get professional content.
          <br className="hidden sm:block" /> No negotiations. No delays.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/influencers" className="btn-brand flex items-center gap-2 text-base">
            Explore Influencers
            <ArrowRight size={18} />
          </Link>
          <Link
            href="#how-it-works"
            className="btn-ghost flex items-center gap-2 text-base"
          >
            <Play size={18} />
            See How It Works
          </Link>
          {isAuthenticated && (
            <Link href="/dashboard" className="btn-ghost flex items-center gap-2 text-base">
              Go to Dashboard
              <ArrowRight size={18} />
            </Link>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
        >
          {[
            { value: '8+', label: 'AI Influencers' },
            { value: '3K+', label: 'Videos Created' },
            { value: '24/7', label: 'Available' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-text-secondary mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-brand"
          />
        </div>
      </motion.div>
    </section>
  );
}
