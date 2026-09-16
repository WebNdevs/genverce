import { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 h-screen overflow-hidden bg-background">
        {children}
      </div>
    </>
  );
}
