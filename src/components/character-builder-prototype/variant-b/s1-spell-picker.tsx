'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 1, "Spell cards": the
// Spell picker. A shadcn Sheet (a side panel from `md`, a bottom sheet on
// phone) listing one Spellcasting's class list: search, a level filter and,
// in `add` mode, an "include other lists" toggle for off-list Spells. Tapping
// a row records the Spell at once (tapping again removes it). `browse` mode
// is the read-only class list for a `none` Spellcasting (cleric, paladin).

import { Check, Plus } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import {
  SCHOOL_LABEL,
  classSpellList,
  levelText,
  ordinal,
  spellChoices,
  type ResolvedSpellcasting,
  type SpellChoice,
} from '../spellcasting';
import { useBuilderStore } from '../store';
import type { Character } from '../types';
import { ActiveToggle, TextField, chip } from './shared';

// ------------------------------------------------------------ breakpoint

// `md` (768px): a side panel from there, a bottom sheet below (as the
// routine editor does). Without `matchMedia` the answer is true.
const md = '(min-width: 768px)';
function mediaQuery() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(md)
    : null;
}
function subscribe(listener: () => void) {
  const query = mediaQuery();
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}
function useIsMd() {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? true,
    () => true,
  );
}

// ---------------------------------------------------------------- helpers

const label =
  'text-muted-foreground font-mono text-[11px] tracking-wide uppercase';
const filterChip = cn(
  chip,
  'hover:bg-foreground/10 min-h-8 shrink-0 px-2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground',
);

/** The rows of the read-only class list, in the picker's row shape. */
function browseRows(sc: ResolvedSpellcasting): SpellChoice[] {
  return classSpellList(sc.classKey).map(({ catalog, level }) => ({
    catalog,
    level,
    onList: true,
    recordedEntryId: null,
    granted: sc.granted.some((g) => g.catalog.key === catalog.key),
    tooHigh: sc.highestLevel === null || level > sc.highestLevel,
    opposition: Boolean(sc.school?.opposition.includes(catalog.detail.school)),
  }));
}

