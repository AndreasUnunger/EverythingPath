'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 2, "Spell-level ladder".
// One Spellcasting section with one row per spell level: the DC, spells per
// day as pips (base / bonus / extra slot), known and prepared counts, and the
// Spells as inline chips with a "+" chip that opens an inline typeahead. No
// separate numbers grid. A multiclass caster switches Spellcastings with a
// segmented control; the pinned vitals row gets a tiny CL · concentration
// readout. Contract: CONTRACT.md, "Round 4".

import { ChevronDown, ChevronUp, Plus, TriangleAlert, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { className as classNameOf } from '../sheet';
import {
  SCHOOL_LABEL,
  classSpellList,
  ordinal,
  orphanedSpells,
  spellChoices,
  spellcastingsOf,
  type GrantedSpell,
  type RecordedSpell,
  type ResolvedSpellcasting,
  type SlotRow,
  type SpellChoice,
} from '../spellcasting';
import { isAccepted, useBuilderStore } from '../store';
import { SCHOOLS, type Character, type SchoolKey } from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import { Block, FieldWarnings, NumField, StatButton, chip, th } from './shared';
import type { SpellSlotProps, SpellVariantSlots } from './sheet-variants';

export const s2Slots: SpellVariantSlots = {
  Spellcasting: SpellLadderSection,
  VitalsExtra: SpellVitals,
};

// ------------------------------------------------------------------ bits

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

const SCHOOL_SHORT: Record<SchoolKey, string> = {
  abjuration: 'abj',
  conjuration: 'conj',
  divination: 'div',
  enchantment: 'ench',
  evocation: 'evo',
  illusion: 'ill',
  necromancy: 'necro',
  transmutation: 'trans',
  universal: 'univ',
};

const touch = 'min-h-11 md:min-h-9';
const smallButton =
  'hover:bg-foreground/10 inline-flex items-center gap-1 font-mono text-xs';

/** The entry ids a Spellcasting's warnings may point at. */
function castingWarnings(sc: ResolvedSpellcasting, warnings: Warning[]) {
  const ids = new Set(sc.recorded.map((r) => `entry:${r.entry.id}`));
  return warnings.filter(
    (w) => w.where === `spellcasting:${sc.classKey}` || ids.has(w.where),
  );
}

// ------------------------------------------------------------ the section

function SpellLadderSection({ character, warnings }: SpellSlotProps) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const castings = spellcastingsOf(character);
  const orphans = orphanedSpells(character);
  const param = nav.param('spellcasting');
  const selected =
    castings.find((sc) => sc.classKey === param) ?? castings[0] ?? null;
  const [browsing, setBrowsing] = useState(false);
  if (!selected) return null;

  const open = (w: Warning) =>
    !(w.acceptable && isAccepted(store.state, character.id, w));

  return (
    <Block
      id="b-spellcasting"
      title="Spellcasting"
      aside={
        castings.length > 1 ? (
          <div
            role="tablist"
            aria-label="Spellcasting"
            className="border-foreground/40 -mx-3 flex max-w-[calc(100%+1.5rem)] overflow-x-auto border md:mx-0 md:max-w-full"
          >
            {castings.map((sc) => {
              const active = sc.classKey === selected.classKey;
              const alert = castingWarnings(sc, warnings).some(open);
              return (
                <button
                  key={sc.classKey}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setBrowsing(false);
                    nav.set({ spellcasting: sc.classKey });
                  }}
                  className={cn(
                    'flex min-h-9 items-center gap-1.5 px-3 font-mono text-sm whitespace-nowrap md:min-h-8 md:text-xs',
                    active
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/5',
                  )}
                >
                  {sc.className}
                  <span className={active ? '' : 'opacity-70'}>
                    {sc.casterLevel ? `CL ${sc.casterLevel.total}` : '—'}
                  </span>
                  {alert && (
                    <span
                      aria-label="Has warnings"
                      className="size-1.5 bg-amber-300"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      <CastingHeader
        character={character}
        sc={selected}
        warnings={warnings}
        browsing={browsing}
        onBrowse={() => setBrowsing((b) => !b)}
      />
      {selected.casterLevel ? (
        <Ladder
          key={selected.classKey}
          character={character}
          sc={selected}
          warnings={warnings}
        />
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">
          No spells yet: {selected.className} {selected.classLevels} has no
          spells per day. They come with more {selected.className} levels.
        </p>
      )}
      {browsing && selected.casting.record === 'none' && (
        <ClassListBrowser sc={selected} onClose={() => setBrowsing(false)} />
      )}
      {orphans.length > 0 && (
        <OrphanedSpells
          character={character}
          orphans={orphans}
          warnings={warnings}
        />
      )}
    </Block>
  );
}

// ------------------------------------------------------- selected header

function CastingHeader({
  character,
  sc,
  warnings,
  browsing,
  onBrowse,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
  browsing: boolean;
  onBrowse: () => void;
}) {
  const facts: { key: string; node: ReactNode }[] = [];
  if (sc.school)
    facts.push({
      key: 'school',
      node: <OppositionSchools character={character} sc={sc} />,
    });
  if (sc.extraSlot)
    facts.push({
      key: 'extra',
      node: (
        <span title={sc.extraSlot.from.join(', ')}>
          <span className="text-primary">◆</span> {sc.extraSlot.label}
        </span>
      ),
    });
  if (sc.advances.length > 0)
    facts.push({
      key: 'advances',
      node: (
        <span>
          {sc.className} {sc.classLevels} + {sc.advances.length}{' '}
          {sc.advances.length === 1 ? 'advance' : 'advances'} (
          {sc.advances.map((a) => a.label).join(', ')})
        </span>
      ),
    });

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="font-sans text-lg leading-tight">
            {sc.className}
            {sc.heading && (
              <span className="text-muted-foreground"> · {sc.heading}</span>
            )}
          </h3>
          <p className="text-muted-foreground text-xs">
            {sc.casting.type === 'prepared'
              ? 'Prepares spells'
              : sc.casting.type === 'spontaneous'
                ? 'Casts spontaneously'
                : 'Prepares spells, casts spontaneously'}
            {' · '}
            {ABILITY_SHORT[sc.ability]}{' '}
            <span className="font-mono">
              {sc.abilityScore} ({formatBonus(sc.abilityMod)})
            </span>
          </p>
        </div>
        {sc.casterLevel && (
          <div className="flex items-end gap-x-4">
            <Figure label="Caster level">
              <StatButton
                size="md"
                stat={sc.casterLevel}
                statKey={`${sc.classKey}:cl`}
                title={`${sc.className} caster level`}
              />
            </Figure>
            <Figure label="Concentration">
              <StatButton
                size="md"
                signed
                stat={sc.concentration!}
                statKey={`${sc.classKey}:concentration`}
                title={`${sc.className} concentration`}
              />
            </Figure>
          </div>
        )}
        {sc.casting.record === 'none' && sc.casterLevel && (
          <button
            type="button"
            aria-expanded={browsing}
            onClick={onBrowse}
            className={cn(chip, smallButton, 'min-h-9 px-2 md:min-h-7')}
          >
            {browsing ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            Browse the {sc.className.toLowerCase()} list
          </button>
        )}
      </div>
      {facts.length > 0 && (
        <p className="text-muted-foreground flex flex-col gap-y-0.5 text-xs md:flex-row md:flex-wrap md:items-center md:gap-x-2">
          {facts.map((f, i) => (
            <span key={f.key} className="flex items-center gap-x-2">
              {i > 0 && (
                <span aria-hidden className="hidden md:inline">
                  ·
                </span>
              )}
              {f.node}
            </span>
          ))}
        </p>
      )}
      <FieldWarnings
        warnings={warnings}
        where={(w) =>
          w.where === `spellcasting:${sc.classKey}` && w.spellLevel == null
        }
        characterId={character.id}
      />
    </div>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-muted-foreground font-sans text-[11px] leading-tight tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}

/** "Evoker · opposition: Enchantment, Necromancy", with an inline editor. */
function OppositionSchools({
  character,
  sc,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
}) {
  const store = useBuilderStore();
  const [editing, setEditing] = useState(false);
  const school = sc.school!;
  const toggle = (s: SchoolKey) => {
    const next = school.opposition.includes(s)
      ? school.opposition.filter((x) => x !== s)
      : [...school.opposition, s];
    store.setOppositionSchools(character.id, school.entryId, next);
  };
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span>
        {SPECIALIST[school.school]} · opposition:{' '}
        {school.opposition.length === 0
          ? 'none'
          : school.opposition.map((s) => SCHOOL_LABEL[s]).join(', ')}
      </span>
      <button
        type="button"
        aria-expanded={editing}
        onClick={() => setEditing((e) => !e)}
        className="hover:text-foreground underline decoration-dotted underline-offset-2"
      >
        {editing ? 'done' : 'edit'}
      </button>
      {editing && (
        <span className="flex basis-full flex-wrap gap-1">
          {SCHOOLS.filter((s) => s !== 'universal' && s !== school.school).map(
            (s) => {
              const on = school.opposition.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={cn(
                    chip,
                    'hover:bg-foreground/10 min-h-7',
                    on
                      ? 'border-foreground text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {SCHOOL_LABEL[s]}
                </button>
              );
            },
          )}
        </span>
      )}
    </span>
  );
}

// --------------------------------------------------------------- ladder

type ExtraRow = { level: number | null; recorded: RecordedSpell[] };

const cell = 'md:border-foreground/10 md:border-t md:py-2';

function Ladder({
  character,
  sc,
  warnings,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
}) {
  const [pickerLevel, setPickerLevel] = useState<number | null>(null);
  const rowLevels = new Set(sc.rows.map((r) => r.level));
  // Recorded Spells with no row of their own: above what it can cast, or
  // off-list without a level yet.
  const extraRows: ExtraRow[] = [];
  for (const r of sc.recorded) {
    if (r.level !== null && rowLevels.has(r.level)) continue;
    let row = extraRows.find((x) => x.level === r.level);
    if (!row) extraRows.push((row = { level: r.level, recorded: [] }));
    row.recorded.push(r);
  }
  extraRows.sort((a, b) => (a.level ?? 99) - (b.level ?? 99));
  const editable = sc.casting.record !== 'none';
  const hasCounts = sc.rows.some(
    (r) => r.known !== null || r.prepared !== null,
  );

  return (
    <ul
      className={cn(
        'mt-3',
        hasCounts
          ? 'md:grid md:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] md:gap-x-4'
          : 'md:grid md:grid-cols-[auto_auto_auto_minmax(0,1fr)] md:gap-x-4',
      )}
    >
      <li className="hidden md:contents">
        <span className={cn(th, 'hidden px-0 md:block')}>Level</span>
        <span className={cn(th, 'hidden px-0 md:block')}>DC</span>
        <span className={cn(th, 'hidden px-0 md:block')}>Per day</span>
        {hasCounts && (
          <span className={cn(th, 'hidden px-0 md:block')}>
            {sc.casting.type === 'hybrid' ? 'Prepared' : 'Known'}
          </span>
        )}
        <span className={cn(th, 'hidden px-0 md:block')}>
          {editable ? 'Spells' : 'Granted Spells'}
        </span>
      </li>
      {sc.rows.map((row) => (
        <LadderRow
          key={row.level}
          character={character}
          sc={sc}
          row={row}
          hasCounts={hasCounts}
          recorded={sc.recorded.filter((r) => r.level === row.level)}
          granted={sc.granted.filter((g) => g.level === row.level)}
          warnings={warnings}
          picker={editable ? pickerLevel === row.level : null}
          onPicker={(open) => setPickerLevel(open ? row.level : null)}
        />
      ))}
      {extraRows.map((x) => (
        <LadderRow
          key={x.level ?? 'unset'}
          character={character}
          sc={sc}
          row={null}
          level={x.level}
          hasCounts={hasCounts}
          recorded={x.recorded}
          granted={[]}
          warnings={warnings}
          picker={null}
          onPicker={() => undefined}
        />
      ))}
    </ul>
  );
}

function LadderRow({
  character,
  sc,
  row,
  level: extraLevel,
  hasCounts,
  recorded,
  granted,
  warnings,
  picker,
  onPicker,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  /** The table row, or null for an extra row (too high / level not set). */
  row: SlotRow | null;
  level?: number | null;
  hasCounts: boolean;
  recorded: RecordedSpell[];
  granted: GrantedSpell[];
  warnings: Warning[];
  /** Open / closed, or null: no "+" chip (a `none` Spellcasting, an extra row). */
  picker: boolean | null;
  onPicker: (open: boolean) => void;
}) {
  const store = useBuilderStore();
  const level = row ? row.level : (extraLevel ?? null);
  const entryIds = new Set(recorded.map((r) => `entry:${r.entry.id}`));
  const over = row !== null && row.known !== null && row.recorded > row.known;
  const levelLabel =
    level === null ? 'Level not set' : row ? ordinal(level) : ordinal(level);
  return (
    <li
      className={cn(
        'border-foreground/10 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t py-2 md:contents',
        !row && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          cell,
          'font-mono text-base leading-none md:self-start md:pt-2.5',
          !row && 'text-muted-foreground',
        )}
      >
        {levelLabel}
      </span>
      <span className={cn(cell, 'flex items-center gap-x-1.5 md:self-start')}>
        {row ? (
          <>
            <span className="text-muted-foreground font-mono text-xs md:hidden">
              DC
            </span>
            <StatButton
              size="sm"
              stat={sc.dcStat(row.level)}
              statKey={`${sc.classKey}:dc:${row.level}`}
              title={`${ordinal(row.level)}-level save DC`}
            />
            {row.dcBySchool.map((d) => (
              <span
                key={d.school}
                className="flex items-baseline gap-0.5"
                title={`${SCHOOL_LABEL[d.school]} DC`}
              >
                <span className="text-muted-foreground font-mono text-[11px]">
                  {SCHOOL_SHORT[d.school]}
                </span>
                <StatButton
                  size="sm"
                  stat={sc.dcStat(row.level, d.school)}
                  statKey={`${sc.classKey}:dc:${row.level}:${d.school}`}
                  title={`${ordinal(row.level)}-level ${SCHOOL_LABEL[d.school].toLowerCase()} DC`}
                  className="min-h-7 text-xs"
                />
              </span>
            ))}
          </>
        ) : (
          <span className="font-mono text-xs">
            {level === null
              ? 'needs a level'
              : sc.highestLevel === null
                ? "can't cast yet"
                : `can't cast yet · casts up to ${ordinal(sc.highestLevel)}`}
          </span>
        )}
      </span>
      <span className={cn(cell, 'flex items-center md:self-start')}>
        {row && <Pips row={row} extraLabel={sc.extraSlot?.label ?? null} />}
      </span>
      {hasCounts && (
        <span
          className={cn(
            cell,
            'flex items-center font-mono text-xs md:self-start md:pt-2.5',
            over ? 'text-amber-300' : 'text-muted-foreground',
          )}
        >
          {row?.known !== null && row?.known !== undefined && (
            <span title={`${row.recorded} recorded of ${row.known} known`}>
              {row.recorded}/{row.known}
              {over && (
                <TriangleAlert
                  aria-label="Over the table"
                  className="ml-1 inline size-3 align-[-1px]"
                />
              )}
            </span>
          )}
          {row?.prepared !== null && row?.prepared !== undefined && (
            <span
              title={`Prepares ${row.prepared} ${ordinal(row.level)}-level spells a day`}
            >
              prepares {row.prepared}
            </span>
          )}
        </span>
      )}
      <span
        className={cn(
          cell,
          'flex min-w-0 basis-full flex-col gap-1 md:basis-auto md:self-start',
        )}
      >
        <span className="flex flex-wrap items-center gap-1">
          {recorded.map((r) => (
            <RecordedChip
              key={r.entry.id}
              spell={r}
              onLevel={(n) => store.setSpellLevel(character.id, r.entry.id, n)}
              onRemove={() => store.removeEntry(character.id, r.entry.id)}
            />
          ))}
          {granted.map((g) => (
            <GrantedChip key={g.catalog.key} spell={g} />
          ))}
          {picker === false && level !== null && (
            <button
              type="button"
              aria-label={`Add a ${ordinal(level)}-level Spell`}
              onClick={() => onPicker(true)}
              className={cn(
                chip,
                smallButton,
                'text-muted-foreground hover:text-foreground min-h-9 min-w-9 justify-center md:min-h-7 md:min-w-7',
              )}
            >
              <Plus className="size-3.5" />
              {recorded.length === 0 && granted.length === 0 && (
                <span>Add</span>
              )}
            </button>
          )}
          {recorded.length === 0 &&
            granted.length === 0 &&
            picker === null &&
            row && (
              <span className="text-muted-foreground text-xs">
                {sc.casting.record === 'none' ? 'From the class list' : '—'}
              </span>
            )}
        </span>
        {picker && level !== null && (
          <SpellPicker
            character={character}
            sc={sc}
            level={level}
            onClose={() => onPicker(false)}
          />
        )}
        <FieldWarnings
          warnings={warnings}
          where={(w) =>
            entryIds.has(w.where) ||
            (w.where === `spellcasting:${sc.classKey}` &&
              w.spellLevel === level)
          }
          characterId={character.id}
        />
      </span>
    </li>
  );
}

// ------------------------------------------------------------------ pips

function Pips({
  row,
  extraLabel,
}: {
  row: SlotRow;
  extraLabel: string | null;
}) {
  if (row.perDay === null)
    return (
      <span className="text-muted-foreground font-mono text-xs leading-none">
        at will
      </span>
    );
  const base = row.base ?? 0;
  const parts = [`${base} base`];
  if (row.bonus) parts.push(`${row.bonus} bonus`);
  if (row.extra) parts.push(`1 ${extraLabel ?? 'extra slot'}`);
  const label = `${row.perDay} per day: ${parts.join(' + ')}`;
  const run = (kind: 'base' | 'bonus' | 'extra', n: number) =>
    Array.from({ length: n }, (_, i) => ({ kind, key: `${kind}-${i}` }));
  const pips = [
    ...run('base', base),
    ...run('bonus', row.bonus),
    ...run('extra', row.extra),
  ];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex items-center gap-x-2"
    >
      <span className="flex flex-wrap items-center gap-[3px]">
        {pips.map((p) => (
          <span
            key={p.key}
            className={cn(
              'block size-2.5',
              p.kind === 'base' && 'bg-foreground/85',
              p.kind === 'bonus' && 'border-foreground/70 border',
              p.kind === 'extra' && 'bg-primary scale-90 rotate-45',
            )}
          />
        ))}
      </span>
      <span className="font-mono text-base leading-none">{row.perDay}</span>
    </span>
  );
}

// ----------------------------------------------------------------- chips

function RecordedChip({
  spell,
  onLevel,
  onRemove,
}: {
  spell: RecordedSpell;
  onLevel: (n: number | null) => void;
  onRemove: () => void;
}) {
  const name = spell.catalog.name;
  const flagged = spell.tooHigh || spell.offList;
  return (
    <span
      className={cn(
        chip,
        'min-h-7 max-w-full gap-1.5 py-0',
        flagged && 'border-amber-500/60',
        spell.tooHigh && 'text-amber-300',
      )}
      title={
        spell.tooHigh
          ? `${name}: above what this Spellcasting casts now`
          : spell.offList
            ? `${name}: not on the class list`
            : spell.catalog.summary
      }
    >
      {flagged && (
        <TriangleAlert
          aria-label={spell.tooHigh ? 'Too high' : 'Off the class list'}
          className="size-3 shrink-0 text-amber-300"
        />
      )}
      <span className="truncate">{name}</span>
      {spell.opposition && (
        <span
          className="text-muted-foreground"
          title="Opposition school: takes two slots to prepare"
        >
          2 slots
        </span>
      )}
      {spell.offList && (
        <NumField
          value={spell.level}
          onChange={onLevel}
          ariaLabel={`${name} level`}
          placeholder="lvl"
          todo={spell.level === null}
          width="w-9"
          className="h-5 text-xs"
        />
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground -mr-1 flex min-h-7 min-w-6 items-center justify-center"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function GrantedChip({ spell }: { spell: GrantedSpell }) {
  const from = spell.from.join(', ');
  return (
    <span
      className={cn(
        chip,
        'text-muted-foreground min-h-7 max-w-full gap-1.5 border-dashed py-0',
      )}
      title={`${spell.catalog.name}: granted by ${from}`}
    >
      <span className="truncate">{spell.catalog.name}</span>
      <span className="text-[10px] tracking-wide uppercase opacity-80">
        {from}
      </span>
      {spell.opposition && <span>2 slots</span>}
    </span>
  );
}

// ------------------------------------------------------------- typeahead

function SpellPicker({
  character,
  sc,
  level,
  onClose,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  level: number;
  onClose: () => void;
}) {
  const store = useBuilderStore();
  const [q, setQ] = useState('');
  const [offList, setOffList] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = `${sc.classKey}-${level}-spells`.replace(/\W/g, '-');

  const all = useMemo(
    () => spellChoices(character, sc.classKey, { offList }),
    [character, sc.classKey, offList],
  );
  const needle = q.trim().toLowerCase();
  const matches = all.filter(
    (c) =>
      (c.onList ? c.level === level : needle ? true : c.level === level) &&
      (!needle || c.catalog.name.toLowerCase().includes(needle)),
  );
  const shown = matches.slice(0, 12);
  const more = matches.length - shown.length;

  useEffect(() => {
    const input = inputRef.current;
    if (input?.offsetParent == null) return;
    input.focus();
    // With the on-screen keyboard up, an input near the bottom is covered:
    // bring it to the middle.
    const rect = input.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 180 || rect.top < 80)
      input.scrollIntoView({ block: 'center' });
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [onClose]);

  // A new query starts on the first Spell that can still be added.
  const firstAddable = Math.max(
    0,
    shown.findIndex((c) => !c.recordedEntryId),
  );
  useEffect(() => {
    setActive(firstAddable);
  }, [q, offList, firstAddable]);

  const add = (c: SpellChoice) => {
    if (c.recordedEntryId) return;
    store.addSpell(
      character.id,
      sc.classKey,
      c.catalog.key,
      c.onList ? undefined : level,
    );
    setQ('');
    inputRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = shown[active];
      if (c) add(c);
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full max-w-[22rem]"
      onKeyDown={(e) => {
        // Escape closes from anywhere in the picker, not just the input.
        if (e.key === 'Escape' && e.target !== inputRef.current) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            shown[active] ? `${listId}-${active}` : undefined
          }
          aria-label={`Add a ${ordinal(level)}-level Spell`}
          placeholder={`${ordinal(level)}-level Spell…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          className={cn(
            'bg-field border-input focus-visible:border-ring focus-visible:ring-ring/50 min-w-0 flex-1 border px-2 text-base outline-none focus-visible:ring-[3px]',
            touch,
          )}
        />
        <button
          type="button"
          aria-pressed={offList}
          title="Also offer Spells from other class lists, recorded at this level"
          onClick={() => {
            setOffList((o) => !o);
            inputRef.current?.focus();
          }}
          className={cn(
            chip,
            smallButton,
            touch,
            'px-2',
            offList
              ? 'border-foreground text-foreground'
              : 'text-muted-foreground',
          )}
        >
          other lists
        </button>
        <button
          type="button"
          aria-label="Close the Spell picker"
          onClick={onClose}
          className={cn(
            'text-muted-foreground hover:text-foreground flex min-w-9 items-center justify-center',
            touch,
          )}
        >
          <X className="size-4" />
        </button>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${ordinal(level)}-level Spells`}
        className="bg-background border-foreground/40 absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto border shadow-xl"
      >
        {shown.length === 0 && (
          <li className="text-muted-foreground px-2 py-2 text-xs">
            {needle
              ? offList
                ? 'No Spell by that name.'
                : 'Nothing on the class list; try “other lists”.'
              : 'Nothing left to add at this level.'}
          </li>
        )}
        {shown.map((c, i) => {
          const taken = Boolean(c.recordedEntryId);
          return (
            <li
              key={c.catalog.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={taken || undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(c)}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-2 text-sm',
                touch,
                i === active && 'bg-foreground/10',
                taken && 'cursor-default opacity-50',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{c.catalog.name}</span>
              {!c.onList && (
                <span className="text-muted-foreground font-mono text-[11px]">
                  other lists{c.level !== null && ` · ${ordinal(c.level)}`}
                </span>
              )}
              {c.opposition && (
                <span className="text-muted-foreground font-mono text-[11px]">
                  2 slots
                </span>
              )}
              {c.tooHigh && (
                <span className="font-mono text-[11px] text-amber-300">
                  too high
                </span>
              )}
              {c.granted && (
                <span className="text-muted-foreground font-mono text-[11px]">
                  granted
                </span>
              )}
              {taken && (
                <span className="text-muted-foreground font-mono text-[11px]">
                  recorded
                </span>
              )}
            </li>
          );
        })}
        {more > 0 && (
          <li className="text-muted-foreground px-2 py-1.5 text-xs">
            {more} more: keep typing.
          </li>
        )}
      </ul>
      {/* Keeps the row tall enough that the open list does not cover the next rows on phone. */}
      <div className="h-2" />
    </div>
  );
}

// ---------------------------------------------------- class list browser

function ClassListBrowser({
  sc,
  onClose,
}: {
  sc: ResolvedSpellcasting;
  onClose: () => void;
}) {
  const list = classSpellList(sc.classKey);
  const granted = new Set(sc.granted.map((g) => g.catalog.key));
  const levels = [...new Set(list.map((s) => s.level))].sort((a, b) => a - b);
  return (
    <section
      aria-label={`${sc.className} spell list`}
      className="border-foreground/20 mt-3 border p-3"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="font-sans text-sm">
          The {sc.className.toLowerCase()} list
          <span className="text-muted-foreground text-xs">
            {' '}
            · read-only; a {sc.className.toLowerCase()} prepares any of these
          </span>
        </h4>
        <button
          type="button"
          aria-label="Close the list"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground flex min-h-9 min-w-9 items-center justify-center md:min-h-7 md:min-w-7"
        >
          <X className="size-4" />
        </button>
      </header>
      <ul className="space-y-1.5">
        {levels.map((level) => {
          const castable = sc.highestLevel !== null && level <= sc.highestLevel;
          return (
            <li
              key={level}
              className={cn(
                'flex flex-wrap items-baseline gap-x-3 gap-y-1',
                !castable && 'opacity-50',
              )}
            >
              <span className="w-10 shrink-0 font-mono text-base leading-none">
                {ordinal(level)}
              </span>
              {!castable && (
                <span className="text-muted-foreground font-mono text-xs">
                  can&apos;t cast yet
                </span>
              )}
              <span className="flex min-w-0 flex-1 basis-full flex-wrap gap-1 md:basis-auto">
                {list
                  .filter((s) => s.level === level)
                  .map((s) => (
                    <span
                      key={s.catalog.key}
                      className={cn(
                        chip,
                        'min-h-6',
                        granted.has(s.catalog.key) &&
                          'text-muted-foreground border-dashed',
                      )}
                      title={s.catalog.summary}
                    >
                      {s.catalog.name}
                      {granted.has(s.catalog.key) && (
                        <span className="ml-1 text-[10px] tracking-wide uppercase">
                          granted
                        </span>
                      )}
                    </span>
                  ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------- orphaned spells

function OrphanedSpells({
  character,
  orphans,
  warnings,
}: {
  character: Character;
  orphans: ReturnType<typeof orphanedSpells>;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  return (
    <div className="border-foreground/10 mt-3 border-t pt-2">
      <p className="text-muted-foreground mb-1 font-mono text-xs tracking-wide uppercase">
        Recorded for a class without levels
      </p>
      <ul className="space-y-1.5">
        {orphans.map((o) => (
          <li key={o.entry.id} className="space-y-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  chip,
                  'min-h-7 gap-1.5 border-amber-500/60 py-0 text-amber-300',
                )}
              >
                <TriangleAlert aria-hidden className="size-3" />
                {o.catalog.name}
                <button
                  type="button"
                  aria-label={`Remove ${o.catalog.name}`}
                  onClick={() => store.removeEntry(character.id, o.entry.id)}
                  className="text-muted-foreground hover:text-foreground -mr-1 flex min-h-7 min-w-6 items-center justify-center"
                >
                  <X className="size-3" />
                </button>
              </span>
              <span className="text-muted-foreground text-xs">
                Recorded for {classNameOf(o.castingClass)}, which this character
                has no levels in.
              </span>
            </span>
            <FieldWarnings
              warnings={warnings}
              where={`entry:${o.entry.id}`}
              characterId={character.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------ pinned vitals row

function SpellVitals({ character }: SpellSlotProps) {
  const castings = spellcastingsOf(character).filter((sc) => sc.casterLevel);
  if (castings.length === 0) return null;
  return (
    <>
      {castings.map((sc) => (
        <div key={sc.classKey} className="hidden flex-col items-start md:flex">
          <span className="text-muted-foreground font-sans text-[11px] leading-tight tracking-wide">
            {sc.className} CL · conc
          </span>
          <span className="flex items-center gap-0.5">
            <StatButton
              size="sm"
              stat={sc.casterLevel!}
              statKey={`vitals:${sc.classKey}:cl`}
              title={`${sc.className} caster level`}
              className="font-sans"
            />
            <span className="text-muted-foreground text-xs">·</span>
            <StatButton
              size="sm"
              signed
              stat={sc.concentration!}
              statKey={`vitals:${sc.classKey}:concentration`}
              title={`${sc.className} concentration`}
              className="font-sans"
            />
          </span>
        </div>
      ))}
    </>
  );
}
