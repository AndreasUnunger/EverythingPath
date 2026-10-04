'use client';
import { spellcastingBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { cn } from '~/lib/utils';
import { formatModifier } from './sheet-parts';
import { StatBreakdown } from './stat-breakdown';
import type { useCharacterSheet } from './use-character-sheet';

// Small pieces the sheet's Spellcasting section and the Spells page share:
// the casting row type, spell level names, the explained dash and the
// per-day figure.

type Sheet = NonNullable<ReturnType<typeof useCharacterSheet>['sheet']>;
export type Spellcasting = Sheet['calculated']['spellcastings'][number];
export type SpellcastingSlot = Spellcasting['slots'][number] & {
  extra?: number;
};

const unresolvedNames: Record<string, string> = {
  casterLevel: 'caster level',
  concentration: 'concentration',
  spellDC: 'save DC',
  casting: 'casting',
  castingLevel: 'casting level',
  table: 'spell table',
  spellKind: 'spell kind',
};

/** "0", "1st", "2nd", "3rd", "4th"… "11th", "21st": a spell level as the class tables print it. */
export function formatSpellLevel(level: number) {
  if (level === 0) return '0';
  const lastTwo = level % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${level}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th';
  return `${level}${suffix}`;
}

/** "0-level", "1st-level": the heading of one spell level's Spells. */
export const formatSpellLevelHeading = (level: number) =>
  `${formatSpellLevel(level)}-level`;

/**
 * The witch's familiar recording model keeps its Spells on the witch (#326);
 * other collections need no note.
 */
export function describeCollectionNote(
  casting: Pick<Spellcasting, 'record' | 'bookType'> | null | undefined,
) {
  return casting?.record === 'book' && casting.bookType === 'familiar'
    ? 'Witch Spells stay with the witch through familiar replacement and restoration.'
    : null;
}

export const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

/** A number the sheet cannot state, with its reason for a screen reader. */
export function Dash({ reason }: { reason: string }) {
  return (
    <span className="text-muted-foreground font-mono">
      <span aria-hidden>—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

// "Not complete: caster level, save DC." The resolver names what it could
// not settle; the sheet never guesses a number in its place.
export function describeUnresolved(unresolved: readonly string[]) {
  if (unresolved.length === 0) return null;
  const names = unresolved.map(
    (key) => unresolvedNames[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2'),
  );
  return `Not complete: ${names.join(', ')}.`;
}

const isAtWill = (casting: Spellcasting, slot: SpellcastingSlot) =>
  slot.spellLevel === 0 && casting.cantrips;

/** One per-day figure: at will, the total, or a dash the sheet can explain. */
export function PerDay({
  casting,
  slot,
  className,
}: {
  casting: Spellcasting;
  slot: SpellcastingSlot;
  className?: string;
}) {
  if (isAtWill(casting, slot))
    return <span className={cn('font-mono', className)}>At will</span>;
  if (slot.total === null) return <Dash reason="Not available" />;
  return <span className={cn('font-mono', className)}>{slot.total}</span>;
}

/** Caster level or concentration: its breakdown, or a dash while there is none. */
export function CastingFigure({
  casting,
  kind,
  className,
}: {
  casting: Spellcasting;
  kind: 'casterLevel' | 'concentration';
  className?: string;
}) {
  const statistic = casting[kind];
  const label =
    kind === 'casterLevel'
      ? `${casting.name} caster level`
      : `${casting.name} concentration`;
  if (!statistic)
    return (
      <Dash
        reason={
          kind === 'casterLevel'
            ? 'Caster level not available'
            : 'Concentration not available'
        }
      />
    );
  return (
    <StatBreakdown
      label={label}
      statistic={statistic}
      target={spellcastingBreakdownTarget(casting.classEntryId, { kind })}
      format={kind === 'concentration' ? formatModifier : String}
      incompleteReason={
        casting.unresolved.includes(kind) ? describeUnresolved([kind]) : null
      }
      className={className}
    />
  );
}
