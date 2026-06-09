'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { GET_ME } from '@/graphql/queries/user';
import { UPDATE_PROFILE, CHANGE_PASSWORD } from '@/graphql/mutations/user';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { User, Camera, Lock, Eye, EyeOff, AtSign, Building2, Mail } from 'lucide-react';

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-4 py-3 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-colors text-sm';
const readonlyCls = 'w-full px-4 py-3 bg-surface border border-border rounded-lg text-text-secondary text-sm cursor-not-allowed select-none';

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated, updateUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const { data } = useQuery(GET_ME);
  const me = data?.me;
  const [initialized, setInitialized] = useState(false);

  /* ── profile fields ── */
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [company, setCompany]   = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [preview, setPreview]   = useState('');

  /* ── password fields ── */
  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!initialized && me) {
      setName(me.name ?? '');
      setUsername(me.username ?? '');
      setCompany(me.company ?? '');
      setAvatarUrl(me.avatar ?? '');
      setPreview(me.avatar ?? '');
      setInitialized(true);
    }
  }, [initialized, me]);

  /* ── mutations ── */
  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE, {
    update: (cache, { data }) => {
      const updated = data?.updateProfile;
      if (!updated) return;
      cache.writeQuery({ query: GET_ME, data: { me: updated } });
    },
    onCompleted: (res) => {
      const u = res.updateProfile;
      updateUser({ name: u.name, company: u.company, avatar: u.avatar });
      toast({ title: 'Profile updated', variant: 'success' });
      router.push(user?.role === 'ADMIN' ? '/admin/settings' : '/profile/overview');
    },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'error' }),
  });

  const [changePassword, { loading: changingPw }] = useMutation(CHANGE_PASSWORD, {
    onCompleted: () => {
      toast({ title: 'Password changed successfully', variant: 'success' });
      setShowPwSection(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (e) => toast({ title: 'Password change failed', description: e.message, variant: 'error' }),
  });

  /* ── avatar upload ── */
  const onFileSelect = async (file: File | null) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    try {
      const token = localStorage.getItem('genverce_token') || '';
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
      );
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setAvatarUrl(url);
    } catch {
      toast({ title: 'Image upload failed', variant: 'error' });
      setPreview(avatarUrl);
    }
  };

  const submitProfile = () => {
    updateProfile({ variables: { name, username: username || undefined, company, avatar: avatarUrl || undefined } });
  };

  const submitPassword = () => {
    if (newPw !== confirmPw) {
      toast({ title: 'Passwords do not match', variant: 'error' });
      return;
    }
    if (newPw.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'error' });
      return;
    }
    changePassword({ variables: { currentPassword: currentPw, newPassword: newPw } });
  };

  const pwStrength = (pw: string) => {
    if (!pw) return null;
    if (pw.length < 6)  return { label: 'Too short', color: 'bg-error',   w: 'w-1/4' };
    if (pw.length < 8)  return { label: 'Weak',      color: 'bg-warning',  w: 'w-2/4' };
    if (pw.length < 12) return { label: 'Good',       color: 'bg-brand',    w: 'w-3/4' };
    return                    { label: 'Strong',      color: 'bg-success',  w: 'w-full' };
  };
  const strength = pwStrength(newPw);

  if (!mounted) return null;

  return (
    <div className="py-2 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Profile <span className="gradient-text">Settings</span></h1>
        <p className="text-text-secondary mt-1">Manage your account information</p>
      </motion.div>

      {/* ── Profile Info Card ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass-card p-6 space-y-5 mb-6">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <User size={16} className="text-brand-light" />
          Personal Information
        </h2>

        {/* Avatar */}
        <div className="flex flex-wrap items-center gap-4 pb-1">
          <div className="relative w-16 h-16 rounded-full bg-surface border-2 border-border overflow-hidden flex items-center justify-center flex-shrink-0">
            {preview
              ? <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
              : <User size={24} className="text-brand-light" />}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-ghost cursor-pointer flex items-center gap-2 text-sm flex-shrink-0">
              <Camera size={15} />
              Change Photo
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)} />
            </label>
            <input
              value={avatarUrl}
              onChange={(e) => { setAvatarUrl(e.target.value); setPreview(e.target.value); }}
              placeholder="Or paste image URL…"
              className="w-56 px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-brand transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Name */}
          <Field label="Full Name" icon={<User size={14} />}>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your full name" className={inputCls} />
          </Field>

          {/* Username */}
          <Field label="Username" icon={<AtSign size={14} />}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50 text-sm select-none">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                placeholder="yourhandle" className={`${inputCls} pl-8`} />
            </div>
          </Field>

          {/* Company */}
          <Field label="Company Name" icon={<Building2 size={14} />}>
            <input value={company} onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company (optional)" className={inputCls} />
          </Field>

          {/* Email — read-only */}
          <Field label="Email Address" icon={<Mail size={14} />}>
            <div className="relative">
              <input value={me?.email ?? ''} readOnly className={readonlyCls} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-secondary/50 bg-surface px-1.5 py-0.5 rounded">
                READ ONLY
              </span>
            </div>
          </Field>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={submitProfile} disabled={!name.trim() || saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => router.push(user?.role === 'ADMIN' ? '/admin/settings' : '/profile/overview')}
            className="btn-ghost">Cancel</button>
        </div>
      </motion.div>

      {/* ── Change Password Card ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
        className="glass-card p-6">
        <button
          onClick={() => setShowPwSection(!showPwSection)}
          className="w-full flex items-center justify-between group"
        >
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Lock size={16} className="text-brand-light" />
            Change Password
          </h2>
          <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
            {showPwSection ? 'Cancel' : 'Update →'}
          </span>
        </button>

        {showPwSection && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="mt-5 space-y-4 overflow-hidden">

            {/* Current password */}
            <Field label="Current Password" icon={<Lock size={14} />}>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Enter current password" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {/* New password */}
            <Field label="New Password" icon={<Lock size={14} />}>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 6 characters" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Strength bar */}
              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.w}`} />
                  </div>
                  <p className="text-xs text-text-secondary">{strength.label}</p>
                </div>
              )}
            </Field>

            {/* Confirm password */}
            <Field label="Confirm New Password" icon={<Lock size={14} />}>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-error mt-1">Passwords do not match</p>
              )}
            </Field>

            <button
              onClick={submitPassword}
              disabled={!currentPw || !newPw || !confirmPw || changingPw}
              className="btn-brand disabled:opacity-50"
            >
              {changingPw ? 'Updating…' : 'Update Password'}
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
