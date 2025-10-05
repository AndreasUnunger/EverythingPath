import '~/styles/globals.css';

import { type Metadata } from 'next';
import { Geist } from 'next/font/google';

import { ConvexClientProvider } from 'ConvexClientProvider';
import { ClerkProvider } from '@clerk/nextjs';
import NavBar from '~/components/NavBar';
import ConvexQueryCacheProviderClientComponent from 'ConvexQueryCacheProvider';

export const metadata: Metadata = {
  title: 'EverythingPath',
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
              <>
                <NavBar />
                {children}
              </>
            </ConvexQueryCacheProviderClientComponent>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
