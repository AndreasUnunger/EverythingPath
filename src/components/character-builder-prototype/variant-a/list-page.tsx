'use client';
// PROTOTYPE (throwaway, #208) — Variant A: the campaign's characters home.
// Militia-only rows edit in place; Full rows are read-only with a link to
// the sheet. Switching presentation is one select and keeps everything.

import { UserPlus } from 'lucide-react';
import { useState } from 'react';
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
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import {
  classLevels,
  levelsRemovedBy,
  useBuilderStore,
  useCampaign,
  useCampaignCharacters,
  useResolved,
} from '../store';
import { ABILITIES, type Character, type RosterPerson } from '../types';
import { ConfirmDialog, chip, tableHead } from './shared';

export function ListPage({ campaignId }: { campaignId: string }) {
  const nav = useProtoNav();
  const campaign = useCampaign(campaignId);
  const rows = useCampaignCharacters(campaignId);
  const militia = !!campaign?.militia;
  const sorted = [...rows].sort((a, b) => {
    const ra = a.roster ? 0 : 1;
    const rb = b.roster ? 0 : 1;
    return ra - rb || a.character.name.localeCompare(b.character.name);
  });
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-sans text-2xl">
            {militia ? 'Characters & officers' : 'Characters'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {militia
              ? 'Everyone in the campaign. Militia-only characters are edited right here; Full characters have a sheet.'
              : 'Everyone in the campaign. Each one has a sheet.'}
          </p>
        </div>
        <Button className="min-h-11 md:min-h-9" onClick={() => nav.go('create', { campaign: campaignId })}>
          <UserPlus aria-hidden /> New character
        </Button>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-foreground/20 border-b">
              <th className={tableHead}>Name</th>
              {militia && <th className={tableHead}>Role</th>}
              <th className={cn(tableHead, 'text-right')}>Level</th>
              {ABILITIES.map((a) => (
                <th key={a} className={cn(tableHead, 'text-center')}>
                  {ABILITY_SHORT[a]}
                </th>
              ))}
              {militia && (
                <th className={tableHead} title="Switching keeps everything on the sheet.">
                  Presentation
                </th>
              )}
              <th className={tableHead} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ character, roster }) => (
              <Row key={character.id} character={character} roster={roster} militia={militia} />
            ))}
          </tbody>
        </table>
        {militia && (
          <p className="text-muted-foreground mt-2 text-xs">
            Militia-only shows just name, level and scores. Switching a
            character between Militia-only and Full keeps everything on the
            sheet; nothing is lost either way.
          </p>
        )}
      </div>
      <div className="space-y-2 md:hidden">
        {sorted.map(({ character, roster }) => (
          <Row key={character.id} character={character} roster={roster} militia={militia} card />
        ))}
      </div>
    </main>
  );
}

