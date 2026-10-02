'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 1, "Stat-block lines".
//
// The sheet reads like a Paizo stat block. Attacks are worked out from the
// weapons in Gear (`autoSetups`): adding a weapon is all it takes, and the
// Offense block writes each weapon as a line, "+1 greataxe +13/+8
// (1d12+8/×3)", alternatives starting with "or". Every attack bonus and
// every damage figure is tappable and opens the shared breakdown.
//
// Situational bonuses are text riders in small muted type under the number
// they would change: "+2 dodge vs. traps · Trap Sense". They never enter a
// total and are never shown as an alternate number. What the sheet can know
// (a weapon's own bonus, Weapon Focus on that weapon, raging) is already in
// the numbers; a rider whose condition waits on something that is off ("while
// raging" when not raging) is dimmed, so the player still knows it exists.
//
// Owned by the variant 1 presentation agent. Contract: CONTRACT.md, "Round 3".

import { Fragment, useMemo, type ComponentProps } from 'react';
import { cn } from '~/lib/utils';
import {
  autoSetups,
  resolveRoutine,
  statBlockText,
  type ResolvedAttack,
  type ResolvedRoutine,
} from '../attacks';
import type {
  ConditionalContribution,
  SkillKey,
  SkillStat,
  Stat,
} from '../types';
import { BONUS_TYPE_LABEL, formatBonus } from '../ui-helpers';
import { StatGroups, StatRow } from './sheet-default-blocks';
import type { SheetSlotProps, SheetVariantSlots } from './sheet-variants';
import { Block, StatButton, getStat, useSheetUi } from './shared';

// ------------------------------------------------------------------ riders

/** "+2 dodge vs. traps": the value, its type when it has one, then the condition. */
function riderText(c: ConditionalContribution, noun = '') {
  const type =
    c.bonusType === 'untyped' || c.bonusType === 'base'
      ? ''
      : ` ${BONUS_TYPE_LABEL[c.bonusType]}`;
  return `${formatBonus(c.value)}${type}${noun && ` ${noun}`} ${c.conditionText}`;
}

const riderKey = (c: ConditionalContribution) =>
  `${c.label}|${c.bonusType}|${c.conditionText}|${c.waitingOn ?? ''}`;

/**
 * A Stat's riders: its conditional contributions with the same source and
 * condition collapsed into one (Kesh's two Trap Sense entries read "+2 dodge
 * vs. traps"). Weapon-scoped ones are left out: the attack lines already
 * have them in their numbers.
 */
function ridersOf(stat: Stat): ConditionalContribution[] {
  const out: ConditionalContribution[] = [];
  for (const c of stat.conditional) {
    if (c.weapon) continue;
    const same = out.find((o) => riderKey(o) === riderKey(c));
    if (same) same.value += c.value;
    else out.push({ ...c });
  }
  return out;
}

const riderList = 'text-muted-foreground text-xs leading-tight';
const waiting = 'text-muted-foreground/60';

/** The riders under a Defenses row, one per line, each naming its source. */
function StatRiders({ stat }: { stat: Stat }) {
  const list = ridersOf(stat);
  if (list.length === 0) return null;
  return (
    <ul className={cn(riderList, 'basis-full space-y-0.5 pb-1.5')}>
      {list.map((c) => (
        <li key={riderKey(c)} className={cn(c.waitingOn && waiting)}>
          {riderText(c)} · {c.label}
        </li>
      ))}
    </ul>
  );
}

/** A default stat row with its riders under the label. */
function RiderRow(props: Omit<ComponentProps<typeof StatRow>, 'children'>) {
  return (
    <StatRow {...props}>
      <StatRiders stat={getStat(props.sheet, props.path)} />
    </StatRow>
  );
}

// ---------------------------------------------------------------- defenses

