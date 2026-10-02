import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { cn } from '~/lib/utils';

// The last line of every frame. One short row of muted text so the bounded
// Week (which cannot scroll past its viewport) keeps its editor room while
// the link stays in view above the phone tabs. The link consults the
// departure guard where a shell provides one and is a plain link elsewhere.
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'text-muted-foreground short:py-0.5 flex shrink-0 flex-wrap items-center gap-x-4 px-3 py-1.5 text-xs md:px-4',
        className,
      )}
    >
      <GuardedLink
        href="/legal"
        className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
      >
        Legal notices
      </GuardedLink>
    </footer>
  );
}
