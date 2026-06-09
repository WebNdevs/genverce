'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileManagerRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/profile/overview'); }, []);
  return null;
}
