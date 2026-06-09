 'use client';
 
 import { useEffect } from 'react';
 import { useRouter } from 'next/navigation';
 import { Navbar } from '@/components/layout/navbar';
 import { Footer } from '@/components/layout/footer';
 import { useAuthStore } from '@/lib/auth';
 
 export default function ProfileRouterPage() {
   const router = useRouter();
   const { user, isAuthenticated, hydrated } = useAuthStore();

   useEffect(() => {
     if (!hydrated) return;
     if (!isAuthenticated) { router.push('/login'); return; }
     const role = user?.role ?? 'CUSTOMER';
     if (role === 'ADMIN') {
       router.replace('/admin/settings');
     } else {
       router.replace('/profile/overview');
     }
   }, [hydrated, isAuthenticated, user]);
 
   return (
     <>
       <Navbar />
       <main className="min-h-screen pt-20 pb-24">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
           <div className="skeleton h-32 rounded-2xl" />
         </div>
       </main>
       <Footer />
     </>
   );
 }
