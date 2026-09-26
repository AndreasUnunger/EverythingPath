import '~/styles/globals.css';
import { type Metadata, type Viewport } from 'next';
import { ConvexClientProvider } from 'ConvexClientProvider';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import ConvexQueryCacheProviderClientComponent from 'ConvexQueryCacheProvider';
import { BrowserHistoryAdapter } from '~/components/campaign-shell/browser-history-adapter';
import type React from 'react';
import { Cinzel, VT323, MedievalSharp } from 'next/font/google';

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

// Phone shell: `cover` makes the safe-area insets real so the bottom bar and
// top bar pad around the home indicator and notch; `resizes-content` shrinks
// the layout viewport under the on-screen keyboard, so the sticky bottom bar
// and a focused field stay above it instead of underneath.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

// Each route renders its own top bar: the campaign list keeps the
// organization switcher in the breadcrumb, campaign pages the campaign switcher.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
              <BrowserHistoryAdapter />
              {children}
            </ConvexQueryCacheProviderClientComponent>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
