'use client';
// PROTOTYPE (throwaway, #208) — Variant A: the focused level wizard. Used for
// Kesh 7 → 8 (`page=levelup`) and for reopening any past level from the
// sheet (`&level=<id>`). Ends with a before/after diff of derived statistics.

import { Check, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  ABILITY_LABEL,
  ABILITY_SHORT,
  CLASSES,
  SKILLS,
  catalogOfKind,
  classDetail,
} from '../catalog';
import { useProtoNav } from '../nav';
import { resolveSheet } from '../resolve';
import {
  classLevelShortLabel,
  classLevels,
  entryName,
  favoredClass,
  featuresGainedAt,
  lookupCatalog,
  useBuilderStore,
  useCharacter,
  useResolved,
  useWarnings,
} from '../store';
import { ABILITIES, type Character, type ResolvedSheet } from '../types';
import { formatBonus } from '../ui-helpers';
import { BAB_LABEL, classLevelGives } from './rules';
import {
  ChoiceRow,
  ConfirmDialog,
  LiveSheetPanel,
  LiveSheetStrip,
  StepFooter,
  StepHeading,
  StepRail,
  WarningList,
  chip,
  formatStat,
  statLabel,
  statOf,
  useApplyWarning,
  type StatKey,
  type StepDef,
} from './shared';
import { HpPolicyChoice, LevelHpRow, SkillRanksTable } from './steps';
import { AddFromCatalog } from './pickers';

type LevelStep =
  | 'class'
  | 'hp'
  | 'favored'
  | 'ability'
  | 'skills'
  | 'features'
  | 'review';

const ALL_STEPS: StepDef<LevelStep>[] = [
  { key: 'class', label: 'Class', short: 'Class' },
  { key: 'hp', label: 'Hit points', short: 'HP' },
  { key: 'favored', label: 'Favored class', short: 'Favored' },
  { key: 'ability', label: 'Ability increase', short: 'Ability' },
  { key: 'skills', label: 'Skill ranks', short: 'Skills' },
  { key: 'features', label: 'Features & picks', short: 'Features' },
  { key: 'review', label: 'Before / after', short: 'Review' },
];

/** The Character as it was without this level (for the before/after diff). */
function withoutLevel(character: Character, levelId: string): Character {
  return {
    ...character,
    entries: character.entries.filter(
      (e) => e.id !== levelId && e.gainedAtClassLevel !== levelId,
    ),
  };
}

