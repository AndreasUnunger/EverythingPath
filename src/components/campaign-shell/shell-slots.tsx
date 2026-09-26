'use client';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '~/lib/utils';

// Positions the shell reserves for the Week frame (#137): the phone status
// strip immediately above the bottom bar, and the save/other-player note in
// the top bar. The shell renders the hosts; the week page fills them through
// portals, so the shell holds none of the week's state.
type SlotName = 'phone-status-strip' | 'top-bar-status';
type Hosts = Partial<Record<SlotName, HTMLElement | null>>;
type Register = (name: SlotName, host: HTMLElement | null) => void;
// Two contexts: the registrar is stable so host refs attach once; the hosts
// change only when a host mounts or unmounts.
const RegisterContext = createContext<Register | null>(null);
const HostsContext = createContext<Hosts>({});

export function ShellSlotProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<Hosts>({});
  const register = useCallback<Register>((name, host) => {
    setHosts((current) =>
      current[name] === host ? current : { ...current, [name]: host },
    );
  }, []);
  return (
    <RegisterContext.Provider value={register}>
      <HostsContext.Provider value={hosts}>{children}</HostsContext.Provider>
    </RegisterContext.Provider>
  );
}

export function ShellSlotHost({
  name,
  className,
}: {
  name: SlotName;
  className?: string;
}) {
  const register = useContext(RegisterContext);
  const ref = useCallback(
    (host: HTMLElement | null) => register?.(name, host),
    [register, name],
  );
  return (
    <div
      ref={ref}
      data-shell-slot={name}
      className={cn('empty:hidden', className)}
    />
  );
}

function ShellSlot({
  name,
  children,
}: {
  name: SlotName;
  children: ReactNode;
}) {
  const host = useContext(HostsContext)[name];
  return host ? createPortal(children, host) : null;
}

/** Phone only: rendered immediately above the bottom bar, below the page. */
export function PhoneStatusStrip({ children }: { children: ReactNode }) {
  return <ShellSlot name="phone-status-strip">{children}</ShellSlot>;
}

/** Top bar, right of the section links at every width. */
export function TopBarStatus({ children }: { children: ReactNode }) {
  return <ShellSlot name="top-bar-status">{children}</ShellSlot>;
}
