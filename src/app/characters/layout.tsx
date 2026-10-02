'use client';

import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';
import type { ReactNode } from 'react';
import { NavigationGuardProvider } from '~/components/campaign-shell/navigation-guard';
import {
  AccountControl,
  ShellFrame,
  SignIn,
} from '~/components/campaign-shell/shell-frame';
import { KeepLink, TopBarRow } from '~/components/campaign-shell/top-bar';
import {
  CharacterSheetFrame,
  CharacterSheetSkeleton,
  type BackLink,
} from '~/components/character-sheet/character-sheet-frame';
import { Card } from '~/components/ui/card';

const back: BackLink = { href: '/campaigns', label: 'Campaigns' };

// Private sheets stand outside every campaign and organization, so the top
// bar (approved shell, variant C) carries only the Keep and the account; the
// page scrolls under it with Back above the sheet's body. The Characters
// area and its origin-aware Back arrive with #297.
export default function IndependentCharactersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <NavigationGuardProvider>
      <ShellFrame
        header={
          <TopBarRow>
            <KeepLink />
            <div className="ml-auto flex items-center gap-3">
              <AccountControl />
            </div>
          </TopBarRow>
        }
      >
        <Authenticated>{children}</Authenticated>
        <AuthLoading>
          <CharacterSheetSkeleton back={back} />
        </AuthLoading>
        <Unauthenticated>
          <CharacterSheetFrame back={back}>
            <Card className="gap-3 p-4">
              <p>Sign in to open this character.</p>
              <div>
                <SignIn />
              </div>
            </Card>
          </CharacterSheetFrame>
        </Unauthenticated>
      </ShellFrame>
    </NavigationGuardProvider>
  );
}
