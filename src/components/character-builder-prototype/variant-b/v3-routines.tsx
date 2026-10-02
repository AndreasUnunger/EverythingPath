'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 3, "Attack routines". The
// player saves named Attack Routines (`routineSetups`, edited with
// `store.addRoutine`/`updateRoutine`/`removeRoutine`); each lists its full
// attack in order. Situational bonuses stay off the face of the sheet: a
// small sky marker flags any number that has them, and the breakdown
// popover's "Only when…" section shows the conditions and what the total
// becomes in each. Contract: CONTRACT.md, "Round 3".

import { Plus, SquarePen, TriangleAlert, Undo2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '~/lib/utils';
import {
  naturalHand,
  resolveRoutine,
  routineSetups,
  weaponsOf,
  type ResolvedAttack,
  type ResolvedRoutine,
} from '../attacks';
import { getStat, resolveInSituation } from '../resolve';
import { useBuilderStore, type AttackRoutine } from '../store';
import type {
  BonusType,
  Character,
  ConditionalContribution,
  ResolvedSheet,
  SituationKey,
  Stat,
  StatPath,
  Suppressed,
} from '../types';
import { BONUS_TYPE_CLASS, BONUS_TYPE_LABEL, formatBonus } from '../ui-helpers';
import { StatGroups } from './sheet-default-blocks';
import type { SheetSlotProps, SheetVariantSlots } from './sheet-variants';
import { Block, StatButton, chip, useSheetUi } from './shared';
import { RoutineEditor } from './v3-routine-editor';

// ------------------------------------------------------------------ marker

/** A number with contributions waiting on a situation ("vs. traps"). */
export const hasSituational = (stat: Stat) => stat.conditional.length > 0;

/**
 * The one situational marker: a tiny sky diamond at a number's top-right
 * corner. Absolutely positioned, so it never shifts the number; the click
 * goes to the number as usual.
 */
export function Marker({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Has situational bonuses"
      className={cn(
        'pointer-events-none absolute size-1.5 rotate-45 bg-sky-300',
        className,
      )}
    />
  );
}

/** Wraps a number so the marker can sit at its corner. */
function Marked({
  flagged,
  className,
  children,
}: {
  flagged: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('relative inline-flex', className)}>
      {children}
      {flagged && <Marker className="-top-px -right-1" />}
    </span>
  );
}

// ------------------------------------------------------------- stat rows

// `StatRow` from sheet-default-blocks.tsx, copied so the marker can sit on
// the number's corner without wrapping the button it renders.
const onRule = 'bg-card -mb-px self-end';

