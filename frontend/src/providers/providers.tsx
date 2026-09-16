'use client';

import { useEffect } from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/apollo';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/lib/auth';
import { ChatNotifier } from '@/components/chat-notifier';


import { ThemeProvider } from '@/providers/theme-provider';
import { TabNavigationProvider } from '@/providers/tab-navigation-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider>
        <TabNavigationProvider>
          <ChatNotifier />
          {children}
          <Toaster />
        </TabNavigationProvider>
      </ThemeProvider>
    </ApolloProvider>
  );
}
