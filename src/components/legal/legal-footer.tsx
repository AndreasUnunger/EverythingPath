import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { cn } from '~/lib/utils';
import {
  legalFooterClassName,
  legalLinkClassName,
} from './static-legal-footer';

// The last line of every frame. One short row of muted text so the bounded
// Week (which cannot scroll past its viewport) keeps its editor room while
// the link stays in view above the phone tabs. The link consults the
// departure guard where a shell provides one and is a plain link elsewhere.
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn(legalFooterClassName, className)}>
      <GuardedLink href="/legal" className={legalLinkClassName}>
        Legal notices
      </GuardedLink>
    </footer>
  );
}
