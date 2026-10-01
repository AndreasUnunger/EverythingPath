'use client';
// PROTOTYPE (throwaway, #208) — Variant B "One living sheet". There is no
// wizard: creating, building out and levelling up all happen on one dense
// editable sheet. A page is the same sheet in a different highlighted state
// with a checklist that jumps to what still needs a decision.

import { Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { className, classLevels } from './sheet';
import { defaultSections, type FrameNavFn } from './frame';
import { useProtoNav } from './nav';
import { resolveSheet } from './resolve';
import {
  useBuilderStore,
  useCharacter,
  useResolved,
  useWarnings,
} from './store';
import type { ResolvedSheet, VariantProps } from './types';
import { TodoPanel, openTodos } from './variant-b/checklist';
import { ListPage } from './variant-b/list-page';
import { LivingSheet } from './variant-b/living-sheet';
import type { SheetMode } from './variant-b/shared';

export const name = 'One living sheet';

/** Without a militia the shell drops Militia and the section is plain "Characters". */
export const frameNav: FrameNavFn = ({ campaign }) => ({
  sections: campaign.militia
    ? defaultSections(campaign)
    : [
        ...defaultSections(campaign).filter(
          (s) => s.key === 'week' || s.key === 'history',
        ),
        {
          key: 'characters',
          label: 'Characters',
          short: 'Characters',
          icon: Users,
          to: { page: 'list' },
        },
      ],
  activeKey: 'characters',
});

const wrapper = 'mx-auto w-full max-w-6xl p-4 md:p-6';

function Missing({ what }: { what: string }) {
  const nav = useProtoNav();
  return (
    <main className={wrapper}>
      <p className="text-muted-foreground">{what}</p>
      <Button variant="outline" className="mt-2" onClick={() => nav.go('list')}>
        All characters
      </Button>
    </main>
  );
}

/** Kesh's sheet (or any character): everything editable, breakdowns on tap. */
function SheetPage({ characterId }: { characterId: string }) {
  const nav = useProtoNav();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  if (!character || !sheet) return <Missing what="No such character." />;
  const last = classLevels(character).at(-1)?.state.classKey ?? null;
  return (
    <main className={wrapper}>
      <LivingSheet
        character={character}
        sheet={sheet}
        warnings={warnings}
        mode="sheet"
        actions={
          <Button
            size="sm"
            className="min-h-11 md:min-h-9"
            onClick={() =>
              nav.go('levelup', {
                character: character.id,
                params: { as: last ?? 'unspecified' },
              })
            }
          >
            Level up
            {last && (
              <span className="hidden md:inline"> ({className(last)})</span>
            )}
          </Button>
        }
      />
    </main>
  );
}

/**
 * Level up: appends a Class Level row and highlights what the new level
 * needs. `&as=<classKey>` picks the class (default Rogue for the showcase);
 * `&level=<id>` keeps the appended level addressable.
 */
function LevelUpPage({ characterId }: { characterId: string }) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const levelParam = nav.param('level');
  const [baseline, setBaseline] = useState<ResolvedSheet | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!character || started.current) return;
    if (levelParam && character.entries.some((e) => e.id === levelParam))
      return;
    started.current = true;
    const as = nav.param('as');
    const classKey = as === 'unspecified' ? null : (as ?? 'class.rogue');
    setBaseline(resolveSheet(character));
    const id = store.addClassLevel(character.id, classKey);
    nav.set({ level: id });
  }, [character, levelParam, nav, store]);

  if (!character || !sheet) return <Missing what="No such character." />;
  const focus =
    levelParam && character.entries.some((e) => e.id === levelParam)
      ? levelParam
      : null;
  if (!focus)
    return (
      <main className={wrapper}>
        <p className="text-muted-foreground">Adding level {sheet.level + 1}…</p>
      </main>
    );
  const level = classLevels(character).find((l) => l.id === focus)!;
  const todos = openTodos(
    character,
    'levelup',
    focus,
    store.state.pointBuyBudget,
    warnings,
  );
  return (
    <main className={wrapper}>
      <LivingSheet
        character={character}
        sheet={sheet}
        warnings={warnings}
        mode="levelup"
        focusLevelId={focus}
        baseline={baseline}
        dismissDeltas={() => setBaseline(null)}
        banner={
          <TodoPanel
            className="mb-3"
            title={`Level ${level.state.position}: ${className(level.state.classKey)} ${
              classLevels(character).filter(
                (l) =>
                  l.state.classKey === level.state.classKey &&
                  l.state.position <= level.state.position,
              ).length
            }`}
            todos={todos}
          />
        }
        actions={
          <Button
            size="sm"
            variant={todos.length === 0 ? 'default' : 'outline'}
            className="min-h-11 md:min-h-9"
            onClick={() => nav.go('sheet', { character: character.id })}
          >
            Done levelling
          </Button>
        }
      />
    </main>
  );
}

