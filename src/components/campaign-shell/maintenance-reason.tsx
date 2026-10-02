import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';

// Why the save control beside it is disabled, in the notice's own words.
// Plain text: the shell's banner is the one live region that announces it.
export function MaintenanceReason({
  notice,
  id,
  className,
}: {
  notice: MigrationMaintenance;
  id?: string;
  className?: string;
}) {
  if (!notice.readOnly) return null;
  return (
    <p
      id={id}
      data-maintenance-reason
      className={cn('text-muted-foreground w-full text-sm', className)}
    >
      {notice.message}
    </p>
  );
}
