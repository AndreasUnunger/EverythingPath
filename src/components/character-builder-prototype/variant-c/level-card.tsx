'use client';
// PROTOTYPE (throwaway, #208) — Variant C Class Level card: one level's
// choices (class, hp, favored class bonus, ability increase, skill ranks,
// feats, class features), all editable at any time.

import { Dices, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  ABILITY_LABEL,
  ABILITY_SHORT,
  CLASSES,
  SKILLS,
  SKILL_BY_KEY,
  catalogOfKind,
  classDetail,
} from '../catalog';
import { HP_POLICIES, hpPrefill, rollHitDie } from '../hp';
import type { ClassLevelEntry } from '../sheet';
import {
  entryName,
  favoredClass,
  featSlots,
  featuresGainedAt,
  levelInClass,
  skillRankBudget,
  useBuilderStore,
} from '../store';
import {
  ABILITIES,
  type Character,
  type SkillKey,
} from '../types';
import { formatBonus } from '../ui-helpers';
import { Caption, Chip, Stepper, action } from './bits';
import { classPreviews, type ClassPreview } from './model';

const NONE = '__none';

export function levelSummary(character: Character, level: ClassLevelEntry) {
  const s = level.state;
  if (!s.classKey) return 'no class yet · adds a Hit Die only';
  const ranks = Object.values(s.skillRanks).reduce((a, b) => a + (b ?? 0), 0);
  const gained = character.entries.filter(
    (e) => e.gainedAtClassLevel === level.id,
  );
  const names = gained.map((e) => entryName(character, e).replace(/^.*?: /, ''));
  return [
    s.hpGained === null ? 'hp —' : `hp ${s.hpGained}`,
    s.favoredClassBonus
      ? `fcb ${s.favoredClassBonus.choice === 'alt' ? 'alt' : s.favoredClassBonus.choice}`
      : null,
    s.abilityIncrease ? `+1 ${ABILITY_SHORT[s.abilityIncrease]}` : null,
    `${ranks} ranks`,
    names.length ? names.join(', ') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function PreviewLine({ p }: { p: ClassPreview }) {
  const saves = (['fort', 'ref', 'will'] as const)
    .filter((s) => p.saveGains[s])
    .map((s) => `${{ fort: 'Fort', ref: 'Ref', will: 'Will' }[s]} ${formatBonus(p.saveGains[s])}`);
  return (
    <span className="text-muted-foreground font-mono text-xs">
      d{p.hitDie} · BAB {formatBonus(p.babGain)}
      {saves.length ? ` · ${saves.join(' ')}` : ''} · {p.ranks}+Int ranks
      {p.features.length ? ` · ${p.features.join(', ')}` : ''}
    </span>
  );
}

/** Class choice: an option grid while unspecified, a select once chosen. */
export function ClassPicker({
  character,
  level,
  grid,
}: {
  character: Character;
  level: ClassLevelEntry;
  grid?: boolean;
}) {
  const store = useBuilderStore();
  const previews = classPreviews(character, level.state.position);
  const current = previews.find((p) => p.classKey === level.state.classKey);
  const set = (classKey: string | null) =>
    store.updateClassLevel(character.id, level.id, { classKey });
  if (!level.state.classKey && grid)
    return (
      <div>
        <Caption className="mb-1">Class · what each gives at this level</Caption>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {previews.map((p) => (
            <button
              key={p.classKey}
              type="button"
              onClick={() => set(p.classKey)}
              className="border-foreground/20 hover:bg-foreground/5 hover:border-primary/60 flex min-h-11 flex-col items-start gap-0.5 border px-2 py-1.5 text-left"
            >
              <span className="font-sans">
                {p.name} {p.n}
              </span>
              <PreviewLine p={p} />
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <Caption>Class</Caption>
        <Select
          value={level.state.classKey ?? NONE}
          onValueChange={(v) => set(v === NONE ? null : v)}
        >
          <SelectTrigger className={cn(action, 'w-52')}>
            <SelectValue placeholder="Choose a class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Unspecified</SelectItem>
            {previews.map((p) => (
              <SelectItem key={p.classKey} value={p.classKey}>
                {p.name} {p.n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {current && <PreviewLine p={current} />}
    </div>
  );
}

function HpField({
  character,
  level,
}: {
  character: Character;
  level: ClassLevelEntry;
}) {
  const store = useBuilderStore();
  const detail = classDetail(level.state.classKey);
  const hitDie = detail?.hitDie ?? null;
  const prefill = hpPrefill({
    position: level.state.position,
    hitDie,
    policy: store.state.hpPolicy,
  });
  const policy = HP_POLICIES.find((p) => p.key === store.state.hpPolicy)!;
  const set = (hpGained: number | null) =>
    store.updateClassLevel(character.id, level.id, { hpGained });
  return (
    <div>
      <Caption>
        Hit points gained{hitDie ? ` · d${hitDie}` : ''}
      </Caption>
      <div className="flex flex-wrap items-center gap-1">
        <Stepper
          label="Hit points gained"
          value={level.state.hpGained}
          onChange={set}
          empty="—"
        />
        {hitDie && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={action}
              onClick={() => set(rollHitDie(hitDie))}
            >
              <Dices /> Roll d{hitDie}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={action}
              onClick={() => set(hitDie / 2 + 1)}
            >
              Avg {hitDie / 2 + 1}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={action}
              onClick={() => set(hitDie)}
            >
              Max {hitDie}
            </Button>
          </>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Select
          value={store.state.hpPolicy}
          onValueChange={(v) => store.setHpPolicy(v as typeof store.state.hpPolicy)}
        >
          <SelectTrigger
            size="sm"
            className="h-7 border-dashed px-2 font-mono text-xs"
            aria-label="Hit point policy"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HP_POLICIES.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
                <span className="text-muted-foreground ml-1 text-xs">
                  {p.crb ? 'Core Rulebook' : 'table rule'}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground font-mono text-xs">
          {prefill.reason}
          {!policy.crb && ' · not Core Rulebook'}
        </span>
      </div>
    </div>
  );
}

function FcbField({
  character,
  level,
}: {
  character: Character;
  level: ClassLevelEntry;
}) {
  const store = useBuilderStore();
  const favored = favoredClass(character);
  const detail = classDetail(level.state.classKey);
  const fcb = level.state.favoredClassBonus;
  const value = fcb ? fcb.choice : NONE;
  const set = (v: string) =>
    store.updateClassLevel(character.id, level.id, {
      favoredClassBonus:
        v === NONE
          ? null
          : v === 'alt'
            ? { choice: 'alt', note: detail?.favoredClassAlt ?? '' }
            : { choice: v as 'hp' | 'skill' },
    });
  const isFavored = favored && favored === level.state.classKey;
  return (
    <div>
      <Caption>
        Favored class bonus
        {!favored ? ' · no favored class' : !isFavored ? ' · not favored' : ''}
      </Caption>
      <div className="flex flex-wrap gap-1">
        {[
          [NONE, 'None'],
          ['hp', '+1 hp'],
          ['skill', '+1 skill rank'],
          ...(detail?.favoredClassAlt ? [['alt', 'Alternate']] : []),
        ].map(([k, label]) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={value === k ? 'default' : 'outline'}
            className={action}
            onClick={() => set(k!)}
          >
            {label}
          </Button>
        ))}
      </div>
      {fcb?.choice === 'alt' && (
        <p className="text-muted-foreground mt-1 text-xs">{fcb.note}</p>
      )}
    </div>
  );
}

function AbilityIncreaseField({
  character,
  level,
}: {
  character: Character;
  level: ClassLevelEntry;
}) {
  const store = useBuilderStore();
  const due = level.state.position % 4 === 0;
  const value = level.state.abilityIncrease;
  if (!due && !value)
    return (
      <div>
        <Caption>Ability increase</Caption>
        <p className="text-muted-foreground text-xs">
          Due at levels 4, 8, 12…{' '}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() =>
              store.updateClassLevel(character.id, level.id, {
                abilityIncrease: 'str',
              })
            }
          >
            add one anyway
          </button>
        </p>
      </div>
    );
  return (
    <div>
      <Caption>Ability increase{due ? ` · level ${level.state.position}` : ''}</Caption>
      <div className="flex flex-wrap gap-1">
        {ABILITIES.map((a) => (
          <Button
            key={a}
            type="button"
            size="sm"
            variant={value === a ? 'default' : 'outline'}
            className={cn(action, 'px-2 font-mono')}
            onClick={() =>
              store.updateClassLevel(character.id, level.id, {
                abilityIncrease: value === a ? null : a,
              })
            }
            title={`+1 ${ABILITY_LABEL[a]}`}
          >
            {ABILITY_SHORT[a]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SkillRanksField({
  character,
  level,
}: {
  character: Character;
  level: ClassLevelEntry;
}) {
  const store = useBuilderStore();
  const budget = skillRankBudget(character, level.id);
  const detail = classDetail(level.state.classKey);
  const ranks = level.state.skillRanks;
  const setRank = (key: SkillKey, v: number) => {
    const next = { ...ranks };
    if (v <= 0) delete next[key];
    else next[key] = v;
    store.updateClassLevel(character.id, level.id, { skillRanks: next });
  };
  const rows = SKILLS.filter((s) => (ranks[s.key] ?? 0) > 0);
  const left = budget ? budget.total - budget.spent : 0;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <Caption>Skill ranks</Caption>
        {budget && (
          <span
            className={cn(
              'font-mono text-xs',
              left < 0 ? 'text-amber-300' : left > 0 ? 'text-sky-300' : 'text-muted-foreground',
            )}
            title={budget.parts.map((p) => `${p.label} ${formatBonus(p.value)}`).join(', ')}
          >
            {budget.spent} of {budget.total} spent
            {left > 0 ? ` · ${left} left` : left < 0 ? ` · ${-left} over` : ''}
            <span className="text-muted-foreground">
              {' '}
              ({budget.parts.map((p) => `${p.label} ${p.value}`).join(' + ')})
            </span>
          </span>
        )}
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {rows.map((s) => {
          const classSkill = detail?.classSkills.includes(s.key);
          const all = character.entries.reduce(
            (a, e) =>
              a +
              (e.state.kind === 'classLevel'
                ? (e.state.skillRanks[s.key] ?? 0)
                : 0),
            0,
          );
          return (
            <div
              key={s.key}
              className="border-foreground/10 flex items-center gap-2 border p-1"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {s.name}
                {classSkill && (
                  <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                    class
                  </span>
                )}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {all} total
              </span>
              <Stepper
                label={`${s.name} ranks at this level`}
                value={ranks[s.key] ?? 0}
                min={0}
                onChange={(v) => setRank(s.key, v ?? 0)}
              />
            </div>
          );
        })}
        <Select value="" onValueChange={(v) => setRank(v as SkillKey, (ranks[v as SkillKey] ?? 0) + 1)}>
          <SelectTrigger
            className={cn(action, 'w-full border-dashed')}
            aria-label="Add a rank in a skill"
          >
            <SelectValue placeholder="+ rank in another skill" />
          </SelectTrigger>
          <SelectContent>
            {SKILLS.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.name}
                <span className="text-muted-foreground ml-1 text-xs">
                  {ABILITY_SHORT[s.ability]}
                  {detail?.classSkills.includes(s.key) ? ' · class skill' : ''}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function FeatsField({
  character,
  level,
}: {
  character: Character;
  level: ClassLevelEntry;
}) {
  const store = useBuilderStore();
  const slots = featSlots(character).slots.filter(
    (s) => s.classLevelId === level.id,
  );
  const feats = character.entries.filter(
    (e) => e.kind === 'feat' && e.gainedAtClassLevel === level.id,
  );
  const allFeats = catalogOfKind('feat');
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <Caption>Feats</Caption>
        <span className="text-muted-foreground font-mono text-xs">
          {slots.length
            ? slots.map((s) => s.reason).join(' · ')
            : 'no feat slot at this level'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {feats.map((f) => {
          const catalog = store.catalog.find((c) => c.key === f.catalogKey);
          const needsChoice =
            catalog?.detail.kind === 'feat' && catalog.detail.choice;
          const choice = 'choice' in f.state ? f.state.choice : null;
          return (
            <span key={f.id} className="inline-flex items-center gap-1">
              <Chip className="gap-1 pr-0.5">
                {catalog?.name ?? f.catalogKey}
                {f.notes && (
                  <span className="text-muted-foreground">· {f.notes}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${catalog?.name}`}
                  className="hover:text-destructive p-0.5"
                  onClick={() => store.removeEntry(character.id, f.id)}
                >
                  <X className="size-3" />
                </button>
              </Chip>
              {needsChoice === 'skill' && (
                <Select
                  value={choice ?? NONE}
                  onValueChange={(v) =>
                    store.updateEntry(character.id, f.id, {
                      choice: v === NONE ? null : v,
                    })
                  }
                >
                  <SelectTrigger size="sm" className="h-7 font-mono text-xs">
                    <SelectValue placeholder="skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILLS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {needsChoice === 'weapon' && (
                <Input
                  value={choice ?? ''}
                  placeholder="weapon"
                  aria-label="Weapon"
                  onChange={(e) =>
                    store.updateEntry(character.id, f.id, {
                      choice: e.target.value || null,
                    })
                  }
                  className="h-7 w-28 font-mono text-xs"
                />
              )}
            </span>
          );
        })}
        <Select
          value=""
          onValueChange={(v) =>
            store.addEntry(character.id, v, { gainedAtClassLevel: level.id })
          }
        >
          <SelectTrigger
            className={cn(action, 'h-auto w-auto border-dashed')}
            aria-label="Add feat"
          >
            <SelectValue placeholder="+ feat" />
          </SelectTrigger>
          <SelectContent>
            {allFeats.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.name}
                <span className="text-muted-foreground ml-1 text-xs">
                  {f.summary}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function FeaturesField({
  character,
  level,
}: {
  character: Character;
  level: ClassLevelEntry;
}) {
  const store = useBuilderStore();
  const gained = featuresGainedAt(character, level.id);
  const grantedKeys = new Set(
    gained.features.flatMap((f) =>
      f.kind === 'fixed'
        ? [f.grant.catalogKey]
        : f.picked.map((p) => p.catalogKey),
    ),
  );
  // Features added by hand or by a one-click fix (Improved Uncanny Dodge).
  const extra = gained.gainedHere.filter(
    (e) => e.kind === 'classFeature' && !grantedKeys.has(e.catalogKey),
  );
  if (!gained.features.length && !extra.length) return null;
  return (
    <div>
      <Caption className="mb-1">Class features gained</Caption>
      <div className="flex flex-wrap items-center gap-1">
        {gained.features.map((f, i) =>
          f.kind === 'fixed' ? (
            <Chip
              // Grants have no id; a class can grant the same key twice at different levels, never at one.
              key={`${f.grant.catalogKey}-${i.toString()}`}
              muted={!f.entry}
              className="gap-1"
              title={f.catalog?.summary}
            >
              {f.catalog?.name ?? f.grant.catalogKey}
              {!f.entry && (
                <button
                  type="button"
                  className="text-sky-300 underline underline-offset-2"
                  onClick={() =>
                    store.addEntry(character.id, f.grant.catalogKey, {
                      gainedAtClassLevel: level.id,
                    })
                  }
                >
                  add
                </button>
              )}
            </Chip>
          ) : (
            <span
              key={`${f.grant.choose}-${i.toString()}`}
              className="inline-flex flex-wrap items-center gap-1"
            >
              {f.picked.map((p) => (
                <Chip key={p.id} className="gap-1 pr-0.5">
                  {entryName(character, p)}
                  <button
                    type="button"
                    aria-label={`Remove ${entryName(character, p)}`}
                    className="hover:text-destructive p-0.5"
                    onClick={() => store.removeEntry(character.id, p.id)}
                  >
                    <X className="size-3" />
                  </button>
                </Chip>
              ))}
              <Select
                value=""
                onValueChange={(v) =>
                  store.addEntry(character.id, v, {
                    gainedAtClassLevel: level.id,
                  })
                }
              >
                <SelectTrigger
                  className={cn(
                    action,
                    'h-auto w-auto border-dashed',
                    !f.picked.length && 'border-sky-500/60 text-sky-300',
                  )}
                  aria-label={f.grant.label}
                >
                  <SelectValue
                    placeholder={
                      f.picked.length
                        ? `+ ${f.grant.label.toLowerCase()}`
                        : `Choose ${f.grant.label.toLowerCase()}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.name.replace(/^.*?: /, '')}
                      <span className="text-muted-foreground ml-1 text-xs">
                        {o.summary}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          ),
        )}
        {extra.map((e) => (
          <Chip key={e.id} className="gap-1 pr-0.5">
            {entryName(character, e)}
            <button
              type="button"
              aria-label={`Remove ${entryName(character, e)}`}
              className="hover:text-destructive p-0.5"
              onClick={() => store.removeEntry(character.id, e.id)}
            >
              <X className="size-3" />
            </button>
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function LevelCardBody({
  character,
  level,
  pickerGrid,
}: {
  character: Character;
  level: ClassLevelEntry;
  /** Show the class option grid while the level is unspecified. */
  pickerGrid?: boolean;
}) {
  const n = levelInClass(character, level.id);
  const detail = classDetail(level.state.classKey);
  return (
    <>
      <ClassPicker character={character} level={level} grid={pickerGrid} />
      {detail && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <HpField character={character} level={level} />
            <FcbField character={character} level={level} />
          </div>
          <AbilityIncreaseField character={character} level={level} />
          <SkillRanksField character={character} level={level} />
          <FeatsField character={character} level={level} />
          <FeaturesField character={character} level={level} />
          <p className="text-muted-foreground font-mono text-xs">
            {CLASSES.find((c) => c.key === level.state.classKey)?.name} {n} ·{' '}
            {CLASSES.find((c) => c.key === level.state.classKey)?.summary} ·
            class skills: {detail.classSkills.map((k) => SKILL_BY_KEY[k].name).join(', ')}
          </p>
        </>
      )}
      {!detail && (
        <div className="grid gap-3 md:grid-cols-2">
          <HpField character={character} level={level} />
          <AbilityIncreaseField character={character} level={level} />
        </div>
      )}
    </>
  );
}
