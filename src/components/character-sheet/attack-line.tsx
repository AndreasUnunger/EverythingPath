'use client';
import { formatCriticalRange } from '~/lib/character-sheet-attacks';
import { formatSigned } from './equipment-statistics';
import { chip, fieldLabel } from './sheet-parts';
import { StatBreakdown } from './stat-breakdown';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Line = Controller['attacks']['rows'][number]['singleView'][number];

// Touch-sized on the phone, compact beside the text from 768px.
const number = 'min-h-11 text-sm md:min-h-8';

const formatMultiplier = (multiplier: number) => `×${multiplier}`;
const formatRange = (feet: number) => `${feet} ft.`;
const formatPlain = (value: number) => String(value);

/** The weapon and dice the damage total stands on, above its bonuses. */
function DamageDice({ damage }: { damage: Line['damage'] }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {damage.diceSource.entryName}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">
          damage dice
        </span>
        <span className="font-mono">{damage.dice}</span>
      </div>
      {damage.damageType ? (
        <p className="text-muted-foreground text-xs">{damage.damageType}</p>
      ) : null}
    </div>
  );
}

/**
 * One attack of a routine (approved prototype's attack line): its place in
 * the full attack, the weapon, and the attack bonus, damage, critical
 * threat and multiplier, and range increment as numbers that explain
 * themselves. Damage reads as dice plus its bonus, in the line and in its
 * breakdown, with the dice credited to their weapon.
 */
export function AttackLine({
  line,
  routineName,
  sequence,
  count,
}: {
  line: Line;
  routineName: string;
  sequence: 'single' | 'full';
  count: number;
}) {
  const which =
    sequence === 'single'
      ? 'single attack'
      : `full attack ${line.position} of ${count}`;
  const name = `${routineName} ${which}`;
  const formatDamage = (bonus: number) =>
    `${line.damage.dice}${bonus === 0 ? '' : formatSigned(bonus)}`;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 text-sm">
      {line.position === null ? null : (
        <span
          aria-hidden
          className="text-muted-foreground w-3 shrink-0 text-right font-mono text-xs"
        >
          {line.position}
        </span>
      )}
      <span className="flex min-w-0 flex-1 basis-24 flex-wrap items-center gap-x-1.5 leading-tight">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {line.weaponName}
        </span>
        {line.mode === 'melee' ? null : (
          <span className={chip}>
            {line.mode === 'thrown' ? 'Thrown' : 'Ranged'}
          </span>
        )}
      </span>
      <span className="ml-auto flex flex-wrap items-center justify-end gap-x-1">
        <StatBreakdown
          label={`${name}: attack`}
          statistic={line.attack.statistic}
          target={line.attack.target}
          format={formatSigned}
          className={number}
        />
        <StatBreakdown
          label={`${name}: damage`}
          statistic={line.damage.statistic}
          target={line.damage.target}
          format={formatDamage}
          lead={<DamageDice damage={line.damage} />}
          className={number}
        />
        <span className="inline-flex items-center">
          <StatBreakdown
            label={`${name}: critical threat`}
            statistic={line.critical.threat.statistic}
            target={line.critical.threat.target}
            format={formatCriticalRange}
            formatContribution={formatPlain}
            className={number}
          />
          <span aria-hidden className="text-muted-foreground font-mono text-xs">
            /
          </span>
          <StatBreakdown
            label={`${name}: critical multiplier`}
            statistic={line.critical.multiplier.statistic}
            target={line.critical.multiplier.target}
            format={formatMultiplier}
            formatContribution={formatMultiplier}
            className={number}
          />
        </span>
        {line.range ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className={fieldLabel}>
              range
            </span>
            <StatBreakdown
              label={`${name}: range increment`}
              statistic={line.range.statistic}
              target={line.range.target}
              format={formatRange}
              formatContribution={formatRange}
              className={number}
            />
          </span>
        ) : null}
      </span>
    </li>
  );
}
