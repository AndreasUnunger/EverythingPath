'use client';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';

export type Organization = { id: string; name: string };
export type Session =
  | { kind: 'resolving' }
  | { kind: 'signed_out' }
  | { kind: 'no_organization' }
  | { kind: 'member'; organization: Organization };

// Who is asking: sign-in and active organization must both be settled before
// any campaign list is read, so nothing from a previous organization shows.
export function useSession(): Session {
  const auth = useAuth();
  const { organization, isLoaded: organizationLoaded } = useOrganization();
  const convexAuth = useConvexAuth();
  if (!auth.isLoaded || !organizationLoaded || convexAuth.isLoading)
    return { kind: 'resolving' };
  if (auth.isSignedIn !== true || !convexAuth.isAuthenticated)
    return { kind: 'signed_out' };
  if (!organization) return { kind: 'no_organization' };
  return {
    kind: 'member',
    organization: { id: organization.id, name: organization.name },
  };
}
