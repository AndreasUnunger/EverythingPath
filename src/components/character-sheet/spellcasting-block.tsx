'use client';
import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { abilityLabels } from '~/lib/character-sheet';
import { spellcastingBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { cn } from '~/lib/utils';
import { action, Block, fieldLabel, formatModifier } from './sheet-parts';
import { StatBreakdown } from './stat-breakdown';
import type { useCharacterSheet } from './use-character-sheet';

type Sheet = NonNullable<ReturnType<typeof useCharacterSheet>['sheet']>;
type Spellcasting = Sheet['calculated']['spellcastings'][number];
type Slot = Spellcasting['slots'][number] & { extra?: number };

// The approved prototype's Spellcasting section (#233, variant 3): one lean
// summary line per casting class, wrapping into a compact card on the phone,
// and under it, on request, the class's numbers beside its per-level table.
// Only calculated numbers live here; Spells themselves are a later slice.

const recordNames: Record<Spellcasting['record'], string> = {
  book: 'Spellbook',
  known: 'Spells known',
  none: 'Whole list',
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
const th = cn(fieldLabel, 'px-1.5 pb-1 text-left font-normal');
const td = 'border-foreground/10 border-t px-1.5 py-1 align-baseline';
const incomplete = 'text-xs text-amber-300';

/** "0", "1st", "2nd"… "9th": a spell level as the class tables print it. */
const spellLevelNames = [
  '0',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
];
const formatSpellLevel = (level: number) =>
  spellLevelNames[level] ?? `${level}th`;

const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

/** A number the sheet cannot state, with its reason for a screen reader. */
function Dash({ reason }: { reason: string }) {
  return (
    <span className="text-muted-foreground font-mono">
      <span aria-hidden>—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

// "Not complete: caster level, save DC." The resolver names what it could
// not settle; the sheet never guesses a number in its place.
function describeUnresolved(unresolved: readonly string[]) {
  if (unresolved.length === 0) return null;
  const names = unresolved.map(
    (key) => unresolvedNames[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2'),
  );
  return `Not complete: ${names.join(', ')}.`;
}

// A Class Level whose class the resolver could not read keeps the section
// honest: it says what is missing instead of "No spellcasting."
function describeGlobalUnresolved(unresolved: readonly string[]) {
  if (unresolved.length === 0) return null;
  const classes = unresolved.filter((reason) =>
    reason.startsWith('class:'),
  ).length;
  if (classes === unresolved.length)
    return classes === 1
      ? 'Not complete: a Class Level has no class yet.'
      : `Not complete: ${classes} Class Levels have no class yet.`;
  return 'Not complete: spellcasting cannot be fully stated yet.';
}

const isAtWill = (casting: Spellcasting, slot: Slot) =>
  slot.spellLevel === 0 && casting.cantrips;

/** "1 base + 1 bonus": how a per-day number is made; null for a bare table number. */
function describeComposition(slot: Slot) {
  const extra = slot.extra ?? 0;
  if (slot.total === null || (slot.bonus === 0 && extra === 0)) return null;
  const parts = [`${slot.base ?? 0} base`];
  if (slot.bonus > 0) parts.push(`${slot.bonus} bonus`);
  if (extra > 0) parts.push(`${extra} extra`);
  return parts.join(' + ');
}

/** One per-day figure: at will, the total, or a dash the sheet can explain. */
function PerDay({
  casting,
  slot,
  className,
}: {
  casting: Spellcasting;
  slot: Slot;
  className?: string;
}) {
  if (isAtWill(casting, slot))
    return <span className={cn('font-mono', className)}>At will</span>;
  if (slot.total === null) return <Dash reason="Not available" />;
  return <span className={cn('font-mono', className)}>{slot.total}</span>;
}

/** Caster level or concentration: its breakdown, or a dash while there is none. */
function CastingFigure({
  casting,
  kind,
  unavailable,
  className,
}: {
  casting: Spellcasting;
  kind: 'casterLevel' | 'concentration';
  unavailable: string;
  className?: string;
}) {
  const statistic = casting[kind];
  if (!statistic) return <Dash reason={unavailable} />;
  const label =
    kind === 'casterLevel'
      ? `${casting.name} caster level`
      : `${casting.name} concentration`;
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

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={fieldLabel}>{label}</span>
      {children}
    </span>
  );
}

// "Per day 0 At will · 1st 2": the strip the summary line carries so a
// player reads the day's allowance without opening anything.
function PerDayStrip({ casting }: { casting: Spellcasting }) {
  if (casting.slots.length === 0)
    return <span className="text-muted-foreground text-sm">No spells yet</span>;
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className={fieldLabel}>Per day</span>
      {casting.slots.map((slot, index) => (
        <span key={slot.spellLevel} className="flex items-baseline gap-x-1">
          {index > 0 ? (
            <span aria-hidden className="text-muted-foreground/60">
              ·
            </span>
          ) : null}
          <span className="text-muted-foreground text-sm">
            {formatSpellLevel(slot.spellLevel)}
          </span>
          <PerDay casting={casting} slot={slot} className="text-sm" />
        </span>
      ))}
    </span>
  );
}

function SaveDc({
  casting,
  slot,
  school,
}: {
  casting: Spellcasting;
  slot: Slot;
  school?: string;
}) {
  const schoolDC = school
    ? slot.schoolDCs.find((candidate) => candidate.school === school)
    : undefined;
  const statistic = school ? schoolDC?.breakdown : slot.dc;
  const unresolved = school ? schoolDC?.unresolved : slot.dcUnresolved;
  if (!statistic) return <Dash reason="Not applicable" />;
  const level = `${formatSpellLevel(slot.spellLevel)}-level`;
  const name = school
    ? `${level} ${capitalize(school)} save DC`
    : `${level} save DC`;
  return (
    <StatBreakdown
      label={`${casting.name} ${name}`}
      statistic={statistic}
      target={spellcastingBreakdownTarget(casting.classEntryId, {
        kind: 'dc',
        spellLevel: slot.spellLevel,
        school,
      })}
      incompleteReason={unresolved ? describeUnresolved(['spellDC']) : null}
      className="min-h-7 text-sm"
    />
  );
}

/** A known or prepared count; a dash where the table has none for this level. */
function Count({ value }: { value: number | null }) {
  if (value === null) return <Dash reason="Not applicable" />;
  return <span className="font-mono">{value}</span>;
}

// Rows are only the spell levels the table has; a school column appears only
// when a slot returned a DC for it. While a breakdown is open the table may
// overflow its frame instead of clipping the panel.
function AllowanceTable({ casting }: { casting: Spellcasting }) {
  const schools = [
    ...new Set(
      casting.slots.flatMap((slot) =>
        slot.schoolDCs.map((candidate) => candidate.school),
      ),
    ),
  ];
  const hasKnown = casting.slots.some((slot) => slot.known !== null);
  const hasPrepared = casting.slots.some((slot) => slot.prepared !== null);
  return (
    <div className="-mx-1 min-w-0 overflow-x-auto px-1 has-[[aria-expanded=true]]:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{casting.name} spell allowances</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Spell level
            </th>
            <th scope="col" className={th}>
              Per day
            </th>
            {hasKnown ? (
              <th scope="col" className={th}>
                Known
              </th>
            ) : null}
            {hasPrepared ? (
              <th scope="col" className={th}>
                Prepared
              </th>
            ) : null}
            <th scope="col" className={th}>
              Save DC
            </th>
            {schools.map((school) => (
              <th key={school} scope="col" className={th}>
                {capitalize(school)} DC
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {casting.slots.map((slot) => {
            const composition = describeComposition(slot);
            return (
              <tr key={slot.spellLevel}>
                <th scope="row" className={cn(td, 'text-left font-mono')}>
                  {formatSpellLevel(slot.spellLevel)}
                </th>
                <td className={td}>
                  <PerDay casting={casting} slot={slot} className="text-base" />
                  {composition ? (
                    <span className="text-muted-foreground block text-xs">
                      {composition}
                    </span>
                  ) : null}
                </td>
                {hasKnown ? (
                  <td className={td}>
                    <Count value={slot.known} />
                  </td>
                ) : null}
                {hasPrepared ? (
                  <td className={td}>
                    <Count value={slot.prepared} />
                  </td>
                ) : null}
                <td className={td}>
                  <SaveDc casting={casting} slot={slot} />
                </td>
                {schools.map((school) => (
                  <td key={school} className={td}>
                    <SaveDc casting={casting} slot={slot} school={school} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className={fieldLabel}>{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2 text-sm">
        {children}
      </dd>
    </>
  );
}

// The casting level is the table row; the caster level is what the spells
// use, offset and Modifiers included. Both are stated so the difference
// (a paladin's −3, a trait's +1) is visible rather than puzzling.
function CastingNumbers({
  casting,
  id,
}: {
  casting: Spellcasting;
  id: string;
}) {
  const headingId = useId();
  const ability = abilityLabels[casting.ability];
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-foreground/10 mt-2 border-t pt-3"
    >
      <h3 id={headingId} className="mb-2 font-sans text-base">
        {casting.name} spellcasting
      </h3>
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
          <Figure label="Casting level">
            <span className="font-mono">{casting.castingLevel}</span>
          </Figure>
          <Figure label="Caster level">
            <span className="font-mono">
              {casting.casterLevel ? (
                casting.casterLevel.total
              ) : (
                <Dash reason="Not available" />
              )}
            </span>
          </Figure>
          <Figure label="Concentration">
            <span className="font-mono">
              {casting.concentration ? (
                formatModifier(casting.concentration.total)
              ) : (
                <Dash reason="Not available" />
              )}
            </span>
          </Figure>
          <Figure label="Casting ability">
            <span>{ability}</span>
            <span className="text-muted-foreground text-xs">
              Bonus spells use permanent {ability}.
            </span>
          </Figure>
        </dl>
        {casting.slots.length === 0 ? (
          <p className="text-muted-foreground self-center text-sm">
            No spells yet: the {casting.name.toLowerCase()} table starts later.
          </p>
        ) : (
          <AllowanceTable casting={casting} />
        )}
      </div>
    </section>
  );
}

// One class's line: name and recording model, caster level, concentration,
// the per-day strip, what is still unresolved, and the button that opens its
// numbers. The open state lives here, so a class that disappears takes its
// own disclosure with it and no other.
function CastingSummary({ casting }: { casting: Spellcasting }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const unresolved = describeUnresolved(casting.unresolved);
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex min-w-0 basis-full flex-wrap items-baseline gap-x-2 md:basis-auto">
          <span className="font-sans text-base">{casting.name}</span>
          <span className="text-muted-foreground text-xs">
            {recordNames[casting.record]}
          </span>
        </span>
        <span className="flex items-baseline gap-x-3">
          <Labelled label="CL">
            <CastingFigure
              casting={casting}
              kind="casterLevel"
              unavailable="Caster level not available"
              className="min-h-7 text-sm"
            />
          </Labelled>
          <Labelled label="Conc">
            <CastingFigure
              casting={casting}
              kind="concentration"
              unavailable="Concentration not available"
              className="min-h-7 text-sm"
            />
          </Labelled>
        </span>
        <PerDayStrip casting={casting} />
        {unresolved ? <span className={incomplete}>{unresolved}</span> : null}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            action,
            'text-primary inline-flex basis-full items-center gap-1 text-sm hover:underline md:ml-auto md:basis-auto',
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          View {casting.name} spellcasting
        </button>
      </div>
      {isOpen ? <CastingNumbers casting={casting} id={panelId} /> : null}
    </li>
  );
}

/**
 * The Spellcasting section of the Full living sheet: each casting class on
 * its own line with its caster level, concentration and per-day strip, its
 * numbers and allowance table a tap away. A Character with no casting class
 * says so; one whose Class Levels the resolver could not read says that
 * instead, since missing class data is not the absence of spellcasting.
 */
export function SpellcastingBlock({
  spellcastings,
  unresolved,
}: {
  spellcastings: Sheet['calculated']['spellcastings'];
  unresolved: Sheet['calculated']['spellcastingUnresolved'];
}) {
  const globalUnresolved = describeGlobalUnresolved(unresolved);
  return (
    <Block
      title="Spellcasting"
      aside={
        globalUnresolved ? (
          <p className={incomplete}>{globalUnresolved}</p>
        ) : null
      }
    >
      {spellcastings.length === 0 ? (
        globalUnresolved ? null : (
          <p className="text-muted-foreground text-sm">No spellcasting.</p>
        )
      ) : (
        <ul className="divide-foreground/10 -my-2 divide-y">
          {spellcastings.map((casting) => (
            <CastingSummary key={casting.classEntryId} casting={casting} />
          ))}
        </ul>
      )}
    </Block>
  );
}
