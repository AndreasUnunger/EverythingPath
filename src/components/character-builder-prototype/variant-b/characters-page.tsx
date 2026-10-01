'use client';
// PROTOTYPE (throwaway, #208) — Variant B, round 2: the Characters area.
// Every Character I own, "No campaign" first, then one group per campaign,
// in shell C's `CharactersPage` idiom. New character starts one in no
// campaign.

import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useProtoNav } from '../nav';
import { StatusBadge } from '../shell/parts';
import { levelLine, useMyCharacters } from '../store';
import type { Campaign, Character } from '../types';
import { OnRoster, Title, isBarelyStarted } from './page-bits';
import { action, main, rowButton } from './shared';

function CharacterRow({
  character,
  campaign,
}: {
  character: Character;
  campaign: Campaign | null;
}) {
  const nav = useProtoNav();
  const roster =
    campaign?.militia?.roster.find((p) => p.characterId === character.id) ??
    null;
  return (
    <button
      type="button"
      className={rowButton}
      onClick={() =>
        nav.go('sheet', { character: character.id, from: 'characters' })
      }
    >
      <span className="min-w-0 flex-1">
        <span className="block font-sans">{character.name}</span>
        <span className="text-muted-foreground block text-sm">
          {levelLine(character)}
          {isBarelyStarted(character) && ' · sheet barely started'}
        </span>
      </span>
      {campaign?.militia && <OnRoster roster={roster} />}
      <StatusBadge mode={character.sheetMode} />
      <ChevronRight
        aria-hidden
        className="text-muted-foreground size-4 shrink-0"
      />
    </button>
  );
}

export function CharactersPage() {
  const nav = useProtoNav();
  const groups = useMyCharacters();
  return (
    <main className={main}>
      <Title
        actions={
          <Button
            type="button"
            className={action}
            onClick={() => nav.go('create', { from: 'characters' })}
          >
            <Plus /> New character
          </Button>
        }
      >
        Characters
      </Title>
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <h2
              id={`group-${group.key}`}
              className="text-muted-foreground mb-1 flex items-baseline gap-2 text-xs tracking-widest uppercase"
            >
              {group.campaign?.name ?? 'No campaign'}
              {group.campaign && (
                <span className="font-mono tracking-normal normal-case">
                  ·{' '}
                  {group.campaign.militia
                    ? `Week ${group.campaign.militia.week}`
                    : 'No militia'}
                </span>
              )}
            </h2>
            {group.characters.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">None.</p>
            ) : (
              group.characters.map((character) => (
                <CharacterRow
                  key={character.id}
                  character={character}
                  campaign={group.campaign}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
