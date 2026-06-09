'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { LOGIN } from '@/graphql/mutations/auth';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [login, { loading }] = useMutation(LOGIN, {
    onCompleted: (data) => {
      const { accessToken, refreshToken, user } = data.login;
      setAuth(user, accessToken, refreshToken);
      toast({ title: 'Welcome back!', variant: 'success' });
      const mock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
      if (mock) {
        router.push('/');
      } else {
        if (!user.isOnboarded && user.role === 'CUSTOMER') {
          router.push('/onboarding');
        } else {
          router.push(user.role === 'ADMIN' ? '/admin' : '/dashboard');
        }
      }
    },
    onError: (error) => {
      let description = error.message;
      const anyErr = error as any;
      if (anyErr?.networkError) {
        const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        description = `Cannot reach API server at ${api}. Please ensure the backend is running.`;
      } else if (error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('invalid')) {
        description = 'Invalid email or password';
      }
      toast({ title: 'Login failed', description, variant: 'error' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ variables: { input: { email, password } } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <span className="text-2xl font-bold">
              Gen<span className="gradient-text">verce</span>
            </span>
          </Link>
          <p className="text-text-secondary mt-3">Welcome back to the future</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors pr-12"
                  placeholder="Enter your password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-brand flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand-light hover:text-brand font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
