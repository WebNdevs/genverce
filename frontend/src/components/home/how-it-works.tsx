'use client';

import { motion } from 'framer-motion';
import { Search, MessageSquare, CreditCard, Video } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Browse AI Influencers',
    description:
      'Explore our curated collection of AI influencers, each with unique personalities, industries, and content styles.',
  },
  {
    icon: MessageSquare,
    title: 'Chat Before You Hire',
    description:
      'Have a real-time conversation with any AI influencer to discuss your brand, product, and vision before committing.',
  },
  {
    icon: CreditCard,
    title: 'Choose & Pay',
    description:
      'Select a package that fits your needs, from single videos to monthly plans. Secure checkout with Stripe.',
  },
  {
    icon: Video,
    title: 'Get Your Video',
    description:
      'Receive professionally generated 60-second marketing videos. Instant delivery or human-reviewed quality.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How <span className="gradient-text">Genverce</span> Works
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            From browsing to delivery in four simple steps
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6 glow-border group relative"
            >
              <div className="absolute top-4 right-4 text-5xl font-bold text-brand/10">
                {index + 1}
              </div>
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
                <step.icon size={24} className="text-brand-light" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
