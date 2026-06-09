'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Building2, CalendarDays, ChevronDown, ShoppingCart, Video, Users } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { useAuthStore } from '@/lib/auth';
import { GET_ME } from '@/graphql/queries/user';
import { GET_DASHBOARD_DATA } from '@/graphql/queries/order';

export default function ProfileOverviewPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });

  useLayoutEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const { data: meData } = useQuery(GET_ME);
  const { data } = useQuery(GET_DASHBOARD_DATA, { skip: !isAuthenticated });

  const me = meData?.me ?? (mounted ? user : null);
  const stats = data?.myStats ?? { totalOrders: 0, totalVideosGenerated: 0, totalInfluencersHired: 0 };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold">My <span className="gradient-text">Profile</span></h1>
        <p className="text-sm text-text-secondary mt-1">Your account overview</p>
      </motion.div>

      <div className="space-y-4 max-w-xl">
        {/* Profile card */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center overflow-hidden">
                {mounted && me?.avatar ? (
                  <img src={me.avatar} alt={me.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-brand-light" />
                )}
              </div>
              <div>
                <p className="font-semibold">{me?.name}</p>
                <p className="text-xs text-text-secondary">{me?.email}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="px-3 py-2 rounded-lg border border-border bg-surface text-sm flex items-center gap-1 hover:bg-background transition-colors"
            >
              Menu <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {open && (
            <div className="mt-4 rounded-lg border border-border bg-background overflow-hidden">
              <Link
                href="/profile/edit"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface transition-colors"
              >
                <span>Edit Profile</span>
                <span className="text-text-secondary">→</span>
              </Link>
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm border-t border-border pt-4">
            {me?.company && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Building2 size={14} /> {me.company}
              </div>
            )}
            {me?.createdAt && (
              <div className="flex items-center gap-2 text-text-secondary">
                <CalendarDays size={14} /> Joined {fmtDate(me.createdAt)}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
