import { CampaignHomeSkeleton } from '~/components/campaign-home/campaign-home-status';
import { Skeleton } from '~/components/ui/skeleton';

// Route fallback while the campaigns segment streams in: the list shell's
// frame and top bar as static placeholders (Keep icon, organization switcher,
// account control) above the same skeleton the home screen shows while it
// resolves, so nothing jumps when the real shell mounts. The frame and row
// classes mirror ShellFrame and TopBarRow, which are not imported here because
// they pull in Clerk, Convex and the maintenance banner. The screen reader
// announcement ("Loading campaigns…") lives inside CampaignHomeSkeleton.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header
        aria-hidden
        className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]"
      >
        <div className="short:gap-y-0.5 short:py-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 md:gap-x-4 md:px-4 md:py-2">
          <Skeleton className="size-8 shrink-0 rounded-sm" />
          <Skeleton className="hidden h-4 w-1.5 md:block" />
          <Skeleton className="h-8 w-28" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <CampaignHomeSkeleton />
      </div>
    </div>
  );
}
