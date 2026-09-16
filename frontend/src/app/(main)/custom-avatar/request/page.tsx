'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useMutation } from '@apollo/client';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { CREATE_TICKET } from '@/graphql/mutations/ticket';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import AdminLayout from '@/app/(admin)/admin/layout';
import RequestForm from '@/components/custom-avatar/request-form';
import { UserPlus } from 'lucide-react';

export default function CustomAvatarRequestPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const [createTicket, { loading }] = useMutation(CREATE_TICKET, {
    onCompleted: () => {
      toast({ title: 'Request submitted!', description: 'Our team will contact you to scope pricing and next steps.', variant: 'success' });
      router.push('/dashboard/tickets');
    },
    onError: (e) => toast({ title: 'Submission failed', description: e.message, variant: 'error' }),
  });

  const handleSubmit = (data: {
    brandName: string; guidelines: string; requirements: string;
    usageRights: string; complexity: string; assetsUrl: string;
  }) => {
    const issue = [
      '--- Custom AI Influencer Request ---',
      `Customer: ${user?.name} (${user?.email})`,
      `Brand: ${data.brandName}`,
      `Guidelines: ${data.guidelines}`,
      `Requirements: ${data.requirements}`,
      `Usage Rights: ${data.usageRights}`,
      `Complexity: ${data.complexity}`,
      data.assetsUrl ? `Assets: ${data.assetsUrl}` : '',
      '---',
      'Notes:',
      '- Custom avatars are private and available only to this customer.',
      '- Genverce will decide if any avatar becomes public.',
      '- Pricing will be scoped based on complexity and usage rights.',
    ].filter(Boolean).join('\n');

    createTicket({ variables: { issue } });
  };

  const header = (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
          <UserPlus size={20} className="text-brand-light" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Request Custom <span className="gradient-text">AI Influencer</span>
        </h1>
      </div>
      <p className="text-text-secondary text-sm sm:text-base mt-1">
        Submit brand guidelines and requirements for a private, custom-built avatar.
      </p>
    </motion.div>
  );

  if (mounted && user?.role === 'ADMIN') {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto">
          {header}
          <RequestForm loading={loading} onSubmit={handleSubmit} onCancel={() => router.push('/dashboard')} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {header}
          <RequestForm loading={loading} onSubmit={handleSubmit} onCancel={() => router.push('/dashboard')} />
        </div>
      </main>
      <Footer />
    </>
  );
}
