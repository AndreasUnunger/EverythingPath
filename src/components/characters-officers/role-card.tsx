import { useId } from 'react';
import { Badge } from '~/components/ui/badge';
import type { RoleCard } from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import { roleCardId } from './use-characters-page';

const card = 'border-foreground/20 bg-card min-w-0 border p-3';

export function ArchivedBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 font-mono text-[11px] font-normal text-amber-300"
    >
      archived
    </Badge>
  );
}

// A role before the militia exists: its name and nothing to show yet.
export function UnassignedRoleCard({ label }: { label: string }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn(card, 'border-dashed')}>
      <h3 id={headingId} className="font-sans text-lg leading-tight">
        {label}
      </h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Set up militia to assign officers.
      </p>
    </section>
  );
}

// One role on the board: its rule, who holds it, what the rules take from
// them, and the open week's staged changes to it. Focusable so a role chip
// in the table can bring it into view.
export function RoleCardView({ card: role }: { card: RoleCard }) {
  const headingId = useId();
  return (
    <section
      id={roleCardId(role.role)}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn(
        card,
        'focus-visible:ring-ring/50 flex flex-col gap-2 outline-none focus-visible:ring-[3px]',
        role.vacant && 'border-dashed',
      )}
    >
      <div>
        <h3 id={headingId} className="font-sans text-lg leading-tight">
          {role.label}
        </h3>
        <p className="text-muted-foreground text-xs">{role.rule}</p>
      </div>
      {role.holders.length > 0 && (
        <ul className="space-y-1">
          {role.holders.map((holder) => (
            <li
              key={holder.characterId}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              <span
                className={cn(
                  'font-sans [overflow-wrap:anywhere]',
                  holder.archived && 'text-muted-foreground line-through',
                )}
              >
                {holder.name}
              </span>
              {holder.counts && holder.contribution !== null && (
                <span className="text-muted-foreground text-sm">
                  {holder.contribution}
                </span>
              )}
              {!holder.counts && holder.nonStacking !== null && (
                <span className="text-muted-foreground text-sm">
                  {holder.nonStacking}
                </span>
              )}
              {holder.archived && <ArchivedBadge />}
            </li>
          ))}
        </ul>
      )}
      <p
        className={cn(
          'mt-auto font-mono text-xs [overflow-wrap:anywhere]',
          role.vacant && 'text-muted-foreground italic',
        )}
      >
        {role.effect}
        {role.source !== null && ` (${role.source})`}
      </p>
      {role.pending.map((change) => (
        <p
          key={change.key}
          className="text-primary text-sm [overflow-wrap:anywhere]"
        >
          Pending this week: {change.text}
        </p>
      ))}
    </section>
  );
}
