'use client';
// PROTOTYPE (throwaway, #208) — Variant B, round 2: a campaign's
// Characters page, everyone's, with or without a militia, in shell C's
// `CampaignCharactersPage` idiom. Add from my characters moves one of mine
// in (a Character is in one campaign at a time); New character starts one
// here.

import { ChevronRight, Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';
import { useProtoNav } from '../nav';
import { StatusBadge } from '../shell/parts';
import { Missing } from '../shell/placeholders';
import {
  ME,
  levelLine,
  useBuilderStore,
  useCampaignCharacters,
  useMyCharacters,
  userName,
} from '../store';
import { NoticeCard, OnRoster, Title } from './page-bits';
import { action, listTd, listTh, main, rowButton } from './shared';

function AddFromMineDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useBuilderStore();
  const groups = useMyCharacters();
  const candidates = groups
    .filter((g) => g.campaign?.id !== campaignId)
    .flatMap((g) =>
      g.characters.map((character) => ({ character, from: g.campaign })),
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-sans">
            Add from my characters
          </DialogTitle>
          <DialogDescription>
            A Character is in one campaign at a time; adding one that is
            elsewhere moves it here.
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-1">
          {candidates.map(({ character, from }) => (
            <li key={character.id}>
              <button
                type="button"
                className={rowButton}
                onClick={() => {
                  store.addToCampaign(character.id, campaignId);
                  onOpenChange(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-sans">{character.name}</span>
                  <span className="text-muted-foreground block text-sm">
                    {levelLine(character)}
                    {from ? ` · Moves from ${from.name}` : ' · No campaign'}
                  </span>
                </span>
                <UserPlus aria-hidden className="size-4 shrink-0" />
              </button>
            </li>
          ))}
          {candidates.length === 0 && (
            <li className="text-muted-foreground py-4 text-sm">
              All your characters are already here.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignCharactersPage() {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const [adding, setAdding] = useState(false);
  const campaign = nav.campaign;
  const rows = useCampaignCharacters(campaign?.id);
  if (!campaign) return <Missing noun="campaign" />;

  // The note for a Character that was just added or moved here.
  const notice = store.state.notice;
  const arrived =
    notice &&
    (notice.kind === 'added' || notice.kind === 'moved') &&
    rows.some((r) => r.character.id === notice.characterId)
      ? notice
      : null;

  return (
    <main className={main}>
      <Title
        eyebrow={campaign.name}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className={action}
              onClick={() => setAdding(true)}
            >
              <UserPlus /> Add from my characters
            </Button>
            <Button
              type="button"
              className={action}
              onClick={() =>
                nav.go('create', {
                  campaign: campaign.id,
                  from: 'campaign-characters',
                })
              }
            >
              <Plus /> New character
            </Button>
          </>
        }
      >
        Characters
      </Title>
      {arrived && (
        <NoticeCard
          notice={arrived}
          onDismiss={store.dismissNotice}
          className="mb-3"
        />
      )}
      <p className="text-muted-foreground mb-3 text-sm">
        Everyone in {campaign.name} can edit these.
        {!campaign.militia &&
          ' This campaign has no militia, so its Characters live here.'}
      </p>
      {/* Phone: one row per Character, like the Characters area. */}
      <ul className="md:hidden">
        {rows.map(({ character, roster }) => (
          <li key={character.id}>
            <button
              type="button"
              className={rowButton}
              onClick={() =>
                nav.go('sheet', {
                  character: character.id,
                  from: 'campaign-characters',
                })
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block font-sans">{character.name}</span>
                <span className="text-muted-foreground block text-sm">
                  {levelLine(character)} · {userName(character.ownerId)}
                  {character.ownerId === ME && ' (me)'}
                </span>
              </span>
              {campaign.militia && <OnRoster roster={roster} />}
              <StatusBadge mode={character.sheetMode} />
              <ChevronRight
                aria-hidden
                className="text-muted-foreground size-4 shrink-0"
              />
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-muted-foreground py-6 text-sm">
            No Characters in {campaign.name} yet.
          </li>
        )}
      </ul>

      {/* Tablet / desktop */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-foreground/20 border-b">
            <th scope="col" className={cn(listTh, 'w-full')}>
              Name
            </th>
            <th scope="col" className={listTh}>
              Owner
            </th>
            <th scope="col" className={listTh}>
              Level
            </th>
            <th scope="col" className={listTh}>
              Status
            </th>
            {campaign.militia && (
              <th scope="col" className={cn(listTh, 'whitespace-nowrap')}>
                Militia
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ character, roster }) => (
            <tr key={character.id} className="border-foreground/15 border-b">
              <td className={listTd}>
                <a
                  href={nav.href('sheet', {
                    character: character.id,
                    from: 'campaign-characters',
                  })}
                  className="hover:text-primary inline-flex min-h-9 items-center font-sans underline-offset-4 hover:underline"
                >
                  {character.name}
                </a>
              </td>
              <td className={cn(listTd, 'whitespace-nowrap')}>
                {userName(character.ownerId)}
                {character.ownerId === ME && (
                  <span className="text-muted-foreground"> (me)</span>
                )}
              </td>
              <td className={cn(listTd, 'whitespace-nowrap')}>
                {levelLine(character)}
              </td>
              <td className={listTd}>
                <StatusBadge mode={character.sheetMode} />
              </td>
              {campaign.militia && (
                <td className={cn(listTd, 'whitespace-nowrap')}>
                  <OnRoster roster={roster} />
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={campaign.militia ? 5 : 4}
                className="text-muted-foreground py-6 text-sm"
              >
                No Characters in {campaign.name} yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <AddFromMineDialog
        campaignId={campaign.id}
        open={adding}
        onOpenChange={setAdding}
      />
    </main>
  );
}
