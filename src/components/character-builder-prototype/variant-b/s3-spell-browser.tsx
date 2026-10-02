'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": the
// class-list browser, one spell level at a time. It is the page's add mode
// (`add=1`: every row has the record toggle) and a `none` caster's whole
// page (read-only). Level tabs, a search (across every level), a school
// filter and "Include other lists" live in the URL (`level`, `school`, `q`,
// `other`). Contract: CONTRACT.md, "The spells page, second pass".

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { useProtoNav } from '../nav';
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
import { GroupRows, SpellRow, groupByLevel } from './s3-spell-rows';
import { PickField, TextField, chip } from './shared';

function FilterChip({
  pressed,
  onClick,
  children,
  className,
  title,
  role,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  role?: 'tab';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role ? undefined : pressed}
      aria-selected={role ? pressed : undefined}
      title={title}
      onClick={onClick}
      className={cn(
        chip,
        'hover:bg-foreground/10 min-h-11 shrink-0 px-2.5 md:min-h-8',
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

/** The params the browser owns; cleared when the mode is left. */
export const BROWSER_PARAMS = {
  add: null,
  level: null,
  school: null,
  q: null,
  other: null,
};

/**
 * The level the browser opens on: for a recording caster the lowest castable
 * level with Spells still to record, for a `none` caster its highest
 * castable level; else 1st (or the first level the list has).
 */
function defaultLevel(
  sc: ResolvedSpellcasting,
  choices: SpellChoice[],
  levels: number[],
) {
  const castable = (l: number) =>
    sc.highestLevel !== null && l <= sc.highestLevel;
  if (sc.casting.record === 'none') {
    if (sc.highestLevel !== null && levels.includes(sc.highestLevel))
      return sc.highestLevel;
  } else {
    const open = levels.find(
      (l) =>
        castable(l) &&
        choices.some(
          (c) => c.level === l && c.onList && !c.recordedEntryId && !c.granted,
        ),
    );
    if (open !== undefined) return open;
  }
  return levels.includes(1) ? 1 : (levels[0] ?? 1);
}

export function SpellBrowser({
  character,
  sc,
  warnings,
  onDone,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
  /** Leaves add mode (a recording caster). */
  onDone?: () => void;
}) {
  const nav = useProtoNav();
  const readOnly = sc.casting.record === 'none';
  const school = (nav.param('school') ?? null) as SchoolKey | null;
  const other = !readOnly && nav.param('other') === '1';
  const urlQ = nav.param('q') ?? '';
  const [q, setQ] = useState(urlQ);

  // The search box writes to the URL a beat after typing stops.
  useEffect(() => {
    if (q === urlQ) return;
    const t = window.setTimeout(() => nav.set({ q: q || null }), 250);
    return () => window.clearTimeout(t);
  }, [q, urlQ, nav]);

  // The class list, plus recorded and granted Spells off it; with "Include
  // other lists", every Spell.
  const choices = useMemo(
    () => spellChoices(character, sc.classKey, { offList: other }),
    [character, sc.classKey, other],
  );
  const levels = useMemo(
    () =>
      [
        ...new Set(
          choices.map((c) => c.level).filter((l): l is number => l !== null),
        ),
      ].sort((a, b) => a - b),
    [choices],
  );
  const levelParam = nav.param('level');
  const level =
    levelParam !== null && levelParam !== '' && levels.includes(+levelParam)
      ? Number(levelParam)
      : defaultLevel(sc, choices, levels);

  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;
  const visible = choices.filter((c) => {
    if (school && c.catalog.detail.school !== school) return false;
    if (searching) return c.catalog.name.toLowerCase().includes(needle);
    return c.level === level;
  });
  const rowProps = { sc, character, warnings, readOnly };
  const recordedHere = visible.filter((c) => c.recordedEntryId).length;
  const grantedHere = visible.filter((c) => c.granted).length;
  const castsUpTo =
    sc.highestLevel === null
      ? `${sc.className} can’t cast spells yet`
      : `${sc.className} casts up to ${ordinal(sc.highestLevel)} level now`;

  return (
    <div className="space-y-2">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 basis-full items-center md:flex-none md:basis-64">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute left-2 size-4"
          />
          <TextField
            ariaLabel={`Search the ${sc.className.toLowerCase()} list`}
            value={q}
            placeholder="Search all levels"
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
            pressed={other}
            onClick={() => nav.set({ other: other ? null : '1' })}
            title="Also show Spells from other classes’ lists (recorded off-list)"
          >
            Include other lists
          </FilterChip>
        )}
      </div>

      {/* level tabs */}
      <div
        role="tablist"
        aria-label="Spell level"
        className={cn(
          '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:px-0 md:pb-0',
          searching && 'opacity-50',
        )}
      >
        {levels.map((l) => {
          const high = sc.highestLevel === null || l > sc.highestLevel;
          return (
            <FilterChip
              key={l}
              role="tab"
              pressed={!searching && level === l}
              onClick={() => {
                setQ('');
                nav.set({ level: String(l), q: null });
              }}
              className={cn('min-w-11 justify-center', high && 'opacity-70')}
              title={high ? castsUpTo : undefined}
            >
              {ordinal(l)}
            </FilterChip>
          );
        })}
      </div>

      {/* the rows */}
      <section aria-label={searching ? 'Search results' : levelText(level)}>
        <h3 className="text-muted-foreground mb-0.5 flex flex-wrap items-baseline gap-x-2 pt-1 font-mono text-xs tracking-wide uppercase">
          {searching ? (
            <span className="text-foreground">
              {visible.length} match{visible.length === 1 ? '' : 'es'} for “
              {q.trim()}”
            </span>
          ) : (
            <>
              <span className="text-foreground">{levelText(level)}</span>
              <span>
                {visible.length} on the {sc.className.toLowerCase()} list
                {other && ' and others'}
              </span>
              {recordedHere > 0 && <span>· {recordedHere} recorded</span>}
              {grantedHere > 0 && <span>· {grantedHere} granted</span>}
              {sc.highestLevel !== null && level > sc.highestLevel && (
                <span className="text-amber-300 normal-case">
                  · {castsUpTo}
                </span>
              )}
            </>
          )}
        </h3>
        {visible.length === 0 ? (
          <p className="text-muted-foreground border-foreground/20 border border-dashed p-3 text-sm">
            {searching
              ? `Nothing on ${other ? 'any list' : `the ${sc.className.toLowerCase()} list`} matches “${q.trim()}”${school ? ` in ${SCHOOL_LABEL[school]}` : ''}.`
              : `No ${levelText(level)} ${school ? `${SCHOOL_LABEL[school].toLowerCase()} ` : ''}Spells on the list.`}
          </p>
        ) : searching ? (
          <ul>
            {groupByLevel(visible).map((g) => (
              <GroupRows
                key={g.level ?? 'unset'}
                group={g}
                counts={false}
                rowProps={rowProps}
              />
            ))}
          </ul>
        ) : (
          <ul>
            {visible.map((c) => (
              <SpellRow key={c.catalog.key} choice={c} {...rowProps} />
            ))}
          </ul>
        )}
      </section>

      {onDone && (
        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            onClick={onDone}
            className="min-h-11 md:min-h-9"
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