function Row({
  character,
  roster,
  militia,
  card,
}: {
  character: Character;
  roster: RosterPerson | null;
  militia: boolean;
  card?: boolean;
}) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const sheet = useResolved(character.id)!;
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const editable = militia && character.sheetMode === 'militiaOnly';
  const level = classLevels(character).length;
  const changeLevel = (n: number) => {
    if (Number.isNaN(n) || n < 0) return;
    if (n < level && levelsRemovedBy(character, n).length > 0) setPendingLevel(n);
    else store.setMilitiaLevel(character.id, n);
  };
  const openSheet = () => nav.go('sheet', { character: character.id });
  const buildOut = () => nav.go('buildout', { character: character.id });

  const presentation = militia && (
    <Select
      value={character.sheetMode}
      onValueChange={(v) => store.setSheetMode(character.id, v as Character['sheetMode'])}
    >
      <SelectTrigger className="min-h-11 w-36 md:min-h-9" aria-label={`${character.name} presentation`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="militiaOnly" className="min-h-11">
          Militia-only
        </SelectItem>
        <SelectItem value="full" className="min-h-11">
          Full
        </SelectItem>
      </SelectContent>
    </Select>
  );
  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-1 md:flex-col md:items-end">
      {editable ? (
        <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={buildOut}>
          Build out
        </Button>
      ) : (
        <>
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={openSheet}>
            Sheet
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 md:min-h-9"
            onClick={() => nav.go('levelup', { character: character.id })}
          >
            Level up
          </Button>
        </>
      )}
    </div>
  );
  const confirm = (
    <ConfirmDialog
      open={pendingLevel !== null}
      title={`Lower ${character.name} to level ${pendingLevel ?? 0}?`}
      description="These levels and what they granted will be removed:"
      items={pendingLevel === null ? [] : levelsRemovedBy(character, pendingLevel)}
      confirmLabel="Remove levels"
      onCancel={() => setPendingLevel(null)}
      onConfirm={() => {
        if (pendingLevel !== null) store.setMilitiaLevel(character.id, pendingLevel);
        setPendingLevel(null);
      }}
    />
  );
  const nameCell = editable ? (
    <Input
      aria-label="Name"
      value={character.name}
      onChange={(e) => store.setName(character.id, e.target.value)}
      className="min-h-11 w-full font-sans md:min-h-9 md:w-40"
    />
  ) : (
    <button type="button" onClick={openSheet} className="font-sans text-left hover:underline">
      {character.name}
    </button>
  );
  const meta = (
    <span className="text-muted-foreground flex flex-wrap gap-1 text-xs">
      <span className={chip}>{character.kind === 'pc' ? 'PC' : 'NPC'}</span>
      {!character.isActive && <span className={chip}>archived</span>}
      {!editable && (
        <span className="self-center">
          {sheet.classes.map((c) => `${c.name} ${c.levels}`).join(' / ') || 'no classes'}
        </span>
      )}
    </span>
  );
  const scoreInput = (a: (typeof ABILITIES)[number]) =>
    editable ? (
      <Input
        aria-label={`${character.name} ${ABILITY_SHORT[a]}`}
        type="number"
        inputMode="numeric"
        value={sheet.militia.scores[a]}
        onChange={(e) => store.setMilitiaScore(character.id, a, Number(e.target.value))}
        className="min-h-11 w-12 px-1 text-center font-mono md:min-h-9"
      />
    ) : (
      <span className="font-mono">{sheet.militia.scores[a]}</span>
    );
  const levelInput = editable ? (
    <Input
      aria-label={`${character.name} level`}
      type="number"
      inputMode="numeric"
      value={level}
      onChange={(e) => changeLevel(Number(e.target.value))}
      className="min-h-11 w-12 px-1 text-center font-mono md:min-h-9"
    />
  ) : (
    <span className="font-mono">{level}</span>
  );

  if (card)
    return (
      <div className="border-foreground/20 bg-card space-y-2 border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {nameCell}
            {meta}
            {roster && roster.roles.length > 0 && (
              <div className="text-muted-foreground text-xs">{roster.roles.join(', ')}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-muted-foreground font-mono text-xs uppercase">Level</div>
            {levelInput}
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1 text-center">
          {ABILITIES.map((a) => (
            <div key={a}>
              <div className="text-muted-foreground font-mono text-xs uppercase">
                {ABILITY_SHORT[a]}
              </div>
              {editable ? (
                <Input
                  aria-label={`${character.name} ${ABILITY_SHORT[a]}`}
                  type="number"
                  inputMode="numeric"
                  value={sheet.militia.scores[a]}
                  onChange={(e) => store.setMilitiaScore(character.id, a, Number(e.target.value))}
                  className="min-h-11 w-full px-1 text-center font-mono"
                />
              ) : (
                <span className="font-mono">{sheet.militia.scores[a]}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {presentation}
          {actions}
        </div>
        {confirm}
      </div>
    );

  return (
    <tr className="border-foreground/10 hover:bg-foreground/5 border-b">
      <td className="px-2 py-1.5">
        {nameCell}
        {meta}
      </td>
      {militia && (
        <td className="text-muted-foreground px-2 py-1.5 text-sm">
          {roster ? roster.roles.join(', ') || 'on roster' : '—'}
        </td>
      )}
      <td className="px-2 py-1.5 text-right">{levelInput}</td>
      {ABILITIES.map((a) => (
        <td key={a} className="px-1 py-1.5 text-center">
          {scoreInput(a)}
        </td>
      ))}
      {militia && <td className="px-2 py-1.5">{presentation}</td>}
      <td className="px-2 py-1.5">
        {actions}
        {confirm}
      </td>
    </tr>
  );
}
