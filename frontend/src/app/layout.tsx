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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = stored || 'dark';
                  var root = document.documentElement;
                  if (theme === 'light') {
                    root.classList.add('light');
                    root.classList.remove('dark');
                    root.setAttribute('data-theme', 'light');
                  } else {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.setAttribute('data-theme', 'dark');
                  }
                } catch (e) {}
              })();
              // Auto-reload once if an on-demand chunk times out or fails to load
              window.addEventListener('error', function(event) {
                if (event && event.message && /Loading chunk .* failed/i.test(event.message)) {
                  var key = 'chunk_reload_' + (event.filename || 'app');
                  if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, '1');
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${plusJakarta.className} font-sans bg-background text-text-primary min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
