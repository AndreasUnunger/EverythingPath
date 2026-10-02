'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": one
// dense row per Spell, shared by the record view, the add-mode browser and
// a `none` caster's class list. Name, tags and the record toggle sit on one
// line; the school is an abbreviation (full name in `title`); the
// description is one clamped line from tablet width and opens on a tap of
// the name on phone. Contract: CONTRACT.md, "The spells page, second pass".

import { Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/lib/utils';
import { useBuilderStore } from '../store';
import {
  SCHOOL_LABEL,
  levelText,
  ordinal,
  type ResolvedSpellcasting,
  type SpellChoice,
} from '../spellcasting';
import type { Character } from '../types';
import type { Warning } from '../warnings';
import { SCHOOL_ABBR, levelLabel } from './s3-bits';
import { FieldWarnings, NumField, chip } from './shared';

// ---------------------------------------------------------------- switch

/**
 * The record switch: the app's square check (as `ActiveToggle` in Gear),
 * inside a 44px target on phone, 36px from tablet width.
 */
export function RecordSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={`${label}: ${checked ? 'recorded' : 'not recorded'}`}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center md:min-h-9 md:min-w-9"
    >
      <span
        className={cn(
          'inline-flex size-6 items-center justify-center border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-foreground/40 group-hover:border-foreground text-transparent',
        )}
      >
        <Check aria-hidden className="size-4" />
      </span>
    </button>
  );
}

// ------------------------------------------------------------------- rows

const tag = cn(chip, 'px-1 py-0 text-[11px] whitespace-nowrap');
const amber = 'border-amber-500/60 text-amber-300';
const sky = 'border-sky-400/60 text-sky-300';

export type RowProps = {
  choice: SpellChoice;
  sc: ResolvedSpellcasting;
  character: Character;
  warnings: Warning[];
  /** A `none` caster's list: no toggle. */
  readOnly: boolean;
};

export function SpellRow({
  choice,
  sc,
  character,
  warnings,
  readOnly,
}: RowProps) {
  const store = useBuilderStore();
  const [open, setOpen] = useState(false);
  const { catalog, level } = choice;
  const recorded = choice.recordedEntryId
    ? sc.recorded.find((r) => r.entry.id === choice.recordedEntryId)
    : undefined;
  const granted = choice.granted
    ? sc.granted.find((g) => g.catalog.key === catalog.key)
    : undefined;
  const offList = recorded?.offList ?? false;
  const tooHigh = recorded ? recorded.tooHigh : choice.tooHigh;
  const dim = tooHigh && !recorded && !granted;
  const showSwitch = !readOnly && (!granted || recorded);
  const school = catalog.detail.school;
  const summary =
    catalog.summary ??
    (catalog.detail.subschools.length > 0
      ? catalog.detail.subschools.join(', ')
      : '');
  // "Arcane bloodline"; the class level it came at joins from tablet width.
  const grantedAt =
    granted && granted.grantedAtClassLevel !== null
      ? ` · ${sc.className.toLowerCase()} ${granted.grantedAtClassLevel}`
      : '';

  const toggle = (next: boolean) => {
    if (next) store.addSpell(character.id, sc.classKey, catalog.key);
    else if (choice.recordedEntryId)
      store.removeEntry(character.id, choice.recordedEntryId);
  };

  return (
    <li
      id={recorded ? `s3-entry-${recorded.entry.id}` : undefined}
      className={cn(
        'border-foreground/10 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b py-0.5 last:border-b-0 md:grid-cols-[2.5rem_3rem_minmax(0,19rem)_minmax(0,1fr)_auto] md:gap-x-3 lg:grid-cols-[2.5rem_3rem_minmax(0,23rem)_minmax(0,1fr)_auto]',
        dim && 'opacity-50',
      )}
    >
      {/* level */}
      <span className="col-start-1 row-start-1 flex items-center justify-center">
        {offList && recorded ? (
          <NumField
            ariaLabel={`${catalog.name} level`}
            value={recorded.entry.state.level}
            todo={recorded.entry.state.level === null}
            width="w-9"
            className="h-7 text-sm"
            onChange={(v) =>
              store.setSpellLevel(character.id, recorded.entry.id, v)
            }
          />
        ) : (
          <span
            className={cn(
              'font-mono text-base',
              level === null && 'text-muted-foreground',
            )}
          >
            {levelLabel(level)}
          </span>
        )}
      </span>

      {/* school (tablet+): an abbreviation, never truncated */}
      <span
        className="text-muted-foreground hidden font-mono text-sm md:col-start-2 md:row-start-1 md:inline"
        title={SCHOOL_LABEL[school]}
        aria-label={SCHOOL_LABEL[school]}
      >
        {SCHOOL_ABBR[school]}
      </span>

      {/* name + tags */}
      <span className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:col-start-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 text-left font-sans text-base leading-tight md:hidden"
        >
          {catalog.name}
        </button>
        <span className="hidden font-sans text-base leading-tight md:inline">
          {catalog.name}
        </span>
        <span
          className="text-muted-foreground font-mono text-xs md:hidden"
          title={SCHOOL_LABEL[school]}
        >
          {SCHOOL_ABBR[school]}
        </span>
        {choice.opposition && (
          <span
            className={cn(tag, amber)}
            title="Opposition school: takes two slots to prepare"
          >
            2 slots
          </span>
        )}
        {granted && (
          <span
            className={cn(tag, sky)}
            title={`Granted by ${granted.from.join(' and ')}${grantedAt}: always available, never recorded`}
          >
            granted · {granted.from.join(', ')}
            {grantedAt && (
              // The chip is a flex box: a plain leading space would collapse.
              <span className="hidden md:inline">
                {grantedAt.replace(/^ /, ' ')}
              </span>
            )}
          </span>
        )}
        {choice.domainSlotOnly && (
          <span
            className={cn(tag, sky)}
            title={`Not on the ${sc.className.toLowerCase()} list: prepared only in the domain slot`}
          >
            domain slot only
          </span>
        )}
        {tooHigh && level !== null && (
          <span
            className={cn(tag, recorded ? amber : 'text-muted-foreground')}
            title={
              sc.highestLevel === null
                ? `${sc.className} can’t cast spells yet`
                : `${sc.className} casts up to ${ordinal(sc.highestLevel)} level now`
            }
          >
            too high
          </span>
        )}
        {!choice.onList && !granted && (
          <span
            className={cn(tag, recorded ? amber : 'text-muted-foreground')}
            title={`Not on the ${sc.className.toLowerCase()} list`}
          >
            off-list
          </span>
        )}
      </span>

      {/* description, one line (tablet+) */}
      <span
        className="text-muted-foreground hidden min-w-0 truncate text-sm md:col-start-4 md:row-start-1 md:block"
        title={summary || undefined}
      >
        {summary}
      </span>

      {/* switch */}
      <span className="col-start-3 row-start-1 flex justify-end md:col-start-5">
        {showSwitch && (
          <RecordSwitch
            checked={Boolean(choice.recordedEntryId)}
            label={`Record ${catalog.name}`}
            onChange={toggle}
          />
        )}
      </span>

      {/* description, opened by a tap (phone) */}
      {open && (
        <span className="text-muted-foreground col-span-2 col-start-2 pb-1.5 text-xs md:hidden">
          {SCHOOL_LABEL[school]}
          {summary && ` · ${summary}`}
        </span>
      )}

      {recorded && (
        <FieldWarnings
          warnings={warnings}
          where={`entry:${recorded.entry.id}`}
          characterId={character.id}
          className="col-span-full pb-1 md:col-start-3"
        />
      )}
    </li>
  );
}