function matches(row: SpellChoice, q: string) {
  if (!q) return true;
  const hay =
    `${row.catalog.name} ${SCHOOL_LABEL[row.catalog.detail.school]} ${row.catalog.summary ?? ''}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

/** Rows grouped by level (unknown level last), keeping the given order. */
function groupByLevel(rows: SpellChoice[]) {
  const groups = new Map<number | null, SpellChoice[]>();
  for (const r of rows) {
    const list = groups.get(r.level) ?? [];
    list.push(r);
    groups.set(r.level, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (a ?? 99) - (b ?? 99));
}

// ----------------------------------------------------------------- picker

export function SpellPicker({
  character,
  sc,
  mode,
  onClose,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  /** `add`: record Spells for a `known` or `book` Spellcasting. `browse`: the read-only class list. */
  mode: 'add' | 'browse';
  onClose: () => void;
}) {
  const store = useBuilderStore();
  const isMd = useIsMd();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [offList, setOffList] = useState(false);

  const rows =
    mode === 'add'
      ? spellChoices(character, sc.classKey, { offList })
      : browseRows(sc);
  const levels = [
    ...new Set(rows.flatMap((r) => (r.level === null ? [] : [r.level]))),
  ].sort((a, b) => a - b);
  const shown = rows.filter(
    (r) => matches(r, q) && (level === null || r.level === level),
  );
  const groups = groupByLevel(shown);
  const list = sc.className.toLowerCase();
  const highest = sc.highestLevel === null ? null : ordinal(sc.highestLevel);

  const toggle = (row: SpellChoice) => {
    if (mode !== 'add' || row.granted) return;
    if (row.recordedEntryId)
      store.removeEntry(character.id, row.recordedEntryId);
    else store.addSpell(character.id, sc.classKey, row.catalog.key);
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        className={cn(
          'flex flex-col gap-0',
          isMd ? 'w-full sm:max-w-md' : 'max-h-[85vh]',
        )}
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-sans text-xl font-normal">
            {mode === 'add'
              ? `Add Spells · ${sc.className}`
              : `The ${list} list`}
          </SheetTitle>
          <SheetDescription>
            {mode === 'add'
              ? `Tap a Spell to add it to the ${sc.heading?.toLowerCase() ?? 'list'}; tap it again to remove it.`
              : highest === null
                ? `${sc.className} casts from the whole list without recording Spells; no spells yet.`
                : `${sc.className} casts from the whole list without recording Spells. Levels above ${highest} are dimmed.`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-4">
          <TextField
            ariaLabel="Search Spells"
            value={q}
            onChange={setQ}
            placeholder="Search by name, school or effect"
            className="min-h-11 w-full md:min-h-9"
          />
          <div
            role="group"
            aria-label="Spell level"
            className="flex gap-1 overflow-x-auto pb-0.5"
          >
            <button
              type="button"
              aria-pressed={level === null}
              onClick={() => setLevel(null)}
              className={filterChip}
            >
              All
            </button>
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                onClick={() => setLevel(level === l ? null : l)}
                className={filterChip}
              >
                {ordinal(l)}
              </button>
            ))}
          </div>
          {mode === 'add' && (
            <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
              <ActiveToggle
                active={offList}
                onChange={setOffList}
                label="Include other lists"
              />
              <span className="whitespace-nowrap">Include other lists</span>
              <span className="text-muted-foreground hidden text-xs sm:inline">
                off-list Spells get their own level
              </span>
            </label>
          )}
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4">
          {groups.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {q
                ? `No Spell matches “${q}”${level === null ? '' : ` at ${ordinal(level)} level`}.`
                : `Nothing on the ${list} list at this level.`}
            </p>
          )}
          {groups.map(([lvl, items]) => (
            <section key={lvl ?? 'none'} className="mb-2">
              <h3
                className={cn(
                  label,
                  'bg-background border-foreground/15 sticky top-0 z-10 border-b py-1',
                )}
              >
                {lvl === null ? 'Level unknown' : levelText(lvl)}
                <span className="ml-2 tracking-normal normal-case">
                  {items.length}
                </span>
              </h3>
              <ul>
                {items.map((row) =>
                  mode === 'add' ? (
                    <li key={row.catalog.key}>
                      <button
                        type="button"
                        aria-pressed={Boolean(row.recordedEntryId)}
                        disabled={row.granted}
                        onClick={() => toggle(row)}
                        title={
                          row.granted
                            ? 'Granted: always available, nothing to record'
                            : row.recordedEntryId
                              ? 'Added · tap to remove'
                              : 'Tap to add'
                        }
                        className={cn(
                          'hover:bg-foreground/5 focus-visible:ring-ring/50 border-foreground/10 flex min-h-11 w-full items-center gap-2 border-b px-1 py-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset disabled:cursor-default disabled:hover:bg-transparent md:min-h-9',
                          row.recordedEntryId && 'bg-foreground/5',
                          row.granted && 'text-muted-foreground',
                        )}
                      >
                        <RowBody row={row} />
                        <span
                          aria-hidden
                          className="flex w-6 shrink-0 justify-center"
                        >
                          {row.recordedEntryId ? (
                            <Check className="text-primary size-4" />
                          ) : row.granted ? null : (
                            <Plus className="text-muted-foreground size-4" />
                          )}
                        </span>
                        <span className="sr-only">
                          {row.recordedEntryId
                            ? 'Added'
                            : row.granted
                              ? 'Granted'
                              : 'Not added'}
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li
                      key={row.catalog.key}
                      className={cn(
                        'border-foreground/10 flex min-h-9 items-center gap-2 border-b px-1 py-1.5',
                        row.tooHigh && 'opacity-50',
                      )}
                    >
                      <RowBody row={row} />
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-foreground/15 flex items-center justify-between gap-2 border-t p-4">
          <span className="text-muted-foreground text-xs">
            {mode === 'add' && sc.heading
              ? `${sc.heading}: ${sc.recorded.length} ${sc.recorded.length === 1 ? 'Spell' : 'Spells'}`
              : `${rows.length} Spells on the ${list} list`}
          </span>
          <Button
            variant="outline"
            className="min-h-11 rounded-none font-sans md:min-h-9"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RowBody({ row }: { row: SpellChoice }) {
  return (
    <>
      <span className="text-muted-foreground w-7 shrink-0 font-mono text-sm">
        {row.level === null ? '?' : ordinal(row.level)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-sans text-sm leading-tight">
            {row.catalog.name}
          </span>
          <span className="text-muted-foreground text-xs">
            {SCHOOL_LABEL[row.catalog.detail.school].toLowerCase()}
          </span>
          {!row.onList && (
            <span className={cn(chip, 'text-muted-foreground')}>
              other list
            </span>
          )}
          {row.granted && (
            <span className={cn(chip, 'border-dashed')}>granted</span>
          )}
          {row.opposition && (
            <span
              className={chip}
              title="Opposition school: takes two slots to prepare"
            >
              2 slots
            </span>
          )}
          {row.tooHigh && (
            <span className={cn(chip, 'border-amber-500/60 text-amber-300')}>
              too high
            </span>
          )}
        </span>
        {row.catalog.summary && (
          <span className="text-muted-foreground block truncate text-xs">
            {row.catalog.summary}
          </span>
        )}
      </span>
    </>
  );
}
