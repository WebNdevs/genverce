'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState, useLayoutEffect } from 'react';
import {
  Video, Ticket, LayoutDashboard, Search, UserPlus,
  Settings, ChevronDown, User, MessageSquare, Menu, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { useAuthStore } from '@/lib/auth';
import AdminLayout from '@/app/(admin)/admin/layout';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/orders', label: 'My Orders', icon: Video },
  { href: '/dashboard/chats', label: 'My Chats', icon: MessageSquare },
  { href: '/dashboard/tickets', label: 'Support', icon: Ticket },
  { href: '/influencers', label: 'Explore Influencers', icon: Search },
  { href: '/custom-avatar/request', label: 'Request Custom AI Influencer', icon: UserPlus },
  { href: '/profile/edit', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [openSettings, setOpenSettings] = useState(pathname.startsWith('/profile'));
  const [mounted, setMounted] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useLayoutEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-20 pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex gap-6">
              <aside className="hidden lg:block w-64 flex-shrink-0">
                <div className="rounded-lg border border-border bg-surface p-2 space-y-1">
                  {[1,2,3,4,5,6,7].map((i) => (
                    <div key={i} className="h-9 rounded-md bg-background animate-pulse" />
                  ))}
                </div>
              </aside>
              <section className="flex-1 min-w-0">{children}</section>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (user?.role === 'ADMIN') {
    return <AdminLayout>{children}</AdminLayout>;
  }

  const SidebarNav = ({ onClose }: { onClose?: () => void }) => (
    <div className="rounded-lg border border-border bg-surface p-2">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.label === 'Settings') {
            const isActive = pathname === item.href || pathname.startsWith('/profile');
            return (
              <div key="settings" className="space-y-1">
                <div className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-background text-text-primary' : 'text-text-secondary hover:bg-background'
                }`}>
                  <Link href={item.href} className="flex items-center gap-3" onClick={onClose}>
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                  <button
                    onClick={() => setOpenSettings(!openSettings)}
                    aria-expanded={openSettings}
                    className="p-1 rounded hover:bg-background"
                  >
                    <ChevronDown size={16} className={`${openSettings ? 'rotate-180' : ''} transition-transform`} />
                  </button>
                </div>
                {openSettings && (
                  <div className="pl-4">
                    <Link
                      href="/profile/edit"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        pathname.startsWith('/profile/edit') ? 'bg-background text-text-primary' : 'text-text-secondary hover:bg-background'
                      }`}
                    >
                      <User size={16} className="flex-shrink-0" />
                      <span className="truncate">Profile Edit</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          }
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-background text-text-primary' : 'text-text-secondary hover:bg-background'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Mobile sidebar toggle */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <Menu size={16} /> Menu
            </button>
          </div>

          <div className="flex gap-6">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <SidebarNav />
            </aside>

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
              {mobileSidebarOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                  />
                  <motion.aside
                    initial={{ x: -288 }}
                    animate={{ x: 0 }}
                    exit={{ x: -288 }}
                    transition={{ type: 'tween', duration: 0.22 }}
                    className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r border-border z-50 lg:hidden overflow-y-auto"
                  >
                    <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                      <span className="font-semibold text-sm">Menu</span>
                      <button
                        onClick={() => setMobileSidebarOpen(false)}
                        className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-3">
                      <SidebarNav onClose={() => setMobileSidebarOpen(false)} />
                    </div>
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            <section className="flex-1 min-w-0">{children}</section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
