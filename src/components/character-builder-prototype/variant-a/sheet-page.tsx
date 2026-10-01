'use client';
// PROTOTYPE (throwaway, #208) — Variant A: a read-mostly sheet. Each section
// has an Edit that reopens the matching wizard step; Class Levels reopen in
// the level wizard, move, or delete; gear and effects toggle in place.

import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT, SKILLS, classDetail } from '../catalog';
import { useProtoNav } from '../nav';
import {
  classLevelShortLabel,
  classLevels,
  entryName,
  featuresGainedAt,
  isTemporary,
  lookupCatalog,
  raceCatalog,
  skillRankBudget,
  useBuilderStore,
  useCampaign,
  useCharacter,
  useResolved,
  useWarnings,
} from '../store';
import { ABILITIES, type SheetEntry } from '../types';
import { formatBonus, isBuffed } from '../ui-helpers';
import type { WizardStep } from './rules';
import {
  BreakdownDialog,
  ConfirmDialog,
  StatButton,
  WarningList,
  chip,
  formatStat,
  statOf,
  useApplyWarning,
  type StatKey,
} from './shared';

function Section({
  title,
  onEdit,
  editLabel = 'Edit',
  children,
  className,
}: {
  title: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-foreground/20 bg-card border p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-sans text-xl">{title}</h2>
        {onEdit && (
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={onEdit}>
            <Pencil aria-hidden /> {editLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function SheetPage({ characterId }: { characterId: string }) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const apply = useApplyWarning(characterId);
  const campaign = useCampaign(character?.campaignId ?? '');
  const [breakdown, setBreakdown] = useState<StatKey | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  if (!character || !sheet) return null;
  const race = raceCatalog(character);
  const levels = classLevels(character);
  const roster = campaign?.militia?.roster.find((p) => p.characterId === characterId);
  const edit = (step: WizardStep) =>
    nav.go('create', { character: characterId, params: { step } });
  const stat = (key: StatKey, label: string, size: 'sm' | 'md' = 'md') => (
    <StatButton
      key={key}
      label={label}
      value={formatStat(key, statOf(sheet, key).total)}
      stat={statOf(sheet, key)}
      onClick={() => setBreakdown(key)}
      size={size}
    />
  );
  const removingLevel = levels.find((l) => l.id === removing);
  const toggles = character.entries.filter(
    (e) =>
      e.kind === 'item' || e.kind === 'spell' || e.kind === 'condition' || e.kind === 'manual',
  );
  const feats = character.entries.filter((e) => e.kind === 'feat');
  const traits = character.entries.filter((e) => e.kind === 'trait');
  const skills = SKILLS.filter(
    (s) => sheet.skills[s.key].ranks > 0 || sheet.skills[s.key].classSkill,
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            {campaign?.militia ? 'Characters & officers' : 'Characters'}
            {roster && roster.roles.length > 0 && ` · ${roster.roles.join(', ')}`}
          </div>
          <h1 className="font-sans text-3xl">{character.name}</h1>
          <div className="text-muted-foreground text-sm">
            {race?.catalog.name ?? 'No race'} ·{' '}
            {sheet.classes.map((c) => `${c.name} ${c.levels}`).join(' / ') || 'no levels'}{' '}
            · level {sheet.level} · {character.kind === 'pc' ? 'player character' : 'NPC'}
            {campaign?.militia && (
              <>
                {' · '}
                <span className={chip}>
                  {character.sheetMode === 'full' ? 'Full character' : 'Militia-only'}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => edit('concept')}>
            <Pencil aria-hidden /> Concept
          </Button>
          <Button
            className="min-h-11 md:min-h-9"
            onClick={() => nav.go('levelup', { character: characterId })}
          >
            <ChevronUp aria-hidden /> Level up to {sheet.level + 1}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Abilities" onEdit={() => edit('abilities')}>
          <div className="grid grid-cols-6 gap-1">
            {ABILITIES.map((a) => (
              <StatButton
                key={a}
                label={ABILITY_SHORT[a]}
                value={String(sheet.abilities[a].total)}
                stat={sheet.abilities[a]}
                onClick={() => setBreakdown(`ability.${a}`)}
                size="lg"
              />
            ))}
          </div>
          <div className="mt-1 grid grid-cols-6 gap-1 text-center font-mono text-sm">
            {ABILITIES.map((a) => (
              <span
                key={a}
                className={cn(isBuffed(sheet.abilityMods[a]) ? 'text-rose-300' : 'text-muted-foreground')}
              >
                {formatBonus(sheet.abilityMods[a].total)}
              </span>
            ))}
          </div>
          {campaign?.militia && (
            <p className="text-muted-foreground mt-2 text-xs">
              Militia sees {ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${sheet.militia.scores[a]}`).join(' · ')}{' '}
              (permanent only).
            </p>
          )}
        </Section>

        <Section title="Combat" onEdit={() => edit('hp')} editLabel="Hit points">
          <div className="grid grid-cols-3 gap-1">
            {stat('hp', 'HP')}
            {stat('init', 'Init')}
            {stat('bab', 'BAB')}
            {stat('ac', 'AC')}
            {stat('touchAc', 'Touch')}
            {stat('flatFootedAc', 'Flat-footed')}
            {stat('fort', 'Fort')}
            {stat('ref', 'Ref')}
            {stat('will', 'Will')}
            {stat('cmb', 'CMB')}
            {stat('cmd', 'CMD')}
            {stat('flatFootedCmd', 'FF CMD')}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {stat('attackMelee', 'Melee attack', 'sm')}
            {stat('attackRanged', 'Ranged attack', 'sm')}
          </div>
        </Section>

        <Section
          title="Class levels"
          onEdit={() => nav.go('levelup', { character: characterId })}
          editLabel="Add a level"
          className="lg:col-span-2"
        >
          <div>
            {levels.map((l, i) => {
              const gained = featuresGainedAt(character, l.id);
              const budget = skillRankBudget(character, l.id);
              const names = gained.gainedHere.map((e) => entryName(character, e));
              return (
                <div
                  key={l.id}
                  className="border-foreground/10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-1.5"
                >
                  <span className="text-muted-foreground w-8 font-mono">
                    {l.state.position}
                  </span>
                  <span className="w-28 font-sans">
                    {classLevelShortLabel(character, l.id)}
                  </span>
                  <span className="font-mono text-sm">
                    {l.state.hpGained === null ? (
                      <span className="text-muted-foreground">hp —</span>
                    ) : (
                      `hp ${l.state.hpGained}`
                    )}
                    {classDetail(l.state.classKey) && (
                      <span className="text-muted-foreground">
                        /d{classDetail(l.state.classKey)!.hitDie}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {[
                      l.state.favoredClassBonus
                        ? `favored: ${l.state.favoredClassBonus.choice === 'alt' ? 'alt' : `+1 ${l.state.favoredClassBonus.choice}`}`
                        : null,
                      l.state.abilityIncrease
                        ? `+1 ${ABILITY_SHORT[l.state.abilityIncrease]}`
                        : null,
                      budget ? `${budget.spent}/${budget.total} ranks` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="min-w-0 flex-1 basis-full text-xs md:basis-auto">
                    {names.join(', ')}
                  </span>
                  <span className="ml-auto flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move level ${l.state.position} up`}
                      className="min-h-11 md:min-h-9"
                      onClick={() =>
                        store.moveClassLevel(characterId, l.id, l.state.position - 1)
                      }
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move level ${l.state.position} down`}
                      className="min-h-11 md:min-h-9"
                      onClick={() =>
                        store.moveClassLevel(characterId, l.id, l.state.position + 1)
                      }
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 md:min-h-9"
                      onClick={() =>
                        nav.go('levelup', {
                          character: characterId,
                          params: { level: l.id, step: 'class' },
                        })
                      }
                    >
                      <Pencil aria-hidden /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete level ${l.state.position}`}
                      className="min-h-11 md:min-h-9"
                      onClick={() => setRemoving(l.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                  {i === levels.length - 1 && null}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Skills" onEdit={() => edit('skills')}>
          <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_3rem_3rem_4rem] gap-1 px-1 font-mono text-xs tracking-wide uppercase">
            <span>Skill</span>
            <span>Abil.</span>
            <span className="text-right">Ranks</span>
            <span className="text-right">Total</span>
          </div>
          {skills.map((s) => {
            const st = sheet.skills[s.key];
            return (
              <div
                key={s.key}
                className="border-foreground/10 grid grid-cols-[minmax(0,1fr)_3rem_3rem_4rem] items-center gap-1 border-b px-1 py-0.5"
              >
                <span className="truncate text-sm">
                  {s.name}
                  {st.classSkill && (
                    <span className="text-primary font-mono text-xs"> ✓</span>
                  )}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {ABILITY_SHORT[s.ability]}
                </span>
                <span className="text-muted-foreground text-right font-mono text-sm">
                  {st.ranks}
                </span>
                <button
                  type="button"
                  className={cn(
                    'hover:bg-foreground/5 text-right font-mono',
                    !st.usable && 'text-muted-foreground',
                    isBuffed(st) && 'text-rose-300',
                  )}
                  onClick={() => setBreakdown(`skill.${s.key}`)}
                >
                  {formatBonus(st.total)}
                </button>
              </div>
            );
          })}
        </Section>

        <div className="space-y-4">
          <Section title="Feats & traits" onEdit={() => edit('feats')}>
            <ul className="space-y-1 text-sm">
              {feats.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span>{entryName(character, e)}</span>
                  <span className="text-muted-foreground text-xs">
                    {lookupCatalog(character, e.catalogKey)?.summary}
                  </span>
                </li>
              ))}
              {traits.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className={chip}>trait</span>
                  <span>{entryName(character, e)}</span>
                  <span className="text-muted-foreground text-xs">
                    {lookupCatalog(character, e.catalogKey)?.summary}
                  </span>
                </li>
              ))}
              {feats.length + traits.length === 0 && (
                <li className="text-muted-foreground">None yet.</li>
              )}
            </ul>
          </Section>

          <Section title="Gear & effects" onEdit={() => edit('gear')}>
            <div>
              {toggles.map((e) => (
                <ToggleRow key={e.id} characterId={characterId} entry={e} />
              ))}
              {toggles.length === 0 && (
                <p className="text-muted-foreground text-sm">Nothing yet.</p>
              )}
            </div>
          </Section>
        </div>

        <Section title="Rules notes" className="lg:col-span-2">
          <WarningList
            warnings={warnings}
            onAction={apply}
            empty="Nothing to flag."
          />
        </Section>
      </div>

      <BreakdownDialog sheet={sheet} statKey={breakdown} onClose={() => setBreakdown(null)} />
      <ConfirmDialog
        open={!!removingLevel}
        title={removingLevel ? `Delete level ${removingLevel.state.position}?` : ''}
        description="The level and what it granted will be removed; later levels close up."
        items={
          removingLevel
            ? [
                classLevelShortLabel(character, removingLevel.id),
                ...character.entries
                  .filter((e) => e.gainedAtClassLevel === removingLevel.id)
                  .map((e) => entryName(character, e)),
              ]
            : []
        }
        confirmLabel="Delete level"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removingLevel) store.removeClassLevel(characterId, removingLevel.id);
          setRemoving(null);
        }}
      />
    </main>
  );
}

function ToggleRow({ characterId, entry }: { characterId: string; entry: SheetEntry }) {
  const store = useBuilderStore();
  const character = useCharacter(characterId)!;
  const catalog = lookupCatalog(character, entry.catalogKey);
  const temporary = isTemporary(character, entry);
  return (
    <div className="border-foreground/10 flex items-center gap-2 border-b py-1">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className={cn(!entry.active && 'text-muted-foreground')}>
            {entryName(character, entry)}
          </span>
          <span className={chip}>{entry.kind}</span>
          {temporary && (
            <span className={cn(chip, 'border-rose-400/60 text-rose-300')}>temporary</span>
          )}
        </div>
        <div className="text-muted-foreground text-xs">
          {catalog?.summary}
          {entry.notes && ` · ${entry.notes}`}
        </div>
      </div>
      <Button
        variant={entry.active ? 'default' : 'outline'}
        size="sm"
        aria-pressed={entry.active}
        className="min-h-11 w-16 md:min-h-9"
        onClick={() => store.toggleEntryActive(characterId, entry.id)}
      >
        {entry.active ? 'On' : 'Off'}
      </Button>
    </div>
  );
}
