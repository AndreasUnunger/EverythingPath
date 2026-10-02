'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 2, "Attack table": one row per
// weapon in Gear with how it is held (the item's `wield`, set with
// `store.setWield`). The attacks come from `wieldSetups` and
// `resolveRoutine` with the lens passed in; a Primary and an Off hand weapon
// form one two-weapon group. Power Attack and the situations that change an
// attack are second lines under the row, as alternate numbers. A table from
// `md`, cards below. Owned by the variant 2 agent.

import { Fragment, useMemo, type ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  resolveRoutine,
  weaponsOf,
  wieldOf,
  wieldSetups,
  type AttackSetup,
  type ResolvedAttack,
  type ResolvedRoutine,
  type WeaponEntry,
  type Wield,
} from '../attacks';
import { useBuilderStore } from '../store';
import type { Character, ResolvedSheet, SituationKey } from '../types';
import { formatBonus } from '../ui-helpers';
import { StatButton, th, useSheetUi } from './shared';
import { AltButton } from './v2-situations';

// ------------------------------------------------------------------ model

type Routines = {
  setup: AttackSetup;
  /** On screen: resolved with the lens. */
  now: ResolvedRoutine;
  /** The normal sheet, for the change marks. */
  base: ResolvedRoutine;
  /** The same setup with Power Attack on, when the feat can be used. */
  power: { now: ResolvedRoutine; base: ResolvedRoutine } | null;
  /** The situations that change weapon attacks, each resolved on its own. */
  situations: { key: SituationKey; text: string; routine: ResolvedRoutine }[];
};

type Row = {
  weapon: WeaponEntry;
  wield: Wield | null;
  role: 'main' | 'off';
  /** Null when the weapon is not used to attack. */
  routines: Routines | null;
};

/** A row group: one weapon, or a primary and its off-hand weapon. */
type Group = { id: string; rows: Row[]; pair: boolean };

function buildGroups(
  character: Character,
  sheet: ResolvedSheet,
  baseSheet: ResolvedSheet,
  situation: SituationKey | null,
): Group[] {
  const weapons = weaponsOf(character);
  const lens = situation ? [situation] : [];
  const resolve = (
    setup: AttackSetup,
    situations: SituationKey[] = lens,
    on: ResolvedSheet = sheet,
  ) => resolveRoutine(character, on, setup, { situations });
  const routines: Routines[] = wieldSetups(character).map((setup) => {
    const now = resolve(setup);
    const power = now.riders.some((r) => r.key === 'powerAttack')
      ? { ...setup, options: { ...setup.options, powerAttack: true } }
      : null;
    return {
      setup,
      now,
      base: resolve(setup, [], baseSheet),
      power: power
        ? { now: resolve(power), base: resolve(power, [], baseSheet) }
        : null,
      situations: baseSheet.situations
        .filter((s) => s.attacks.length > 0 && s.key !== situation)
        .map((s) => ({
          key: s.key,
          text: s.text,
          routine: resolve(setup, [s.key]),
        })),
    };
  });
  const byId = (id: string) => weapons.find((w) => w.entry.id === id);
  const row = (
    weapon: WeaponEntry,
    role: Row['role'],
    r: Routines | null,
  ): Row => ({ weapon, wield: wieldOf(weapon.entry), role, routines: r });

  const groups: Group[] = [];
  const placed = new Set<string>();
  for (const w of weapons) {
    if (placed.has(w.entry.id)) continue;
    const asMain = routines.find((r) => r.setup.main.entryId === w.entry.id);
    const asOff = routines.find((r) => r.setup.off?.entryId === w.entry.id);
    const pair = asMain?.setup.off ? asMain : asOff;
    if (pair?.setup.off) {
      const main = byId(pair.setup.main.entryId);
      const off = byId(pair.setup.off.entryId);
      if (main && off) {
        placed.add(main.entry.id);
        placed.add(off.entry.id);
        groups.push({
          id: pair.setup.id,
          pair: true,
          rows: [row(main, 'main', pair), row(off, 'off', pair)],
        });
        continue;
      }
    }
    placed.add(w.entry.id);
    groups.push({
      id: w.entry.id,
      pair: false,
      rows: [row(w, 'main', asMain ?? null)],
    });
  }
  return groups;
}

