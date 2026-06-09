import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/providers/providers';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Genverce — AI Influencer Marketplace',
  description:
    'Hire AI influencers. Get professional content. No negotiations. No delays. The future of influence is AI.',
  keywords: [
    'AI influencer',
    'AI marketing',
    'video generation',
    'influencer marketplace',
    'AI content creation',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${plusJakarta.variable} font-sans bg-background text-text-primary min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
