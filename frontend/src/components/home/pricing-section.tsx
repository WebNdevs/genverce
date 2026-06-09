'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { PRICING_PACKAGES } from '@/types';
import { cn } from '@/lib/utils';

export function PricingSection() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, Transparent <span className="gradient-text">Pricing</span>
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Choose the package that fits your content needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PRICING_PACKAGES.map((pkg, index) => {
            const isPopular = pkg.type === 'PACK_5';

            return (
              <motion.div
                key={pkg.type}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'glass-card glow-border p-6 relative flex flex-col',
                  isPopular && 'border-brand ring-1 ring-brand/20'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{pkg.name}</h3>
                <p className="text-xs text-text-secondary mb-4">
                  {pkg.description}
                </p>
                <div className="mb-6">
                  <span className="text-3xl font-bold">
                    ${pkg.price.toFixed(0)}
                  </span>
                  {pkg.isMonthly && (
                    <span className="text-text-secondary text-sm">/mo</span>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  <li className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check size={14} className="text-success flex-shrink-0" />
                    {pkg.videoCount} video{pkg.videoCount > 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check size={14} className="text-success flex-shrink-0" />
                    60 seconds each
                  </li>
                  <li className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check size={14} className="text-success flex-shrink-0" />
                    HD quality
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className={cn(
                    'text-center py-2.5 rounded-lg text-sm font-semibold transition-all',
                    isPopular
                      ? 'btn-brand'
                      : 'btn-ghost'
                  )}
                >
                  Get Started
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