function Row({
  label,
  title,
  path,
  sheet,
  signed,
  also,
}: {
  label: string;
  title: string;
  path: StatPath;
  sheet: ResolvedSheet;
  signed?: boolean;
  also?: { label: string; title: string; path: StatPath; signed?: boolean }[];
}) {
  return (
    <li className="border-foreground/15 flex items-end gap-3 border-b pt-1">
      <span className="flex min-w-0 flex-1 flex-wrap items-end gap-x-4">
        <span className="pb-1.5 text-sm leading-tight">{label}</span>
        {also && (
          <span className="text-muted-foreground flex flex-wrap items-end gap-x-3 text-xs">
            {also.map((a) => (
              <span key={a.path} className="inline-flex items-end gap-1">
                <span className="pb-1.5 leading-tight">{a.label}</span>
                <Marked
                  flagged={hasSituational(getStat(sheet, a.path))}
                  className={onRule}
                >
                  <StatButton
                    path={a.path}
                    sheet={sheet}
                    title={a.title}
                    signed={a.signed}
                    className="text-foreground min-h-7 font-sans text-sm"
                  />
                </Marked>
              </span>
            ))}
          </span>
        )}
      </span>
      <Marked flagged={hasSituational(getStat(sheet, path))} className={onRule}>
        <StatButton
          path={path}
          sheet={sheet}
          title={title}
          signed={signed}
          className="min-w-12 justify-end font-sans text-xl"
        />
      </Marked>
    </li>
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
                <Row label="Hit points" title="Hit points" path="hp" sheet={sheet} />
                <Row
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
                <Row
                  label="Fortitude"
                  title="Fortitude save"
                  path="saves.fort"
                  sheet={sheet}
                  signed
                />
                <Row
                  label="Reflex"
                  title="Reflex save"
                  path="saves.ref"
                  sheet={sheet}
                  signed
                />
                <Row
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
              <Row
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

// ----------------------------------------------------------------- offense

function Offense({ character, sheet }: SheetSlotProps) {
  return (
    <>
      <Block id="b-offense" title="Offense">
        <StatGroups
          groups={[
            {
              key: 'bab',
              rows: (
                <Row
                  label="Base attack"
                  title="Base attack bonus"
                  path="bab"
                  sheet={sheet}
                  signed
                />
              ),
            },
            {
              key: 'cmb',
              rows: (
                <Row
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
                <Row
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
      <AttacksBlock character={character} sheet={sheet} />
    </>
  );
}

// ----------------------------------------------------------------- attacks

const iconButton =
  'text-muted-foreground hover:text-foreground flex min-h-11 w-8 shrink-0 items-center justify-center md:min-h-7';

function AttacksBlock({ character, sheet }: SheetSlotProps) {
  const store = useBuilderStore();
  const ui = useSheetUi();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<AttackRoutine | null>(null);
  const weapons = weaponsOf(character);
  const setups = routineSetups(character);
  const situations = ui.situation ? [ui.situation] : [];
  const routines = setups.map((setup) => ({
    routine: resolveRoutine(character, sheet, setup, { situations }),
    base: ui.situation
      ? resolveRoutine(character, ui.baseSheet, setup)
      : undefined,
  }));

  const add = () => {
    const w = weapons[0];
    if (!w) return;
    const id = store.addRoutine(character.id, {
      name: w.catalog.name,
      main: { entryId: w.entry.id, hand: naturalHand(w.weapon) },
      options: { powerAttack: false },
    });
    setEditingId(id);
  };
  const remove = (routine: ResolvedRoutine) => {
    const { setup } = routine;
    setRemoved({
      name: setup.name,
      main: setup.main,
      ...(setup.off ? { off: setup.off } : {}),
      options: setup.options,
    });
    store.removeRoutine(character.id, setup.id);
    if (editingId === setup.id) setEditingId(null);
  };
  const undo = () => {
    if (!removed) return;
    store.addRoutine(character.id, removed);
    setRemoved(null);
  };

  return (
    <Block
      id="b-attacks"
      title="Attacks"
      aside={
        <button
          type="button"
          onClick={add}
          disabled={weapons.length === 0}
          className={cn(
            chip,
            'hover:bg-foreground/10 min-h-7 gap-1 disabled:opacity-40',
          )}
        >
          <Plus className="size-3" />
          Add attack routine
        </button>
      }
    >
      {routines.length === 0 && (
        <p className="text-muted-foreground text-xs">
          {weapons.length === 0
            ? 'Add a weapon under Gear, then save how it attacks here.'
            : 'No attack routines yet.'}
        </p>
      )}
      <ul className="space-y-2">
        {routines.map(({ routine, base }) => (
          <RoutineCard
            key={routine.setup.id}
            routine={routine}
            base={base}
            onEdit={() => setEditingId(routine.setup.id)}
            onRemove={() => remove(routine)}
          />
        ))}
      </ul>
      {removed && (
        <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate">
            Removed “{removed.name}”.
          </span>
          <button
            type="button"
            onClick={undo}
            className={cn(chip, 'hover:bg-foreground/10 min-h-7 gap-1')}
          >
            <Undo2 className="size-3" />
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setRemoved(null)}
            className={cn(iconButton, 'min-h-7')}
          >
            <X className="size-3.5" />
          </button>
        </p>
      )}
      {editingId && (
        <RoutineEditor
          character={character}
          sheet={sheet}
          routineId={editingId}
          onClose={() => setEditingId(null)}
          onRemove={() => {
            const r = routines.find((x) => x.routine.setup.id === editingId);
            if (r) remove(r.routine);
          }}
        />
      )}
    </Block>
  );
}

function RoutineCard({
  routine,
  base,
  onEdit,
  onRemove,
}: {
  routine: ResolvedRoutine;
  /** The same routine without the lens, for `data-situation-changed`. */
  base?: ResolvedRoutine;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { setup, attacks, penalties, riders, notes } = routine;
  const situationalDamage = riders.some((r) => r.situationKey);
  return (
    <li className="border-foreground/15 border px-2 py-1">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 font-sans text-base leading-tight [overflow-wrap:anywhere]">
          {setup.name}
        </span>
        {setup.options.powerAttack && (
          <span className={cn(chip, 'border-primary/60 text-primary')}>
            Power Attack
          </span>
        )}
        <button
          type="button"
          aria-label={`Edit ${setup.name}`}
          onClick={onEdit}
          className={iconButton}
        >
          <SquarePen className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Remove ${setup.name}`}
          onClick={onRemove}
          className={cn(iconButton, 'hover:text-destructive')}
        >
          <X className="size-4" />
        </button>
      </div>
      {notes.map((n) => (
        <p
          key={n}
          className="flex items-start gap-1.5 pb-1 text-xs text-amber-300"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{n}</span>
        </p>
      ))}
      {routine.single && (
        <ol className="divide-foreground/10 divide-y">
          <AttackLine
            attack={routine.single}
            base={base?.single ?? undefined}
            tag="single"
            situationalDamage={situationalDamage}
          />
          {attacks.map((a, i) => (
            <AttackLine
              key={a.key}
              attack={a}
              base={base?.attacks.find((b) => b.key === a.key)}
              tag={i === 0 ? 'full' : undefined}
              seq={a.sequence}
              of={attacks.length}
              situationalDamage={situationalDamage}
            />
          ))}
        </ol>
      )}
      {penalties.map((p) => (
        <p key={p} className="text-muted-foreground pt-0.5 text-xs">
          {p}
        </p>
      ))}
    </li>
  );
}

const numberButton =
  'hover:bg-foreground/10 inline-flex min-h-7 items-center border-b border-dotted px-1 font-sans text-base leading-none';

function AttackLine({
  attack,
  base,
  tag,
  seq,
  of,
  situationalDamage,
}: {
  attack: ResolvedAttack;
  base?: ResolvedAttack;
  /** "single" on the standard-action line; "full" on the first full-attack line. */
  tag?: 'single' | 'full';
  /** Position in the full attack (absent on the single line). */
  seq?: number;
  of?: number;
  /** The routine has a situational damage rider (sneak attack). */
  situationalDamage: boolean;
}) {
  const ui = useSheetUi();
  const which = seq ? `full attack ${seq} of ${of}` : 'single attack';
  const damageKey = `${attack.key}:damage`;
  const damageOpen = ui.open?.key === damageKey;
  const damageChanged =
    base !== undefined && base.damage.text !== attack.damage.text;
  const damageBuffed = attack.damage.bonus.applied.some((c) => c.temporary);
  return (
    <li className="flex flex-wrap items-center gap-x-2 py-0.5 text-sm">
      <span className="text-muted-foreground w-9 shrink-0 font-mono text-xs">
        {tag}
      </span>
      <span className="text-muted-foreground w-3 shrink-0 text-right font-mono text-xs">
        {seq}
      </span>
      <span className="flex min-w-0 flex-1 basis-20 items-center gap-1.5 leading-tight">
        <span className="min-w-0">{attack.label}</span>
        {attack.note && (
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            {attack.note}
          </span>
        )}
      </span>
      <span className="ml-auto flex items-center gap-x-2">
        <Marked flagged={hasSituational(attack.bonus)}>
          <StatButton
            stat={attack.bonus}
            statKey={`${attack.key}:bonus`}
            baseStat={base?.bonus}
            title={`${attack.label} attack, ${which}`}
            signed
            className="min-h-7 font-sans text-base data-[situation-changed=true]:text-sky-300"
          />
        </Marked>
        <Marked
          flagged={
            situationalDamage || hasSituational(attack.damage.bonus)
          }
        >
          <button
            type="button"
            data-situation-changed={damageChanged ? 'true' : undefined}
            onClick={(e) =>
              ui.openStat({
                key: damageKey,
                title: `${attack.label} damage, ${which}`,
                stat: attack.damage.bonus,
                anchor: e.currentTarget,
              })
            }
            title={`${attack.label} damage, ${which}: tap for the breakdown`}
            className={cn(
              numberButton,
              damageOpen
                ? 'border-primary bg-foreground/10'
                : 'border-foreground/40',
              damageBuffed && 'text-violet-200',
              damageChanged && 'text-sky-300',
            )}
          >
            {attack.damage.text}
          </button>
        </Marked>
        <span className="text-muted-foreground min-w-8 font-mono text-xs leading-none whitespace-nowrap">
          {attack.critical.text}
          {attack.rangeIncrement && ` · ${attack.rangeIncrement} ft.`}
        </span>
      </span>
    </li>
  );
}

// --------------------------------------------------- small slot markers

function VitalExtra({ stat }: SheetSlotProps & { path: StatPath; stat: Stat }) {
  if (!hasSituational(stat)) return null;
  return (
    <span className="relative block h-0 w-full">
      <Marker className="-top-7 -right-0.5" />
    </span>
  );
}

function SkillExtra({ stat }: SheetSlotProps & { stat: Stat }) {
  if (!hasSituational(stat)) return null;
  return (
    <span className="relative inline-block w-0 align-top">
      <Marker className="top-0.5 -left-1.5" />
    </span>
  );
}

// --------------------------------------------------------------- breakdown

type Line = {
  key: string;
  label: string;
  /** A more specific condition than the group's ("to locate traps"). */
  detail?: string;
  bonusType?: BonusType;
  /** "+3", or "+2d6" for extra dice. */
  value: string;
};

type Group = {
  key: string;
  /** "vs. traps". */
  text: string;
  /** What the number becomes in that situation; absent when nothing applies yet. */
  total?: string;
  lines: Line[];
  suppressed: { key: string; label: string; bonusType: BonusType; value: number; by: string; reason: Suppressed['reason'] }[];
  /** Lines waiting on something else as well ("while raging"), dimmed. */
  waiting: { key: string; label: string; bonusType: BonusType; value: number; waitingOn: string }[];
};

const same = (a: Suppressed, b: Suppressed) =>
  a.contribution.label === b.contribution.label &&
  a.contribution.bonusType === b.contribution.bonusType &&
  a.contribution.value === b.contribution.value &&
  a.by === b.by;

/** The condition text without the `whileActive` part: "vs. spells, supernatural…". */
function ownText(c: ConditionalContribution) {
  if (!c.waitingOn || !c.conditionText.endsWith(c.waitingOn))
    return c.conditionText;
  return c.conditionText
    .slice(0, c.conditionText.length - c.waitingOn.length)
    .replace(/,?\s*$/, '');
}

function waitingOf(stat: Stat, key: SituationKey | undefined) {
  return stat.conditional
    .filter((c) => c.situationKey === key && c.waitingOn)
    .map((c, i) => ({
      key: `${c.label}|${i}`,
      label: c.label,
      bonusType: c.bonusType,
      value: c.value,
      waitingOn: c.waitingOn!,
    }));
}

/** Contributions of one situation that newly apply there, as lines. */
function linesOf(
  applied: Stat['applied'],
  key: SituationKey,
  groupText: string,
): Line[] {
  return applied
    .filter((c) => c.situationKey === key)
    .map((c, i) => ({
      key: `${c.label}|${i}`,
      label: c.label,
      detail:
        c.conditionText && c.conditionText !== groupText
          ? c.conditionText
          : undefined,
      bonusType: c.bonusType,
      value: formatBonus(c.value),
    }));
}

function suppressedOf(inSituation: Stat, base: Stat) {
  return inSituation.suppressed
    .filter((s) => !base.suppressed.some((t) => same(s, t)))
    .map((s, i) => ({
      key: `${s.contribution.label}|${i}`,
      label: s.contribution.label,
      bonusType: s.contribution.bonusType,
      value: s.contribution.value,
      by: s.by,
      reason: s.reason,
    }));
}

/** Conditional lines with no situation (weapon-scoped at sheet level, a bare "while raging"), grouped by their text; no total. */
function otherGroups(stat: Stat): Group[] {
  const groups = new Map<string, Group>();
  stat.conditional
    .filter((c) => !c.situationKey)
    .forEach((c, i) => {
      const text = ownText(c);
      let g = groups.get(text);
      if (!g)
        groups.set(text, (g = { key: `other:${text}`, text, lines: [], suppressed: [], waiting: [] }));
      if (c.waitingOn)
        g.waiting.push({
          key: `${c.label}|${i}`,
          label: c.label,
          bonusType: c.bonusType,
          value: c.value,
          waitingOn: c.waitingOn,
        });
      else
        g.lines.push({
          key: `${c.label}|${i}`,
          label: c.label,
          bonusType: c.bonusType,
          value: formatBonus(c.value),
        });
    });
  return [...groups.values()];
}

/** A sheet statistic: one group per situation on the sheet that touches it, with the total resolved there. */
function sheetGroups(
  character: Character,
  baseSheet: ResolvedSheet,
  path: StatPath,
  stat: Stat,
  signed: boolean,
): Group[] {
  const fmt = (n: number) => (signed ? formatBonus(n) : String(n));
  const keys = new Set(
    stat.conditional.flatMap((c) => (c.situationKey ? [c.situationKey] : [])),
  );
  const groups = baseSheet.situations
    .filter((s) => keys.has(s.key))
    .map((s): Group => {
      const inSituation = getStat(resolveInSituation(character, s.key), path);
      const lines = linesOf(inSituation.applied, s.key, s.text);
      const suppressed = suppressedOf(inSituation, stat);
      return {
        key: s.key,
        text: s.text,
        total:
          lines.length > 0 || suppressed.length > 0
            ? fmt(inSituation.total)
            : undefined,
        lines,
        suppressed,
        waiting: waitingOf(stat, s.key),
      };
    });
  return [...groups, ...otherGroups(stat)];
}

/** An attack's bonus or damage: the routine resolved in each situation that changes attacks, matched by attack key. */
function attackGroups(
  character: Character,
  sheet: ResolvedSheet,
  openKey: string,
  stat: Stat,
): Group[] {
  const m = /^(.+):(single|main-\d+|haste|off):(bonus|damage)$/.exec(openKey);
  const setup = m && routineSetups(character).find((s) => s.id === m[1]);
  if (!m || !setup) return otherGroups(stat);
  const attackKey = `${m[1]}:${m[2]}`;
  const which = m[3] as 'bonus' | 'damage';
  const groups = sheet.situations
    .filter((s) => s.attacks.length > 0)
    .flatMap((s): Group[] => {
      const routine = resolveRoutine(character, sheet, setup, {
        situations: [s.key],
      });
      const a =
        m[2] === 'single'
          ? routine.single
          : routine.attacks.find((x) => x.key === attackKey);
      if (!a) return [];
      const waiting = waitingOf(stat, s.key);
      if (which === 'bonus') {
        const lines = linesOf(a.bonus.applied, s.key, s.text);
        const suppressed = suppressedOf(a.bonus, stat);
        if (lines.length === 0 && suppressed.length === 0 && waiting.length === 0)
          return [];
        return [
          {
            key: s.key,
            text: s.text,
            total:
              lines.length > 0 || suppressed.length > 0
                ? formatBonus(a.bonus.total)
                : undefined,
            lines,
            suppressed,
            waiting,
          },
        ];
      }
      const lines = [
        ...linesOf(a.damage.bonus.applied, s.key, s.text),
        ...a.damage.extra.map((x, i) => ({
          key: `${x.label}|dice|${i}`,
          label: x.label,
          detail: x.conditionText !== s.text ? x.conditionText : undefined,
          value: `+${x.dice}`,
        })),
      ];
      const suppressed = suppressedOf(a.damage.bonus, stat);
      if (lines.length === 0 && suppressed.length === 0 && waiting.length === 0)
        return [];
      return [
        {
          key: s.key,
          text: s.text,
          total:
            lines.length > 0 || suppressed.length > 0
              ? a.damage.text
              : undefined,
          lines,
          suppressed,
          waiting,
        },
      ];
    });
  return [...groups, ...otherGroups(stat)];
}

const REASON: Record<Suppressed['reason'], string> = {
  bonusType: 'same bonus type, only the highest applies',
  sameSource: 'same source, only the strongest applies',
  sameEntry: 'same entry',
  excluded: '',
};

function TypeTag({ bonusType, dim }: { bonusType?: BonusType; dim?: boolean }) {
  if (!bonusType || bonusType === 'untyped' || bonusType === 'base')
    return null;
  return (
    <span
      className={cn(
        'font-mono text-[11px]',
        dim ? 'text-muted-foreground' : BONUS_TYPE_CLASS[bonusType],
      )}
    >
      {BONUS_TYPE_LABEL[bonusType]}
    </span>
  );
}

/**
 * The popover's conditional part, this variant's way: one group per
 * condition, each with its lines, anything it suppresses, and what the
 * number becomes then. It replaces the popover's default "Only when…" list
 * (`replacesConditionalSection` below).
 */
function BreakdownExtra({
  path,
  openKey,
  stat,
  character,
  sheet,
}: SheetSlotProps & {
  path: StatPath | null;
  openKey: string;
  title: string;
  stat: Stat;
}) {
  const ui = useSheetUi();
  const groups = path
    ? sheetGroups(character, ui.baseSheet, path, stat, ui.open?.signed ?? true)
    : attackGroups(character, sheet, openKey, stat);
  if (groups.length === 0) return null;
  return (
    <div className="border-foreground/15 mt-2 border-t pt-2">
      <p className="text-muted-foreground mb-1 font-mono text-[11px] tracking-wide uppercase">
        Only when…
      </p>
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5 text-sky-300">
                <Marker className="relative top-0 size-1.5 shrink-0 self-center" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{g.text}</span>
              </span>
              {g.total !== undefined && (
                <span className="shrink-0 font-mono">
                  <span className="text-muted-foreground text-xs">becomes </span>
                  <span className="text-lg">{g.total}</span>
                </span>
              )}
            </div>
            <ul className="space-y-0.5 pl-3">
              {g.lines.map((l) => (
                <li key={l.key}>
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <TypeTag bonusType={l.bonusType} />
                    <span className="font-mono">{l.value}</span>
                  </div>
                  {l.detail && (
                    <div className="text-muted-foreground text-xs">
                      {l.detail}
                    </div>
                  )}
                </li>
              ))}
              {g.suppressed.map((s) => (
                <li key={s.key} className="text-muted-foreground">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate line-through">
                      {s.label}
                    </span>
                    <TypeTag bonusType={s.bonusType} dim />
                    <span className="font-mono line-through">
                      {formatBonus(s.value)}
                    </span>
                  </div>
                  <div className="text-xs">
                    {s.reason === 'excluded'
                      ? s.by
                      : `by ${s.by} — ${REASON[s.reason]}`}
                  </div>
                </li>
              ))}
              {g.waiting.map((w) => (
                <li key={w.key} className="text-muted-foreground/70">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate">{w.label}</span>
                    <TypeTag bonusType={w.bonusType} dim />
                    <span className="font-mono">{formatBonus(w.value)}</span>
                  </div>
                  <div className="text-xs">
                    only {w.waitingOn} — not now
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const v3Slots: SheetVariantSlots = {
  Defenses,
  Offense,
  BreakdownExtra,
  replacesConditionalSection: true,
  SkillExtra,
  VitalExtra,
};
