'use client';
import { useId, type ReactNode } from 'react';
import { abilityLabels } from '~/lib/character-sheet';
import { spellcastingBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { cn } from '~/lib/utils';
import { fieldLabel, formatModifier } from './sheet-parts';
import {
  capitalize,
  CastingFigure,
  Dash,
  describeUnresolved,
  formatSpellLevel,
  PerDay,
  type Spellcasting,
  type SpellcastingSlot,
} from './spellcasting-parts';
import { SheetStatistic } from './sheet-statistic';

const th = cn(fieldLabel, 'px-1.5 pb-1 text-left font-normal');
const td = 'border-foreground/10 border-t px-1.5 py-1 align-baseline';

/** "1 base + 1 bonus": how a per-day number is made; null for a bare table number. */
function describeComposition(slot: SpellcastingSlot) {
  const extra = slot.extra ?? 0;
  if (slot.total === null || (slot.bonus === 0 && extra === 0)) return null;
  const parts = [`${slot.base ?? 0} base`];
  if (slot.bonus > 0) parts.push(`${slot.bonus} bonus`);
  if (extra > 0) parts.push(`${extra} extra`);
  return parts.join(' + ');
}

function SaveDc({
  casting,
  slot,
  school,
}: {
  casting: Spellcasting;
  slot: SpellcastingSlot;
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
  const target = spellcastingBreakdownTarget(casting.classEntryId, {
    kind: 'dc',
    spellLevel: slot.spellLevel,
    school,
  });
  const incompleteReason = unresolved ? describeUnresolved(['spellDC']) : null;
  return (
    <>
      <SheetStatistic
        label={`${casting.name} ${name}`}
        statistic={statistic}
        target={target}
        incompleteReason={incompleteReason}
        className="min-h-7 text-sm"
        alternates={{ isStacked: true, className: 'items-start' }}
      />
    </>
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

/**
 * One Spellcasting's numbers: casting level, caster level, concentration and
 * ability beside its per-level allowance table, every number explained by
 * the shared breakdown. The casting level is the table row; the caster level
 * is what the spells use, offset and Modifiers included. Both are stated so
 * the difference (a paladin's −3, a trait's +1) is visible rather than
 * puzzling. The sheet opens it under a summary line, whose caster level
 * and concentration already open their breakdowns; the Spells page shows it
 * alone for the selected Spellcasting, so there those figures open theirs.
 */
export function SpellcastingNumbers({
  casting,
  id,
  isHeadingVisible = true,
  hasFigureBreakdowns = false,
  className = 'border-foreground/10 mt-2 border-t pt-3',
}: {
  casting: Spellcasting;
  id?: string;
  isHeadingVisible?: boolean;
  hasFigureBreakdowns?: boolean;
  className?: string;
}) {
  const headingId = useId();
  const ability = abilityLabels[casting.ability];
  return (
    <section id={id} aria-labelledby={headingId} className={className}>
      <h3
        id={headingId}
        className={isHeadingVisible ? 'mb-2 font-sans text-base' : 'sr-only'}
      >
        {casting.name} spellcasting
      </h3>
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
          <Figure label="Casting level">
            <span className="font-mono">{casting.castingLevel}</span>
          </Figure>
          <Figure label="Caster level">
            {hasFigureBreakdowns ? (
              <CastingFigure
                casting={casting}
                kind="casterLevel"
                className="min-h-7 text-sm"
              />
            ) : (
              <span className="font-mono">
                {casting.casterLevel ? (
                  casting.casterLevel.total
                ) : (
                  <Dash reason="Not available" />
                )}
              </span>
            )}
          </Figure>
          <Figure label="Concentration">
            {hasFigureBreakdowns ? (
              <CastingFigure
                casting={casting}
                kind="concentration"
                className="min-h-7 text-sm"
              />
            ) : (
              <span className="font-mono">
                {casting.concentration ? (
                  formatModifier(casting.concentration.total)
                ) : (
                  <Dash reason="Not available" />
                )}
              </span>
            )}
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
