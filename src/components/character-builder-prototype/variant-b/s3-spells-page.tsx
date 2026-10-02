'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page". The
// sheet keeps one summary line per Spellcasting (s3-sheet-summary.tsx); this
// is `?page=spells`: the Character's Spellcastings as tabs, the selected
// one's numbers (caster level, concentration, ability, school, per level),
// then the record (recorded and granted Spells by level). "Add Spells"
// (`add=1`) swaps the record for the class-list browser
// (s3-spell-browser.tsx); a `none` caster gets the browser read-only.
// Orphaned Spells sit in their own group (s3-orphans.tsx). Contract:
// CONTRACT.md, "Round 4" and "The spells page, second pass".

import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import {
  SCHOOL_LABEL,
  ordinal,
  spellChoices,
  spellcastingsOf,
  type ResolvedSpellcasting,
} from '../spellcasting';
import type { Character } from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import {
  PerDay,
  SCHOOL_ABBR,
  perDayDetail,
  prestigeShare,
  recordedCount,
} from './s3-bits';
import { Orphans } from './s3-orphans';
import { S3SpellcastingSummary } from './s3-sheet-summary';
import { BROWSER_PARAMS, SpellBrowser } from './s3-spell-browser';
import { GroupRows, groupByLevel } from './s3-spell-rows';
import type { SpellSlotProps, SpellVariantSlots } from './sheet-variants';
import {
  Block,
  FieldWarnings,
  StatButton,
  chip,
  th,
  useSheetUi,
} from './shared';

// The same scale as the table headers (`th`) and the sheet summary's labels.
const dt = 'text-muted-foreground font-mono text-xs tracking-wide uppercase';
/** The outline chip-style action in a Block header (Add Spells, Done). */
const headerAction = cn(chip, 'min-h-11 gap-1 px-2.5 md:min-h-8');

// ------------------------------------------------------------- numbers

