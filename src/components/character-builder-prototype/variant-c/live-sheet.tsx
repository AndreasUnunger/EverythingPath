'use client';
// PROTOTYPE (throwaway, #208) — Variant C right pane: the live derived
// sheet. Every number is a button; the selected one opens its breakdown
// (applied and suppressed contributions) and highlights the timeline cards
// that feed it. With a `before` sheet it shows deltas (level-up preview).

import { Sparkles, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT, SKILLS } from '../catalog';
import {
  ABILITIES,
  type ResolvedSheet,
  type Stat,
} from '../types';
import {
  BONUS_TYPE_CLASS,
  BONUS_TYPE_LABEL,
  formatBonus,
  isBuffed,
} from '../ui-helpers';
import { Caption, Delta } from './bits';
import { STAT_LABEL, statByKey } from './model';

type Props = {
  sheet: ResolvedSheet;
  /** The sheet without the focused card, for deltas. */
  before?: ResolvedSheet | null;
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Smaller type for the sticky phone bar. */
  className?: string;
};

function StatButton({
  statKey,
  label,
  value,
  stat,
  before,
  selected,
  onSelect,
  big,
  signed,
}: {
  statKey: string;
  label: ReactNode;
  value: number;
  stat: Stat;
  before?: number;
  selected: boolean;
  onSelect: (key: string | null) => void;
  big?: boolean;
  signed?: boolean;
}) {
  const delta = before === undefined ? 0 : value - before;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={typeof label === 'string' ? label : statKey}
      onClick={() => onSelect(selected ? null : statKey)}
      className={cn(
        'border-foreground/20 hover:bg-foreground/5 flex min-h-11 min-w-0 flex-col items-center justify-center border px-1 py-1 text-center md:min-h-9',
        selected && 'bg-foreground/10 border-primary',
        delta && 'border-emerald-500/40',
      )}
    >
      <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
        {label}
      </span>
      <span
        className={cn(
          'flex items-baseline gap-1 font-mono leading-none',
          big ? 'text-2xl' : 'text-lg',
          isBuffed(stat) && 'text-violet-300',
        )}
      >
        {delta !== 0 && before !== undefined && (
          <span className="text-muted-foreground text-xs line-through">
            {signed ? formatBonus(before) : before}
          </span>
        )}
        {signed ? formatBonus(value) : value}
        <Delta value={delta} />
      </span>
    </button>
  );
}

/** Contributions have no ids: key by label, numbering repeats. */
function keyed<T extends { label: string }>(list: T[]): [string, T][] {
  const seen = new Map<string, number>();
  return list.map((item) => {
    const n = (seen.get(item.label) ?? 0) + 1;
    seen.set(item.label, n);
    return [`${item.label}#${n}`, item];
  });
}

