'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 1, "Spell cards". A
// Spellcasting section with one card per Spellcasting (`spellcastingsOf`):
// the header numbers (caster level, concentration, casting ability, school,
// prestige advances), a compact slots grid (per day as table + bonus + extra
// slot, known, prepared, DC per level and per Spell Focus school), the
// recorded Spells by level, the granted Spells set apart, and a side-panel
// picker (s1-spell-picker.tsx). Orphaned Spells close the section.
// Contract: CONTRACT.md, "Round 4".

import { BookOpen, Pencil, Plus, Undo2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { CASTING_TABLES, cell } from '../casting-tables';
import { ABILITY_SHORT } from '../catalog';
import { className as classNameOf } from '../sheet';
import {
  SCHOOL_LABEL,
  levelText,
  ordinal,
  orphanedSpells,
  spellcastingsOf,
  type GrantedSpell,
  type RecordedSpell,
  type ResolvedSpellcasting,
  type SlotRow,
} from '../spellcasting';
import { useBuilderStore } from '../store';
import {
  SCHOOLS,
  type Casting,
  type Character,
  type SchoolKey,
} from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import { SpellPicker } from './s1-spell-picker';
import type { SpellSlotProps, SpellVariantSlots } from './sheet-variants';
import {
  Block,
  FieldWarnings,
  NumField,
  StatButton,
  blockHeading,
  chip,
  th,
} from './shared';

// ----------------------------------------------------------------- styles

const iconButton =
  'text-muted-foreground hover:text-foreground flex min-h-11 w-8 shrink-0 items-center justify-center md:min-h-7';
const figureLabel =
  'text-muted-foreground font-mono text-[11px] leading-none tracking-wide uppercase';
const chipButton = cn(chip, 'hover:bg-foreground/10 min-h-11 gap-1 md:min-h-7');
/** The three parts of "per day": the table, bonus spells, the extra slot. */
const tone = {
  base: 'text-foreground',
  bonus: 'text-sky-300',
  extra: 'text-violet-300',
};

const SPECIALIST: Record<SchoolKey, string> = {
  abjuration: 'Abjurer',
  conjuration: 'Conjurer',
  divination: 'Diviner',
  enchantment: 'Enchanter',
  evocation: 'Evoker',
  illusion: 'Illusionist',
  necromancy: 'Necromancer',
  transmutation: 'Transmuter',
  universal: 'Universalist',
};

// ---------------------------------------------------------------- helpers

/** The first casting level with any table entry (a paladin's 4). */
function firstCastingLevel(casting: Casting): number | null {
  const t = CASTING_TABLES[casting.table];
  for (let row = 1; row <= 20; row++)
    for (let level = 0; level <= 9; level++)
      if (
        cell(t.spellsPerDay, row, level) !== null ||
        cell(t.spellsKnown, row, level) !== null ||
        cell(t.preparedPerDay, row, level) !== null
      )
        return row;
  return null;
}

const schoolText = (s: SchoolKey) => SCHOOL_LABEL[s].toLowerCase();

const joinNames = (names: string[]) => [...new Set(names)].join(', ');

/** What a removed Spell needs to come back: the picker's `addSpell` call. */
type Removed = {
  name: string;
  castingClass: string;
  spellKey: string;
  level: number | null;
};

function useRemovedSpell(characterId: string) {
  const store = useBuilderStore();
  const [removed, setRemoved] = useState<Removed | null>(null);
  const remove = (
    entry: RecordedSpell['entry'],
    name: string,
    spellKey: string,
  ) => {
    setRemoved({
      name,
      castingClass: entry.state.castingClass,
      spellKey,
      level: entry.state.level,
    });
    store.removeEntry(characterId, entry.id);
  };
  const undo = () => {
    if (!removed) return;
    store.addSpell(
      characterId,
      removed.castingClass,
      removed.spellKey,
      removed.level,
    );
    setRemoved(null);
  };
  return { removed, remove, undo, dismiss: () => setRemoved(null) };
}

function RemovedLine({
  removed,
  onUndo,
  onDismiss,
}: {
  removed: Removed;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate">Removed “{removed.name}”.</span>
      <button type="button" onClick={onUndo} className={chipButton}>
        <Undo2 className="size-3" />
        Undo
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className={cn(iconButton, 'min-h-7')}
      >
        <X className="size-3.5" />
      </button>
    </p>
  );
}

// ---------------------------------------------------------------- section

function SpellcastingSection({ character, warnings }: SpellSlotProps) {
  const all = spellcastingsOf(character);
  const orphans = orphanedSpells(character);
  if (all.length === 0 && orphans.length === 0) return null;
  return (
    <Block id="b-spellcasting" title="Spellcasting">
      <div className="space-y-3">
        {all.map((sc) => (
          <SpellcastingCard
            key={sc.classKey}
            character={character}
            sc={sc}
            warnings={warnings}
          />
        ))}
        {orphans.length > 0 && (
          <OrphanedList
            character={character}
            orphans={orphans}
            warnings={warnings}
          />
        )}
      </div>
    </Block>
  );
}

// ------------------------------------------------------------------- card

function SpellcastingCard({
  character,
  sc,
  warnings,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
}) {
  const [picker, setPicker] = useState<'add' | 'browse' | null>(null);
  const undo = useRemovedSpell(character.id);
  const headingId = `s1-${sc.classKey}`;
  const grantedBy = joinNames(sc.granted.flatMap((g) => g.from));

  return (
    <article
      aria-labelledby={headingId}
      className="border-foreground/15 border p-3"
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-x-6">
        <CardHeader
          character={character}
          sc={sc}
          headingId={headingId}
          onOpen={setPicker}
        />
        <div className="mt-3 min-w-0 lg:mt-0">
          <SlotsGrid sc={sc} />
          <FieldWarnings
            warnings={warnings}
            where={`spellcasting:${sc.classKey}`}
            characterId={character.id}
            className="mt-2"
          />
        </div>
      </div>

      {sc.heading && (
        <RecordedList
          character={character}
          sc={sc}
          warnings={warnings}
          onAdd={() => setPicker('add')}
          onRemove={(r) => undo.remove(r.entry, r.catalog.name, r.catalog.key)}
        />
      )}
      {sc.granted.length > 0 && (
        <GrantedList granted={sc.granted} grantedBy={grantedBy} />
      )}
      {undo.removed && (
        <RemovedLine
          removed={undo.removed}
          onUndo={undo.undo}
          onDismiss={undo.dismiss}
        />
      )}
      {picker && (
        <SpellPicker
          character={character}
          sc={sc}
          mode={picker}
          onClose={() => setPicker(null)}
        />
      )}
    </article>
  );
}

// ----------------------------------------------------------------- header

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={figureLabel}>{label}</span>
      <span className="flex items-end">{children}</span>
    </div>
  );
}