/** The selected Spellcasting's numbers: the figures on the left, the per-level table on the right. */
function CastingNumbers({
  character,
  sc,
  warnings,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
}) {
  const ui = useSheetUi();
  const schools = [
    ...new Set(sc.rows.flatMap((r) => r.dcBySchool.map((d) => d.school))),
  ];
  const showPrepared = sc.rows.some((r) => r.prepared !== null);
  const showKnown = sc.rows.some((r) => r.known !== null);
  const share = prestigeShare(sc);
  const conditional = sc.concentration?.conditional ?? [];
  // A `none` caster's title already says "prepares from the whole list".
  const counts = [
    sc.casting.record === 'none' ? null : recordedCount(sc),
    sc.granted.length > 0 ? `${sc.granted.length} granted` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Block
      id="s3-numbers"
      title={`${sc.className} · ${sc.heading ?? 'prepares from the whole list'}`}
      aside={
        counts && (
          <span className="text-muted-foreground font-mono text-sm">
            {counts}
          </span>
        )
      }
    >
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm">
          <dt className={dt}>Caster level</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            {sc.casterLevel ? (
              <StatButton
                title={`${sc.className} caster level`}
                stat={sc.casterLevel}
                statKey={`${sc.classKey}:cl`}
              />
            ) : (
              <span className="text-muted-foreground font-mono">—</span>
            )}
            <span className="text-muted-foreground text-xs">
              casting level {sc.castingLevel}
              {share && ` = ${sc.className} ${sc.classLevels} ${share}`}
              {sc.casting.casterLevelOffset !== 0 &&
                ` · caster level ${formatBonus(sc.casting.casterLevelOffset)}`}
            </span>
          </dd>

          <dt className={dt}>Concentration</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            {sc.concentration ? (
              <StatButton
                signed
                title={`${sc.className} concentration`}
                stat={sc.concentration}
                statKey={`${sc.classKey}:conc`}
              />
            ) : (
              <span className="text-muted-foreground font-mono">—</span>
            )}
            {conditional.map((c) => (
              <span
                key={`${c.label}|${c.conditionText}`}
                className="text-xs text-sky-300"
              >
                {formatBonus(c.value)} {c.conditionText} ({c.label})
              </span>
            ))}
          </dd>

          <dt className={dt}>{ABILITY_LABEL[sc.ability]}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="flex items-baseline gap-1 font-mono">
              <span className="text-muted-foreground text-sm">
                {ABILITY_SHORT[sc.ability]}
              </span>
              <StatButton
                size="sm"
                title={ABILITY_LABEL[sc.ability]}
                path={`abilities.${sc.ability}`}
                sheet={ui.sheet}
              />
              <span>({formatBonus(sc.abilityMod)})</span>
            </span>
            {sc.permanentScore !== sc.abilityScore && (
              <span className="text-muted-foreground text-xs">
                bonus spells from the permanent {sc.permanentScore}
              </span>
            )}
          </dd>

          {sc.school && (
            <>
              <dt className={dt}>School</dt>
              <dd
                className="flex flex-wrap items-baseline gap-x-2"
                title="Opposition schools are set on the Arcane school class feature"
              >
                <span>{SCHOOL_LABEL[sc.school.school]}</span>
                <span className="text-muted-foreground text-xs">
                  opposition{' '}
                  {sc.school.opposition.length > 0
                    ? sc.school.opposition
                        .map((s) => SCHOOL_LABEL[s])
                        .join(', ')
                    : 'not chosen yet'}
                </span>
              </dd>
            </>
          )}

          {sc.extraSlot && (
            <>
              <dt className={dt}>Extra slot</dt>
              <dd className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono">{sc.extraSlot.label}</span>
                <span className="text-muted-foreground text-xs">
                  per level from 1st · {sc.extraSlot.from.join(', ')}
                </span>
              </dd>
            </>
          )}
        </dl>

        {sc.rows.length === 0 ? (
          <p className="text-muted-foreground self-center text-sm">
            No spells per day yet: the {sc.className.toLowerCase()} table starts
            later.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Level</th>
                  <th className={cn(th, 'text-right')}>Per day</th>
                  {showPrepared && (
                    <th className={cn(th, 'text-right')}>Prepared</th>
                  )}
                  {showKnown && <th className={cn(th, 'text-right')}>Known</th>}
                  <th className={cn(th, 'text-right')}>DC</th>
                  {schools.map((s) => (
                    <th
                      key={s}
                      className={cn(th, 'text-right')}
                      title={`${SCHOOL_LABEL[s]} DC`}
                    >
                      <span className="hidden md:inline">
                        {SCHOOL_LABEL[s]}
                      </span>
                      <span className="md:hidden">{SCHOOL_ABBR[s]}</span> DC
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sc.rows.map((row) => {
                  const over = row.known !== null && row.recorded > row.known;
                  const detail = perDayDetail(row, sc);
                  return (
                    <tr
                      key={row.level}
                      className="border-foreground/10 border-t"
                    >
                      <td className="px-2 py-1 font-mono text-base">
                        {ordinal(row.level)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <span className="inline-flex items-baseline gap-x-2">
                          {detail && (
                            <span className="text-muted-foreground hidden font-mono text-sm sm:inline">
                              {detail} =
                            </span>
                          )}
                          <PerDay row={row} sc={sc} className="text-xl" />
                        </span>
                      </td>
                      {showPrepared && (
                        <td className="px-2 py-1 text-right font-mono text-xl">
                          {row.prepared ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {showKnown && (
                        <td
                          className={cn(
                            'px-2 py-1 text-right font-mono text-xl',
                            over && 'text-amber-300',
                          )}
                          title={
                            row.known === null
                              ? undefined
                              : `${row.recorded} recorded of ${row.known} known`
                          }
                        >
                          {row.known === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              {row.recorded}
                              <span className="text-muted-foreground text-base">
                                /{row.known}
                              </span>
                            </>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-1 text-right">
                        <StatButton
                          size="sm"
                          title={`${ordinal(row.level)}-level spell DC`}
                          stat={sc.dcStat(row.level)}
                          statKey={`${sc.classKey}:dc:${row.level}`}
                        />
                      </td>
                      {schools.map((s) => (
                        <td key={s} className="px-2 py-1 text-right">
                          <StatButton
                            size="sm"
                            title={`${ordinal(row.level)}-level ${SCHOOL_LABEL[s].toLowerCase()} spell DC`}
                            stat={sc.dcStat(row.level, s)}
                            statKey={`${sc.classKey}:dc:${row.level}:${s}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <FieldWarnings
        warnings={warnings}
        where={`spellcasting:${sc.classKey}`}
        characterId={character.id}
        className="mt-2"
      />
    </Block>
  );
}

// -------------------------------------------------------------- record

/** The record view's rows: what a `known` or `book` caster has recorded or is granted. */
function recordRows(character: Character, sc: ResolvedSpellcasting) {
  return spellChoices(character, sc.classKey).filter(
    (c) => c.recordedEntryId !== null || c.granted,
  );
}

/** The default view of a `known` or `book` caster: recorded and granted Spells by level. */
function RecordView({
  character,
  sc,
  warnings,
  onAdd,
}: {
  character: Character;
  sc: ResolvedSpellcasting;
  warnings: Warning[];
  onAdd: () => void;
}) {
  const mine = recordRows(character, sc);
  if (mine.length === 0)
    return (
      <div className="border-foreground/20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-dashed p-3">
        <span className="text-muted-foreground min-w-0 flex-1 basis-48 text-sm">
          Nothing in the {(sc.heading ?? 'record').toLowerCase()} yet. Add
          Spells opens the {sc.className.toLowerCase()} list one level at a
          time.
        </span>
        <AddSpellsButton onClick={onAdd} />
      </div>
    );
  return (
    <ul>
      {groupByLevel(mine).map((g) => (
        <GroupRows
          key={g.level ?? 'unset'}
          group={g}
          counts
          rowProps={{ sc, character, warnings, readOnly: false }}
        />
      ))}
    </ul>
  );
}

function AddSpellsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      className={headerAction}
    >
      <Plus aria-hidden className="size-3.5" />
      Add Spells
    </Button>
  );
}

// ----------------------------------------------------------------- page

function S3SpellsPage({ character, warnings }: SpellSlotProps) {
  const nav = useProtoNav();
  const all = spellcastingsOf(character);
  const wanted = nav.param('spellcasting');
  const sc = all.find((s) => s.classKey === wanted) ?? all[0];
  const none = sc?.casting.record === 'none';
  const adding = !none && nav.param('add') === '1';
  const leave = () => nav.set(BROWSER_PARAMS);
  const enter = () => nav.set({ ...BROWSER_PARAMS, add: '1' });
  const heading = sc?.heading ?? '';
  // An empty record carries its own Add Spells; the header then keeps quiet.
  const empty = sc ? recordRows(character, sc).length === 0 : true;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-sans text-2xl">Spells</h2>
        {all.length > 1 && (
          <div
            role="tablist"
            aria-label="Spellcasting"
            className="flex w-full gap-1 md:ml-auto md:w-auto"
          >
            {all.map((s) => {
              const selected = s.classKey === sc?.classKey;
              return (
                <button
                  key={s.classKey}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() =>
                    nav.set({ ...BROWSER_PARAMS, spellcasting: s.classKey })
                  }
                  className={cn(
                    'flex min-h-11 flex-1 flex-col items-start justify-center border px-3 py-1 text-left md:min-h-9 md:flex-none md:flex-row md:items-baseline md:gap-x-2',
                    selected
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-foreground/40 text-muted-foreground hover:bg-foreground/10',
                  )}
                >
                  <span className="font-sans text-base">{s.className}</span>
                  <span className="font-mono text-xs">
                    {s.heading
                      ? `${s.heading.toLowerCase()} · ${s.recorded.length}`
                      : 'whole list'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sc ? (
        <>
          <CastingNumbers character={character} sc={sc} warnings={warnings} />
          {none ? (
            <Block
              id="s3-list"
              title={`The ${sc.className.toLowerCase()} list`}
              aside={
                <span className="text-muted-foreground text-xs">
                  Nothing to record
                  {sc.granted.length > 0 && '; granted Spells are marked'}.
                </span>
              }
            >
              <SpellBrowser
                key={sc.classKey}
                character={character}
                sc={sc}
                warnings={warnings}
              />
            </Block>
          ) : adding ? (
            <Block
              id="s3-add"
              title={`Add to the ${heading.toLowerCase()}`}
              aside={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={leave}
                  className={headerAction}
                >
                  Done
                </Button>
              }
            >
              <SpellBrowser
                key={sc.classKey}
                character={character}
                sc={sc}
                warnings={warnings}
                onDone={leave}
              />
            </Block>
          ) : (
            <Block
              id="s3-record"
              title={heading}
              aside={!empty && <AddSpellsButton onClick={enter} />}
            >
              <RecordView
                character={character}
                sc={sc}
                warnings={warnings}
                onAdd={enter}
              />
            </Block>
          )}
          <Orphans character={character} warnings={warnings} framed />
        </>
      ) : (
        <>
          <Orphans character={character} warnings={warnings} framed />
          <p className="text-muted-foreground text-sm">
            {character.name} has no Spellcasting: no class with Class Levels
            here casts spells.
          </p>
        </>
      )}
    </div>
  );
}

export const s3Slots: SpellVariantSlots = {
  Spellcasting: S3SpellcastingSummary,
  SpellsPage: S3SpellsPage,
};