function Breakdown({
  statKey,
  sheet,
  onClose,
}: {
  statKey: string;
  sheet: ResolvedSheet;
  onClose: () => void;
}) {
  const stat = statByKey(sheet, statKey);
  if (!stat) return null;
  const title = statKey.startsWith('ability.')
    ? ABILITY_SHORT[statKey.slice(8) as keyof typeof ABILITY_SHORT]
    : statKey.startsWith('skill.')
      ? (SKILLS.find((s) => s.key === statKey.slice(6))?.name ?? statKey)
      : (STAT_LABEL[statKey] ?? statKey);
  return (
    <div className="border-primary/60 bg-background/60 col-span-full border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-sans">
          {title}{' '}
          <span className="font-mono text-base">
            {statKey.startsWith('ability.') || /ac|cmd|hp/i.test(statKey)
              ? stat.total
              : formatBonus(stat.total)}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close breakdown"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="mt-1 space-y-0.5">
        {keyed(stat.applied).map(([key, c]) => (
          <li key={key} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">
              {c.label}
              {c.temporary && (
                <Sparkles
                  aria-label="temporary"
                  className="ml-1 inline size-3 text-violet-300"
                />
              )}
            </span>
            <span
              className={cn(
                'shrink-0 font-mono',
                BONUS_TYPE_CLASS[c.bonusType],
              )}
            >
              {formatBonus(c.value)}
              {c.bonusType !== 'untyped' && c.bonusType !== 'base' && (
                <span className="ml-1 text-xs opacity-80">
                  {BONUS_TYPE_LABEL[c.bonusType]}
                </span>
              )}
            </span>
          </li>
        ))}
        {keyed(stat.suppressed.map((s) => ({ ...s, label: s.contribution.label }))).map(([key, s]) => (
          <li
            key={key}
            className="text-muted-foreground flex items-baseline justify-between gap-2"
          >
            <span className="min-w-0 truncate">
              <span className="line-through">{s.contribution.label}</span>
              <span className="ml-1 text-xs">
                {s.reason === 'excluded'
                  ? s.by
                  : `suppressed by ${s.by} (${
                      s.reason === 'bonusType'
                        ? `same ${BONUS_TYPE_LABEL[s.contribution.bonusType]} bonus`
                        : s.reason === 'sameSource'
                          ? 'same source'
                          : 'same entry'
                    })`}
              </span>
            </span>
            <span className="shrink-0 font-mono line-through">
              {formatBonus(s.contribution.value)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-1 text-xs">
        Cards that feed this number are marked on the timeline.
      </p>
    </div>
  );
}

export function LiveSheet({
  sheet,
  before,
  selected,
  onSelect,
  className,
}: Props) {
  const [allSkills, setAllSkills] = useState(false);
  const b = (key: string) =>
    before ? statByKey(before, key)?.total : undefined;
  const group = (keys: string[]) =>
    selected && keys.includes(selected) ? (
      <Breakdown statKey={selected} sheet={sheet} onClose={() => onSelect(null)} />
    ) : null;
  const skills = SKILLS.filter(
    (s) =>
      allSkills ||
      sheet.skills[s.key].ranks > 0 ||
      selected === `skill.${s.key}`,
  );
  return (
    <div className={cn('space-y-3', className)}>
      <section>
        <Caption className="mb-1">Abilities</Caption>
        <div className="grid grid-cols-6 gap-1">
          {ABILITIES.map((a) => (
            <StatButton
              key={a}
              statKey={`ability.${a}`}
              label={ABILITY_SHORT[a]}
              value={sheet.abilities[a].total}
              stat={sheet.abilities[a]}
              before={b(`ability.${a}`)}
              selected={selected === `ability.${a}`}
              onSelect={onSelect}
            />
          ))}
          {ABILITIES.map((a) => (
            <div
              key={`${a}-mod`}
              className={cn(
                'text-center font-mono text-sm',
                isBuffed(sheet.abilityMods[a])
                  ? 'text-violet-300'
                  : 'text-muted-foreground',
              )}
            >
              {formatBonus(sheet.abilityMods[a].total)}
            </div>
          ))}
          {group(ABILITIES.map((a) => `ability.${a}`))}
        </div>
      </section>

      <section>
        <Caption className="mb-1">Defense</Caption>
        <div className="grid grid-cols-5 gap-1">
          <StatButton
            statKey="hp"
            label="HP"
            value={sheet.hp.total}
            stat={sheet.hp}
            before={b('hp')}
            selected={selected === 'hp'}
            onSelect={onSelect}
            big
          />
          <StatButton
            statKey="ac"
            label="AC"
            value={sheet.ac.total}
            stat={sheet.ac}
            before={b('ac')}
            selected={selected === 'ac'}
            onSelect={onSelect}
            big
          />
          <StatButton
            statKey="touchAc"
            label="Touch"
            value={sheet.touchAc.total}
            stat={sheet.touchAc}
            before={b('touchAc')}
            selected={selected === 'touchAc'}
            onSelect={onSelect}
          />
          <StatButton
            statKey="flatFootedAc"
            label="Flat"
            value={sheet.flatFootedAc.total}
            stat={sheet.flatFootedAc}
            before={b('flatFootedAc')}
            selected={selected === 'flatFootedAc'}
            onSelect={onSelect}
          />
          <StatButton
            statKey="init"
            label="Init"
            value={sheet.init.total}
            stat={sheet.init}
            before={b('init')}
            selected={selected === 'init'}
            onSelect={onSelect}
            signed
          />
          {group(['hp', 'ac', 'touchAc', 'flatFootedAc', 'init'])}
        </div>
      </section>

      <section>
        <Caption className="mb-1">Saves</Caption>
        <div className="grid grid-cols-3 gap-1">
          {(['fort', 'ref', 'will'] as const).map((s) => (
            <StatButton
              key={s}
              statKey={`save.${s}`}
              label={{ fort: 'Fort', ref: 'Ref', will: 'Will' }[s]}
              value={sheet.saves[s].total}
              stat={sheet.saves[s]}
              before={b(`save.${s}`)}
              selected={selected === `save.${s}`}
              onSelect={onSelect}
              signed
            />
          ))}
          {group(['save.fort', 'save.ref', 'save.will'])}
        </div>
      </section>

      <section>
        <Caption className="mb-1">Attack</Caption>
        <div className="grid grid-cols-6 gap-1">
          {(
            [
              ['bab', 'BAB', sheet.bab, true],
              ['attackMelee', 'Melee', sheet.attackMelee, true],
              ['attackRanged', 'Ranged', sheet.attackRanged, true],
              ['cmb', 'CMB', sheet.cmb, true],
              ['cmd', 'CMD', sheet.cmd, false],
              ['flatFootedCmd', 'FF CMD', sheet.flatFootedCmd, false],
            ] as const
          ).map(([key, label, stat, signed]) => (
            <StatButton
              key={key}
              statKey={key}
              label={label}
              value={stat.total}
              stat={stat}
              before={b(key)}
              selected={selected === key}
              onSelect={onSelect}
              signed={signed}
            />
          ))}
          {group([
            'bab',
            'attackMelee',
            'attackRanged',
            'cmb',
            'cmd',
            'flatFootedCmd',
          ])}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <Caption>Skills</Caption>
          <button
            type="button"
            className="text-muted-foreground font-mono text-xs underline underline-offset-2"
            onClick={() => setAllSkills(!allSkills)}
          >
            {allSkills ? 'with ranks only' : 'all skills'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-px">
          {skills.map((s) => {
            const st = sheet.skills[s.key];
            const key = `skill.${s.key}`;
            const prev = b(key);
            const delta = prev === undefined ? 0 : st.total - prev;
            return (
              <div key={s.key} className="contents">
                <button
                  type="button"
                  aria-pressed={selected === key}
                  onClick={() => onSelect(selected === key ? null : key)}
                  className={cn(
                    'hover:bg-foreground/5 flex min-h-9 items-center justify-between gap-2 border-b px-1 text-left text-sm',
                    'border-foreground/10',
                    selected === key && 'bg-foreground/10',
                    !st.usable && 'text-muted-foreground',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {s.name}
                    {st.classSkill && (
                      <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                        class
                      </span>
                    )}
                    {!st.usable && (
                      <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                        trained only
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 font-mono">
                    <span className="text-muted-foreground text-xs">
                      {st.ranks} rk
                    </span>
                    <span
                      className={cn(
                        'text-base',
                        isBuffed(st) && 'text-violet-300',
                      )}
                    >
                      {formatBonus(st.total)}
                    </span>
                    <Delta value={delta} />
                  </span>
                </button>
                {selected === key && (
                  <Breakdown
                    statKey={key}
                    sheet={sheet}
                    onClose={() => onSelect(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** The phone's sticky mini bar: the six numbers a player glances at. */
export function MiniStatBar({
  sheet,
  before,
}: {
  sheet: ResolvedSheet;
  before?: ResolvedSheet | null;
}) {
  const cells: [string, string, number, boolean][] = [
    ['hp', 'HP', sheet.hp.total, false],
    ['ac', 'AC', sheet.ac.total, false],
    ['save.fort', 'Fort', sheet.saves.fort.total, true],
    ['save.ref', 'Ref', sheet.saves.ref.total, true],
    ['save.will', 'Will', sheet.saves.will.total, true],
    ['bab', 'BAB', sheet.bab.total, true],
  ];
  return (
    <div className="bg-background/95 border-foreground/20 sticky top-0 z-30 -mx-4 grid grid-cols-6 border-b px-2 py-1 backdrop-blur">
      {cells.map(([key, label, value, signed]) => {
        const prev = before ? statByKey(before, key)?.total : undefined;
        const delta = prev === undefined ? 0 : value - prev;
        return (
          <div key={key} className="flex flex-col items-center">
            <span className="text-muted-foreground font-mono text-[10px] uppercase">
              {label}
            </span>
            <span className="flex items-baseline gap-1 font-mono text-base leading-none">
              {signed ? formatBonus(value) : value}
              <Delta value={delta} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
