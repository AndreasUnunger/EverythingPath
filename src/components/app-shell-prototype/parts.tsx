'use client';
// PROTOTYPE — small shared static controls (not layout) for the app-shell
// prototype. Variants may use or ignore them.
import type { ReactNode } from 'react';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { orgs, type Status } from './mock';

/** Stand-in for OrganizationControl: a Select over the mock orgs. */
export function MockOrgSwitcher({
  value,
  onChange,
  fill = false,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Take the row's full width (phone More sheet) instead of a bar-sized cap. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
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
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.id} className="min-h-11">
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Stand-in for Clerk's UserButton: round initials. */
export function MockAvatar({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Account: Andreas"
      onClick={onClick}
      className={cn(
        'bg-primary text-primary-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      AU
    </button>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[11px] font-normal',
        status === 'militia-only'
          ? 'border-amber-500/60 text-amber-300'
          : 'border-foreground/40 text-muted-foreground',
        className,
      )}
    >
      {status === 'militia-only' ? 'Militia-only' : 'Full'}
    </Badge>
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
