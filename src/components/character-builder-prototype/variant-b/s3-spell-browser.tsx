'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": the
// class-list browser. Picker and list are one thing: every Spell on the class
// list is a row with a record switch; recorded (and granted) Spells are
// pinned in a group at the top, the rest of the list follows, both grouped
// by level. Filters live in the URL (`level`, `school`, `q`, `recorded`,
// `other`, `high`). A `none` Spellcasting gets the same browser read-only.
// Contract: CONTRACT.md, "Round 4".

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { useProtoNav } from '../nav';
import { useBuilderStore } from '../store';
import {
  SCHOOL_LABEL,
  levelText,
  ordinal,
  spellChoices,
  type ResolvedSpellcasting,
  type SpellChoice,
} from '../spellcasting';
import { SCHOOLS, type Character, type SchoolKey } from '../types';
import type { Warning } from '../warnings';
import { levelLabel } from './s3-bits';
import { FieldWarnings, NumField, PickField, TextField, chip } from './shared';

// ---------------------------------------------------------------- switch

/** The record switch: a 44px target on phone, 36px from tablet width. */
function RecordSwitch({
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
      title={label}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center md:min-h-9 md:min-w-9"
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 items-center border transition-colors',
          checked
            ? 'border-primary bg-primary'
            : 'border-foreground/40 bg-foreground/5 group-hover:border-foreground/80',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] size-3 transition-transform',
            checked
              ? 'bg-primary-foreground translate-x-[19px]'
              : 'bg-foreground/70 translate-x-[3px]',
          )}
        />
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ chips

