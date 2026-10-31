import Link from 'next/link';
import { cn } from '~/lib/utils';

export const legalFooterClassName =
  'text-muted-foreground short:py-0.5 flex shrink-0 flex-wrap items-center gap-x-4 px-3 py-1.5 text-xs md:px-4';
export const legalLinkClassName =
  'hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]';

// The legal footer for route fallbacks that stand outside any shell (the
// list's loading frame, the campaigns error frame). No departure guard
// exists there, so the link is a plain one, and the frame pulls in none of
// the shell's Clerk, Convex or Workspace code.
export function StaticLegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn(legalFooterClassName, className)}>
      <Link href="/legal" className={legalLinkClassName}>
        Legal notices
      </Link>
    </footer>
  );
}
