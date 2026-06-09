'use client';

import { useEffect, useState } from 'react';
import { HeroSection } from './hero-section';
import { HowItWorks } from './how-it-works';
import { FeaturedInfluencers } from './featured-influencers';
import { PricingSection } from './pricing-section';

type SectionType = 'hero' | 'how' | 'featured' | 'pricing';

type LayoutItem = {
  type: SectionType;
  enabled: boolean;
};

const DEFAULT_LAYOUT: LayoutItem[] = [
  { type: 'hero', enabled: true },
  { type: 'how', enabled: true },
  { type: 'featured', enabled: true },
  { type: 'pricing', enabled: true },
];

const STORAGE_KEY = 'genverce_home_layout';

export function DynamicHome() {
  const [mounted, setMounted] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LayoutItem[];
        if (Array.isArray(parsed) && parsed.every(i => i && typeof i.type === 'string')) {
          setLayout(parsed as LayoutItem[]);
        }
      }
    } catch {}
  }, []);

  if (!mounted) return null;

  const renderSection = (item: LayoutItem, idx: number) => {
    if (!item.enabled) return null;
    if (item.type === 'hero') return <HeroSection key={`hero-${idx}`} />;
    if (item.type === 'how') return <HowItWorks key={`how-${idx}`} />;
    if (item.type === 'featured') return <FeaturedInfluencers key={`featured-${idx}`} />;
    if (item.type === 'pricing') return <PricingSection key={`pricing-${idx}`} />;
    return null;
  };

  return <>{layout.map((item, idx) => renderSection(item, idx))}</>;
}