function FilterChip({
  pressed,
  onClick,
  children,
  className,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        chip,
        'hover:bg-foreground/10 min-h-9 shrink-0 px-2 md:min-h-7',
        pressed
          ? 'border-primary bg-primary/15 text-primary'
          : 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

const flagChip = cn(chip, 'px-1 py-0 text-[11px]');

// ------------------------------------------------------------------- rows

type RowProps = {
  choice: SpellChoice;
  sc: ResolvedSpellcasting;
  character: Character;
  warnings: Warning[];
  readOnly: boolean;
};

function SpellRow({ choice, sc, character, warnings, readOnly }: RowProps) {
  const store = useBuilderStore();
  const { catalog } = choice;
  const recorded = choice.recordedEntryId
    ? sc.recorded.find((r) => r.entry.id === choice.recordedEntryId)
    : undefined;
  const granted = sc.granted.find((g) => g.catalog.key === catalog.key);
  const level = recorded ? recorded.level : (granted?.level ?? choice.level);
  const offList = recorded?.offList ?? false;
  const tooHigh = recorded ? recorded.tooHigh : choice.tooHigh;
  const dim = tooHigh && !recorded && (readOnly || !choice.onList);
  const showSwitch = !readOnly && (!granted || recorded);

  const toggle = (next: boolean) => {
    if (next) store.addSpell(character.id, sc.classKey, catalog.key);
    else if (choice.recordedEntryId)
      store.removeEntry(character.id, choice.recordedEntryId);
  };

  return (
    <li
      id={recorded ? `s3-entry-${recorded.entry.id}` : undefined}
      className={cn(
        'border-foreground/10 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b py-1.5 last:border-b-0 md:grid-cols-[2.5rem_minmax(0,15rem)_6.5rem_minmax(0,1fr)_auto] md:py-1',
        dim && 'opacity-50',
      )}
    >
      {/* level */}
      <span className="flex items-center justify-center">
        {offList && recorded ? (
          <NumField
            ariaLabel={`${catalog.name} level`}
            value={recorded.entry.state.level}
            todo={recorded.entry.state.level === null}
            width="w-10"
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

      {/* name + flags */}
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-sans text-base leading-tight">
          {catalog.name}
        </span>
        {choice.opposition && (
          <span
            className={cn(flagChip, 'border-amber-500/60 text-amber-300')}
            title="Opposition school: takes two slots to prepare"
          >
            2 slots
          </span>
        )}
        {granted && (
          <span
            className={cn(flagChip, 'border-sky-400/60 text-sky-300')}
            title={`Granted by ${granted.from.join(' and ')}: always available, never recorded`}
          >
            granted · {granted.from.join(', ')}
          </span>
        )}
        {tooHigh && level !== null && (
          <span
            className={cn(
              flagChip,
              recorded
                ? 'border-amber-500/60 text-amber-300'
                : 'text-muted-foreground',
            )}
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
            className={cn(
              flagChip,
              recorded ? 'border-amber-500/60 text-amber-300' : undefined,
            )}
            title={`Not on the ${sc.className.toLowerCase()} list`}
          >
            off-list
          </span>
        )}
      </span>

      {/* school (tablet+) */}
      <span className="text-muted-foreground hidden truncate text-sm md:inline">
        {SCHOOL_LABEL[catalog.detail.school]}
      </span>

      {/* summary */}
      <span className="text-muted-foreground col-start-2 text-xs md:col-start-auto md:text-sm">
        <span className="md:hidden">
          {SCHOOL_LABEL[catalog.detail.school]}
          {catalog.summary && ' · '}
        </span>
        {catalog.summary ?? (
          <span className="opacity-60">
            {catalog.detail.subschools.length > 0
              ? catalog.detail.subschools.join(', ')
              : ''}
          </span>
        )}
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

      {recorded && (
        <FieldWarnings
          warnings={warnings}
          where={`entry:${recorded.entry.id}`}
          characterId={character.id}
          className="col-span-full md:col-start-2"
        />
      )}
    </li>
  );
}

// ----------------------------------------------------------------- groups

type Group = { level: number | null; rows: SpellChoice[] };

function groupByLevel(
  rows: SpellChoice[],
  levelOf: (c: SpellChoice) => number | null,
): Group[] {
  const map = new Map<number | null, SpellChoice[]>();
  for (const c of rows) {
    const l = levelOf(c);
    map.set(l, [...(map.get(l) ?? []), c]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
    .map(([level, rows]) => ({ level, rows }));
}

function LevelHeading({
  level,
  sc,
  mine,
  count,
}: {
  level: number | null;
  sc: ResolvedSpellcasting;
  /** The pinned group: shows known x/y for `known` casters. */
  mine: boolean;
  count: number;
}) {
  const row =
    level === null ? undefined : sc.rows.find((r) => r.level === level);
  const over = row && row.known !== null && row.recorded > row.known;
  return (
    <li className="text-muted-foreground flex items-baseline gap-x-2 pt-2 pb-0.5 font-mono text-xs tracking-wide uppercase first:pt-0">
      <span>{level === null ? 'Level not set' : levelText(level)}</span>
      {mine && row && row.known !== null ? (
        <span className={cn(over && 'text-amber-300')}>
          {row.recorded}/{row.known} known
          {row.granted > 0 && ` · ${row.granted} granted`}
        </span>
      ) : (
        <span>{count}</span>
      )}
      {mine && row?.prepared !== null && row?.prepared !== undefined && (
        <span>{row.prepared} prepared</span>
      )}
    </li>
  );
}

// --------------------------------------------------------------- browser

export function SpellBrowser({
  character,
  sc,
  warnings,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
}) {
  const nav = useProtoNav();
  const readOnly = sc.casting.record === 'none';
  const levelParam = nav.param('level');
  const level =
    levelParam === null || levelParam === '' ? null : Number(levelParam);
  const school = (nav.param('school') ?? null) as SchoolKey | null;
  const recordedOnly = nav.param('recorded') === '1';
  const other = nav.param('other') === '1';
  const showHigh = nav.param('high') === '1';
  const urlQ = nav.param('q') ?? '';
  const [q, setQ] = useState(urlQ);

  // The search box writes to the URL a beat after typing stops.
  useEffect(() => {
    if (q === urlQ) return;
    const t = window.setTimeout(() => nav.set({ q: q || null }), 250);
    return () => window.clearTimeout(t);
  }, [q, urlQ, nav]);

  const isMine = (c: SpellChoice) => c.recordedEntryId !== null || c.granted;
  // Every Spell, so recorded and granted off-list ones are always in; the
  // rest of the other lists only with "Include other lists".
  const choices = useMemo(
    () =>
      spellChoices(character, sc.classKey, { offList: true }).filter(
        (c) => c.onList || other || isMine(c),
      ),
    [character, sc.classKey, other],
  );
  const levelOf = (c: SpellChoice) =>
    c.recordedEntryId
      ? (sc.recorded.find((r) => r.entry.id === c.recordedEntryId)?.level ??
        null)
      : c.granted
        ? (sc.granted.find((g) => g.catalog.key === c.catalog.key)?.level ??
          c.level)
        : c.level;

  const levels = [
    ...new Set(choices.map(levelOf).filter((l): l is number => l !== null)),
  ].sort((a, b) => a - b);

  const needle = q.trim().toLowerCase();
  const matches = (c: SpellChoice) => {
    const l = levelOf(c);
    if (level !== null && l !== level) return false;
    if (school && c.catalog.detail.school !== school) return false;
    if (recordedOnly && !isMine(c)) return false;
    if (readOnly && !showHigh && level === null && c.tooHigh && !c.granted)
      return false;
    if (needle && !c.catalog.name.toLowerCase().includes(needle)) return false;
    return true;
  };

  const visible = choices.filter(matches);
  const mine = groupByLevel(visible.filter(isMine), levelOf);
  const rest = groupByLevel(
    visible.filter((c) => !isMine(c)),
    levelOf,
  );
  const mineCount = sc.recorded.length + sc.granted.length;
  const hiddenHigh =
    readOnly && !showHigh && level === null
      ? choices.filter((c) => c.tooHigh && !c.granted && !recordedOnly).length
      : 0;

  const mineTitle = readOnly
    ? `Granted (${sc.granted.length})`
    : `${sc.heading ?? 'Recorded'} (${sc.recorded.length}${
        sc.granted.length > 0 ? ` + ${sc.granted.length} granted` : ''
      })`;

  const rowProps = { sc, character, warnings, readOnly };

  return (
    <div className="space-y-3">
      {readOnly && (
        <p className="text-muted-foreground text-sm">
          A {sc.className.toLowerCase()} prepares from the whole list; nothing
          to record. Granted Spells are marked. Levels it can’t cast yet are
          hidden until you show them.
        </p>
      )}

      {/* filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex min-w-0 flex-1 basis-full items-center md:flex-none md:basis-64">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute left-2 size-4"
            />
            <TextField
              ariaLabel={`Search the ${sc.className.toLowerCase()} list`}
              value={q}
              placeholder="Search spells"
              onChange={setQ}
              className="min-h-11 w-full pl-8 md:min-h-9"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQ('')}
                className="text-muted-foreground hover:text-foreground absolute right-1 flex size-9 items-center justify-center"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <PickField<SchoolKey>
            ariaLabel="School"
            value={school}
            placeholder="All schools"
            options={SCHOOLS.map((s) => ({ value: s, label: SCHOOL_LABEL[s] }))}
            onChange={(v) => nav.set({ school: v })}
            className="min-h-11 flex-1 md:min-h-9 md:w-44 md:flex-none [&>select]:h-full"
          />
          {!readOnly && (
            <FilterChip
              pressed={recordedOnly}
              onClick={() => nav.set({ recorded: recordedOnly ? null : '1' })}
            >
              Recorded only
            </FilterChip>
          )}
          {!readOnly && (
            <FilterChip
              pressed={other}
              onClick={() => nav.set({ other: other ? null : '1' })}
            >
              Include other lists
            </FilterChip>
          )}
          {readOnly && (
            <FilterChip
              pressed={showHigh}
              onClick={() => nav.set({ high: showHigh ? null : '1' })}
            >
              Show higher levels
            </FilterChip>
          )}
        </div>
        <div
          role="group"
          aria-label="Spell level"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:px-0 md:pb-0"
        >
          <FilterChip
            pressed={level === null}
            onClick={() => nav.set({ level: null })}
          >
            All levels
          </FilterChip>
          {levels.map((l) => (
            <FilterChip
              key={l}
              pressed={level === l}
              onClick={() => nav.set({ level: level === l ? null : String(l) })}
              className={cn(
                sc.highestLevel !== null && l > sc.highestLevel && 'opacity-70',
              )}
            >
              {ordinal(l)}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* pinned: recorded + granted */}
      <section aria-label={mineTitle}>
        <h3 className="text-muted-foreground mb-1 flex items-baseline gap-x-2 font-sans text-xs tracking-[0.15em] uppercase">
          <span className="text-foreground">{mineTitle}</span>
          {visible.filter(isMine).length !== mineCount && (
            <span>· {visible.filter(isMine).length} shown</span>
          )}
        </h3>
        {mineCount === 0 ? (
          <p className="text-muted-foreground border-foreground/20 border border-dashed p-3 text-sm">
            {readOnly
              ? 'No granted Spells.'
              : `Nothing recorded yet. Switch Spells on below to build the ${(sc.heading ?? 'list').toLowerCase()}.`}
          </p>
        ) : mine.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            None match these filters.
          </p>
        ) : (
          <ul className="border-foreground/20 bg-background/40 border px-2 py-1">
            {mine.map((g) => (
              <GroupRows
                key={g.level ?? 'unset'}
                group={g}
                mine
                rowProps={rowProps}
              />
            ))}
          </ul>
        )}
      </section>

      {/* the rest of the class list */}
      {!recordedOnly && (
        <section aria-label={`${sc.className} list`}>
          <h3 className="text-muted-foreground mb-1 flex flex-wrap items-baseline gap-x-2 font-sans text-xs tracking-[0.15em] uppercase">
            <span className="text-foreground">
              {sc.className} list
              {other && ' and other lists'}
            </span>
            <span>· {rest.reduce((n, g) => n + g.rows.length, 0)} more</span>
            {hiddenHigh > 0 && (
              <button
                type="button"
                onClick={() => nav.set({ high: '1' })}
                className="hover:text-foreground tracking-normal normal-case underline decoration-dotted underline-offset-2"
              >
                {hiddenHigh} higher-level hidden
              </button>
            )}
          </h3>
          {rest.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {visible.length === 0 && choices.length > 0
                ? 'Nothing matches these filters.'
                : 'Everything on the list is recorded.'}
            </p>
          ) : (
            <ul className="px-2">
              {rest.map((g) => (
                <GroupRows
                  key={g.level ?? 'unset'}
                  group={g}
                  mine={false}
                  rowProps={rowProps}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function GroupRows({
  group,
  mine,
  rowProps,
}: {
  group: Group;
  mine: boolean;
  rowProps: Omit<RowProps, 'choice'>;
}) {
  return (
    <>
      <LevelHeading
        level={group.level}
        sc={rowProps.sc}
        mine={mine}
        count={group.rows.length}
      />
      {group.rows.map((c) => (
        <SpellRow key={c.catalog.key} choice={c} {...rowProps} />
      ))}
    </>
  );
}
