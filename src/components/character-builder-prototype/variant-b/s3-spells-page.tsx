'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page". The
// sheet keeps one summary line per Spellcasting (s3-sheet-summary.tsx); this
// is `?page=spells`: the Character's Spellcastings as tabs, the selected
// one's full numbers (caster level, concentration, ability, school, per
// level), then the class-list browser (s3-spell-browser.tsx) where picker
// and list are one thing. Contract: CONTRACT.md, "Round 4".

import { ArrowLeft, TriangleAlert, X } from 'lucide-react';
import { cn } from '~/lib/utils';
import { ABILITY_LABEL, ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { className as classNameOf } from '../sheet';
import { useBuilderStore } from '../store';
import {
  SCHOOL_LABEL,
  ordinal,
  orphanedSpells,
  spellcastingsOf,
  type ResolvedSpellcasting,
} from '../spellcasting';
import { SCHOOLS, type Character, type SchoolKey } from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import { PerDay, ProtoLink, perDayDetail, recordedCount } from './s3-bits';
import { S3SpellcastingSummary } from './s3-sheet-summary';
import { SpellBrowser } from './s3-spell-browser';
import type { SpellSlotProps, SpellVariantSlots } from './sheet-variants';
import {
  Block,
  FieldWarnings,
  PickField,
  StatButton,
  chip,
  th,
  useSheetUi,
} from './shared';

const dt =
  'text-muted-foreground font-mono text-[11px] tracking-wide uppercase';

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
  const store = useBuilderStore();
  const ui = useSheetUi();
  const schools = [
    ...new Set(sc.rows.flatMap((r) => r.dcBySchool.map((d) => d.school))),
  ];
  const showPrepared = sc.rows.some((r) => r.prepared !== null);
  const showKnown = sc.rows.some((r) => r.known !== null);
  const castingSum = [
    `${sc.className} ${sc.classLevels}`,
    ...sc.advances.map((a) => a.label),
  ].join(' + ');
  const conditional = sc.concentration?.conditional ?? [];

  return (
    <Block
      id="s3-numbers"
      title={`${sc.className} · ${sc.heading ?? 'prepares from the whole list'}`}
      aside={
        <span className="text-muted-foreground font-mono text-xs">
          {recordedCount(sc)}
          {sc.granted.length > 0 && ` · ${sc.granted.length} granted`}
        </span>
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
              {sc.advances.length > 0 && ` = ${castingSum}`}
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
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{SCHOOL_LABEL[sc.school.school]}</span>
                <span className="text-muted-foreground text-xs">
                  opposition
                </span>
                {[0, 1].map((i) => (
                  <PickField<SchoolKey>
                    key={i}
                    ariaLabel={`Opposition school ${i + 1}`}
                    value={sc.school!.opposition[i] ?? null}
                    placeholder="—"
                    options={SCHOOLS.filter(
                      (s) => s !== sc.school!.school && s !== 'universal',
                    ).map((s) => ({ value: s, label: SCHOOL_LABEL[s] }))}
                    todo={sc.school!.opposition[i] === undefined}
                    className="w-36"
                    onChange={(v) => {
                      const next = [...sc.school!.opposition];
                      if (v === null) next.splice(i, 1);
                      else next[i] = v;
                      store.setOppositionSchools(
                        character.id,
                        sc.school!.entryId,
                        next.filter((s): s is SchoolKey => Boolean(s)),
                      );
                    }}
                  />
                ))}
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
                    <th key={s} className={cn(th, 'text-right')}>
                      <span className="hidden md:inline">
                        {SCHOOL_LABEL[s]}
                      </span>
                      <span className="md:hidden">
                        {SCHOOL_LABEL[s].slice(0, 4)}
                      </span>{' '}
                      DC
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
                            <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
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

// -------------------------------------------------------------- orphans

/** Spells recorded for a class the Character has no levels in. */
function OrphansBlock({
  character,
  warnings,
}: {
  character: Character;
  warnings: Warning[];
}) {
  const store = useBuilderStore();
  const orphans = orphanedSpells(character);
  if (orphans.length === 0) return null;
  const firstName = character.name.split(' ')[0] ?? character.name;
  return (
    <Block
      id="s3-orphans"
      title={
        <span className="flex items-center gap-1.5 text-amber-300">
          <TriangleAlert aria-hidden className="size-3.5" />
          Recorded for a class without levels
        </span>
      }
      className="border-amber-500/60"
    >
      <ul className="divide-foreground/10 divide-y">
        {orphans.map((o) => (
          <li
            key={o.entry.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
          >
            <span className="font-sans text-base">{o.catalog.name}</span>
            <span className="text-muted-foreground min-w-0 flex-1 text-sm">
              Recorded for {classNameOf(o.castingClass)}, which {firstName} has
              no levels in. It stays here until {firstName} takes a{' '}
              {classNameOf(o.castingClass)} level, or you remove it.
            </span>
            <button
              type="button"
              onClick={() => store.removeEntry(character.id, o.entry.id)}
              className={cn(
                chip,
                'hover:bg-foreground/10 min-h-11 gap-1 md:min-h-7',
              )}
            >
              <X className="size-3" />
              Remove
            </button>
            <FieldWarnings
              warnings={warnings}
              where={`entry:${o.entry.id}`}
              characterId={character.id}
              className="basis-full"
            />
          </li>
        ))}
      </ul>
    </Block>
  );
}

// ----------------------------------------------------------------- page

function S3SpellsPage({ character, warnings }: SpellSlotProps) {
  const nav = useProtoNav();
  const all = spellcastingsOf(character);
  const wanted = nav.param('spellcasting');
  const sc = all.find((s) => s.classKey === wanted) ?? all[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-sans text-2xl">Spells</h2>
        <ProtoLink
          to="sheet"
          className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1 text-sm md:min-h-8"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Sheet
        </ProtoLink>
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
                    nav.set({
                      spellcasting: s.classKey,
                      level: null,
                      school: null,
                      q: null,
                      recorded: null,
                      other: null,
                      high: null,
                    })
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
          <OrphansBlock character={character} warnings={warnings} />
          <Block
            id="s3-browser"
            title={
              sc.casting.record === 'none'
                ? `The ${sc.className.toLowerCase()} list`
                : `${sc.heading} and the ${sc.className.toLowerCase()} list`
            }
          >
            <SpellBrowser
              key={sc.classKey}
              character={character}
              sc={sc}
              warnings={warnings}
            />
          </Block>
        </>
      ) : (
        <>
          <OrphansBlock character={character} warnings={warnings} />
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
