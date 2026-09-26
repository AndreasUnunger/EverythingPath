'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

// Client-side links bypass the week editor's page-exit warning. Editors
// register pending work here so shell navigation asks before leaving; a
// delayed save stays bound to the editor's own campaign and draft either way.
type Guard = {
  pending: boolean;
  setPending: (pending: boolean) => void;
  navigate: (href: string) => void;
};
const GuardContext = createContext<Guard>({
  pending: false,
  setPending: () => undefined,
  navigate: () => undefined,
});

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const navigate = useCallback(
    (href: string) => {
      if (pending) setBlocked(href);
      else router.push(href);
    },
    [pending, router],
  );
  const guard = useMemo(
    () => ({ pending, setPending, navigate }),
    [pending, navigate],
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
                const href = blocked;
                setBlocked(null);
                if (href) router.push(href);
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

export function useNavigationGuard() {
  return useContext(GuardContext);
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
        if (guard.pending) {
          event.preventDefault();
          guard.navigate(href);
        }
      }}
      {...props}
    />
  );
}
