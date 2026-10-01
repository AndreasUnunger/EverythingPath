'use client';
// PROTOTYPE (throwaway, #208) — Variant A: the step wizard used by
// `create` (a new Character) and `buildout` (Sergeant Hessa). The rail,
// the current step and the live sheet; every step is reachable at any time.

import { ArrowRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import {
  useBuilderStore,
  useCampaign,
  useCharacter,
  useResolved,
  useWarnings,
} from '../store';
import { ABILITIES, type VariantProps } from '../types';
import {
  WIZARD_STEPS,
  isWizardStep,
  stepOfWarning,
  type WizardStep,
} from './rules';
import { LiveSheetPanel, LiveSheetStrip, StepFooter, StepRail } from './shared';
import {
  AbilitiesStep,
  ClassStep,
  ConceptStep,
  FeatsStep,
  GearStep,
  HpStep,
  RaceStep,
  ReviewStep,
  SkillsStep,
} from './steps';

export function WizardPage({ page, campaignId, characterId }: VariantProps) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const creating = useRef(false);
  const character = useCharacter(characterId);

  // `create` without a character: make one and put its id in the URL.
  useEffect(() => {
    if (page !== 'create' || characterId || creating.current) return;
    creating.current = true;
    const id = store.createCharacter({ campaignId });
    nav.go('create', {
      character: id,
      params: { step: nav.param('step') ?? 'concept' },
    });
  }, [page, characterId, campaignId, store, nav]);

  if (!character)
    return (
      <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground">Starting a new character…</p>
      </main>
    );
  if (page === 'buildout' && character.sheetMode === 'militiaOnly')
    return <BuildoutIntro characterId={character.id} />;
  return <Wizard characterId={character.id} page={page} />;
}

function BuildoutIntro({ characterId }: { characterId: string }) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId)!;
  const sheet = useResolved(characterId)!;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="font-sans text-2xl">Build out {character.name}</h1>
      <div className="border-foreground/20 bg-card max-w-2xl space-y-3 border p-4">
        <p>
          {character.name} is a militia-only character: level{' '}
          <span className="font-mono">{sheet.militia.level}</span> with{' '}
          <span className="font-mono">
            {ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${sheet.militia.scores[a]}`).join(' · ')}
          </span>
          .
        </p>
        <p className="text-muted-foreground text-sm">
          Building out gives those {sheet.militia.level} levels classes, hit
          points, skills, feats and gear. The militia keeps seeing the same
          level and scores unless you change the scores themselves; the full
          sheet is extra, not a replacement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11 md:min-h-9"
            onClick={() => {
              store.setSheetMode(characterId, 'full');
              nav.set({ step: 'classes' });
            }}
          >
            Build out as a Full Character <ArrowRight aria-hidden />
          </Button>
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => nav.go('list')}>
            Keep militia-only
          </Button>
        </div>
      </div>
    </main>
  );
}

function Wizard({
  characterId,
  page,
}: {
  characterId: string;
  page: VariantProps['page'];
}) {
  const nav = useProtoNav();
  const character = useCharacter(characterId)!;
  const campaign = useCampaign(character.campaignId);
  const sheet = useResolved(characterId)!;
  const warnings = useWarnings(characterId);
  const stepParam = nav.param('step');
  const step: WizardStep = isWizardStep(stepParam)
    ? stepParam
    : page === 'buildout'
      ? 'classes'
      : 'concept';
  const index = WIZARD_STEPS.findIndex((s) => s.key === step);
  const go = (key: WizardStep) => nav.set({ step: key });
  const counts: Partial<
    Record<WizardStep, { warning: number; prompt: number; info: number }>
  > = {};
  for (const w of warnings) {
    const key = stepOfWarning(w);
    const c = (counts[key] ??= { warning: 0, prompt: 0, info: 0 });
    c[w.severity] += 1;
  }
  const prev = WIZARD_STEPS[index - 1]?.key;
  const next = WIZARD_STEPS[index + 1]?.key;
  const finish = () =>
    character.sheetMode === 'full'
      ? nav.go('sheet', { character: characterId })
      : nav.go('list');

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-40 md:p-6 md:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            {page === 'buildout' ? 'Build out' : 'New character'} · step{' '}
            {index + 1} of {WIZARD_STEPS.length}
          </div>
          <h1 className="font-sans text-2xl">{character.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => nav.go('list')}>
            {campaign?.militia ? 'All characters' : 'Characters'}
          </Button>
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={finish}>
            {character.sheetMode === 'full' ? 'Open sheet' : 'Done'}
          </Button>
        </div>
      </div>
      {page === 'buildout' && (
        <p className="text-muted-foreground text-sm">
          Militia numbers stay level {sheet.militia.level} ·{' '}
          {ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${sheet.militia.scores[a]}`).join(' · ')}{' '}
          unless the scores themselves change.
        </p>
      )}
      <LiveSheetStrip characterId={characterId} />
      <div className="grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)_17rem]">
        <StepRail steps={WIZARD_STEPS} current={step} onSelect={go} counts={counts} />
        <section className="min-w-0 space-y-5">
          {step === 'concept' && <ConceptStep characterId={characterId} />}
          {step === 'race' && <RaceStep characterId={characterId} />}
          {step === 'abilities' && <AbilitiesStep characterId={characterId} />}
          {step === 'classes' && <ClassStep characterId={characterId} />}
          {step === 'hp' && <HpStep characterId={characterId} />}
          {step === 'skills' && (
            <SkillsStep
              characterId={characterId}
              levelId={nav.param('lvl')}
              onLevel={(id) => nav.set({ lvl: id })}
            />
          )}
          {step === 'feats' && <FeatsStep characterId={characterId} />}
          {step === 'gear' && <GearStep characterId={characterId} />}
          {step === 'review' && (
            <ReviewStep characterId={characterId} onGo={go} />
          )}
          <StepFooter
            onPrev={prev ? () => go(prev) : undefined}
            onNext={next ? () => go(next) : finish}
            nextLabel={
              next
                ? `Next: ${WIZARD_STEPS[index + 1]!.label}`
                : character.sheetMode === 'full'
                  ? 'Done: open sheet'
                  : 'Done'
            }
          />
        </section>
        <LiveSheetPanel characterId={characterId} />
      </div>
    </main>
  );
}