/** A tiny sky diamond: the number has a situational part (Combat Casting). */
function SituationalMark() {
  return (
    <span
      role="img"
      aria-label="Has situational bonuses"
      className="pointer-events-none absolute -top-px -right-1 size-1.5 rotate-45 bg-sky-300"
    />
  );
}

function CardHeader({
  character,
  sc,
  headingId,
  onOpen,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  headingId: string;
  onOpen: (mode: 'add' | 'browse') => void;
}) {
  const ability = ABILITY_SHORT[sc.ability];
  const scoreChanged = sc.abilityScore !== sc.permanentScore;
  const until = sc.casterLevel ? null : firstCastingLevel(sc.casting);
  const list = sc.className.toLowerCase();

  return (
    <header className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className="font-sans text-lg leading-tight">
          {sc.className}
          <span className="text-muted-foreground text-sm">
            {' '}
            · {sc.heading ?? `casts from the ${list} list`}
          </span>
        </h3>
        {sc.heading ? (
          <button
            type="button"
            onClick={() => onOpen('add')}
            className={chipButton}
          >
            <Plus className="size-3" />
            Add Spells
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpen('browse')}
            className={chipButton}
          >
            <BookOpen className="size-3" />
            Browse the {list} list
          </button>
        )}
      </div>

      {sc.casterLevel && sc.concentration ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
          <Figure label="Caster level">
            <StatButton
              stat={sc.casterLevel}
              statKey={`${sc.classKey}:cl`}
              title={`${sc.className} caster level`}
            />
          </Figure>
          <Figure label="Concentration">
            <span className="relative inline-flex">
              <StatButton
                stat={sc.concentration}
                statKey={`${sc.classKey}:concentration`}
                title={`${sc.className} concentration`}
                signed
              />
              {sc.concentration.conditional.length > 0 && <SituationalMark />}
            </span>
          </Figure>
          <Figure label={ability}>
            <span
              className="inline-flex min-h-8 items-center gap-1 px-1 font-mono text-xl leading-none"
              title={
                scoreChanged
                  ? `${ability} ${sc.abilityScore} now; bonus spells use the permanent ${sc.permanentScore}`
                  : `Casting ability: DCs, concentration and bonus spells`
              }
            >
              {sc.abilityScore}
              <span className="text-muted-foreground text-base">
                ({formatBonus(sc.abilityMod)})
              </span>
              {scoreChanged && (
                <span className="text-muted-foreground text-xs">
                  · {sc.permanentScore} permanent
                </span>
              )}
            </span>
          </Figure>
          {sc.concentration.conditional.length > 0 && (
            <ul className="basis-full text-xs text-sky-300">
              {sc.concentration.conditional.map((c) => (
                <li
                  key={`${c.entryId ?? c.label}|${c.conditionText}`}
                  className="flex items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rotate-45 bg-sky-300"
                  />
                  <span>
                    <span className="font-mono">{formatBonus(c.value)}</span>{' '}
                    {c.conditionText} ({c.label})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          No spells{until === null ? ' yet' : ` until ${sc.className} ${until}`}
          {sc.castingLevel > 0 && until !== null && (
            <span className="font-mono">
              {' '}
              ({sc.castingLevel} of {until})
            </span>
          )}
          .
        </p>
      )}

      <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
        {sc.advances.length > 0 && (
          <p title="Prestige advances assigned to this Spellcasting; change them in the levels table">
            Casting level{' '}
            <span className="font-mono text-sm">{sc.castingLevel}</span> ={' '}
            {sc.className}{' '}
            <span className="font-mono text-sm">{sc.classLevels}</span> +{' '}
            {sc.advances.length}{' '}
            {sc.advances.length === 1 ? 'advance' : 'advances'}:{' '}
            {sc.advances.map((a) => a.label).join(', ')}
          </p>
        )}
        {sc.school && <SchoolLine character={character} school={sc.school} />}
      </div>
    </header>
  );
}

function SchoolLine({
  character,
  school,
}: {
  character: Character;
  school: NonNullable<ResolvedSpellcasting['school']>;
}) {
  const store = useBuilderStore();
  const [editing, setEditing] = useState(false);
  const toggle = (s: SchoolKey) =>
    store.setOppositionSchools(
      character.id,
      school.entryId,
      school.opposition.includes(s)
        ? school.opposition.filter((x) => x !== s)
        : [...school.opposition, s],
    );
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-1.5">
        <span className="text-foreground">{SPECIALIST[school.school]}</span>
        <span className="inline-flex flex-wrap items-center gap-x-1.5">
          <span>
            · opposition:{' '}
            {school.opposition.length
              ? school.opposition.map(schoolText).join(', ')
              : 'none chosen'}
          </span>
          <button
            type="button"
            aria-pressed={editing}
            aria-label="Change opposition schools"
            onClick={() => setEditing((v) => !v)}
            className={cn(iconButton, 'inline-flex min-h-7 w-6')}
          >
            <Pencil className="size-3" />
          </button>
        </span>
      </p>
      {editing && (
        <div
          role="group"
          aria-label="Opposition schools"
          className="mt-1 flex flex-wrap gap-1"
        >
          {SCHOOLS.filter((s) => s !== 'universal').map((s) => {
            const on = school.opposition.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s)}
                className={cn(
                  chipButton,
                  'min-h-9 md:min-h-7',
                  on && 'border-primary bg-primary text-primary-foreground',
                  s === school.school && !on && 'opacity-50',
                )}
                title={
                  s === school.school
                    ? 'The specialist school'
                    : on
                      ? 'Opposition school: Spells take two slots'
                      : undefined
                }
              >
                {SCHOOL_LABEL[s]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- slots grid

/** The per-day cell: total on top, the "3+2+1" parts underneath in their tones. */
function PerDay({ row, sc }: { row: SlotRow; sc: ResolvedSpellcasting }) {
  if (row.perDay === null)
    return (
      <span
        className="text-muted-foreground font-mono text-sm"
        title="Cantrips: cast at will"
      >
        at will
      </span>
    );
  const parts = row.bonus > 0 || row.extra > 0;
  const title = [
    `${row.base ?? 0} from the table`,
    row.bonus > 0 &&
      `${row.bonus} bonus ${row.bonus === 1 ? 'spell' : 'spells'} (${ABILITY_SHORT[sc.ability]} ${sc.permanentScore})`,
    row.extra > 0 && sc.extraSlot && `${row.extra} ${sc.extraSlot.label}`,
  ]
    .filter(Boolean)
    .join(' + ');
  return (
    <span
      className="flex flex-col items-start gap-0.5 leading-none"
      title={title}
    >
      <span className="font-mono text-xl">{row.perDay}</span>
      {parts && (
        <span className="font-mono text-xs leading-none">
          <span className={tone.base}>{row.base ?? 0}</span>
          {row.bonus > 0 && <span className={tone.bonus}>+{row.bonus}</span>}
          {row.extra > 0 && <span className={tone.extra}>+{row.extra}</span>}
        </span>
      )}
    </span>
  );
}

function Known({ row }: { row: SlotRow }) {
  if (row.known === null) return <Dash />;
  const over = row.recorded > row.known;
  return (
    <span
      className={cn('font-mono text-xl leading-none', over && 'text-amber-300')}
      title={`${row.recorded} recorded of ${row.known} Spells known${over ? ': over the table' : ''}`}
    >
      {row.recorded}
      <span className={cn('text-sm', !over && 'text-muted-foreground')}>
        /{row.known}
      </span>
    </span>
  );
}

function Dash() {
  return <span className="text-muted-foreground font-mono">—</span>;
}

function DcButton({
  sc,
  row,
  school,
  suffix,
}: {
  sc: ResolvedSpellcasting;
  row: SlotRow;
  school?: SchoolKey;
  /** Keeps the phone list's keys apart from the table's. */
  suffix: string;
}) {
  const dc = school ? row.dcBySchool.find((d) => d.school === school) : null;
  if (school && !dc) return <Dash />;
  return (
    <StatButton
      size="sm"
      stat={sc.dcStat(row.level, school)}
      statKey={`${sc.classKey}:dc:${row.level}:${school ?? 'any'}${suffix}`}
      title={`${sc.className} ${levelText(row.level)} ${school ? `${SCHOOL_LABEL[school]} ` : ''}spell DC`}
    />
  );
}

function SlotsGrid({ sc }: { sc: ResolvedSpellcasting }) {
  const rows = sc.rows;
  if (rows.length === 0) return null;
  const hasKnown = rows.some((r) => r.known !== null);
  const hasPrepared = rows.some((r) => r.prepared !== null);
  const isBook = sc.casting.record === 'book';
  const schools = [
    ...new Set(rows.flatMap((r) => r.dcBySchool.map((d) => d.school))),
  ];
  const hasBonus = rows.some((r) => r.bonus > 0);
  const hasExtra = rows.some((r) => r.extra > 0);
  const ability = ABILITY_SHORT[sc.ability];
  const rowTh = cn(th, 'whitespace-nowrap pl-0');
  const td = 'px-2 py-1 align-bottom';

  return (
    <div>
      {/* From md: spell levels as columns. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className={rowTh} scope="col">
                <span className="sr-only">Spell level</span>
              </th>
              {rows.map((r) => (
                <th
                  key={r.level}
                  scope="col"
                  className={cn(th, 'text-foreground min-w-14 text-sm')}
                >
                  {ordinal(r.level)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-foreground/15 border-t">
              <th scope="row" className={rowTh}>
                Per day
              </th>
              {rows.map((r) => (
                <td key={r.level} className={td}>
                  <PerDay row={r} sc={sc} />
                </td>
              ))}
            </tr>
            {hasPrepared && (
              <tr>
                <th scope="row" className={rowTh}>
                  Prepared
                </th>
                {rows.map((r) => (
                  <td key={r.level} className={td}>
                    {r.prepared === null ? (
                      <Dash />
                    ) : (
                      <span className="font-mono text-xl leading-none">
                        {r.prepared}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )}
            {hasKnown && (
              <tr>
                <th scope="row" className={rowTh}>
                  Known
                </th>
                {rows.map((r) => (
                  <td key={r.level} className={td}>
                    <Known row={r} />
                  </td>
                ))}
              </tr>
            )}
            {isBook && (
              <tr>
                <th scope="row" className={rowTh}>
                  In {sc.heading?.toLowerCase()}
                </th>
                {rows.map((r) => (
                  <td key={r.level} className={td}>
                    <span
                      className={cn(
                        'font-mono text-xl leading-none',
                        r.recorded === 0 && 'text-muted-foreground',
                      )}
                    >
                      {r.recorded}
                    </span>
                  </td>
                ))}
              </tr>
            )}
            <tr className="border-foreground/15 border-t">
              <th scope="row" className={rowTh}>
                DC
              </th>
              {rows.map((r) => (
                <td key={r.level} className={td}>
                  <DcButton sc={sc} row={r} suffix="" />
                </td>
              ))}
            </tr>
            {schools.map((s) => (
              <tr key={s}>
                <th scope="row" className={cn(rowTh, 'pl-3')}>
                  {SCHOOL_LABEL[s]}
                </th>
                {rows.map((r) => (
                  <td key={r.level} className={td}>
                    <DcButton sc={sc} row={r} school={s} suffix="" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one line per spell level. */}
      <ul className="divide-foreground/10 divide-y md:hidden">
        {rows.map((r) => (
          <li
            key={r.level}
            className="flex flex-wrap items-end gap-x-4 gap-y-1 py-1.5"
          >
            <span className="w-7 font-mono text-base leading-none">
              {ordinal(r.level)}
            </span>
            <Figure label="Per day">
              <PerDay row={r} sc={sc} />
            </Figure>
            {hasPrepared && (
              <Figure label="Prepared">
                <span className="font-mono text-xl leading-none">
                  {r.prepared ?? '—'}
                </span>
              </Figure>
            )}
            {hasKnown && (
              <Figure label="Known">
                <Known row={r} />
              </Figure>
            )}
            {isBook && (
              <Figure label={`In ${sc.heading?.toLowerCase()}`}>
                <span className="font-mono text-xl leading-none">
                  {r.recorded}
                </span>
              </Figure>
            )}
            <Figure label="DC">
              <DcButton sc={sc} row={r} suffix=":m" />
            </Figure>
            {r.dcBySchool.map((d) => (
              <Figure key={d.school} label={`${SCHOOL_LABEL[d.school]} DC`}>
                <DcButton sc={sc} row={r} school={d.school} suffix=":m" />
              </Figure>
            ))}
          </li>
        ))}
      </ul>

      {(hasBonus || hasExtra) && (
        <p className="text-muted-foreground mt-1.5 font-mono text-[11px] leading-tight">
          Per day = <span className={tone.base}>table</span>
          {hasBonus && (
            <>
              {' '}
              + <span className={tone.bonus}>bonus spells</span> ({ability}{' '}
              {sc.permanentScore})
            </>
          )}
          {hasExtra && sc.extraSlot && (
            <>
              {' '}
              + <span className={tone.extra}>{sc.extraSlot.label}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------- recorded list

function groupRecorded(list: RecordedSpell[]) {
  const groups = new Map<number | null, RecordedSpell[]>();
  for (const r of list) {
    const g = groups.get(r.level) ?? [];
    g.push(r);
    groups.set(r.level, g);
  }
  return [...groups.entries()].sort(([a], [b]) => (a ?? 99) - (b ?? 99));
}

function RecordedList({
  character,
  sc,
  warnings,
  onAdd,
  onRemove,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
  onAdd: () => void;
  onRemove: (r: RecordedSpell) => void;
}) {
  const store = useBuilderStore();
  const n = sc.recorded.length;
  return (
    <section className="border-foreground/15 mt-3 border-t pt-2">
      <h4 className={blockHeading}>
        {sc.heading}
        <span className="ml-2 font-mono text-sm tracking-normal normal-case">
          {n}
        </span>
      </h4>
      {n === 0 ? (
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          Nothing in the {sc.heading?.toLowerCase()} yet.
          <button
            type="button"
            onClick={onAdd}
            className="hover:text-foreground underline decoration-dotted underline-offset-2"
          >
            Add Spells
          </button>
        </p>
      ) : (
        <div className="mt-1 gap-x-6 sm:columns-2 lg:columns-3">
          {groupRecorded(sc.recorded).map(([level, list]) => (
            <div key={level ?? 'none'} className="mb-2 break-inside-avoid">
              <p className="text-muted-foreground border-foreground/15 flex items-baseline justify-between border-b pb-0.5 font-mono text-xs tracking-wide uppercase">
                <span>
                  {level === null ? 'Level not set' : levelText(level)}
                </span>
                <span>{list.length}</span>
              </p>
              <ul>
                {list.map((r) => (
                  <li
                    key={r.entry.id}
                    className="border-foreground/10 border-b last:border-b-0"
                  >
                    <div className="flex min-h-9 items-center gap-2">
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="font-sans text-sm">
                          {r.catalog.name}
                        </span>
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          {schoolText(r.catalog.detail.school)}
                        </span>
                      </span>
                      {r.opposition && (
                        <span
                          className={cn(chip, 'shrink-0')}
                          title="Opposition school: takes two slots to prepare"
                        >
                          2 slots
                        </span>
                      )}
                      {r.offList && (
                        <label className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                          <span>level</span>
                          <NumField
                            ariaLabel={`${r.catalog.name}: level for ${sc.className}`}
                            value={r.entry.state.level}
                            todo={r.level === null}
                            width="w-10"
                            onChange={(v) =>
                              store.setSpellLevel(character.id, r.entry.id, v)
                            }
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${r.catalog.name}`}
                        onClick={() => onRemove(r)}
                        className={iconButton}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <FieldWarnings
                      warnings={warnings}
                      where={`entry:${r.entry.id}`}
                      characterId={character.id}
                      className="pb-1.5"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------ granted list

function GrantedList({
  granted,
  grantedBy,
}: {
  granted: GrantedSpell[];
  grantedBy: string;
}) {
  return (
    <section className="border-foreground/30 mt-3 border-l-2 border-dashed pl-3">
      <h4 className={blockHeading}>
        Granted by {grantedBy}
        <span className="ml-2 font-mono text-sm tracking-normal normal-case">
          {granted.length}
        </span>
      </h4>
      <p className="text-muted-foreground text-xs">
        Always available at these levels; nothing to record.
      </p>
      <ul className="mt-1 gap-x-6 sm:columns-2">
        {granted.map((g) => (
          <li
            key={g.catalog.key}
            className="text-muted-foreground flex min-h-7 break-inside-avoid items-center gap-2 text-sm"
          >
            <span className="w-7 shrink-0 font-mono text-xs">
              {ordinal(g.level)}
            </span>
            <span className="text-foreground shrink-0 font-sans leading-tight whitespace-nowrap">
              {g.catalog.name}
            </span>
            <span className="hidden min-w-0 truncate text-xs sm:inline">
              {schoolText(g.catalog.detail.school)}
            </span>
            {g.opposition && (
              <span
                className={cn(chip, 'shrink-0')}
                title="Opposition school: takes two slots to prepare"
              >
                2 slots
              </span>
            )}
            <span className="ml-auto min-w-0 truncate text-xs">
              {g.from.join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- orphans

function OrphanedList({
  character,
  orphans,
  warnings,
}: {
  character: Character;
  orphans: ReturnType<typeof orphanedSpells>;
  warnings: Warning[];
}) {
  const undo = useRemovedSpell(character.id);
  return (
    <section
      aria-label="Spells recorded for a class without levels"
      className="border-foreground/20 border border-dashed p-3"
    >
      <h3 className={blockHeading}>Recorded for a class without levels</h3>
      <ul className="mt-1">
        {orphans.map((o) => (
          <li
            key={o.entry.id}
            className="border-foreground/10 border-b last:border-b-0"
          >
            <div className="flex min-h-9 items-center gap-2">
              <span className="min-w-0 flex-1 leading-tight">
                <span className="font-sans text-sm">{o.catalog.name}</span>
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {schoolText(o.catalog.detail.school)} ·{' '}
                  {classNameOf(o.castingClass)}
                  {o.entry.state.level !== null &&
                    `, ${levelText(o.entry.state.level)}`}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${o.catalog.name}`}
                onClick={() =>
                  undo.remove(o.entry, o.catalog.name, o.catalog.key)
                }
                className={iconButton}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <FieldWarnings
              warnings={warnings}
              where={`entry:${o.entry.id}`}
              characterId={character.id}
              className="pb-1.5"
            />
          </li>
        ))}
      </ul>
      {undo.removed && (
        <RemovedLine
          removed={undo.removed}
          onUndo={undo.undo}
          onDismiss={undo.dismiss}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------------ slots

export const s1Slots: SpellVariantSlots = {
  Spellcasting: SpellcastingSection,
};
