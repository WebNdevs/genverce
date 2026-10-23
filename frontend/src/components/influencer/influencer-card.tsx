'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, Briefcase } from 'lucide-react';
import { Influencer } from '@/types';

export function InfluencerCard({ influencer }: { influencer: Influencer }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="glass-card glow-border group overflow-hidden"
    >
      <Link href={`/influencers/${influencer.id}`}>
        <div className="p-6">
          {/* Avatar with glow ring */}
          <div className="flex items-start gap-4 mb-4">
            <div className="relative">
              <div className="avatar-glow w-16 h-16 rounded-full">
                <div className="w-16 h-16 rounded-full bg-surface border-2 border-brand/30 flex items-center justify-center text-xl font-bold gradient-text overflow-hidden">
                  {influencer.avatar ? (
                    <img
                      src={influencer.avatar}
                      alt={influencer.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    influencer.name.charAt(0)
                  )}
                </div>
              </div>
              {/* Availability indicator */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-surface ${
                  influencer.isActive ? 'bg-success' : 'bg-error'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-text-primary truncate">
                {influencer.name}
              </h3>
              <p className="text-sm text-text-secondary">{influencer.contentStyle}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star size={14} className="text-brand-light fill-brand-light" />
                <span className="text-sm font-medium text-brand-light">
                  {influencer.rating.toFixed(1)}
                </span>
                <span className="text-xs text-text-secondary">
                  ({influencer.totalReviews})
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          <p className="text-sm text-text-secondary line-clamp-2 mb-4">
            {influencer.bio}
          </p>

          {/* Industry tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {influencer.industries.slice(0, 3).map((industry) => (
              <span key={industry} className="tag-pill">
                {industry}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Briefcase size={12} />
              <span>{influencer.totalProjects} projects</span>
            </div>
            <div className={`text-xs px-2 py-0.5 rounded-full ${
              influencer.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}>
              {influencer.isActive ? 'Available Now' : 'Unavailable'}
            </div>
          </div>
        </div>

        {/* Hire button (slides up on hover) */}
        <div className="overflow-hidden">
          <motion.div
            initial={{ y: '100%' }}
            whileHover={{ y: 0 }}
            className="bg-brand hover:bg-brand-hover text-white text-center py-3 text-sm font-semibold transition-colors group-hover:translate-y-0"
            style={{
              transform: 'translateY(100%)',
              transition: 'transform 0.3s ease',
            }}
          >
            View Profile & Hire
          </motion.div>
        </div>
      </Link>
      <style jsx>{`
        .group:hover div:last-child > div {
          transform: translateY(0) !important;
        }
      `}</style>
    </motion.div>
  );
}
