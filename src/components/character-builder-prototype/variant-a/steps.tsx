'use client';
// PROTOTYPE (throwaway, #208) — Variant A: one decision per step. Every step
// edits the store directly; the live sheet beside it reacts. Nothing locks.

import { Check, Dices, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { cn } from '~/lib/utils';
import {
  ABILITY_LABEL,
  ABILITY_SHORT,
  CLASSES,
  POINT_BUY_COST,
  RACES,
  SKILLS,
  catalogOfKind,
  classDetail,
} from '../catalog';
import { HP_POLICIES, hpPrefill, rollHitDie } from '../hp';
import {
  baseScores,
  classLevelShortLabel,
  classLevels,
  favoredClass,
  featSlots,
  featuresGainedAt,
  isTemporary,
  levelsRemovedBy,
  lookupCatalog,
  pointBuyCost,
  raceCatalog,
  skillRankBudget,
  useBuilderStore,
  useCampaign,
  useCharacter,
  useResolved,
  useWarnings,
} from '../store';
import { ABILITIES, type SheetEntry } from '../types';
import { formatBonus } from '../ui-helpers';
import type { Warning } from '../warnings';
import { AddFromCatalog } from './pickers';
import {
  BAB_LABEL,
  classLevelGives,
  goodSaves,
  stepOfWarning,
  type WizardStep,
  WIZARD_STEPS,
} from './rules';
import {
  BreakdownDialog,
  ChoiceRow,
  ConfirmDialog,
  LiveSheet,
  NumberStepper,
  StepHeading,
  WarningLine,
  WarningList,
  chip,
  type StatKey,
  useApplyWarning,
} from './shared';

type StepProps = { characterId: string };

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function StepWarnings({
  characterId,
  step,
}: {
  characterId: string;
  step: WizardStep;
}) {
  const warnings = useWarnings(characterId).filter(
    (w) => stepOfWarning(w) === step,
  );
  const apply = useApplyWarning(characterId);
  if (warnings.length === 0) return null;
  return (
    <div className="border-foreground/20 bg-card border p-3">
      <WarningList warnings={warnings} onAction={apply} />
    </div>
  );
}

// ---------------------------------------------------------------- concept

export function ConceptStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const campaign = useCampaign(character?.campaignId ?? '');
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  if (!character) return null;
  const level = classLevels(character).length;
  const changeLevel = (n: number | null) => {
    if (n === null || n < 0) return;
    if (n < level && levelsRemovedBy(character, n).length > 0)
      setPendingLevel(n);
    else store.setMilitiaLevel(characterId, n);
  };
  return (
    <div className="space-y-5">
      <StepHeading
        title="Concept"
        lede="Who this is. Everything here can change later."
      />
      <Field label="Name">
        <Input
          value={character.name}
          onChange={(e) => store.setName(characterId, e.target.value)}
          className="min-h-11 font-sans text-lg md:min-h-9"
        />
      </Field>
      <Field label="Played by">
        <ChoiceRow
          label="Played by"
          value={character.kind}
          onChange={(kind) => store.updateCharacter(characterId, { kind })}
          options={[
            { value: 'pc', label: 'Player character' },
            { value: 'npc', label: 'Non-player character' },
          ]}
        />
      </Field>
      {campaign?.militia && (
        <Field
          label="Presentation"
          hint="Militia-only shows just name, level and scores on the militia roster. The sheet keeps everything either way, so you can switch any time."
        >
          <ChoiceRow
            label="Presentation"
            value={character.sheetMode}
            onChange={(mode) => store.setSheetMode(characterId, mode)}
            options={[
              { value: 'full', label: 'Full character' },
              { value: 'militiaOnly', label: 'Militia-only' },
            ]}
          />
        </Field>
      )}
      <Field
        label="Starting level"
        hint="Levels start Unspecified; the Class step gives each one a class."
      >
        <NumberStepper
          label="Starting level"
          value={level}
          min={0}
          max={20}
          onChange={changeLevel}
        />
      </Field>
      <Field label="Notes">
        <Textarea
          value={character.description}
          onChange={(e) =>
            store.updateCharacter(characterId, { description: e.target.value })
          }
          rows={3}
        />
      </Field>
      <StepWarnings characterId={characterId} step="concept" />
      <ConfirmDialog
        open={pendingLevel !== null}
        title={`Lower to level ${pendingLevel ?? 0}?`}
        description="These levels and what they granted will be removed:"
        items={
          pendingLevel === null ? [] : levelsRemovedBy(character, pendingLevel)
        }
        confirmLabel="Remove levels"
        onCancel={() => setPendingLevel(null)}
        onConfirm={() => {
          if (pendingLevel !== null)
            store.setMilitiaLevel(characterId, pendingLevel);
          setPendingLevel(null);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------- race

export function RaceStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  if (!character) return null;
  const race = raceCatalog(character);
  const choice =
    race?.entry.state.kind === 'race' ? race.entry.state.abilityChoice : null;
  const favored = favoredClass(character);
  return (
    <div className="space-y-5">
      <StepHeading
        title="Race"
        lede="Racial modifiers land on the live sheet as soon as you pick."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {RACES.map((r) => {
          const selected = race?.catalog.key === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => store.setRace(characterId, r.key)}
              aria-pressed={selected}
              className={cn(
                'min-h-11 border p-3 text-left',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-foreground/20 hover:bg-foreground/5',
              )}
            >
              <div className="flex items-center gap-2 font-sans text-lg">
                {r.name}
                {selected && <Check className="text-primary size-4" aria-hidden />}
              </div>
              <div className="text-muted-foreground text-sm">{r.summary}</div>
              {r.detail.kind === 'race' && (
                <ul className="text-muted-foreground mt-1 text-xs">
                  {r.detail.traitsText.slice(0, 3).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => store.setRace(characterId, null)}
          className="border-foreground/20 text-muted-foreground min-h-11 border border-dashed p-3 text-left text-sm"
        >
          No race yet
        </button>
      </div>
      {race?.detail.chooseAbility && (
        <Field
          label={`${race.catalog.name}: +2 to one ability`}
          hint="The +2 shows on the live sheet as a racial bonus."
        >
          <ChoiceRow
            label="Ability for +2"
            value={choice}
            onChange={(a) =>
              store.setRace(characterId, race.catalog.key, { abilityChoice: a })
            }
            options={ABILITIES.map((a) => ({
              value: a,
              label: ABILITY_SHORT[a],
            }))}
          />
        </Field>
      )}
      {race && (
        <Field
          label="Favored class"
          hint="Each level in the favored class gives +1 hp or +1 skill rank (chosen on the Hit points step)."
        >
          <ChoiceRow
            label="Favored class"
            value={favored}
            onChange={(key) =>
              store.setRace(characterId, race.catalog.key, {
                favoredClass: key,
              })
            }
            options={CLASSES.map((c) => ({ value: c.key, label: c.name }))}
          />
        </Field>
      )}
      <StepWarnings characterId={characterId} step="race" />
    </div>
  );
}

// -------------------------------------------------------------- abilities

export function AbilitiesStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const [breakdown, setBreakdown] = useState<StatKey | null>(null);
  if (!character || !sheet) return null;
  const base = baseScores(character);
  const cost = pointBuyCost(base);
  const budget = store.state.pointBuyBudget;
  const over = cost.total > budget;
  const race = raceCatalog(character);
  const increaseLevels = classLevels(character).filter(
    (l) => l.state.position % 4 === 0,
  );
  return (
    <div className="space-y-5">
      <StepHeading
        title="Ability scores"
        lede="Point buy by default; any number can be typed in."
      >
        <div className="min-w-48">
          <div className="flex items-baseline justify-between font-mono text-sm">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Point buy
            </span>
            <span className={cn(over && 'text-amber-300')}>
              {cost.total} / {budget}
            </span>
          </div>
          <div className="bg-foreground/10 h-2 w-full">
            <div
              className={cn('h-2', over ? 'bg-amber-400' : 'bg-primary')}
              style={{
                width: `${Math.min(100, (Math.max(cost.total, 0) / budget) * 100)}%`,
              }}
            />
          </div>
          <div className="text-muted-foreground text-xs">
            {over
              ? `${cost.total - budget} over the table's budget`
              : `${budget - cost.total} left`}
          </div>
        </div>
      </StepHeading>
      <div className="space-y-1">
        <div className="text-muted-foreground hidden grid-cols-[7.5rem_auto_3rem_minmax(0,1fr)_4rem] gap-2 px-1 font-mono text-xs tracking-wide uppercase sm:grid">
          <span>Ability</span>
          <span>Base</span>
          <span>Cost</span>
          <span>Adjustments</span>
          <span className="text-right">Total</span>
        </div>
        {ABILITIES.map((a) => {
          const raceMod = race?.catalog.modifiers.find(
            (m) => m.target === `ability.${a}`,
          );
          const choiceMod =
            race?.entry.state.kind === 'race' &&
            race.entry.state.abilityChoice === a
              ? 2
              : 0;
          const notes = [
            raceMod && typeof raceMod.value === 'number'
              ? `${formatBonus(raceMod.value)} ${race!.catalog.name}`
              : null,
            choiceMod ? `${formatBonus(choiceMod)} chosen` : null,
            ...increaseLevels
              .filter((l) => l.state.abilityIncrease === a)
              .map((l) => `+1 at level ${l.state.position}`),
          ].filter(Boolean);
          const c = POINT_BUY_COST[base[a]];
          return (
            <div
              key={a}
              className="border-foreground/10 grid grid-cols-[minmax(0,1fr)_auto_4rem] items-center gap-2 border-b px-1 py-1.5 sm:grid-cols-[7.5rem_auto_3rem_minmax(0,1fr)_4rem]"
            >
              <div>
                <div className="font-sans">{ABILITY_LABEL[a]}</div>
                <div className="text-muted-foreground text-xs sm:hidden">
                  {notes.join(' · ') || 'no adjustments'} · cost{' '}
                  {c ?? '—'}
                </div>
              </div>
              <NumberStepper
                label={`${ABILITY_LABEL[a]} base`}
                value={base[a]}
                min={1}
                max={30}
                onChange={(v) =>
                  store.setBaseScore(characterId, a, v ?? 10)
                }
              />
              <span
                className={cn(
                  'hidden font-mono sm:inline',
                  c === undefined && 'text-amber-300',
                )}
              >
                {c ?? '—'}
              </span>
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {notes.join(' · ') || '—'}
              </span>
              <button
                type="button"
                onClick={() => setBreakdown(`ability.${a}`)}
                className="hover:bg-foreground/5 min-h-11 text-right font-mono md:min-h-9"
              >
                <span className="text-xl">{sheet.abilities[a].total}</span>
                <span className="text-muted-foreground text-xs">
                  {' '}
                  {formatBonus(sheet.abilityMods[a].total)}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {increaseLevels.length > 0 && (
        <Field
          label="Ability increases"
          hint="One +1 at character level 4, 8, 12, 16 and 20."
        >
          <div className="space-y-2">
            {increaseLevels.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-sm">
                  Level {l.state.position}
                </span>
                <ChoiceRow
                  label={`Level ${l.state.position} increase`}
                  value={l.state.abilityIncrease}
                  onChange={(a) =>
                    store.updateClassLevel(characterId, l.id, {
                      abilityIncrease: a,
                    })
                  }
                  options={ABILITIES.map((a) => ({
                    value: a,
                    label: ABILITY_SHORT[a],
                  }))}
                />
              </div>
            ))}
          </div>
        </Field>
      )}
      <StepWarnings characterId={characterId} step="abilities" />
      <BreakdownDialog
        sheet={sheet}
        statKey={breakdown}
        onClose={() => setBreakdown(null)}
      />
    </div>
  );
}

// ------------------------------------------------------------------ class

export function ClassStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  if (!character) return null;
  const levels = classLevels(character);
  const single = levels.length === 1;
  const setAll = (classKey: string) => {
    for (const l of levels)
      if (l.state.classKey !== classKey)
        store.updateClassLevel(characterId, l.id, { classKey });
  };
  return (
    <div className="space-y-5">
      <StepHeading
        title={single ? 'Class' : `Assign classes to ${levels.length} levels`}
        lede={
          single
            ? 'The class of the first level. Its fixed features are added for you.'
            : 'Give every level a class. Each one adds its hit die, BAB, saves and features; the picks come on later steps.'
        }
      />
      {levels.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No levels yet. Set a starting level on the Concept step.
        </p>
      )}
      {single ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {CLASSES.map((c) => {
            const detail = c.detail.kind === 'class' ? c.detail : null;
            const selected = levels[0]!.state.classKey === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  store.updateClassLevel(characterId, levels[0]!.id, {
                    classKey: c.key,
                  })
                }
                className={cn(
                  'min-h-11 border p-3 text-left',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-foreground/20 hover:bg-foreground/5',
                )}
              >
                <div className="flex items-center gap-2 font-sans text-lg">
                  {c.name}
                  {selected && (
                    <Check className="text-primary size-4" aria-hidden />
                  )}
                </div>
                {detail && (
                  <div className="text-muted-foreground text-sm">
                    d{detail.hitDie} · {BAB_LABEL[detail.bab]} · good{' '}
                    {goodSaves(detail).join(', ')} · {detail.skillRanksPerLevel}{' '}
                    + Int ranks
                  </div>
                )}
                <div className="mt-1 text-xs">
                  <span className="text-muted-foreground">Level 1 gives: </span>
                  {classLevelGives(c.key, 1).join(', ') || '—'}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <Field label="All levels">
            <div className="flex flex-wrap gap-1">
              {CLASSES.map((c) => (
                <Button
                  key={c.key}
                  variant="outline"
                  className="min-h-11 md:min-h-9"
                  onClick={() => setAll(c.key)}
                >
                  All {c.name}
                </Button>
              ))}
            </div>
          </Field>
          <div className="space-y-1">
            {levels.map((l) => {
              const inClass = l.state.classKey
                ? levels.filter(
                    (x) =>
                      x.state.classKey === l.state.classKey &&
                      x.state.position <= l.state.position,
                  ).length
                : 0;
              return (
                <div
                  key={l.id}
                  className="border-foreground/10 grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 border-b py-1.5 md:grid-cols-[5rem_12rem_minmax(0,1fr)]"
                >
                  <span className="font-mono text-sm">Level {l.state.position}</span>
                  <ClassSelect
                    value={l.state.classKey}
                    onChange={(classKey) =>
                      store.updateClassLevel(characterId, l.id, { classKey })
                    }
                  />
                  <span className="text-muted-foreground col-span-2 text-xs md:col-span-1">
                    {l.state.classKey
                      ? `${classLevelShortLabel(character, l.id)} gives: ${classLevelGives(l.state.classKey, inClass).join(', ') || 'nothing new'}`
                      : 'Unspecified: adds a Hit Die only'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <StepWarnings characterId={characterId} step="classes" />
    </div>
  );
}

export function ClassSelect({
  value,
  onChange,
  includeUnspecified = true,
}: {
  value: string | null;
  onChange: (classKey: string | null) => void;
  includeUnspecified?: boolean;
}) {
  return (
    <Select
      value={value ?? 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : v)}
    >
      <SelectTrigger className="min-h-11 w-full md:min-h-9" aria-label="Class">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeUnspecified && (
          <SelectItem value="none" className="min-h-11">
            Unspecified
          </SelectItem>
        )}
        {CLASSES.map((c) => (
          <SelectItem key={c.key} value={c.key} className="min-h-11">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// -------------------------------------------------------------- hit points

export function HpPolicyChoice() {
  const store = useBuilderStore();
  return (
    <div className="grid gap-1 sm:grid-cols-3">
      {HP_POLICIES.map((p) => {
        const selected = store.state.hpPolicy === p.key;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={selected}
            onClick={() => store.setHpPolicy(p.key)}
            className={cn(
              'min-h-11 border p-2 text-left',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-foreground/20 hover:bg-foreground/5',
            )}
          >
            <div className="flex items-center gap-2 text-sm">
              {p.label}
              <span
                className={cn(
                  chip,
                  !p.crb && 'border-amber-500/60 text-amber-300',
                )}
              >
                {p.crb ? 'Core Rulebook' : 'table rule'}
              </span>
            </div>
            <div className="text-muted-foreground text-xs">{p.description}</div>
          </button>
        );
      })}
    </div>
  );
}

/** One level's hit points and favored class bonus; shared with the level wizard. */
export function LevelHpRow({
  characterId,
  levelId,
  showFavored = true,
}: {
  characterId: string;
  levelId: string;
  showFavored?: boolean;
}) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  if (!character) return null;
  const level = classLevels(character).find((l) => l.id === levelId);
  if (!level) return null;
  const detail = classDetail(level.state.classKey);
  const prefill = hpPrefill({
    position: level.state.position,
    hitDie: detail?.hitDie ?? null,
    policy: store.state.hpPolicy,
  });
  const set = (hpGained: number | null) =>
    store.updateClassLevel(characterId, levelId, { hpGained });
  const favored = favoredClass(character);
  const isFavored = !!favored && level.state.classKey === favored;
  const fcb = level.state.favoredClassBonus;
  return (
    <div className="border-foreground/10 space-y-2 border-b py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-40 shrink-0 text-sm">
          <span className="font-mono text-muted-foreground">
            L{level.state.position}
          </span>{' '}
          {classLevelShortLabel(character, levelId)}
          {detail && (
            <span className="text-muted-foreground font-mono"> d{detail.hitDie}</span>
          )}
        </span>
        <NumberStepper
          label={`Hit points at level ${level.state.position}`}
          value={level.state.hpGained}
          min={0}
          placeholder="—"
          onChange={set}
        />
        {detail && (
          <div className="flex flex-wrap gap-1">
            {prefill.roll && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-9"
                onClick={() => set(rollHitDie(detail.hitDie))}
              >
                <Dices aria-hidden /> Roll d{detail.hitDie}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-9"
              onClick={() => set(detail.hitDie / 2 + 1)}
            >
              Avg {detail.hitDie / 2 + 1}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-9"
              onClick={() => set(detail.hitDie)}
            >
              Max {detail.hitDie}
            </Button>
          </div>
        )}
        <span className="text-muted-foreground text-xs">{prefill.reason}</span>
      </div>
      {showFavored && level.state.classKey && (
        <div className="flex flex-wrap items-center gap-2 pl-0 md:pl-40">
          <span className="text-muted-foreground text-xs">
            Favored class bonus{' '}
            {isFavored
              ? ''
              : favored
                ? `(not the favored class)`
                : '(no favored class yet)'}
          </span>
          <ChoiceRow
            label={`Favored class bonus at level ${level.state.position}`}
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
              { value: 'hp', label: '+1 hp' },
              { value: 'skill', label: '+1 skill rank' },
              { value: 'alt', label: 'Alternative' },
            ]}
          />
          {fcb?.choice === 'alt' && (
            <span className="text-muted-foreground text-xs">
              {detail?.favoredClassAlt}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function HpStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const [breakdown, setBreakdown] = useState(false);
  if (!character || !sheet) return null;
  const levels = classLevels(character);
  const fillEmpty = () => {
    for (const l of levels) {
      if (l.state.hpGained !== null || !l.state.classKey) continue;
      const p = hpPrefill({
        position: l.state.position,
        hitDie: classDetail(l.state.classKey)?.hitDie ?? null,
        policy: store.state.hpPolicy,
      });
      const value = p.value ?? (p.roll ? rollHitDie(classDetail(l.state.classKey)!.hitDie) : null);
      if (value !== null)
        store.updateClassLevel(characterId, l.id, { hpGained: value });
    }
  };
  return (
    <div className="space-y-5">
      <StepHeading
        title="Hit points"
        lede="How the table fills in hit points per level. Your own number always wins."
      >
        <button
          type="button"
          onClick={() => setBreakdown(true)}
          className="border-foreground/20 hover:bg-foreground/5 min-h-11 border px-3 text-right md:min-h-9"
        >
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Total HP{' '}
          </span>
          <span className="font-mono text-2xl">{sheet.hp.total}</span>
        </button>
      </StepHeading>
      <Field label="Table rule for hit points">
        <HpPolicyChoice />
      </Field>
      <Field label="Per level">
        <div>
          {levels.map((l) => (
            <LevelHpRow key={l.id} characterId={characterId} levelId={l.id} />
          ))}
          {levels.length === 0 && (
            <p className="text-muted-foreground text-sm">No levels yet.</p>
          )}
        </div>
      </Field>
      <div>
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={fillEmpty}>
          <Dices aria-hidden /> Fill empty levels by the table rule
        </Button>
      </div>
      <StepWarnings characterId={characterId} step="hp" />
      <BreakdownDialog
        sheet={sheet}
        statKey={breakdown ? 'hp' : null}
        onClose={() => setBreakdown(false)}
      />
    </div>
  );
}

// ------------------------------------------------------------------ skills

/** The skill table for one level's ranks, with live totals. Shared with the level wizard. */
export function SkillRanksTable({
  characterId,
  levelId,
}: {
  characterId: string;
  levelId: string;
}) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const [breakdown, setBreakdown] = useState<StatKey | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!character || !sheet) return null;
  const level = classLevels(character).find((l) => l.id === levelId);
  if (!level) return null;
  const budget = skillRankBudget(character, levelId);
  const detail = classDetail(level.state.classKey);
  const ranksHere = level.state.skillRanks;
  const setRank = (key: (typeof SKILLS)[number]['key'], v: number | null) => {
    const next = { ...ranksHere };
    if (!v || v <= 0) delete next[key];
    else next[key] = v;
    store.updateClassLevel(characterId, levelId, { skillRanks: next });
  };
  const list = showAll
    ? SKILLS
    : SKILLS.filter(
        (s) =>
          sheet.skills[s.key].classSkill ||
          sheet.skills[s.key].ranks > 0 ||
          !s.trainedOnly,
      );
  const over = budget ? budget.spent > budget.total : false;
  return (
    <div className="space-y-2">
      {budget ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={cn('font-mono', over && 'text-amber-300')}>
            {budget.spent} / {budget.total} ranks
          </span>
          <span className="text-muted-foreground text-xs">
            {budget.parts.map((p) => `${p.label} ${formatBonus(p.value)}`).join(' · ')}
          </span>
          <div className="bg-foreground/10 h-1.5 w-full max-w-xs">
            <div
              className={cn('h-1.5', over ? 'bg-amber-400' : 'bg-primary')}
              style={{
                width: `${Math.min(100, (budget.spent / Math.max(1, budget.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          An Unspecified level has no rank budget; give it a class first.
          Ranks can still be recorded.
        </p>
      )}
      <div className="text-muted-foreground hidden grid-cols-[minmax(0,1fr)_3rem_auto_3.5rem_4rem] gap-2 px-1 font-mono text-xs tracking-wide uppercase md:grid">
        <span>Skill</span>
        <span>Abil.</span>
        <span>Ranks here</span>
        <span className="text-right">All</span>
        <span className="text-right">Total</span>
      </div>
      {list.map((s) => {
        const stat = sheet.skills[s.key];
        const isClass = detail?.classSkills.includes(s.key) ?? false;
        return (
          <div
            key={s.key}
            className="border-foreground/10 grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-2 border-b px-1 py-1 md:grid-cols-[minmax(0,1fr)_3rem_auto_3.5rem_4rem]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="truncate">{s.name}</span>
                {isClass && (
                  <span className={cn(chip, 'text-primary border-primary/60')} title="Class skill">
                    class
                  </span>
                )}
                {s.trainedOnly && !stat.usable && (
                  <span className={cn(chip, 'text-muted-foreground')}>
                    trained only
                  </span>
                )}
              </div>
              <div className="text-muted-foreground font-mono text-xs md:hidden">
                {ABILITY_SHORT[s.ability]} · {stat.ranks} ranks total
              </div>
            </div>
            <span className="text-muted-foreground hidden font-mono text-xs md:inline">
              {ABILITY_SHORT[s.ability]}
            </span>
            <NumberStepper
              label={`${s.name} ranks at this level`}
              value={ranksHere[s.key] ?? 0}
              min={0}
              onChange={(v) => setRank(s.key, v)}
            />
            <span className="text-muted-foreground hidden text-right font-mono md:inline">
              {stat.ranks}
            </span>
            <button
              type="button"
              onClick={() => setBreakdown(`skill.${s.key}`)}
              className={cn(
                'hover:bg-foreground/5 min-h-11 text-right font-mono text-lg md:min-h-9',
                !stat.usable && 'text-muted-foreground',
              )}
            >
              {formatBonus(stat.total)}
            </button>
          </div>
        );
      })}
      <Button
        variant="link"
        className="h-auto p-0"
        onClick={() => setShowAll(!showAll)}
      >
        {showAll ? 'Hide unusable trained-only skills' : 'Show every skill'}
      </Button>
      <BreakdownDialog
        sheet={sheet}
        statKey={breakdown}
        onClose={() => setBreakdown(null)}
      />
    </div>
  );
}

export function SkillsStep({
  characterId,
  levelId,
  onLevel,
}: StepProps & { levelId: string | null; onLevel: (id: string) => void }) {
  const character = useCharacter(characterId);
  if (!character) return null;
  const levels = classLevels(character);
  const current =
    levels.find((l) => l.id === levelId) ??
    [...levels].reverse().find((l) => l.state.classKey) ??
    levels[0];
  return (
    <div className="space-y-5">
      <StepHeading
        title="Skills"
        lede="Ranks are spent per level. Totals include ability, class skill and everything else on the sheet."
      />
      {levels.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {levels.map((l) => {
            const b = skillRankBudget(character, l.id);
            return (
              <Button
                key={l.id}
                variant={l.id === current?.id ? 'default' : 'outline'}
                className="min-h-11 md:min-h-9"
                onClick={() => onLevel(l.id)}
              >
                L{l.state.position} {classLevelShortLabel(character, l.id)}
                {b && (
                  <span
                    className={cn(
                      'font-mono text-xs',
                      b.spent > b.total ? 'text-amber-300' : 'opacity-70',
                    )}
                  >
                    {b.spent}/{b.total}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}
      {current ? (
        <SkillRanksTable characterId={characterId} levelId={current.id} />
      ) : (
        <p className="text-muted-foreground text-sm">No levels yet.</p>
      )}
      <StepWarnings characterId={characterId} step="skills" />
    </div>
  );
}

// ------------------------------------------------------------------ feats

function EntryRow({
  characterId,
  entry,
  warnings,
  children,
}: {
  characterId: string;
  entry: SheetEntry;
  warnings: Warning[];
  children?: ReactNode;
}) {
  const store = useBuilderStore();
  const character = useCharacter(characterId)!;
  const catalog = lookupCatalog(character, entry.catalogKey);
  const level = entry.gainedAtClassLevel
    ? classLevels(character).find((l) => l.id === entry.gainedAtClassLevel)
    : null;
  const mine = warnings.filter((w) => w.where === `entry:${entry.id}`);
  return (
    <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-b py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span>{catalog?.name ?? entry.catalogKey}</span>
          {level && (
            <span className={chip}>
              L{level.state.position} {classLevelShortLabel(character, level.id)}
            </span>
          )}
        </div>
        <div className="text-muted-foreground text-xs">{catalog?.summary}</div>
        {mine.map((w) => (
          <WarningLine key={w.id} warning={w} />
        ))}
      </div>
      {children}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${catalog?.name ?? 'entry'}`}
        className="min-h-11 md:min-h-9"
        onClick={() => store.removeEntry(characterId, entry.id)}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

export function FeatsStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const warnings = useWarnings(characterId);
  const apply = useApplyWarning(characterId);
  if (!character) return null;
  const levels = classLevels(character);
  const latest = levels[levels.length - 1];
  const slots = featSlots(character);
  const feats = character.entries.filter((e) => e.kind === 'feat');
  const traits = character.entries.filter((e) => e.kind === 'trait');
  const picks = levels.flatMap((l) =>
    featuresGainedAt(character, l.id)
      .features.filter((f) => f.kind === 'choice')
      .map((f) => ({ level: l, feature: f })),
  );
  return (
    <div className="space-y-5">
      <StepHeading
        title="Feats & traits"
        lede="Slots and prerequisites are advice, never a lock."
      />
      <Field label={`Feats · ${slots.taken} of ${slots.slots.length} slots`}>
        <div className="text-muted-foreground mb-1 flex flex-wrap gap-1 text-xs">
          {slots.slots.map((s) => (
            <span key={`${s.kind}-${s.reason}`} className={chip}>
              {s.reason}
            </span>
          ))}
        </div>
        {feats.map((e) => {
          const catalog = lookupCatalog(character, e.catalogKey);
          const needsChoice =
            catalog?.detail.kind === 'feat' ? catalog.detail.choice : undefined;
          const choice = 'choice' in e.state ? e.state.choice : null;
          return (
            <EntryRow
              key={e.id}
              characterId={characterId}
              entry={e}
              warnings={warnings}
            >
              {needsChoice === 'skill' && (
                <Select
                  value={choice ?? 'none'}
                  onValueChange={(v) =>
                    store.updateEntry(characterId, e.id, {
                      choice: v === 'none' ? null : v,
                    })
                  }
                >
                  <SelectTrigger className="min-h-11 w-44 md:min-h-9" aria-label="Skill">
                    <SelectValue placeholder="Skill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a skill</SelectItem>
                    {SKILLS.map((s) => (
                      <SelectItem key={s.key} value={s.key} className="min-h-11">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {needsChoice === 'weapon' && (
                <Input
                  aria-label="Weapon"
                  placeholder="Weapon"
                  value={choice ?? ''}
                  onChange={(ev) =>
                    store.updateEntry(characterId, e.id, {
                      choice: ev.target.value || null,
                    })
                  }
                  className="min-h-11 w-40 md:min-h-9"
                />
              )}
            </EntryRow>
          );
        })}
        <div className="mt-2">
          <AddFromCatalog
            label="Add a feat"
            options={catalogOfKind('feat')}
            onAdd={(key) =>
              store.addEntry(characterId, key, {
                gainedAtClassLevel: latest?.id,
              })
            }
          />
        </div>
      </Field>
      {picks.length > 0 && (
        <Field label="Class picks">
          <div className="space-y-2">
            {picks.map(({ level, feature }) => {
              if (feature.kind !== 'choice') return null;
              return (
                <div key={`${level.id}-${feature.grant.choose}`}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={chip}>
                      L{level.state.position} {classLevelShortLabel(character, level.id)}
                    </span>
                    <span>{feature.grant.label}</span>
                  </div>
                  {feature.picked.map((p) => (
                    <EntryRow
                      key={p.id}
                      characterId={characterId}
                      entry={p}
                      warnings={warnings}
                    />
                  ))}
                  {feature.picked.length === 0 && (
                    <div className="mt-1">
                      <AddFromCatalog
                        label={`Choose a ${feature.grant.label.toLowerCase()}`}
                        options={feature.options}
                        onAdd={(key) =>
                          store.addEntry(characterId, key, {
                            gainedAtClassLevel: level.id,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Field>
      )}
      <Field label={`Traits · ${traits.length} of 2`}>
        {traits.map((e) => (
          <EntryRow
            key={e.id}
            characterId={characterId}
            entry={e}
            warnings={warnings}
          />
        ))}
        <div className="mt-2">
          <AddFromCatalog
            label="Add a trait"
            options={catalogOfKind('trait')}
            onAdd={(key) => store.addEntry(characterId, key)}
          />
        </div>
      </Field>
      <div className="border-foreground/20 bg-card border p-3">
        <WarningList
          warnings={warnings.filter(
            (w) => stepOfWarning(w) === 'feats' && !w.where.startsWith('entry:'),
          )}
          onAction={apply}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- gear

export function GearStep({ characterId }: StepProps) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const warnings = useWarnings(characterId);
  if (!character) return null;
  const items = character.entries.filter((e) => e.kind === 'item');
  const effects = character.entries.filter(
    (e) => e.kind === 'spell' || e.kind === 'condition' || e.kind === 'manual',
  );
  const toggle = (e: SheetEntry) => (
    <Button
      variant={e.active ? 'default' : 'outline'}
      size="sm"
      className="min-h-11 md:min-h-9"
      aria-pressed={e.active}
      onClick={() => store.toggleEntryActive(characterId, e.id)}
    >
      {e.active ? 'On' : 'Off'}
    </Button>
  );
  return (
    <div className="space-y-5">
      <StepHeading
        title="Gear & effects"
        lede="Optional. Worn gear and running effects count on the live sheet while they are on."
      />
      <Field label="Items">
        {items.map((e) => (
          <EntryRow
            key={e.id}
            characterId={characterId}
            entry={e}
            warnings={warnings}
          >
            {isTemporary(character, e) && (
              <span className={chip}>consumable</span>
            )}
            {toggle(e)}
          </EntryRow>
        ))}
        <div className="mt-2">
          <AddFromCatalog
            label="Add an item"
            options={catalogOfKind('item')}
            onAdd={(key) => store.addEntry(characterId, key)}
          />
        </div>
      </Field>
      <Field
        label="Spells & conditions"
        hint="Effects of a day or less are temporary: they change the sheet but not the militia's numbers."
      >
        {effects.map((e) => (
          <EntryRow
            key={e.id}
            characterId={characterId}
            entry={e}
            warnings={warnings}
          >
            {isTemporary(character, e) && <span className={chip}>temporary</span>}
            {toggle(e)}
          </EntryRow>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          <AddFromCatalog
            label="Add a spell"
            options={catalogOfKind('spell')}
            onAdd={(key) => store.addEntry(characterId, key)}
          />
          <AddFromCatalog
            label="Add a condition"
            options={catalogOfKind('condition')}
            onAdd={(key) => store.addEntry(characterId, key)}
          />
        </div>
      </Field>
    </div>
  );
}

// ----------------------------------------------------------------- review

export function ReviewStep({
  characterId,
  onGo,
}: StepProps & { onGo: (step: WizardStep) => void }) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const campaign = useCampaign(character?.campaignId ?? '');
  const apply = useApplyWarning(characterId);
  if (!character || !sheet) return null;
  const race = raceCatalog(character);
  const grouped = WIZARD_STEPS.map((s) => ({
    step: s,
    warnings: warnings.filter((w) => stepOfWarning(w) === s.key),
  })).filter((g) => g.warnings.length > 0);
  const scoreSummary = ABILITIES.map(
    (a) => `${ABILITY_SHORT[a]} ${sheet.militia.scores[a]}`,
  ).join(' · ');
  return (
    <div className="space-y-5">
      <StepHeading
        title="Review"
        lede="What the sheet says now. Open any step to change it."
      />
      <div className="border-foreground/20 bg-card border p-3">
        <div className="font-sans text-xl">{character.name}</div>
        <div className="text-muted-foreground text-sm">
          {race?.catalog.name ?? 'No race'} ·{' '}
          {sheet.classes.map((c) => `${c.name} ${c.levels}`).join(' / ') ||
            'no levels'}{' '}
          · {character.kind === 'pc' ? 'player character' : 'NPC'}
          {campaign?.militia &&
            ` · ${character.sheetMode === 'full' ? 'Full character' : 'Militia-only'}`}
        </div>
        <div className="mt-3 lg:hidden">
          <LiveSheet characterId={characterId} />
        </div>
      </div>
      {campaign?.militia && (
        <Field
          label="On the militia roster"
          hint={`Militia numbers: level ${sheet.militia.level} · ${scoreSummary}. Temporary effects never change them.`}
        >
          <ChoiceRow
            label="Presentation"
            value={character.sheetMode}
            onChange={(mode) => store.setSheetMode(characterId, mode)}
            options={[
              { value: 'full', label: 'Full character' },
              { value: 'militiaOnly', label: 'Militia-only' },
            ]}
          />
        </Field>
      )}
      <Field label={grouped.length ? 'Still open' : 'Rules check'}>
        {grouped.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing to flag.</p>
        )}
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.step.key} className="border-foreground/20 border p-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-sans">{g.step.label}</span>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => onGo(g.step.key)}
                >
                  Open step
                </Button>
              </div>
              <WarningList warnings={g.warnings} onAction={apply} />
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}
