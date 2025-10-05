import '~/styles/globals.css';

import { type Metadata } from 'next';
import { Geist } from 'next/font/google';

import { ConvexClientProvider } from 'ConvexClientProvider';
import { ClerkProvider } from '@clerk/nextjs';
import ConvexQueryCacheProviderClientComponent from 'ConvexQueryCacheProvider';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '~/components/ui/sidebar';
import AppSidebar from './appSidebar';

export const metadata: Metadata = {
  title: 'Campfire Ledger',
  description: 'Big tings',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
};

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            <ConvexQueryCacheProviderClientComponent>
              <SidebarProvider>
                <AppSidebar />
                <SidebarTrigger />
                <SidebarInset>{children}</SidebarInset>
              </SidebarProvider>
            </ConvexQueryCacheProviderClientComponent>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