function Defenses({ sheet }: SheetSlotProps) {
  return (
    <Block id="b-defenses" title="Defenses">
      <StatGroups
        groups={[
          {
            key: 'hp-ac',
            rows: (
              <>
                <RiderRow
                  label="Hit points"
                  title="Hit points"
                  path="hp"
                  sheet={sheet}
                />
                <RiderRow
                  label="Armor Class"
                  title="Armor Class"
                  path="ac"
                  sheet={sheet}
                  also={[
                    { label: 'Touch', title: 'Touch AC', path: 'touchAc' },
                    {
                      label: 'Flat-footed',
                      title: 'Flat-footed AC',
                      path: 'flatFootedAc',
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'saves',
            rows: (
              <>
                <RiderRow
                  label="Fortitude"
                  title="Fortitude save"
                  path="saves.fort"
                  sheet={sheet}
                  signed
                />
                <RiderRow
                  label="Reflex"
                  title="Reflex save"
                  path="saves.ref"
                  sheet={sheet}
                  signed
                />
                <RiderRow
                  label="Will"
                  title="Will save"
                  path="saves.will"
                  sheet={sheet}
                  signed
                />
              </>
            ),
          },
          {
            key: 'cmd',
            rows: (
              <RiderRow
                label="CMD"
                title="Combat Maneuver Defense"
                path="cmd"
                sheet={sheet}
                also={[
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed CMD',
                    path: 'flatFootedCmd',
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </Block>
  );
}

// ----------------------------------------------------------------- attacks

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

/** The tappable numbers in a stat-block line: body font, compact on tablet, a thumb's height on phone. */
const lineNumber = 'min-h-9 px-0.5 font-sans text-base md:min-h-7';

type AttackGroup = {
  key: string;
  /** "+1 greataxe", "kukri": the weapon as the book writes it. */
  name: string;
  attacks: { attack: ResolvedAttack; title: string }[];
  /** "×3", "18–20", "19–20/×2"; empty for 20/×2, as stat blocks leave it out. */
  crit: string;
};

/**
 * One weapon's run of attacks in the line, "+13/+8": the main weapon's
 * attacks (iteratives and haste) in one group, the off hand in another, in
 * the order the full attack is made.
 */
function groupAttacks(routine: ResolvedRoutine): AttackGroup[] {
  const groups: (AttackGroup & { id: string; iteratives: number })[] = [];
  for (const attack of routine.attacks) {
    const id = `${attack.weaponEntryId}|${attack.hand === 'off' ? 'off' : 'main'}`;
    let group = groups.find((g) => g.id === id);
    if (!group) {
      const c = attack.critical;
      groups.push(
        (group = {
          id,
          key: attack.key,
          name: attack.label.charAt(0).toLowerCase() + attack.label.slice(1),
          attacks: [],
          iteratives: 0,
          crit:
            c.threat >= 20 && c.mult === 2
              ? ''
              : c.threat >= 20
                ? `×${c.mult}`
                : c.mult === 2
                  ? `${c.threat}–20`
                  : `${c.threat}–20/×${c.mult}`,
        }),
      );
    }
    // "+1 greataxe attack", "+1 greataxe, 2nd attack", "Kukri, off-hand attack".
    const title =
      attack.note === 'haste'
        ? `${attack.label}, haste attack`
        : attack.hand === 'off'
          ? `${attack.label}, off-hand attack`
          : group.iteratives++ === 0
            ? `${attack.label} attack`
            : `${attack.label}, ${ORDINAL[group.iteratives - 1]} attack`;
    group.attacks.push({ attack, title });
  }
  return groups;
}

/** The damage figure, "1d12+8", tappable for the damage bonus's breakdown. */
function DamageButton({
  attack,
  title,
}: {
  attack: ResolvedAttack;
  title: string;
}) {
  const ui = useSheetUi();
  const key = `${attack.key}:damage`;
  const isOpen = ui.open?.key === key;
  const buffed = attack.damage.bonus.applied.some((c) => c.temporary);
  return (
    <button
      type="button"
      onClick={(e) =>
        ui.openStat({
          key,
          title,
          stat: attack.damage.bonus,
          anchor: e.currentTarget,
        })
      }
      title={`${title}: tap for the breakdown`}
      className={cn(
        'hover:bg-foreground/10 inline-flex items-center border-b border-dotted leading-none',
        lineNumber,
        isOpen ? 'border-primary bg-foreground/10' : 'border-foreground/40',
        buffed && 'text-violet-200',
      )}
    >
      {attack.damage.text}
    </button>
  );
}

/** "kukri +7/+2 (1d4+5/18–20)": one weapon's part of the line, numbers tappable. */
function WeaponPart({ group }: { group: AttackGroup }) {
  const first = group.attacks[0]!.attack;
  const damageTitle =
    first.hand === 'off'
      ? `${first.label}, off-hand damage`
      : `${first.label} damage`;
  // The run of bonuses and the bracketed damage each wrap as one piece, so a
  // line never breaks inside "+13/+8" or leaves a "(" hanging at its end.
  return (
    <>
      {group.name}{' '}
      <span className="inline-block indent-0 whitespace-nowrap">
        {group.attacks.map(({ attack, title }, i) => (
          <Fragment key={attack.key}>
            {i > 0 && '/'}
            <StatButton
              stat={attack.bonus}
              statKey={`${attack.key}:bonus`}
              title={title}
              signed
              size="sm"
              className={lineNumber}
            />
          </Fragment>
        ))}
      </span>{' '}
      <span className="inline-block indent-0 whitespace-nowrap">
        (<DamageButton attack={first} title={damageTitle} />
        {group.crit && `/${group.crit}`})
      </span>
    </>
  );
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * One stat-block line and its riders: the two-weapon penalty, what the
 * attack can add (Power Attack when off, sneak attack), and the situational
 * bonuses on its numbers, each naming its source.
 */
function AttackLine({
  routine,
  alternative,
}: {
  routine: ResolvedRoutine;
  alternative: boolean;
}) {
  const groups = groupAttacks(routine);
  const range = routine.attacks[0]!.rangeIncrement;
  // Situational bonuses on the numbers; the same one on every iterative shows once.
  const conditionals: { c: ConditionalContribution; noun: string }[] = [];
  for (const g of groups) {
    const first = g.attacks[0]!.attack;
    for (const [stat, noun] of [
      [first.bonus, ''],
      [first.damage.bonus, 'damage'],
    ] as const)
      for (const c of ridersOf(stat))
        if (!conditionals.some((x) => riderKey(x.c) === riderKey(c)))
          conditionals.push({ c, noun });
  }
  return (
    <li className="-indent-4 pl-4 text-sm leading-tight">
      {alternative && <span className="text-muted-foreground">or </span>}
      {groups.map((g, i) => (
        <Fragment key={g.key}>
          {i > 0 && ', '}
          <WeaponPart group={g} />
        </Fragment>
      ))}
      {range && `, ${range} ft.`}
      {(routine.penalties.length > 0 ||
        routine.riders.length > 0 ||
        conditionals.length > 0 ||
        routine.notes.length > 0) && (
        <ul className={cn(riderList, 'mt-0.5 space-y-0.5 indent-0')}>
          {routine.penalties.map((p) => (
            <li key={p}>{lowerFirst(p)}</li>
          ))}
          {routine.riders.map((r) => (
            <li key={r.key}>
              {r.label}: {r.text}
              {r.conditionText && ` ${r.conditionText}`}
              {r.from !== r.label && ` · ${r.from}`}
            </li>
          ))}
          {conditionals.map(({ c, noun }) => (
            <li key={riderKey(c)} className={cn(c.waitingOn && waiting)}>
              {riderText(c, noun)} · {c.label}
            </li>
          ))}
          {routine.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** "Melee" or "Ranged" and its lines; an em dash when there are none. */
function AttackSection({
  label,
  routines,
}: {
  label: string;
  routines: ResolvedRoutine[];
}) {
  return (
    <li className="border-foreground/15 border-b py-1.5">
      <p className="text-muted-foreground mb-1 font-mono text-[11px] tracking-wide uppercase">
        {label}
      </p>
      {routines.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-tight">—</p>
      ) : (
        <ol className="space-y-1.5">
          {routines.map((r, i) => (
            <AttackLine key={r.setup.id} routine={r} alternative={i > 0} />
          ))}
        </ol>
      )}
    </li>
  );
}

/**
 * The weapons' lines, one per distinct line: two kukris in Gear give one
 * "kukri +11/+6" line and the two-weapon line, as a stat block would write
 * them.
 */
function distinctLines(routines: ResolvedRoutine[]) {
  const seen = new Set<string>();
  return routines.filter((r) => {
    if (r.attacks.length === 0) return false;
    const text = statBlockText(r);
    if (seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

function Offense({ character, sheet }: SheetSlotProps) {
  const lines = useMemo(
    () =>
      distinctLines(
        autoSetups(character).map((s) => resolveRoutine(character, sheet, s)),
      ),
    [character, sheet],
  );
  const melee = lines.filter((r) => r.attacks[0]!.kind === 'melee');
  const ranged = lines.filter((r) => r.attacks[0]!.kind === 'ranged');
  return (
    <Block id="b-offense" title="Offense">
      <StatGroups
        groups={[
          {
            key: 'attacks',
            rows: (
              <>
                <StatRow
                  label="Base attack"
                  title="Base attack bonus"
                  path="bab"
                  sheet={sheet}
                  signed
                />
                <AttackSection label="Melee" routines={melee} />
                <AttackSection label="Ranged" routines={ranged} />
              </>
            ),
          },
          {
            key: 'cmb',
            rows: (
              <StatRow
                label="CMB"
                title="Combat Maneuver Bonus"
                path="cmb"
                sheet={sheet}
                signed
              />
            ),
          },
          {
            key: 'init',
            rows: (
              <StatRow
                label="Initiative"
                title="Initiative"
                path="init"
                sheet={sheet}
                signed
              />
            ),
          },
        ]}
      />
    </Block>
  );
}

// ------------------------------------------------------------------ skills

/**
 * A skill's riders beside its total: Perception "+1 to locate traps". From
 * tablet width it sits left of the number on the number's own line, so the
 * row keeps its height: it comes after the number in the cell, and a line
 * may always break before an inline button, so it is a block pulled up over
 * the number's line (the number's height) and kept clear of the number. On
 * phone it goes under the number and may wrap.
 */
function SkillExtra({
  stat,
}: SheetSlotProps & { skill: SkillKey; stat: SkillStat }) {
  const list = ridersOf(stat);
  if (list.length === 0) return null;
  return (
    <span
      className="text-muted-foreground block text-[11px] leading-tight md:-mt-8 md:h-8 md:truncate md:pr-14 md:text-left md:leading-8"
      title={list.map((c) => `${riderText(c)} · ${c.label}`).join('; ')}
    >
      {list.map((c) => riderText(c)).join(', ')}
    </span>
  );
}

export const v1Slots: SheetVariantSlots = {
  Defenses,
  Offense,
  SkillExtra,
};
