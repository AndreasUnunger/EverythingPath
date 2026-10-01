'use client';
// PROTOTYPE (throwaway, #208) — Variant B, round 2: the Character pages.
// Each opens with the one header block (name, status, level line, owner,
// membership strip, confirmation note); the shell's Back sits above. A Full
// Character gets the living sheet; a Militia-only one gets a compact card
// with what the militia reads, edited in place, and Build out.

import { Hammer } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { useBuildoutFlow, useCreateFlow, useLevelUpFlow } from '../flows';
import { useProtoNav } from '../nav';
import { Missing } from '../shell/placeholders';
import {
  className,
  classLevels,
  useBuilderStore,
  useCharacter,
  useResolved,
  useWarnings,
} from '../store';
import type { Character, ResolvedSheet } from '../types';
import type { Warning } from '../warnings';
import { TodoPanel, openTodos } from './checklist';
import { LivingSheet } from './living-sheet';
import {
  CharacterHeader,
  CharacterTitle,
  LevelField,
  MembershipStrip,
  MilitiaScoresGrid,
  NameField,
  useBuildOut,
  useMilitiaLevel,
} from './page-bits';
import { action, characterMain, type SheetMode } from './shared';

// ------------------------------------------------------ Militia-only body

/** What the militia reads, edited in place; Build out opens the whole sheet. */
function MilitiaOnlyBody({ character }: { character: Character }) {
  const level = useMilitiaLevel();
  const buildOut = useBuildOut();
  return (
    <Card className="gap-3 p-4">
      <p className="text-muted-foreground text-sm">
        Militia-only: this shows only what the militia needs. Name, level and
        the six scores are edited here, on Characters & officers too. Build out
        to open the whole sheet.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Name
          </span>
          <NameField character={character} className="w-full" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Level
          </span>
          <LevelField character={character} setLevel={level.setLevel} />
        </label>
      </div>
      <MilitiaScoresGrid character={character} editable className="max-w-md" />
      <div>
        <Button
          type="button"
          className={action}
          onClick={() => buildOut.ask(character)}
        >
          <Hammer /> Build out
        </Button>
      </div>
      {level.dialog}
      {buildOut.dialog}
    </Card>
  );
}

// --------------------------------------------------------------- pages

/**
 * A Full Character's page body: the living sheet in a mode, with the name
 * in its vitals row and the membership strip under it.
 */
function FullBody({
  character,
  sheet,
  warnings,
  mode,
  banner,
  actions,
  focusLevelId,
  baseline,
  dismissDeltas,
}: {
  character: Character;
  sheet: ResolvedSheet;
  warnings: Warning[];
  mode: SheetMode;
  banner?: ReactNode;
  actions?: ReactNode;
  focusLevelId?: string | null;
  baseline?: ResolvedSheet | null;
  dismissDeltas?: () => void;
}) {
  return (
    <main className={characterMain}>
      <LivingSheet
        character={character}
        sheet={sheet}
        warnings={warnings}
        mode={mode}
        focusLevelId={focusLevelId}
        baseline={baseline}
        dismissDeltas={dismissDeltas}
        heading={<CharacterTitle character={character} />}
        actions={actions}
        below={<MembershipStrip character={character} className="mb-3" />}
        banner={banner}
      />
    </main>
  );
}

/** The sheet: everything editable, breakdowns on tap. */
export function SheetPage({ characterId }: { characterId: string }) {
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const buildOut = useBuildOut();
  if (!character || !sheet) return <Missing noun="character" />;

  if (character.sheetMode === 'militiaOnly')
    return (
      <main className={characterMain}>
        <CharacterHeader
          character={character}
          actions={
            <Button
              type="button"
              className={action}
              onClick={() => buildOut.ask(character)}
            >
              <Hammer /> Build out
            </Button>
          }
        />
        <MilitiaOnlyBody character={character} />
        {buildOut.dialog}
      </main>
    );

  return (
    <FullBody
      character={character}
      sheet={sheet}
      warnings={warnings}
      mode="sheet"
    />
  );
}

/**
 * Level up: the flow appends a Class Level and highlights what the new
 * level needs. The before → after markers compare against the baseline.
 */
export function LevelUpPage({ characterId }: { characterId: string }) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const { character, focusLevelId, baseline, dismissBaseline } =
    useLevelUpFlow(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  if (!character || !sheet) return <Missing noun="character" />;

  const done = (
    <Button
      type="button"
      size="sm"
      className={action}
      onClick={() => nav.go('sheet')}
    >
      Done levelling
    </Button>
  );

  if (!focusLevelId)
    return (
      <main className={characterMain}>
        <CharacterHeader character={character} actions={done} />
        <p className="text-muted-foreground">Adding level {sheet.level + 1}…</p>
      </main>
    );

  const level = classLevels(character).find((l) => l.id === focusLevelId)!;
  const inClass = classLevels(character).filter(
    (l) =>
      l.state.classKey === level.state.classKey &&
      l.state.position <= level.state.position,
  ).length;
  const todos = openTodos(
    character,
    'levelup',
    focusLevelId,
    store.state.pointBuyBudget,
    warnings,
  );
  return (
    <FullBody
      character={character}
      sheet={sheet}
      warnings={warnings}
      mode="levelup"
      focusLevelId={focusLevelId}
      baseline={baseline}
      dismissDeltas={dismissBaseline}
      banner={
        <TodoPanel
          className="mb-3"
          title={`Level ${level.state.position}: ${className(level.state.classKey)} ${inClass}`}
          todos={todos}
          characterId={character.id}
        />
      }
      actions={done}
    />
  );
}

/**
 * Create and build out share the sheet; a `title` adds the checklist
 * banner (build out), without one the sheet is plain (create).
 */
function BuildBody({
  character,
  mode,
  title,
}: {
  character: Character;
  mode: 'create' | 'buildout';
  title?: string;
}) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const sheet = useResolved(character.id);
  const warnings = useWarnings(character.id);
  if (!sheet) return <Missing noun="character" />;
  const todos = openTodos(
    character,
    mode,
    null,
    store.state.pointBuyBudget,
    warnings,
  );
  return (
    <FullBody
      character={character}
      sheet={sheet}
      warnings={warnings}
      mode={mode}
      banner={
        title ? (
          <TodoPanel
            className="mb-3"
            title={title}
            todos={todos}
            characterId={character.id}
          />
        ) : undefined
      }
      actions={
        <Button
          type="button"
          size="sm"
          variant={todos.length === 0 ? 'default' : 'outline'}
          className={action}
          onClick={() => nav.go('sheet')}
        >
          Open as sheet
        </Button>
      }
    />
  );
}

/** A new Character from nothing: the same sheet, blank. */
export function CreatePage() {
  const character = useCreateFlow();
  if (!character)
    return (
      <main className={characterMain}>
        <p className="text-muted-foreground">Starting a blank sheet…</p>
      </main>
    );
  return <BuildBody character={character} mode="create" />;
}

/** The sheet right after Build out: Unspecified levels become real ones. */
export function BuildoutPage({ characterId }: { characterId: string }) {
  const character = useBuildoutFlow(characterId);
  // Keep the banner's wording stable across the build-out moment.
  const [title] = useState('Build out');
  if (!character) return <Missing noun="character" />;
  if (character.sheetMode === 'militiaOnly')
    return (
      <main className={characterMain}>
        <CharacterHeader character={character} />
        <p className="text-muted-foreground">Building out…</p>
      </main>
    );
  return <BuildBody character={character} mode="buildout" title={title} />;
}
