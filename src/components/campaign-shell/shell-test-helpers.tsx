import type { ReactNode } from 'react';

// Module shapes for the shell tests' `vi.mock` factories. A factory is
// hoisted above the test file's own declarations, so every control is passed
// as a getter (`() => auth()`), read at render time rather than when the
// factory runs.

export type AuthState = { isLoaded: boolean; isSignedIn?: boolean };
export type ConvexAuthState = { isLoading: boolean; isAuthenticated: boolean };
export type Organization = { id: string; name: string };

export const thursdayTable: Organization = {
  id: 'org',
  name: 'Thursday table',
};

/** `next/link` as a plain anchor. */
export function linkModule() {
  return {
    default: ({
      href,
      children,
      ...props
    }: React.ComponentProps<'a'> & { href: string }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
}

/** Convex's auth gates and hooks, read from `convexAuth` on each render. */
export function convexReactModule(convexAuth: () => ConvexAuthState) {
  const convex = {};
  return {
    useConvex: () => convex,
    useConvexAuth: () => convexAuth(),
    Authenticated: ({ children }: { children: ReactNode }) =>
      convexAuth().isAuthenticated ? children : null,
    Unauthenticated: ({ children }: { children: ReactNode }) =>
      !convexAuth().isLoading && !convexAuth().isAuthenticated
        ? children
        : null,
    AuthLoading: ({ children }: { children: ReactNode }) =>
      convexAuth().isLoading ? children : null,
  };
}

/** The organization list Clerk returns for the given memberships. */
export function organizationList({
  organizations,
  setActive = () => Promise.resolve(),
}: {
  organizations: Organization[];
  setActive?: () => Promise<void>;
}) {
  return {
    isLoaded: true,
    setActive,
    userMemberships: {
      data: organizations.map((organization) => ({ organization })),
      hasNextPage: false,
      isFetching: false,
      fetchNext: () => Promise.resolve(),
    },
  };
}

/**
 * Clerk's hooks and buttons. `UserButton` defaults to a ready avatar button;
 * pass one to stand in for Clerk's `fallback` behavior.
 */
export function clerkModule({
  auth,
  organization,
  clerk,
  organizations,
  user,
  UserButton = () => <button>Account</button>,
}: {
  auth: () => AuthState;
  organization: () => { isLoaded: boolean; organization?: Organization };
  clerk: () => Record<string, unknown>;
  organizations: () => ReturnType<typeof organizationList>;
  user?: () => Record<string, unknown>;
  UserButton?: (props: { fallback?: ReactNode }) => ReactNode;
}) {
  return {
    useAuth: () => auth(),
    useOrganization: () => organization(),
    useClerk: () => clerk(),
    useUser: () => user?.(),
    useOrganizationList: () => organizations(),
    SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
    UserButton,
  };
}

/** `next/navigation`'s router and pathname, read on each call. */
export function navigationModule({
  push = () => undefined,
  pathname,
}: {
  push?: (href: string) => void;
  pathname: () => string;
}) {
  return {
    useRouter: () => ({ push, replace: () => undefined }),
    usePathname: () => pathname(),
  };
}
