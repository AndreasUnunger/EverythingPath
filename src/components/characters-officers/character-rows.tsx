import { Check, CircleAlert, Minus, Pencil } from 'lucide-react';
import { useId } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  managesText,
  ROLE_LABELS,
  type CharacterRow,
  type OfficerRole,
} from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import { ArchivedBadge, chip, roleCardId, Warnings } from './parts';
import type { RosterRowControl } from './use-character-corrections';

export type RowsProps = {
  rows: CharacterRow[];
  /**
   * Whether the militia exists: without it there is no roster to be on and
   * no role card for a chip to reach.
   */
  hasBoard: boolean;
  teamsHref: string;
  onEdit: (characterId: string) => void;
  /** A row's controls while Correct roster is open; null otherwise. */
  rosterRow: ((characterId: string) => RosterRowControl | null) | null;
};

const dash = <span className="text-muted-foreground">—</span>;
const switchControl =
  'border-foreground/40 bg-foreground/10 before:bg-foreground checked:border-primary checked:bg-primary checked:before:bg-primary-foreground focus-visible:ring-ring/50 relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full border outline-none transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-4.5 before:rounded-full before:transition-transform checked:before:translate-x-4 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

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

// Correct roster: the membership switch, with why a record cannot join yet.
function RosterSwitch({
  name,
  control,
}: {
  name: string;
  control: RosterRowControl;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const blocked = control.cannotJoin !== null;
  return (
    <div className="grid gap-1">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm select-none md:min-h-0">
        <input
          type="checkbox"
          role="switch"
          className={switchControl}
          aria-label={`${name} on roster`}
          checked={control.onRoster}
          disabled={blocked}
          aria-describedby={blocked ? noteId : undefined}
          onChange={(event) => control.setOnRoster(event.target.checked)}
        />
        {control.onRoster ? 'On roster' : 'Not on roster'}
      </label>
      {blocked && (
        <p
          id={noteId}
          className="text-muted-foreground max-w-56 text-xs [overflow-wrap:anywhere] whitespace-normal"
        >
          {control.cannotJoin}
        </p>
      )}
    </div>
  );
}

// Correct roster: the Hit Dice override, its error kept within the cell.
function HitDiceField({
  field,
}: {
  field: NonNullable<RosterRowControl['hitDice']>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1">
      <span className="inline-flex items-center gap-1.5">
        <Input
          {...field.register}
          id={id}
          inputMode="numeric"
          placeholder={field.placeholder}
          aria-label={field.label}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={field.error ? errorId : undefined}
          className="h-11 w-16 font-mono md:h-9"
        />
        <span className="font-mono text-sm">HD</span>
      </span>
      {field.error && (
        <p
          id={errorId}
          className="text-destructive flex max-w-48 items-start gap-1 text-xs [overflow-wrap:anywhere] whitespace-normal"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{field.error}</span>
        </p>
      )}
    </div>
  );
}

function HitDice({
  row,
  control,
}: {
  row: CharacterRow;
  control: RosterRowControl | null;
}) {
  if (control?.hitDice) return <HitDiceField field={control.hitDice} />;
  return <span className="font-mono whitespace-nowrap">{row.hitDice} HD</span>;
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
  rosterRow,
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
        {rows.map((row) => {
          const control = rosterRow?.(row.characterId) ?? null;
          return (
            <tr
              key={row.characterId}
              className={cn(
                'border-foreground/10 border-b',
                row.archived && 'opacity-60',
              )}
            >
              {hasBoard && (
                <td className={cn(td, 'whitespace-nowrap')}>
                  {control ? (
                    <RosterSwitch name={row.name} control={control} />
                  ) : (
                    <OnRoster onRoster={row.onRoster} />
                  )}
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
              <td className={td}>
                <HitDice row={row} control={control} />
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
          );
        })}
      </tbody>
    </table>
  );
}

function CharacterCard({
  row,
  hasBoard,
  teamsHref,
  onEdit,
  rosterRow,
}: { row: CharacterRow } & Omit<RowsProps, 'rows'>) {
  const headingId = useId();
  const control = rosterRow?.(row.characterId) ?? null;
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
        {!control && (
          <span className="font-mono text-sm whitespace-nowrap">
            {row.hitDice} HD
          </span>
        )}
        <div className="-mt-2 -mr-2">
          <EditButton row={row} onEdit={onEdit} />
        </div>
      </div>
      {control && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <RosterSwitch name={row.name} control={control} />
          <HitDice row={row} control={control} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.archived && <ArchivedBadge />}
        {hasBoard && !control && <OnRoster onRoster={row.onRoster} />}
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