// ----------------------------------------------------------------- groups

export type Group = { level: number | null; rows: SpellChoice[] };

export function groupByLevel(rows: SpellChoice[]): Group[] {
  const map = new Map<number | null, SpellChoice[]>();
  for (const c of rows) map.set(c.level, [...(map.get(c.level) ?? []), c]);
  return [...map.entries()]
    .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
    .map(([level, rows]) => ({ level, rows }));
}

/** A level's heading: "1st-level · 3/3 known · 1 granted · 4 prepared", or a plain count. */
export function LevelHeading({
  level,
  sc,
  counts,
  count,
}: {
  level: number | null;
  sc: ResolvedSpellcasting;
  /** The record view: show known x/y, granted and prepared from the table row. */
  counts: boolean;
  count: number;
}) {
  const row =
    level === null ? undefined : sc.rows.find((r) => r.level === level);
  const over = row && row.known !== null && row.recorded > row.known;
  return (
    <li className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 pt-2 pb-0.5 font-mono text-xs tracking-wide uppercase first:pt-0">
      <span className="text-foreground">
        {level === null ? 'Level not set' : levelText(level)}
      </span>
      {counts && row && row.known !== null ? (
        <span className={cn(over && 'text-amber-300')}>
          {row.recorded}/{row.known} known
        </span>
      ) : (
        <span>{count}</span>
      )}
      {counts && row && row.granted > 0 && <span>{row.granted} granted</span>}
      {counts && row?.prepared !== null && row?.prepared !== undefined && (
        <span>{row.prepared} prepared</span>
      )}
    </li>
  );
}

export function GroupRows({
  group,
  counts,
  rowProps,
}: {
  group: Group;
  counts: boolean;
  rowProps: Omit<RowProps, 'choice'>;
}) {
  return (
    <>
      <LevelHeading
        level={group.level}
        sc={rowProps.sc}
        counts={counts}
        count={group.rows.length}
      />
      {group.rows.map((c) => (
        <SpellRow key={c.catalog.key} choice={c} {...rowProps} />
      ))}
    </>
  );
}
