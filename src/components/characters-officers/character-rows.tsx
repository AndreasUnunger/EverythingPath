import { Check, Minus, Pencil, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import {
  managesText,
  ROLE_LABELS,
  type CharacterRow,
  type OfficerRole,
} from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import { ArchivedBadge } from './role-card';
import { roleCardId } from './use-characters-page';

export type RowsProps = {
  rows: CharacterRow[];
  /**
   * Whether the militia exists: without it there is no roster to be on and
   * no role card for a chip to reach.
   */
  hasBoard: boolean;
  teamsHref: string;
  onEdit: (characterId: string) => void;
};

const chip =
  'border-foreground/40 inline-flex items-center border px-1.5 py-0.5 font-mono text-xs leading-tight';
const dash = <span className="text-muted-foreground">—</span>;

// Brings the role's card into view and moves focus to it.
function showRoleCard(role: OfficerRole) {
  const card = document.getElementById(roleCardId(role));
  if (!card) return;
  card.scrollIntoView({ block: 'center' });
  card.focus({ preventScroll: true });
}

function KindChip({ kind }: { kind: CharacterRow['kind'] }) {
  return (
    <span className={cn(chip, kind === 'pc' && 'border-primary text-primary')}>
      {kind === 'pc' ? 'PC' : 'NPC'}
    </span>
  );
}

function OnRoster({ onRoster }: { onRoster: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {onRoster ? (
        <Check aria-hidden className="size-4 shrink-0" />
      ) : (
        <Minus aria-hidden className="text-muted-foreground size-4 shrink-0" />
      )}
      {onRoster ? 'On roster' : 'Not on roster'}
    </span>
  );
}

function RoleChips({
  roles,
  hasBoard,
}: {
  roles: OfficerRole[];
  hasBoard: boolean;
}) {
  if (!hasBoard || roles.length === 0) return dash;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {roles.map((role) => (
        <button
          key={role}
          type="button"
          title={`Show the ${ROLE_LABELS[role]} card`}
          className={cn(
            chip,
            'focus-visible:ring-ring/50 hover:bg-foreground/5 min-h-11 outline-none focus-visible:ring-[3px] md:min-h-0',
          )}
          onClick={() => showRoleCard(role)}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </span>
  );
}

function Teams({
  manages,
  href,
}: {
  manages: CharacterRow['manages'];
  href: string;
}) {
  if (manages === null) return dash;
  return (
    <GuardedLink
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center text-sm underline underline-offset-4 md:min-h-0',
        manages.count > manages.limit && 'text-amber-300',
      )}
    >
      {managesText(manages)}
    </GuardedLink>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  return warnings.map((warning) => (
    <p
      key={warning}
      className="flex items-start gap-1.5 text-sm text-amber-300"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{warning}</span>
    </p>
  ));
}

function EditButton({
  row,
  onEdit,
}: {
  row: CharacterRow;
  onEdit: RowsProps['onEdit'];
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 md:size-9"
      aria-label={`Edit ${row.name}`}
      onClick={() => onEdit(row.characterId)}
    >
      <Pencil />
    </Button>
  );
}

const th =
  'text-muted-foreground px-2 py-2 text-left font-mono text-xs font-normal tracking-wide uppercase';
const td = 'px-2 py-2 align-top';

// From 768px: one row per character.
export function CharacterTable({
  rows,
  hasBoard,
  teamsHref,
  onEdit,
}: RowsProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-foreground/20 border-b">
          {hasBoard && (
            <th scope="col" className={th}>
              On roster
            </th>
          )}
          <th scope="col" className={cn(th, 'w-full')}>
            Character
          </th>
          <th scope="col" className={th}>
            Kind
          </th>
          <th scope="col" className={cn(th, 'whitespace-nowrap')}>
            Hit Dice
          </th>
          <th scope="col" className={cn(th, 'whitespace-nowrap')}>
            Officer roles
          </th>
          <th scope="col" className={th}>
            Teams
          </th>
          <th scope="col" className={th}>
            <span className="sr-only">Edit</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.characterId}
            className={cn(
              'border-foreground/10 border-b',
              row.archived && 'opacity-60',
            )}
          >
            {hasBoard && (
              <td className={cn(td, 'whitespace-nowrap')}>
                <OnRoster onRoster={row.onRoster} />
              </td>
            )}
            <th scope="row" className={cn(td, 'text-left font-normal')}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-base font-semibold [overflow-wrap:anywhere]">
                  {row.name}
                </span>
                {row.archived && <ArchivedBadge />}
              </span>
              <Warnings warnings={row.warnings} />
            </th>
            <td className={td}>
              <KindChip kind={row.kind} />
            </td>
            <td className={cn(td, 'font-mono whitespace-nowrap')}>
              {row.hitDice} HD
            </td>
            <td className={td}>
              <RoleChips roles={row.roles} hasBoard={hasBoard} />
            </td>
            <td className={cn(td, 'whitespace-nowrap')}>
              <Teams manages={row.manages} href={teamsHref} />
            </td>
            <td className={cn(td, 'py-1 text-right')}>
              <EditButton row={row} onEdit={onEdit} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CharacterCard({
  row,
  hasBoard,
  teamsHref,
  onEdit,
}: { row: CharacterRow } & Omit<RowsProps, 'rows'>) {
  const headingId = useId();
  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        'border-foreground/20 bg-card min-w-0 space-y-2 border p-3',
        row.archived && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <h3
          id={headingId}
          className="min-w-0 flex-1 font-sans text-lg leading-tight [overflow-wrap:anywhere]"
        >
          {row.name}
        </h3>
        <KindChip kind={row.kind} />
        <span className="font-mono text-sm whitespace-nowrap">
          {row.hitDice} HD
        </span>
        <div className="-mt-2 -mr-2">
          <EditButton row={row} onEdit={onEdit} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.archived && <ArchivedBadge />}
        {hasBoard && <OnRoster onRoster={row.onRoster} />}
        <RoleChips roles={row.roles} hasBoard={hasBoard} />
        <Teams manages={row.manages} href={teamsHref} />
      </div>
      <Warnings warnings={row.warnings} />
    </li>
  );
}

// Below 768px: one card per character with the same facts as a table row.
export function CharacterCards({ rows, ...props }: RowsProps) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <CharacterCard key={row.characterId} row={row} {...props} />
      ))}
    </ul>
  );
}
