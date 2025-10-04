'use client';

import { OrganizationSwitcher, SignInButton, UserButton } from '@clerk/nextjs';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';

export default function NavBar() {
  return (
    <div className="border-b bg-gray-50 p-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="font-bold text-gray-900">EverythingPath</div>
        <div>
          <Unauthenticated>
            <SignInButton />
          </Unauthenticated>
          <Authenticated>
            <div className="flex gap-2">
              <OrganizationSwitcher />
              <UserButton />
            </div>
          </Authenticated>
          <AuthLoading>
            <p>Still loading</p>
          </AuthLoading>
        </div>
      </div>
    </div>
  );
}
