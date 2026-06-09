'use client';

import { ReactNode } from 'react';
import DashboardLayout from '@/app/(main)/dashboard/layout';

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
