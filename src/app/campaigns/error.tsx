'use client';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { StaticLegalFooter } from '~/components/legal/static-legal-footer';

// Replaces the list and campaign shells, so it closes with its own legal
// footer.
export default function CampaignsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:p-6">
        <FailedLoadCard noun="Campaigns" retry={reset} />
      </main>
      <StaticLegalFooter />
    </div>
  );
}
