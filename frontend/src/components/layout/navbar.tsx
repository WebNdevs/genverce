'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  Menu,
  X,
  User,
  LogOut,
  Bell,
  LayoutDashboard,
  MessageSquare,
} from 'lucide-react';
import { useState, useLayoutEffect } from 'react';
import { useQuery } from '@apollo/client';
import { NotificationBell } from '@/components/ui/notification-bell';
import { GET_MY_CHATS } from '@/graphql/queries/chat';
import { useNotificationStore } from '@/lib/notifications';

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => { setMounted(true); }, []);

  const mock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
  const role = user?.role;

  useQuery(GET_MY_CHATS, {
    skip: !isAuthenticated || role === 'ADMIN',
    fetchPolicy: 'cache-and-network',
  });

  // Unread message count: notifications whose href points to a chat or messages page
  const { notifications } = useNotificationStore();
  const unreadMessageCount = notifications.filter(
    (n) => !n.read && (n.href.startsWith('/chat/') || n.href === '/messages')
  ).length;
  const navLinks =
    !mounted
      ? []
      : isAuthenticated && role === 'ADMIN'
      ? []
      : [
          { href: '/influencers', label: 'Explore Influencers' },
          { href: '/custom-avatar/request', label: 'Request Custom AI Influencer' },
          ...(isAuthenticated
            ? [
                { href: '/dashboard', label: 'Dashboard' },
                ...(role === 'REVIEWER' && !mock
                  ? [{ href: '/admin/reviewer', label: 'Review Queue' }]
                  : []),
              ]
            : []),
        ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className="text-xl font-bold text-text-primary">
              Gen<span className="gradient-text">verce</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-brand-light',
                  pathname === link.href
                    ? 'text-brand-light'
                    : 'text-text-secondary'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!mounted ? (
              <div className="w-32 h-8 rounded-lg bg-surface animate-pulse" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                {/* Messages link */}
                {role !== 'ADMIN' && (
                  <Link
                    href="/messages"
                    className={cn(
                      'relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface/70 transition-colors',
                      pathname.startsWith('/messages')
                        ? 'text-brand-light border-brand/40'
                        : 'text-text-secondary hover:text-text-primary hover:border-brand/40'
                    )}
                    title="Messages"
                    aria-label="Messages"
                  >
                    <MessageSquare size={20} />
                    {unreadMessageCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                      </span>
                    )}
                  </Link>
                )}
                {/* Notification bell */}
                <NotificationBell />
                <Link
                  href="/profile/edit"
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <span>{user?.name}</span>
                </Link>
                <button
                  onClick={logout}
                  className="text-text-secondary hover:text-error transition-colors p-2"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Log In
                </Link>
                <Link href="/signup" className="btn-brand text-sm py-2 px-4">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile: notification bell + menu toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {mounted && isAuthenticated && role !== 'ADMIN' && (
              <Link
                href="/messages"
                className={cn(
                  'relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface/70 transition-colors',
                  pathname.startsWith('/messages')
                    ? 'text-brand-light border-brand/40'
                    : 'text-text-secondary hover:text-text-primary hover:border-brand/40'
                )}
                title="Messages"
                aria-label="Messages"
              >
                <MessageSquare size={18} />
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </Link>
            )}
            {mounted && isAuthenticated && <NotificationBell />}
            <button
              className="text-text-primary"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatedMobileMenu
        isOpen={mobileOpen}
        links={navLinks}
        isAuthenticated={isAuthenticated}
        user={user}
        role={role}
        onLogout={logout}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
      />
    </nav>
  );
}

function AnimatedMobileMenu({
  isOpen,
  links,
  isAuthenticated,
  user,
  role,
  onLogout,
  onClose,
  pathname,
}: {
  isOpen: boolean;
  links: { href: string; label: string }[];
  isAuthenticated: boolean;
  user: any;
  role: string | undefined;
  onLogout: () => void;
  onClose: () => void;
  pathname: string;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="md:hidden border-t border-border bg-background"
    >
      <div className="px-4 py-4 space-y-3">
        {links.filter((l) => l.href !== '/dashboard').map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className={cn(
              'block py-2 text-sm font-medium',
              pathname === link.href
                ? 'text-brand-light'
                : 'text-text-secondary'
            )}
          >
            {link.label}
          </Link>
        ))}
        <div className="border-t border-border pt-3 mt-3">
          {isAuthenticated ? (
            <div className="space-y-2">
              <Link
                href="/dashboard"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2 py-2 text-sm font-medium',
                  pathname === '/dashboard' ? 'text-brand-light' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              {role !== 'ADMIN' && (
                <Link
                  href="/messages"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2 py-2 text-sm font-medium',
                    pathname.startsWith('/messages') ? 'text-brand-light' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  <MessageSquare size={16} /> Messages
                </Link>
              )}
              <Link
                href="/profile/edit"
                onClick={onClose}
                className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <User size={16} /> Profile
              </Link>
              <Link
                href="/notifications"
                onClick={onClose}
                className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <Bell size={16} /> Notifications
              </Link>
              <button
                onClick={() => { onLogout(); onClose(); }}
                className="flex items-center gap-2 text-sm text-error"
              >
                <LogOut size={16} /> Log Out
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                onClick={onClose}
                className="block text-sm text-text-secondary"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                onClick={onClose}
                className="block btn-brand text-sm text-center py-2"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
