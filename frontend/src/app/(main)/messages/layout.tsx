import { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
