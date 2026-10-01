'use client';
// PROTOTYPE (throwaway, #208) — Variant B, round 2: Characters & officers,
// the militia page, in shell C's `OfficersPage` idiom. The presentation is
// a status per row. Militia-only rows edit name, level and the six scores
// in place and have Build out (one way); Full rows show the same facts
// read-only and open the sheet. New character makes a Militia-only
// Character on the roster, edited right here.

import { ChevronRight, Hammer, Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { militiaCharacterFacts } from '../resolve';
import { StatusBadge } from '../shell/parts';
import { Missing } from '../shell/placeholders';
import {
  ABILITIES,
  classLevels,
  levelLine,
  useBuilderStore,
  useCampaignCharacters,
  userName,
} from '../store';
import type { Character, RosterPerson } from '../types';
import {
  LevelField,
  MilitiaScoresGrid,
  NameField,
  OnRoster,
  ScoreField,
  Title,
  useBuildOut,
  useMilitiaLevel,
} from './page-bits';
import { action, listTd, listTh, main } from './shared';

export function OfficersPage() {
  const store = useBuilderStore();
  const nav = useProtoNav();
  const campaign = nav.campaign;
  const rows = useCampaignCharacters(campaign?.id);
  const added = nav.param('added');
  const level = useMilitiaLevel();
  const buildOut = useBuildOut('officers');
  if (!campaign?.militia) return <Missing noun="militia" />;

  const create = () => {
    const id = store.createCharacter({
      campaignId: campaign.id,
      sheetMode: 'militiaOnly',
      onRoster: true,
    });
    nav.set({ added: id });
  };
  const openSheet = (c: Character) =>
    nav.go('sheet', { character: c.id, from: 'officers' });

  const nameCell = (c: Character, militiaOnly: boolean) =>
    militiaOnly ? (
      <NameField character={c} focus={c.id === added} className="w-40" />
    ) : (
      <a
        href={nav.href('sheet', { character: c.id, from: 'officers' })}
        className="hover:text-primary inline-flex min-h-8 items-center font-sans underline-offset-4 hover:underline"
      >
        {c.name}
      </a>
    );

  const rosterCell = (c: Character, roster: RosterPerson | null) => (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <OnRoster roster={roster} />
      {!roster && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => store.setOnRoster(c.id, true)}
        >
          Put on roster
        </Button>
      )}
    </span>
  );

  const actionsCell = (c: Character, militiaOnly: boolean) =>
    militiaOnly ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={action}
        aria-label={`Build out ${c.name}`}
        onClick={() => buildOut.ask(c)}
      >
        <Hammer /> Build out
      </Button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={action}
        onClick={() => openSheet(c)}
      >
        Sheet <ChevronRight />
      </Button>
    );

  return (
    <main className={main}>
      <Title
        eyebrow={campaign.name}
        actions={
          <Button type="button" className={action} onClick={create}>
            <Plus /> New character
          </Button>
        }
      >
        Characters & officers
      </Title>
      <p className="text-muted-foreground mb-3 text-sm">
        Everyone the militia can draw on. Militia-only Characters are edited
        here; a Full Character's level and scores come from its sheet.
      </p>

      {/* Tablet / desktop */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-foreground/20 border-b">
            <th scope="col" className={cn(listTh, 'w-full')}>
              Name
            </th>
            <th scope="col" className={listTh}>
              Status
            </th>
            <th scope="col" className={cn(listTh, 'text-center')}>
              Level
            </th>
            {ABILITIES.map((a) => (
              <th
                key={a}
                scope="col"
                className={cn(listTh, 'px-1 text-center')}
              >
                {ABILITY_SHORT[a]}
              </th>
            ))}
            <th scope="col" className={cn(listTh, 'whitespace-nowrap')}>
              Roster
            </th>
            <th scope="col" className={listTh}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ character: c, roster }) => {
            const facts = militiaCharacterFacts(c);
            const militiaOnly = c.sheetMode === 'militiaOnly';
            return (
              <tr
                key={c.id}
                className={cn(
                  'border-foreground/15 border-b',
                  c.id === added && 'bg-primary/10',
                )}
              >
                <td className={cn(listTd, 'py-1.5')}>
                  {nameCell(c, militiaOnly)}
                  <span className="text-muted-foreground block text-xs">
                    {userName(c.ownerId)} · {c.kind.toUpperCase()}
                    {!militiaOnly && ` · ${levelLine(c)}`}
                  </span>
                </td>
                <td className={cn(listTd, 'py-1.5')}>
                  <StatusBadge mode={c.sheetMode} />
                </td>
                <td className={cn(listTd, 'py-1.5 text-center')}>
                  {militiaOnly ? (
                    <LevelField character={c} setLevel={level.setLevel} />
                  ) : (
                    <span className="font-mono text-base">
                      {classLevels(c).length}
                    </span>
                  )}
                </td>
                {ABILITIES.map((a) => (
                  <td key={a} className={cn(listTd, 'px-1 py-1.5 text-center')}>
                    {militiaOnly ? (
                      <ScoreField
                        character={c}
                        ability={a}
                        value={facts.scores[a]}
                      />
                    ) : (
                      <span className="inline-block w-12 font-mono text-base">
                        {facts.scores[a]}
                      </span>
                    )}
                  </td>
                ))}
                <td className={cn(listTd, 'py-1.5')}>
                  {rosterCell(c, roster)}
                </td>
                <td
                  className={cn(listTd, 'py-1.5 text-right whitespace-nowrap')}
                >
                  {actionsCell(c, militiaOnly)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Phone */}
      <ul className="space-y-2 md:hidden">
        {rows.map(({ character: c, roster }) => {
          const militiaOnly = c.sheetMode === 'militiaOnly';
          return (
            <li
              key={c.id}
              className={cn(
                'border-foreground/20 bg-card border p-3',
                c.id === added && 'bg-primary/10',
              )}
            >
              <div className="flex items-center gap-2">
                {militiaOnly ? (
                  <NameField
                    character={c}
                    focus={c.id === added}
                    className="min-w-0 flex-1"
                  />
                ) : (
                  <a
                    href={nav.href('sheet', {
                      character: c.id,
                      from: 'officers',
                    })}
                    className="min-w-0 flex-1 truncate font-sans text-lg underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </a>
                )}
                <StatusBadge mode={c.sheetMode} />
              </div>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                <span>
                  {userName(c.ownerId)} · {c.kind.toUpperCase()}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5">
                  Level
                  {militiaOnly ? (
                    <LevelField character={c} setLevel={level.setLevel} />
                  ) : (
                    <span className="text-foreground font-mono text-base">
                      {classLevels(c).length}
                    </span>
                  )}
                </span>
              </div>
              {!militiaOnly && (
                <div className="text-muted-foreground text-xs">
                  {levelLine(c)}
                </div>
              )}
              <MilitiaScoresGrid
                character={c}
                editable={militiaOnly}
                className="mt-2"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {rosterCell(c, roster)}
                <span className="ml-auto">{actionsCell(c, militiaOnly)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {level.dialog}
      {buildOut.dialog}
    </main>
  );
}