export function LevelUpPage({ characterId }: { characterId: string }) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const apply = useApplyWarning(characterId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const levelId = nav.param('level');
  const levels = character ? classLevels(character) : [];
  const level = levels.find((l) => l.id === levelId) ?? null;
  const before = useMemo(
    () =>
      character
        ? resolveSheet(level ? withoutLevel(character, level.id) : character)
        : null,
    [character, level],
  );
  if (!character || !sheet || !before) return null;

  const position = level ? level.state.position : levels.length + 1;
  const abilityDue = position % 4 === 0;
  const steps = ALL_STEPS.filter((s) => abilityDue || s.key !== 'ability');
  const stepParam = nav.param('step') as LevelStep | null;
  const step: LevelStep =
    level && stepParam && steps.some((s) => s.key === stepParam)
      ? stepParam
      : 'class';
  const index = steps.findIndex((s) => s.key === step);
  const go = (key: LevelStep) => nav.set({ step: key });
  const prevStep = steps[index - 1]?.key;
  const nextStep = steps[index + 1]?.key;
  const done = () => nav.go('sheet', { character: characterId });
  const isNew = !level || level.state.position === levels.length;
  const mine = warnings.filter(
    (w) =>
      (!!level && w.where === `classLevel:${level.id}`) ||
      w.where === 'features',
  );
  const counts: Partial<Record<LevelStep, { warning: number; prompt: number; info: number }>> = {};
  for (const w of mine) {
    const key: LevelStep = w.id.includes('-hp')
      ? 'hp'
      : w.id.includes('-fcb')
        ? 'favored'
        : w.id.includes('-increase')
          ? 'ability'
          : w.id.includes('-ranks')
            ? 'skills'
            : 'features';
    const c = (counts[key] ??= { warning: 0, prompt: 0, info: 0 });
    c[w.severity] += 1;
  }

  const chooseClass = (classKey: string | null) => {
    if (level) {
      store.updateClassLevel(characterId, level.id, { classKey });
      return;
    }
    const id = store.addClassLevel(characterId, classKey);
    nav.set({ level: id, step: 'hp' });
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-40 md:p-6 md:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            {isNew ? 'Level up' : 'Edit level'} · step {index + 1} of{' '}
            {steps.length}
          </div>
          <h1 className="font-sans text-2xl">
            {character.name}{' '}
            {isNew ? (
              <span className="font-mono">
                {position - 1} → {position}
              </span>
            ) : (
              <span className="font-mono">· level {position}</span>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {level && (
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 aria-hidden /> {isNew ? 'Cancel level-up' : 'Delete level'}
            </Button>
          )}
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={done}>
            Back to sheet
          </Button>
        </div>
      </div>
      <LiveSheetStrip characterId={characterId} />
      <div className="grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)_17rem]">
        <StepRail steps={steps} current={step} onSelect={go} counts={counts} />
        <section className="min-w-0 space-y-5">
          {step === 'class' && (
            <div className="space-y-4">
              <StepHeading
                title={`Class for level ${position}`}
                lede="What each class gives at its next level for this character."
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {CLASSES.map((c) => {
                  const detail = classDetail(c.key);
                  const soFar = levels.filter(
                    (l) =>
                      l.state.classKey === c.key &&
                      l.state.position < position,
                  ).length;
                  const n = soFar + 1;
                  const selected = level?.state.classKey === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseClass(c.key)}
                      className={cn(
                        'min-h-11 border p-3 text-left',
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-foreground/20 hover:bg-foreground/5',
                      )}
                    >
                      <div className="flex items-center gap-2 font-sans text-lg">
                        {c.name} {n}
                        {selected && (
                          <Check className="text-primary size-4" aria-hidden />
                        )}
                        {soFar === 0 && <span className={chip}>new class</span>}
                      </div>
                      {detail && (
                        <div className="text-muted-foreground text-sm">
                          d{detail.hitDie} · {BAB_LABEL[detail.bab]} ·{' '}
                          {detail.skillRanksPerLevel} + Int ranks
                        </div>
                      )}
                      <div className="mt-1 text-xs">
                        {classLevelGives(c.key, n).join(', ') || 'nothing new'}
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button variant="link" className="h-auto p-0" onClick={() => chooseClass(null)}>
                Leave this level Unspecified for now
              </Button>
            </div>
          )}
          {level && step === 'hp' && (
            <div className="space-y-4">
              <StepHeading
                title="Hit points"
                lede={`Hit points for ${classLevelShortLabel(character, level.id)}. Roll, take the table's number or type your own.`}
              />
              <HpPolicyChoice />
              <LevelHpRow characterId={characterId} levelId={level.id} showFavored={false} />
            </div>
          )}
          {level && step === 'favored' && (
            <FavoredStep characterId={characterId} levelId={level.id} />
          )}
          {level && step === 'ability' && (
            <div className="space-y-4">
              <StepHeading
                title={`Ability increase at level ${position}`}
                lede="One permanent +1. It shows on the live sheet at once."
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ABILITIES.map((a) => {
                  const selected = level.state.abilityIncrease === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        store.updateClassLevel(characterId, level.id, {
                          abilityIncrease: selected ? null : a,
                        })
                      }
                      className={cn(
                        'min-h-11 border p-3 text-left',
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-foreground/20 hover:bg-foreground/5',
                      )}
                    >
                      <div className="font-sans">{ABILITY_LABEL[a]}</div>
                      <div className="font-mono text-sm">
                        {before.abilities[a].total} →{' '}
                        {before.abilities[a].total + 1}{' '}
                        <span className="text-muted-foreground">
                          ({formatBonus(Math.floor((before.abilities[a].total + 1 - 10) / 2))})
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {level && step === 'skills' && (
            <div className="space-y-4">
              <StepHeading
                title="Skill ranks"
                lede={`Ranks gained at ${classLevelShortLabel(character, level.id)}.`}
              />
              <SkillRanksTable characterId={characterId} levelId={level.id} />
            </div>
          )}
          {level && step === 'features' && (
            <FeaturesStep characterId={characterId} levelId={level.id} />
          )}
          {level && step === 'review' && (
            <div className="space-y-4">
              <StepHeading
                title="Before and after"
                lede={`${character.name} at level ${position - 1} and now.`}
              />
              <Diff before={before} after={sheet} />
              {mine.length > 0 && (
                <div className="border-foreground/20 bg-card border p-3">
                  <WarningList warnings={mine} onAction={apply} />
                </div>
              )}
            </div>
          )}
          {!level && step !== 'class' && (
            <p className="text-muted-foreground text-sm">Choose a class first.</p>
          )}
          <StepFooter
            onPrev={prevStep ? () => go(prevStep) : undefined}
            onNext={
              step === 'class' && !level
                ? undefined
                : nextStep
                  ? () => go(nextStep)
                  : done
            }
            nextLabel={nextStep ? `Next: ${steps[index + 1]!.label}` : 'Done: open sheet'}
          />
        </section>
        <LiveSheetPanel characterId={characterId} />
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={isNew ? 'Cancel this level-up?' : `Delete level ${position}?`}
        description="The level and what it granted will be removed:"
        items={
          level
            ? [
                classLevelShortLabel(character, level.id),
                ...character.entries
                  .filter((e) => e.gainedAtClassLevel === level.id)
                  .map((e) => entryName(character, e)),
              ]
            : []
        }
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          if (level) store.removeClassLevel(characterId, level.id);
          setConfirmRemove(false);
          done();
        }}
      />
    </main>
  );
}

function FavoredStep({
  characterId,
  levelId,
}: {
  characterId: string;
  levelId: string;
}) {
  const store = useBuilderStore();
  const character = useCharacter(characterId)!;
  const level = classLevels(character).find((l) => l.id === levelId)!;
  const favored = favoredClass(character);
  const detail = classDetail(level.state.classKey);
  const isFavored = !!favored && favored === level.state.classKey;
  const fcb = level.state.favoredClassBonus;
  return (
    <div className="space-y-4">
      <StepHeading
        title="Favored class bonus"
        lede={
          isFavored
            ? `${detail?.kind === 'class' ? classLevelShortLabel(character, levelId) : 'This level'} is in the favored class: +1 hp or +1 skill rank.`
            : favored
              ? `This level isn’t in the favored class (${lookupCatalog(character, favored)?.name}). Choosing a bonus anyway is flagged, not blocked.`
              : 'No favored class is set on the race.'
        }
      />
      <ChoiceRow
        label="Favored class bonus"
        value={fcb ? fcb.choice : 'none'}
        onChange={(v) =>
          store.updateClassLevel(characterId, levelId, {
            favoredClassBonus:
              v === 'none'
                ? null
                : v === 'alt'
                  ? { choice: 'alt', note: detail?.favoredClassAlt ?? '' }
                  : { choice: v },
          })
        }
        options={[
          { value: 'none', label: 'None' },
          { value: 'hp', label: '+1 hit point' },
          { value: 'skill', label: '+1 skill rank' },
          { value: 'alt', label: 'Alternative', hint: detail?.favoredClassAlt },
        ]}
      />
    </div>
  );
}

function FeaturesStep({
  characterId,
  levelId,
}: {
  characterId: string;
  levelId: string;
}) {
  const store = useBuilderStore();
  const character = useCharacter(characterId)!;
  const warnings = useWarnings(characterId);
  const apply = useApplyWarning(characterId);
  const gained = featuresGainedAt(character, levelId);
  const prompts = warnings.filter(
    (w) =>
      w.where === 'features' ||
      (w.where === `classLevel:${levelId}` &&
        (w.id.includes('-pick-') || w.id.includes('-missing-'))),
  );
  const feats = gained.gainedHere.filter((e) => e.kind === 'feat');
  return (
    <div className="space-y-4">
      <StepHeading
        title="Features & picks"
        lede="Fixed features are already on the sheet. Picks are yours."
      />
      <div className="space-y-1">
        {gained.features.map((f) =>
          f.kind === 'fixed' ? (
            <div
              key={`fixed-${f.grant.catalogKey}`}
              className="border-foreground/10 flex items-center gap-2 border-b py-1.5"
            >
              <Check
                className={cn('size-4', f.entry ? 'text-primary' : 'text-muted-foreground opacity-30')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div>{f.catalog?.name ?? f.grant.catalogKey}</div>
                <div className="text-muted-foreground text-xs">{f.catalog?.summary}</div>
              </div>
              {f.entry ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${f.catalog?.name}`}
                  onClick={() => store.removeEntry(characterId, f.entry!.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    store.addEntry(characterId, f.grant.catalogKey, {
                      gainedAtClassLevel: levelId,
                    })
                  }
                >
                  Add
                </Button>
              )}
            </div>
          ) : (
            <div
              key={`pick-${f.grant.choose}`}
              className="border-foreground/10 border-b py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sky-300">{f.grant.label}</span>
                <span className="text-muted-foreground text-xs">
                  pick one
                </span>
              </div>
              {f.picked.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1">
                  <Check className="text-primary size-4" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div>{entryName(character, p)}</div>
                    <div className="text-muted-foreground text-xs">
                      {lookupCatalog(character, p.catalogKey)?.summary}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${entryName(character, p)}`}
                    onClick={() => store.removeEntry(characterId, p.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
              <div className="mt-1">
                <AddFromCatalog
                  label={`Choose a ${f.grant.label.toLowerCase()}`}
                  options={f.options}
                  onAdd={(key) =>
                    store.addEntry(characterId, key, {
                      gainedAtClassLevel: levelId,
                    })
                  }
                />
              </div>
            </div>
          ),
        )}
        {gained.generalFeat && (
          <div className="border-foreground/10 border-b py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sky-300">Feat</span>
              <span className="text-muted-foreground text-xs">
                odd character level
              </span>
            </div>
            {feats.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1">
                <Check className="text-primary size-4" aria-hidden />
                <div className="min-w-0 flex-1">{entryName(character, p)}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${entryName(character, p)}`}
                  onClick={() => store.removeEntry(characterId, p.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <div className="mt-1">
              <AddFromCatalog
                label="Choose a feat"
                options={catalogOfKind('feat')}
                onAdd={(key) =>
                  store.addEntry(characterId, key, {
                    gainedAtClassLevel: levelId,
                  })
                }
              />
            </div>
          </div>
        )}
        {gained.features.length === 0 && !gained.generalFeat && (
          <p className="text-muted-foreground text-sm">
            Nothing new to pick at this level.
          </p>
        )}
      </div>
      {prompts.length > 0 && (
        <div className="border-foreground/20 bg-card border p-3">
          <WarningList warnings={prompts} onAction={apply} />
        </div>
      )}
    </div>
  );
}

const DIFF_KEYS: StatKey[] = [
  'hp',
  'bab',
  'fort',
  'ref',
  'will',
  'ac',
  'touchAc',
  'flatFootedAc',
  'cmb',
  'cmd',
  'init',
];

function Diff({ before, after }: { before: ResolvedSheet; after: ResolvedSheet }) {
  const rows: { label: string; key: StatKey }[] = [
    ...DIFF_KEYS.map((key) => ({ label: statLabel(key), key })),
    ...ABILITIES.filter(
      (a) => before.abilities[a].total !== after.abilities[a].total,
    ).map((a) => ({ label: ABILITY_SHORT[a], key: `ability.${a}` as StatKey })),
    ...SKILLS.filter(
      (s) => before.skills[s.key].total !== after.skills[s.key].total,
    ).map((s) => ({ label: s.name, key: `skill.${s.key}` as StatKey })),
  ];
  return (
    <div className="border-foreground/20 border">
      <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_4rem_4rem_4rem] gap-2 px-2 py-2 font-mono text-xs tracking-wide uppercase">
        <span>Statistic</span>
        <span className="text-right">Before</span>
        <span className="text-right">After</span>
        <span className="text-right">Change</span>
      </div>
      {rows.map(({ label, key }) => {
        const b = statOf(before, key).total;
        const a = statOf(after, key).total;
        const d = a - b;
        return (
          <div
            key={key}
            className="border-foreground/10 grid grid-cols-[minmax(0,1fr)_4rem_4rem_4rem] gap-2 border-t px-2 py-1.5 font-mono"
          >
            <span className="truncate font-sans">{label}</span>
            <span className="text-muted-foreground text-right">
              {formatStat(key, b)}
            </span>
            <span className="text-right">{formatStat(key, a)}</span>
            <span
              className={cn(
                'text-right',
                d > 0 ? 'text-primary' : d < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {d === 0 ? '—' : formatBonus(d)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
