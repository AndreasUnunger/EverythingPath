'use client';
import { SignInButton, UserButton } from '@clerk/nextjs';
import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import { GuardedLink } from './navigation-guard';
import { MaintenanceBanner } from './maintenance-banner';

export { OrganizationControl } from './organization-control';

// The page column fills the dynamic viewport so a phone bottom bar sticks to
// its real end while browser chrome collapses, and safe areas pad the edges.
// `boundedOnDesktop` (the Week route from 1280px) caps the frame at the
// viewport so the week host scrolls inside the remaining space; every other
// page keeps document scrolling. The maintenance banner sits above the top
// bar on phone and below it from tablet width.
export function ShellFrame({
  header,
  children,
  footer,
  boundedOnDesktop = false,
}: {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  boundedOnDesktop?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
        boundedOnDesktop && 'xl:h-dvh xl:overflow-hidden',
      )}
    >
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]">
        <MaintenanceBanner className="order-first md:order-last" />
        {header}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {footer}
    </div>
  );
}

// Items may wrap onto a second row on narrow tablets instead of overlapping;
// every control keeps its own bounded width so nothing covers a section link.
export function TopBarRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 md:gap-x-4 md:px-4 md:py-2">
      {children}
    </div>
  );
}

export function KeepLink() {
  return (
    <GuardedLink
      href="/campaigns"
      aria-label="Keep: all campaigns"
      className="text-primary hover:text-primary/80 focus-visible:ring-ring/50 shrink-0 rounded-sm outline-none focus-visible:ring-[3px]"
    >
      <KeepIcon className="size-8" />
    </GuardedLink>
  );
}

export function SignIn() {
  const pathname = usePathname();
  return (
    <SignInButton mode="redirect" fallbackRedirectUrl={pathname}>
      <Button size="sm">Sign in</Button>
    </SignInButton>
  );
}

export function AccountControl() {
  return (
    <>
      <Authenticated>
        <UserButton />
      </Authenticated>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <AuthLoading>
        <Skeleton
          role="status"
          aria-label="Loading account"
          className="size-8 rounded-full"
        />
      </AuthLoading>
    </>
  );
}
