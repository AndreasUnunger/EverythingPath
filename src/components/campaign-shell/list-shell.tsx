'use client';
import type { ReactNode } from 'react';
import { NavigationGuardProvider } from './navigation-guard';
import {
  AccountControl,
  KeepLink,
  OrganizationControl,
  ShellFrame,
  TopBarRow,
} from './shell-frame';

// Campaign list: the organization switcher takes the breadcrumb position;
// campaign pages move it to the right beside the account.
export function ListShell({ children }: { children: ReactNode }) {
  return (
    <NavigationGuardProvider>
      <ShellFrame
        header={
          <TopBarRow>
            <KeepLink />
            <span
              className="text-muted-foreground hidden md:inline"
              aria-hidden
            >
              /
            </span>
            <OrganizationControl />
            <div className="ml-auto flex items-center gap-3">
              <AccountControl />
            </div>
          </TopBarRow>
        }
      >
        {children}
      </ShellFrame>
    </NavigationGuardProvider>
  );
}
