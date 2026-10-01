'use client';
// PROTOTYPE (throwaway, #208) — small shell controls copied from the
// approved app shell (`app-shell-prototype/parts.tsx` and
// `variant-c-parts.tsx`): org switcher and avatar stand-ins, the
// presentation status badge, top-bar link, phone tab primitives, More tab.
import { MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { ORGS } from '../mock-characters';
import type { Icon } from './model';

/** Stand-in for OrganizationControl: a Select over the mock orgs. */
export function MockOrgSwitcher({
  fill = false,
  className,
}: {
  /** Take the row's full width (phone More sheet) instead of a bar-sized cap. */
  fill?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(ORGS[0]!.id);
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger
        aria-label="Organization"
        className={cn(
          'min-h-8 min-w-0 border-0 bg-transparent px-1 text-sm shadow-none *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate dark:bg-transparent',
          fill
            ? 'w-full flex-1'
            : 'max-w-[10rem] md:max-w-[8rem] xl:max-w-[14rem]',
          className,
        )}
      >
        <SelectValue placeholder="Organization" />
      </SelectTrigger>
      <SelectContent>
        {ORGS.map((org) => (
          <SelectItem key={org.id} value={org.id} className="min-h-11">
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Stand-in for Clerk's UserButton: round initials. */
export function MockAvatar({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Account: Andreas"
      className={cn(
        'bg-primary text-primary-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      AU
    </button>
  );
}

/** A section link styled like the real top-bar links, as a button. */
export function NavLink({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

export const phoneTabClass =
  'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset';
const phoneTabActiveClass =
  'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]';
export const phoneTabIdleClass = 'text-muted-foreground hover:text-foreground';

export function PhoneTab({
  icon: TabIcon,
  label,
  active,
  disabled = false,
  onClick,
}: {
  icon: Icon;
  label: string;
  active: boolean;
  /** Keeps the slot, dims it; onClick still fires so the tab can explain. */
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        phoneTabClass,
        active ? phoneTabActiveClass : phoneTabIdleClass,
        disabled && 'text-muted-foreground/40 hover:text-muted-foreground/40',
      )}
    >
      <TabIcon className="size-5" aria-hidden />
      <span aria-hidden>{label}</span>
    </button>
  );
}

/** The phone bottom bar frame: equal slots, hidden from tablet width. */
export function PhoneBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav aria-label="Sections" className="grid auto-cols-fr grid-flow-col">
        {children}
      </nav>
    </div>
  );
}

function MoreGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-2 border-b py-3 last:border-b-0"
    >
      <p className="text-muted-foreground text-xs tracking-widest uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/** The More tab: organization and account, the same in every place. */
export function MoreTab() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(phoneTabClass, phoneTabIdleClass)}>
        <MoreHorizontal className="size-5" aria-hidden />
        More
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Organization and account.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col px-4 pb-4">
          <MoreGroup label="Organization">
            <MockOrgSwitcher fill />
          </MoreGroup>
          <MoreGroup label="Account">
            <div className="flex items-center gap-3 px-1">
              <MockAvatar />
              <span className="text-sm">Andreas</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto min-h-11"
              >
                Sign out
              </Button>
            </div>
          </MoreGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
