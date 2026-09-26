'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useWorkspaceController } from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import { registerTraversalGuard } from './browser-history';

// One departure decision for links, the campaign switcher, organization
// changes and browser Back/Forward. Pending work is read from the shared
// Workspace store at the moment of the request, never from a copied flag. A
// blocked operation runs once on Leave and never on Stay; a delayed save
// stays bound to the editor's own campaign and draft either way.
export type Departure = { commit: () => void | Promise<void> };
type Guard = {
  requestDeparture: (departure: Departure) => void;
  navigate: (href: string) => void;
  hasPendingWork: () => boolean;
};
const GuardContext = createContext<Guard | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const controller = useWorkspaceController();
  const store = controller?.store;
  const [blocked, setBlocked] = useState<Departure | null>(null);
  const committing = useRef(false);
  const hasPendingWork = useCallback(
    () => store?.getPendingWork() ?? false,
    [store],
  );
  const requestDeparture = useCallback(
    (departure: Departure) => {
      if (committing.current) return;
      if (hasPendingWork()) setBlocked((open) => open ?? departure);
      else void departure.commit();
    },
    [hasPendingWork],
  );
  const navigate = useCallback(
    (href: string) => requestDeparture({ commit: () => router.push(href) }),
    [requestDeparture, router],
  );
  useEffect(
    () =>
      registerTraversalGuard({
        shouldBlock: () => committing.current || hasPendingWork(),
        onBlocked: (intent) =>
          setBlocked((open) => open ?? { commit: intent.commit }),
      }),
    [hasPendingWork],
  );
  const guard = useMemo(
    () => ({ requestDeparture, navigate, hasPendingWork }),
    [requestDeparture, navigate, hasPendingWork],
  );
  return (
    <GuardContext.Provider value={guard}>
      {children}
      <Dialog
        open={blocked !== null}
        onOpenChange={(open) => {
          if (!open) setBlocked(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changes are still saving</DialogTitle>
            <DialogDescription>
              Leaving now may lose changes that have not finished saving. Wait a
              moment, or leave anyway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked(null)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const departure = blocked;
                setBlocked(null);
                if (!departure) return;
                committing.current = true;
                void Promise.resolve(departure.commit()).finally(() => {
                  committing.current = false;
                });
              }}
            >
              Leave anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}

const passthrough: Guard = {
  requestDeparture: (departure) => void departure.commit(),
  navigate: () => undefined,
  hasPendingWork: () => false,
};

export function useNavigationGuard(): Guard {
  return useContext(GuardContext) ?? passthrough;
}

// Runs `onCommit` right before any departure requested inside commits: a
// container (the phone More sheet) closes itself once its choice actually
// leaves, and stays open while the player still decides Stay or Leave.
export function BeforeDeparture({
  onCommit,
  children,
}: {
  onCommit: () => void;
  children: ReactNode;
}) {
  const guard = useNavigationGuard();
  const router = useRouter();
  const wrapped = useMemo<Guard>(() => {
    const requestDeparture = (departure: Departure) =>
      guard.requestDeparture({
        commit: () => {
          onCommit();
          return departure.commit();
        },
      });
    return {
      requestDeparture,
      navigate: (href) => requestDeparture({ commit: () => router.push(href) }),
      hasPendingWork: guard.hasPendingWork,
    };
  }, [guard, onCommit, router]);
  return (
    <GuardContext.Provider value={wrapped}>{children}</GuardContext.Provider>
  );
}

function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

// An ordinary link that consults the guard on a plain left click.
export function GuardedLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const guard = useNavigationGuard();
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !plainClick(event)) return;
        if (guard.hasPendingWork()) {
          event.preventDefault();
          guard.navigate(href);
        }
      }}
      {...props}
    />
  );
}