/** A new Character from nothing: the same sheet, blank, with a checklist. */
function CreatePage({
  campaignId,
  characterId,
}: {
  campaignId: string;
  characterId: string | null;
}) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const started = useRef(false);

  useEffect(() => {
    if (character || started.current) return;
    started.current = true;
    const id = store.createCharacter({ campaignId });
    nav.go('create', { character: id });
  }, [campaignId, character, nav, store]);

  if (!character || !sheet)
    return (
      <main className={wrapper}>
        <p className="text-muted-foreground">Starting a blank sheet…</p>
      </main>
    );
  return (
    <BuildSheet
      mode="create"
      character={character}
      sheet={sheet}
      warnings={warnings}
      title="New character"
    />
  );
}

/** Sergeant Hessa: militia-only levels become real ones on the same sheet. */
function BuildoutPage({ characterId }: { characterId: string }) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const [switched, setSwitched] = useState(false);
  useEffect(() => {
    if (character?.sheetMode === 'militiaOnly') {
      store.setSheetMode(character.id, 'full');
      setSwitched(true);
    }
  }, [character, store]);
  if (!character || !sheet) return <Missing what="No such character." />;
  return (
    <BuildSheet
      mode="buildout"
      character={character}
      sheet={sheet}
      warnings={warnings}
      title="Build out"
      note={
        switched
          ? `${character.name} was Militia-only; the sheet is now shown as a Full Character. The militia's numbers (level ${sheet.militia.level}, the six scores) stay exactly as they were unless the scores change. Choose a class per level, or set them all at once in the Class Levels header.`
          : undefined
      }
    />
  );
}

function BuildSheet({
  mode,
  character,
  sheet,
  warnings,
  title,
  note,
}: {
  mode: SheetMode;
  character: Parameters<typeof LivingSheet>[0]['character'];
  sheet: ResolvedSheet;
  warnings: ReturnType<typeof useWarnings>;
  title: string;
  note?: string;
}) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const todos = openTodos(
    character,
    mode,
    null,
    store.state.pointBuyBudget,
    warnings,
  );
  return (
    <main className={wrapper}>
      <LivingSheet
        character={character}
        sheet={sheet}
        warnings={warnings}
        mode={mode}
        banner={
          <div className="mb-3 space-y-2">
            {note && (
              <p className="border-foreground/20 bg-card text-muted-foreground border p-2 text-sm">
                {note}
              </p>
            )}
            <TodoPanel title={title} todos={todos} />
          </div>
        }
        actions={
          <Button
            size="sm"
            variant={todos.length === 0 ? 'default' : 'outline'}
            className="min-h-11 md:min-h-9"
            onClick={() => nav.go('sheet', { character: character.id })}
          >
            Open as sheet
          </Button>
        }
      />
    </main>
  );
}

export function VariantB({ page, campaignId, characterId }: VariantProps) {
  if (page === 'list') return <ListPage campaignId={campaignId} />;
  if (page === 'create')
    return <CreatePage campaignId={campaignId} characterId={characterId} />;
  if (page === 'buildout')
    return <BuildoutPage characterId={characterId ?? 'hessa'} />;
  if (page === 'levelup')
    return <LevelUpPage characterId={characterId ?? 'kesh'} />;
  return <SheetPage characterId={characterId ?? 'kesh'} />;
}
