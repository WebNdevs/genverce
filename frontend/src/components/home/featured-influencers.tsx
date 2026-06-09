'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { InfluencerCard } from '@/components/influencer/influencer-card';
import { Influencer } from '@/types';
import { useQuery } from '@apollo/client';
import { GET_TOP_INFLUENCERS } from '@/graphql/queries/influencer';

// Demo data for SSR/static rendering when API isn't connected
const DEMO_INFLUENCERS: Influencer[] = [
  {
    id: '1',
    name: 'Nova Sterling',
    bio: 'AI-powered tech influencer specializing in SaaS, fintech, and developer tools. Known for sharp, data-driven content that converts.',
    avatar: '',
    industries: ['Technology', 'SaaS', 'Fintech'],
    contentStyle: 'Professional & Data-Driven',
    languages: ['English', 'Spanish'],
    rating: 4.9,
    totalProjects: 347,
    totalReviews: 289,
    isActive: true,
    portfolio: [],
  },
  {
    id: '2',
    name: 'Aria Bloom',
    bio: 'Lifestyle and beauty AI influencer with a warm, relatable personality. Creates authentic-feeling content for beauty and wellness brands.',
    avatar: '',
    industries: ['Beauty', 'Lifestyle', 'Wellness'],
    contentStyle: 'Warm & Relatable',
    languages: ['English', 'French'],
    rating: 4.8,
    totalProjects: 512,
    totalReviews: 445,
    isActive: true,
    portfolio: [],
  },
  {
    id: '3',
    name: 'Kai Vortex',
    bio: 'High-energy gaming and entertainment AI influencer. Explosive enthusiasm for game launches, esports gear, and entertainment products.',
    avatar: '',
    industries: ['Gaming', 'Entertainment', 'Tech Gadgets'],
    contentStyle: 'High-Energy & Entertaining',
    languages: ['English', 'Japanese', 'Korean'],
    rating: 4.7,
    totalProjects: 623,
    totalReviews: 534,
    isActive: true,
    portfolio: [],
  },
  {
    id: '4',
    name: 'Zara Nexus',
    bio: 'Fashion-forward AI influencer bridging haute couture with streetwear. Stunning visual content for fashion and luxury brands.',
    avatar: '',
    industries: ['Fashion', 'Luxury', 'E-commerce'],
    contentStyle: 'Bold & Editorial',
    languages: ['English', 'Italian', 'Portuguese'],
    rating: 4.9,
    totalProjects: 298,
    totalReviews: 267,
    isActive: true,
    portfolio: [],
  },
  {
    id: '5',
    name: 'Atlas Prime',
    bio: 'B2B and enterprise AI influencer focused on corporate messaging. Transforms complex business solutions into compelling narratives.',
    avatar: '',
    industries: ['B2B', 'Enterprise', 'Consulting'],
    contentStyle: 'Corporate & Authoritative',
    languages: ['English', 'German', 'Mandarin'],
    rating: 4.8,
    totalProjects: 189,
    totalReviews: 156,
    isActive: true,
    portfolio: [],
  },
  {
    id: '6',
    name: 'Luna Spark',
    bio: 'Health and fitness AI influencer with an energetic, motivational personality. Inspiring content for fitness brands and health products.',
    avatar: '',
    industries: ['Fitness', 'Health', 'Nutrition'],
    contentStyle: 'Motivational & Energetic',
    languages: ['English', 'Spanish', 'Hindi'],
    rating: 4.7,
    totalProjects: 445,
    totalReviews: 398,
    isActive: true,
    portfolio: [],
  },
];

export function FeaturedInfluencers() {
  const { data } = useQuery(GET_TOP_INFLUENCERS, { variables: { limit: 6 } });
  const top = (data?.topInfluencers as Influencer[]) || DEMO_INFLUENCERS;
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Meet Our <span className="gradient-text">AI Influencers</span>
            </h2>
            <p className="text-text-secondary text-lg">
              Every influencer is AI-powered with a unique personality
            </p>
          </div>
          <Link
            href="/influencers"
            className="hidden sm:flex items-center gap-2 text-brand-light hover:text-brand font-medium transition-colors"
          >
            View All
            <ArrowRight size={18} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {top.map((influencer, index) => (
            <motion.div
              key={influencer.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <InfluencerCard influencer={influencer} />
            </motion.div>
          ))}
        </div>

        <div className="sm:hidden mt-8 text-center">
          <Link
            href="/influencers"
            className="btn-brand inline-flex items-center gap-2"
          >
            View All Influencers
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
