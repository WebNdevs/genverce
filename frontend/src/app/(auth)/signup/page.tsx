'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { SIGNUP } from '@/graphql/mutations/auth';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'INDIVIDUAL' | 'AGENCY'>('INDIVIDUAL');
  const [company, setCompany] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [signup, { loading }] = useMutation(SIGNUP, {
    onCompleted: (data) => {
      const { accessToken, refreshToken, user } = data.signup;
      setAuth(user, accessToken, refreshToken);
      toast({ title: 'Account created!', variant: 'success' });
      router.push('/onboarding');
    },
    onError: (error) => {
      toast({
        title: 'Signup failed',
        description: error.message,
        variant: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup({
      variables: {
        input: {
          name,
          email,
          password,
          accountType,
          ...(accountType === 'AGENCY' && company ? { company } : {}),
        },
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <span className="text-2xl font-bold">
              Gen<span className="gradient-text">verce</span>
            </span>
          </Link>
          <p className="text-text-secondary mt-3">
            Create your account and start hiring AI influencers
          </p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Account Type Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['INDIVIDUAL', 'AGENCY'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    accountType === type
                      ? 'bg-brand text-white'
                      : 'bg-background text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {type === 'INDIVIDUAL' ? 'Individual' : 'Agency'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                placeholder="Your name"
                required
                minLength={2}
              />
            </div>

            {accountType === 'AGENCY' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                  placeholder="Your company"
                />
              </div>
            )}

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
                  placeholder="Minimum 8 characters"
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
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-light hover:text-brand font-medium">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