/** The attacks of one routine that belong to a row (its weapon, its hand). */
function attacksOf(routine: ResolvedRoutine, row: Row) {
  return routine.attacks.filter(
    (a) =>
      a.weaponEntryId === row.weapon.entry.id &&
      (row.role === 'off') === (a.hand === 'off'),
  );
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th'];

/** "+1 greataxe attack", "+1 greataxe, 2nd attack", "Kukri, off hand". */
function attackTitle(a: ResolvedAttack) {
  if (a.note === 'haste') return `${a.label}, haste attack`;
  if (a.hand === 'off') return `${a.label}, off hand`;
  const n = Number(/:main-(\d+)$/.exec(a.key)?.[1] ?? 0);
  return n === 0 ? `${a.label} attack` : `${a.label}, ${ORDINAL[n]} attack`;
}

const damageTitle = (a: ResolvedAttack) =>
  `${a.label} damage (${a.damage.dice}${a.hand === 'off' ? ', off hand' : ''})`;

/**
 * What a situation adds to the damage: the extra dice when that is all
 * ("+2d6"), else the whole new damage text.
 */
function damageDelta(alt: ResolvedAttack, now: ResolvedAttack) {
  return alt.damage.bonus.total === now.damage.bonus.total &&
    alt.damage.extra.length > 0
    ? alt.damage.extra.map((x) => `+${x.dice}`).join(' ')
    : alt.damage.text;
}

// ------------------------------------------------------------------ held

const WIELD_LABEL: Record<Wield, string> = {
  twoHands: 'Two hands',
  oneHand: 'One hand',
  primary: 'Primary hand',
  off: 'Off hand',
};
/** The trigger's text; the menu shows the full labels. */
const WIELD_SHORT: Record<Wield, string> = {
  twoHands: 'Two hands',
  oneHand: 'One hand',
  primary: 'Primary',
  off: 'Off hand',
};
const NOT_USED = 'none';

/** The ways this weapon can be held; two-handed and ranged weapons take two hands. */
function wieldChoices(row: Row): Wield[] {
  const h = row.weapon.weapon.handedness;
  const choices: Wield[] =
    h === 'ranged' || h === 'twoHanded'
      ? ['twoHands']
      : ['twoHands', 'oneHand', 'primary', 'off'];
  if (row.wield && !choices.includes(row.wield)) choices.push(row.wield);
  return choices;
}

function HeldSelect({ characterId, row }: { characterId: string; row: Row }) {
  const store = useBuilderStore();
  return (
    <Select
      value={row.wield ?? NOT_USED}
      onValueChange={(v) =>
        store.setWield(
          characterId,
          row.weapon.entry.id,
          v === NOT_USED ? null : (v as Wield),
        )
      }
    >
      <SelectTrigger
        aria-label={`How the ${row.weapon.catalog.name} is held`}
        className="min-h-11 w-full gap-1 px-1.5 py-1 font-mono text-xs shadow-none data-[size=default]:h-auto md:min-h-9 [&_svg]:size-3.5"
      >
        <SelectValue>
          {row.wield ? WIELD_SHORT[row.wield] : 'Not used'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {wieldChoices(row).map((w) => (
          <SelectItem key={w} value={w}>
            {WIELD_LABEL[w]}
          </SelectItem>
        ))}
        <SelectItem value={NOT_USED}>Not used</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ----------------------------------------------------------------- cells

const HasteMark = () => (
  <span className="text-muted-foreground ml-0.5 font-mono text-[10px] tracking-wide uppercase">
    haste
  </span>
);

/** The row's attack numbers as chips, one per attack of the full attack. */
function Chips({
  attacks,
  base,
}: {
  attacks: ResolvedAttack[];
  base: ResolvedRoutine;
}) {
  if (attacks.length === 0)
    return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap items-start gap-1.5">
      {attacks.map((a) => (
        <span key={a.key} className="inline-flex flex-col items-center">
          <StatButton
            stat={a.bonus}
            statKey={`${a.key}:bonus`}
            baseStat={base.attacks.find((b) => b.key === a.key)?.bonus}
            title={attackTitle(a)}
            signed
            size="sm"
            className="border border-solid px-1"
          />
          {a.note === 'haste' && (
            <span className="text-muted-foreground font-mono text-[9px] leading-none tracking-wide uppercase">
              haste
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** The row's damage ("1d12+8"), tapping for the bonus's breakdown. */
function Damage({
  attack,
  base,
}: {
  attack: ResolvedAttack;
  base: ResolvedRoutine;
}) {
  const b = base.attacks.find((x) => x.key === attack.key);
  return (
    <AltButton
      id={`${attack.key}:damage`}
      title={damageTitle(attack)}
      stat={attack.damage.bonus}
      tone="main"
      changed={b !== undefined && b.damage.text !== attack.damage.text}
      className="min-h-8 text-base"
    >
      {attack.damage.text}
    </AltButton>
  );
}

/** Second lines under a row: Power Attack, then each situation that changes the attack. */
function altLines(row: Row, attacks: ResolvedAttack[]): ReactNode[] {
  const r = row.routines;
  const lines: ReactNode[] = [];
  if (!r) return lines;
  if (r.power) {
    const pa = attacksOf(r.power.now, row);
    const first = pa[0];
    if (first) {
      const changed = (a: ResolvedAttack) => {
        const b = r.power!.base.attacks.find((x) => x.key === a.key);
        return b !== undefined && b.bonus.total !== a.bonus.total;
      };
      const baseFirst = r.power.base.attacks.find((x) => x.key === first.key);
      lines.push(
        <p
          key="pa"
          className="text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs"
        >
          <span>Power Attack</span>
          {pa.map((a) => (
            <AltButton
              key={a.key}
              id={`${a.key}:pa:bonus`}
              title={`${attackTitle(a)} with Power Attack`}
              stat={a.bonus}
              tone="muted"
              changed={changed(a)}
            >
              {formatBonus(a.bonus.total)}
              {a.note === 'haste' && <HasteMark />}
            </AltButton>
          ))}
          <span>·</span>
          <AltButton
            id={`${first.key}:pa:damage`}
            title={`${damageTitle(first)} with Power Attack`}
            stat={first.damage.bonus}
            tone="muted"
            changed={
              baseFirst !== undefined &&
              baseFirst.damage.text !== first.damage.text
            }
          >
            {first.damage.text}
          </AltButton>
        </p>,
      );
    }
  }
  for (const s of r.situations) {
    const alt = attacksOf(s.routine, row);
    const changed = alt.filter((a) => {
      const n = attacks.find((x) => x.key === a.key);
      return n !== undefined && n.bonus.total !== a.bonus.total;
    });
    const first = alt[0];
    const now = attacks[0];
    const damageChanged =
      first !== undefined &&
      now !== undefined &&
      first.damage.text !== now.damage.text;
    if (changed.length === 0 && !damageChanged) continue;
    const text =
      damageChanged && first.damage.extra[0]
        ? first.damage.extra[0].conditionText
        : s.text;
    lines.push(
      <p
        key={s.key}
        className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-sky-300/80"
      >
        {changed.map((a) => (
          <AltButton
            key={a.key}
            id={`${a.key}@${s.key}:bonus`}
            title={`${attackTitle(a)} ${s.text}`}
            stat={a.bonus}
          >
            {formatBonus(a.bonus.total)}
            {a.note === 'haste' && <HasteMark />}
          </AltButton>
        ))}
        {changed.length > 0 && damageChanged && <span>·</span>}
        {damageChanged && (
          <AltButton
            id={`${first.key}@${s.key}:damage`}
            title={`${damageTitle(first)} ${s.text}`}
            stat={first.damage.bonus}
          >
            {damageDelta(first, now)}
          </AltButton>
        )}
        <span>{text}</span>
      </p>,
    );
  }
  return lines;
}

/** The notes under a group: the two-weapon penalty, an unpaired hand, resolver notes. */
function groupNotes(group: Group): string[] {
  const r = group.rows[0]?.routines;
  if (!r) return [];
  const notes = [...r.now.penalties, ...r.now.notes];
  const only = group.rows[0];
  if (!group.pair && only && (only.wield === 'primary' || only.wield === 'off'))
    notes.push(
      `No ${only.wield === 'primary' ? 'off-hand' : 'primary'} weapon is set: it attacks on its own, in one hand.`,
    );
  return notes;
}

// ----------------------------------------------------------------- table

export function AttackTable({
  character,
  sheet,
}: {
  character: Character;
  sheet: ResolvedSheet;
}) {
  const ui = useSheetUi();
  const groups = useMemo(
    () => buildGroups(character, sheet, ui.baseSheet, ui.situation),
    [character, sheet, ui.baseSheet, ui.situation],
  );
  if (groups.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        No weapons in Gear. Add one to see its attacks here.
      </p>
    );
  const cell = 'px-1 py-1 align-middle';
  const muted = 'text-muted-foreground';
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-sm md:table">
        {/* Fixed widths so the six columns fit the narrow Offense card from lg; the Weapon column takes the rest. */}
        <colgroup>
          <col />
          <col className="w-24" />
          <col className="w-[82px]" />
          <col className="w-[58px]" />
          <col className="w-[52px]" />
          <col className="w-[47px]" />
        </colgroup>
        <thead>
          <tr className="border-foreground/20 border-b">
            <th className={cn(th, 'px-1')}>Weapon</th>
            <th className={cn(th, 'px-1')}>Held</th>
            <th className={cn(th, 'px-1')}>Attacks</th>
            <th className={cn(th, 'px-1')}>Damage</th>
            <th className={cn(th, 'px-1')}>Critical</th>
            <th className={cn(th, 'px-1')}>Range</th>
          </tr>
        </thead>
        {groups.map((group) => {
          const notes = groupNotes(group);
          return (
            <tbody
              key={group.id}
              className={cn(
                'border-foreground/15 border-b',
                group.pair && 'bg-foreground/[0.05]',
              )}
            >
              {group.rows.map((row) => {
                const attacks = row.routines
                  ? attacksOf(row.routines.now, row)
                  : [];
                const first = attacks[0];
                const alts = altLines(row, attacks);
                return (
                  <Fragment key={row.weapon.entry.id}>
                    <tr>
                      <td className={cn(cell, 'font-sans')}>
                        {row.weapon.catalog.name}
                      </td>
                      <td className={cell}>
                        <HeldSelect characterId={character.id} row={row} />
                      </td>
                      {row.routines && first ? (
                        <>
                          <td className={cell}>
                            <Chips attacks={attacks} base={row.routines.base} />
                          </td>
                          <td className={cn(cell, 'whitespace-nowrap')}>
                            <Damage attack={first} base={row.routines.base} />
                          </td>
                          <td
                            className={cn(
                              cell,
                              'font-mono text-xs whitespace-nowrap',
                            )}
                          >
                            {first.critical.text}
                          </td>
                          <td
                            className={cn(
                              cell,
                              'font-mono text-xs whitespace-nowrap',
                            )}
                          >
                            {first.rangeIncrement
                              ? `${first.rangeIncrement} ft.`
                              : '—'}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className={cn(cell, muted, 'text-xs')}>
                          {row.wield ? 'No attack.' : 'Not used to attack.'}
                        </td>
                      )}
                    </tr>
                    {alts.length > 0 && (
                      <tr>
                        <td colSpan={6} className="space-y-0.5 px-1 pb-1.5">
                          {alts}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {notes.length > 0 && (
                <tr>
                  <td colSpan={6} className={cn(cell, muted, 'pb-1.5 text-xs')}>
                    {notes.join(' · ')}
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>

      <div className="space-y-2 md:hidden">
        {groups.map((group) => {
          const notes = groupNotes(group);
          return (
            <div
              key={group.id}
              className={cn(
                group.pair && 'border-foreground/30 space-y-1.5 border p-1.5',
              )}
            >
              {group.rows.map((row) => {
                const attacks = row.routines
                  ? attacksOf(row.routines.now, row)
                  : [];
                const first = attacks[0];
                const alts = altLines(row, attacks);
                return (
                  <div
                    key={row.weapon.entry.id}
                    className="border-foreground/20 border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans">
                        {row.weapon.catalog.name}
                      </span>
                      <HeldSelect characterId={character.id} row={row} />
                    </div>
                    {row.routines && first ? (
                      <div className="mt-1.5 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
                        <span className={cn(th, 'px-0 py-0')}>Attacks</span>
                        <Chips attacks={attacks} base={row.routines.base} />
                        <span className={cn(th, 'px-0 py-0')}>Damage</span>
                        <span className="flex flex-wrap items-baseline gap-x-3">
                          <Damage attack={first} base={row.routines.base} />
                          <span className="font-mono">
                            {first.critical.text}
                          </span>
                          {first.rangeIncrement && (
                            <span className="font-mono">
                              {first.rangeIncrement} ft.
                            </span>
                          )}
                        </span>
                        {alts.length > 0 && (
                          <span className="col-span-2 space-y-0.5">{alts}</span>
                        )}
                      </div>
                    ) : (
                      <p className={cn(muted, 'mt-1 text-xs')}>
                        {row.wield ? 'No attack.' : 'Not used to attack.'}
                      </p>
                    )}
                  </div>
                );
              })}
              {notes.length > 0 && (
                <p className={cn(muted, 'px-1 text-xs')}>{notes.join(' · ')}</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
