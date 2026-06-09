 'use client';
 
 import { useEffect, useState } from 'react';
 import { useParams, useRouter } from 'next/navigation';
 import { useQuery, useMutation } from '@apollo/client';
 import { motion } from 'framer-motion';
 import Link from 'next/link';
 import { Navbar } from '@/components/layout/navbar';
 import { Footer } from '@/components/layout/footer';
 import { GET_INFLUENCER } from '@/graphql/queries/influencer';
 import { useAuthStore } from '@/lib/auth';
 import { Shield, Power, PowerOff, Edit, User, CheckCircle, XCircle } from 'lucide-react';
 import { gql } from '@apollo/client';
 
 const DEACTIVATE_INFLUENCER = gql`mutation DeactivateInfluencer($id: String!) { deactivateInfluencer(id: $id) { id isActive } }`;
 const ACTIVATE_INFLUENCER = gql`mutation ActivateInfluencer($id: String!) { activateInfluencer(id: $id) { id isActive } }`;
 
 const FALLBACK = {
   id: '1', name: 'Nova Sterling', bio: 'AI-powered tech influencer.', avatar: '',
   industries: ['Technology', 'SaaS'], contentStyle: 'Professional & Data-Driven', languages: ['English'],
   rating: 4.9, totalProjects: 347, totalReviews: 289, isActive: true, portfolio: [] as any,
 };
 
 export default function InfluencerProfileManagePage() {
   const router = useRouter();
   const params = useParams();
   const { user, isAuthenticated, hydrated } = useAuthStore();
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);

   useEffect(() => {
     if (hydrated && !isAuthenticated) { router.push('/login'); return; }
   }, [hydrated, isAuthenticated]);
 
   const id = params?.id as string;
   const mock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
 
   const { data, loading, refetch } = useQuery(GET_INFLUENCER, {
     variables: { id },
     skip: mock || !id || id.length < 10,
   });
 
   const influencer = (data?.influencer as any) ?? FALLBACK;
 
   const [deactivate, { loading: deactivating }] = useMutation(DEACTIVATE_INFLUENCER, {
     variables: { id: influencer.id },
     onCompleted: () => refetch(),
   });
   const [activate, { loading: activating }] = useMutation(ACTIVATE_INFLUENCER, {
     variables: { id: influencer.id },
     onCompleted: () => refetch(),
   });
 
   const isAdmin = mounted && user?.role === 'ADMIN';
 
   return (
     <>
       <Navbar />
       <main className="min-h-screen pt-20 pb-24">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
             <h1 className="text-3xl font-bold">
               AI Influencer <span className="gradient-text">Profile</span>
             </h1>
             <p className="text-text-secondary mt-1">Overview and management</p>
           </motion.div>
 
           {loading ? (
             <div className="space-y-4">
               <div className="skeleton h-40 rounded-2xl" />
               <div className="skeleton h-20 rounded-2xl" />
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Profile */}
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                 className="glass-card p-6 lg:col-span-1">
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center">
                     <User size={24} className="text-brand-light" />
                   </div>
                   <div>
                     <p className="text-lg font-semibold">{influencer.name}</p>
                     <p className="text-xs text-text-secondary">{influencer.contentStyle}</p>
                   </div>
                 </div>
                 <p className="text-text-secondary text-sm mt-4">{influencer.bio}</p>
                 <div className="mt-4 text-sm">
                   <p>Rating: <span className="font-semibold">{influencer.rating.toFixed(1)}</span></p>
                   <p>Projects: <span className="font-semibold">{influencer.totalProjects}</span></p>
                 </div>
                 <div className="mt-6 flex items-center gap-3">
                   <span className={`text-xs px-2 py-1 rounded-full ${influencer.isActive ? 'text-success bg-success/10' : 'text-text-secondary bg-surface'}`}>
                     {influencer.isActive ? 'Active' : 'Inactive'}
                   </span>
                   <Link href={`/influencers/${influencer.id}`} className="btn-ghost text-sm">View Public Page</Link>
                 </div>
               </motion.div>
 
               {/* Management */}
               <div className="lg:col-span-2 space-y-8">
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                   className="glass-card p-6">
                   <h2 className="text-lg font-semibold mb-4">Management</h2>
                   {!isAdmin ? (
                     <p className="text-sm text-text-secondary">Only Super Admin can manage AI Influencer profiles.</p>
                   ) : (
                     <div className="flex flex-wrap items-center gap-3">
                       {influencer.isActive ? (
                         <button
                           onClick={() => deactivate()}
                           disabled={deactivating}
                           className="btn-ghost flex items-center gap-2"
                         >
                           <PowerOff size={16} /> Deactivate
                         </button>
                       ) : (
                         <button
                           onClick={() => activate()}
                           disabled={activating}
                           className="btn-brand flex items-center gap-2"
                         >
                           <Power size={16} /> Activate
                         </button>
                       )}
                       <Link href="/admin/influencers" className="btn-ghost flex items-center gap-2">
                         <Edit size={16} /> Edit Details
                       </Link>
                     </div>
                   )}
                 </motion.div>
 
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                   className="glass-card p-6">
                   <h2 className="text-lg font-semibold mb-4">Content & Industries</h2>
                   <div className="flex flex-wrap gap-2">
                     {(influencer.industries || []).map((ind: string) => (
                       <span key={ind} className="tag-pill">{ind}</span>
                     ))}
                   </div>
                   <div className="mt-4">
                     <p className="text-xs text-text-secondary">Languages: {(influencer.languages || []).join(', ') || '—'}</p>
                   </div>
                 </motion.div>
               </div>
             </div>
           )}
         </div>
       </main>
       <Footer />
     </>
   );
 }
