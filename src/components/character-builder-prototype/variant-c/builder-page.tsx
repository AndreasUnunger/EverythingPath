'use client';
// PROTOTYPE (throwaway, #208) — Variant C two-pane builder: timeline on
// the left, live sheet on the right. One component serves sheet, levelup,
// create and buildout; the page only changes the defaults and the header.

import { ArrowDown, ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { resolveSheet } from '../resolve';
import {
  classLevels,
  raceCatalog,
  useBuilderStore,
  useCampaign,
  useCharacter,
  useResolved,
  useWarnings,
} from '../store';
import { ABILITIES, type ProtoPage } from '../types';
import { Chip, WarningCount, action } from './bits';
import { LiveSheet, MiniStatBar } from './live-sheet';
import {
  FOUNDATION,
  NOW,
  contributorCards,
  parseOpen,
  resolveWithout,
  serializeOpen,
  statByKey,
} from './model';
import { Timeline } from './timeline';

export function BuilderPage({
  page,
  campaignId,
  characterId,
}: {
  page: ProtoPage;
  campaignId: string;
  characterId: string | null;
}) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const campaign = useCampaign(campaignId);
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);

  // create: a new Character from nothing, then edit it (StrictMode-safe).
  const created = useRef(false);
  useEffect(() => {
    if (page !== 'create' || character || created.current) return;
    created.current = true;
    const id = store.createCharacter({ campaignId, name: '' });
    nav.go('create', {
      character: id,
      params: { open: `${FOUNDATION},${id}-l1` },
    });
  }, [page, character, campaignId, store, nav]);

  // levelup: append the next level as a new, expanded card.
  const newParam = nav.param('new');
  const added = useRef<string | null>(null);
  useEffect(() => {
    if (page !== 'levelup' || !character) return;
    if (newParam && classLevels(character).some((l) => l.id === newParam))
      return;
    if (added.current === character.id) return;
    added.current = character.id;
    const levelId = store.addClassLevel(character.id, null, { hpGained: null });
    nav.set({ new: levelId, open: levelId });
  }, [page, character, newParam, store, nav]);

  // levelup: bring the new card into view (it is appended at the bottom).
  useEffect(() => {
    if (page !== 'levelup' || !newParam) return;
    // After the router has settled, so its own scroll handling doesn't undo this.
    const t = window.setTimeout(() => {
      document
        .getElementById(`card-${newParam}`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 150);
    return () => window.clearTimeout(t);
  }, [page, newParam]);

  // buildout: Hessa arrives militia-only; this page is "after switching".
  const switched = useRef(false);
  useEffect(() => {
    if (page !== 'buildout' || !character || switched.current) return;
    if (character.sheetMode === 'militiaOnly') {
      switched.current = true;
      store.setSheetMode(character.id, 'full');
    }
  }, [page, character, store]);

  if (!character || !sheet)
    return (
      <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground">
          {page === 'create' ? 'Starting a new character…' : 'No such character.'}
        </p>
        <Button variant="outline" onClick={() => nav.go('list')}>
          <ArrowLeft /> Characters
        </Button>
      </main>
    );

  const levels = classLevels(character);
  const openParam = nav.param('open');
  const open =
    openParam !== null
      ? parseOpen(openParam)
      : page === 'sheet'
        ? new Set([NOW])
        : page === 'buildout'
          ? new Set(levels.filter((l) => !l.state.classKey).slice(0, 1).map((l) => l.id))
          : page === 'levelup' && newParam
            ? new Set([newParam])
            : new Set<string>();
  const toggle = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    nav.set({ open: serializeOpen(next) ?? '' });
  };

  const selected = nav.param('stat');
  const highlight = contributorCards(character, statByKey(sheet, selected));

  // Deltas: the level-up card, else the one open level card.
  const openLevels = levels.filter((l) => open.has(l.id));
  const focusLevelId =
    page === 'levelup' && newParam
      ? newParam
      : openLevels.length === 1
        ? openLevels[0]!.id
        : null;
  const before = focusLevelId ? resolveWithout(character, focusLevelId) : null;

  const pane = nav.param('pane') === 'sheet' ? 'sheet' : 'timeline';
  const race = raceCatalog(character);
  const hasMilitia = !!campaign?.militia;
  const militia = resolveSheet(character, { permanentOnly: true }).militia;

  const addLevel = () => {
    const id = store.addClassLevel(character.id, null, { hpGained: null });
    nav.set({ open: serializeOpen(new Set([...open, id])) ?? '', new: page === 'levelup' ? id : null });
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-3 p-4 pb-24 md:p-6 md:pb-20">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to characters"
          onClick={() => nav.go('list')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="font-sans text-2xl">
          {character.name || (page === 'create' ? 'New character' : 'Unnamed')}
        </h1>
        <span className="text-muted-foreground font-mono text-sm">
          {race?.catalog.name ?? 'no race'} ·{' '}
          {sheet.classes.length
            ? sheet.classes.map((c) => `${c.name} ${c.levels}`).join(' / ')
            : 'no levels'}{' '}
          · level {sheet.level}
        </span>
        <Chip muted>
          {character.sheetMode === 'full' ? 'Full Character' : 'Militia-only'}
        </Chip>
        <WarningCount warnings={warnings} />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {page === 'levelup' && newParam && levels.some((l) => l.id === newParam) ? (
            <Button
              className={action}
              onClick={() =>
                document
                  .getElementById(`card-${newParam}`)
                  ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
              }
            >
              <ArrowDown /> Level {levels.find((l) => l.id === newParam)?.state.position} card
            </Button>
          ) : page === 'levelup' ? (
            <Button className={action} onClick={addLevel}>
              <Plus /> Add level {levels.length + 1}
            </Button>
          ) : null}
          {page !== 'sheet' && (
            <Button
              variant="outline"
              className={action}
              onClick={() => nav.go('sheet', { character: character.id })}
            >
              Done · open sheet
            </Button>
          )}
        </span>
      </header>

      {page === 'buildout' && (
        <p className="border-foreground/20 bg-card border p-2 text-sm">
          <span className="font-sans">Now a Full Character.</span>{' '}
          <span className="text-muted-foreground">
            The militia keeps seeing level {militia.level} and{' '}
            {ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${militia.scores[a]}`).join(' ')}{' '}
            — those only move if the base scores change. Give each Unspecified
            level a class; hp, ranks and features fill in from there.
          </span>
        </p>
      )}
      {page === 'levelup' && newParam && (
        <p className="text-muted-foreground text-sm">
          The new card is at the bottom of the timeline. The sheet on the right
          shows what it changes.
        </p>
      )}

      <div
        role="tablist"
        aria-label="Pane"
        className="border-foreground/20 grid grid-cols-2 border lg:hidden"
      >
        {(['timeline', 'sheet'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pane === p}
            onClick={() => nav.set({ pane: p === 'timeline' ? null : p })}
            className={cn(
              'min-h-11 font-sans',
              pane === p ? 'bg-foreground/10' : 'text-muted-foreground',
            )}
          >
            {p === 'timeline' ? 'Timeline' : 'Sheet'}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-6">
        <div className={cn(pane !== 'timeline' && 'hidden lg:block')}>
          <div className="lg:hidden">
            <MiniStatBar sheet={sheet} before={before} />
          </div>
          <div className="pt-2 lg:pt-0">
            <Timeline
              character={character}
              sheet={sheet}
              warnings={warnings}
              open={open}
              onToggle={toggle}
              highlight={highlight}
              focusLevelId={focusLevelId}
              hasMilitia={hasMilitia}
              onAddLevel={addLevel}
            />
          </div>
        </div>
        <aside
          className={cn(
            'border-foreground/20 bg-card border p-3',
            pane !== 'sheet' && 'hidden lg:block',
            'lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto',
          )}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-sans text-lg">Live sheet</h2>
            <span className="text-muted-foreground font-mono text-xs">
              {before
                ? 'deltas: the open card'
                : 'tap a number for its breakdown'}
            </span>
          </div>
          <LiveSheet
            sheet={sheet}
            before={before}
            selected={selected}
            onSelect={(key) => nav.set({ stat: key })}
          />
        </aside>
      </div>
    </main>
  );
}
