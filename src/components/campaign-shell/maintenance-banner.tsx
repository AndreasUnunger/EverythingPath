'use client';
import { useQuery } from 'convex/react';
import { Wrench } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { cn } from '~/lib/utils';

// Non-blocking: pages stay readable and edit controls stay enabled. A write
// during the pause fails through the ordinary save feedback.
export function MaintenanceBanner({ className }: { className?: string }) {
  const mode = useQuery(api.cutover.status, {});
  if (mode === undefined || mode === 'canonical') return null;
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 border-b border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm',
        className,
      )}
    >
      <Wrench className="size-4 shrink-0" aria-hidden />
      <span>
        Campaign editing is paused for maintenance. Please try again shortly.
      </span>
    </div>
  );
}
