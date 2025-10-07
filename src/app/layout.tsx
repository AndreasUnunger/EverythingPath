import '~/styles/globals.css';
import { type Metadata } from 'next';
import { ConvexClientProvider } from 'ConvexClientProvider';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import ConvexQueryCacheProviderClientComponent from 'ConvexQueryCacheProvider';
import {
  OnlyMobileSidebarTrigger,
  SidebarInset,
  SidebarProvider,
} from '~/components/ui/sidebar';
import AppSidebar from './appSidebar';
import type React from 'react';
import { Cinzel, VT323, MedievalSharp } from 'next/font/google';
import { cookies } from 'next/headers';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
  weight: ['400', '700'],
});

const vt323 = VT323({
  subsets: ['latin'],
  variable: '--font-vt323',
  display: 'swap',
  weight: ['400'],
});

const medievalSharp = MedievalSharp({
  subsets: ['latin'],
  variable: '--font-medieval',
  display: 'swap',
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'Keepnet',
  description: 'Arcane communication through the mycelial network',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${vt323.variable} ${medievalSharp.variable} antialiased`}
    >
      <body className="vsc-initialized retro-grid scanlines bg-background text-foreground">
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            elements: {
              card: 'bg-background border-foreground/20',
              socialButtonsBlockButton:
                'border-foreground/20 hover:bg-foreground/10',
              dividerLine: 'bg-foreground/20',
              dividerText: 'text-foreground/40',
              formFieldInput:
                'bg-background border-foreground/20 focus:border-foreground/40',
              formButtonPrimary:
                'bg-primary text-primary-foreground hover:bg-primary/90',
              footerActionLink: 'text-primary hover:text-primary/90',
            },
          }}
        >
          <ConvexClientProvider>
            <ConvexQueryCacheProviderClientComponent>
              <SidebarProvider defaultOpen={defaultOpen}>
                <AppSidebar />
                <SidebarInset className="px-2">{children}</SidebarInset>
                <OnlyMobileSidebarTrigger />
              </SidebarProvider>
            </ConvexQueryCacheProviderClientComponent>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
