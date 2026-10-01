'use client';
// PROTOTYPE (throwaway, #208) — Variant B: the campaign's characters home.
// Militia-only rows edit in place (name, level, six scores); Full rows show
// the same facts read-only and open the sheet. The presentation switch is
// on every row and keeps everything.

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { militiaCharacterFacts } from '../resolve';
import {
  ABILITIES,
  classLevels,
  className,
  levelsRemovedBy,
  useBuilderStore,
  useCampaign,
  useCampaignCharacters,
} from '../store';
import type { Character, RosterPerson } from '../types';
import { NumField, PickField, TextField, chip, th } from './shared';

type PendingLower = { character: Character; level: number; removed: string[] };

function summary(character: Character) {
  const counts = new Map<string, number>();
  for (const l of classLevels(character)) {
    const name = className(l.state.classKey);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([n, c]) => `${n} ${c}`).join(' / ');
}

export function ListPage({ campaignId }: { campaignId: string }) {
  const store = useBuilderStore();
  const nav = useProtoNav();
  const campaign = useCampaign(campaignId);
  const rows = useCampaignCharacters(campaignId);
  const [pending, setPending] = useState<PendingLower | null>(null);
  const militia = !!campaign?.militia;

  const setLevel = (character: Character, level: number | null) => {
    if (level === null || level < 0) return;
    const removed = levelsRemovedBy(character, level);
    if (removed.length > 0) setPending({ character, level, removed });
    else store.setMilitiaLevel(character.id, level);
  };

  const presentation = (c: Character) => (
    <PickField
      ariaLabel={`${c.name} presentation`}
      value={c.sheetMode}
      options={[
        { value: 'militiaOnly', label: 'Militia-only' },
        { value: 'full', label: 'Full' },
      ]}
      onChange={(v) => v && store.setSheetMode(c.id, v)}
      className="w-36"
    />
  );

  const scoreCells = (c: Character) => {
    const facts = militiaCharacterFacts(c);
    return ABILITIES.map((a) =>
      c.sheetMode === 'militiaOnly' ? (
        <NumField
          key={a}
          ariaLabel={`${c.name} ${ABILITY_SHORT[a]}`}
          value={facts.scores[a]}
          width="w-12"
          onChange={(v) => v !== null && store.setMilitiaScore(c.id, a, v)}
        />
      ) : (
        <span
          key={a}
          className="inline-block w-12 text-center font-mono text-base"
        >
          {facts.scores[a]}
        </span>
      ),
    );
  };

  const roleChips = (roster: RosterPerson | null) =>
    militia && (
      <span className="flex flex-wrap gap-1">
        {roster ? (
          roster.roles.length ? (
            roster.roles.map((r) => (
              <span
                key={r}
                className={cn(chip, 'border-primary/60 text-primary')}
              >
                {r}
              </span>
            ))
          ) : (
            <span className={chip}>on roster</span>
          )
        ) : (
          <span className="text-muted-foreground text-xs">not on roster</span>
        )}
      </span>
    );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-sans text-2xl">
            {militia ? 'Characters & officers' : 'Characters'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {militia
              ? 'Everyone the militia can draw on. Militia-only rows edit here; a Full Character is edited on its sheet.'
              : `${campaign?.name ?? 'This campaign'} has no militia, so this is where its characters live. Every one of them has a sheet.`}
          </p>
        </div>
        <Button
          className="min-h-11 md:min-h-9"
          onClick={() => nav.go('create')}
        >
          <Plus /> New character
        </Button>
      </header>

      {/* Tablet / desktop */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-foreground/20 border-b">
              <th className={th}>Name</th>
              <th className={th}>Level</th>
              {ABILITIES.map((a) => (
                <th key={a} className={cn(th, 'text-center')}>
                  {ABILITY_SHORT[a]}
                </th>
              ))}
              <th className={th}>Presentation</th>
              {militia && <th className={th}>Roster</th>}
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ character: c, roster }) => {
              const facts = militiaCharacterFacts(c);
              const militiaOnly = c.sheetMode === 'militiaOnly';
              return (
                <tr
                  key={c.id}
                  className="border-foreground/10 border-b align-middle"
                >
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {militiaOnly ? (
                        <TextField
                          ariaLabel="Name"
                          value={c.name}
                          onChange={(v) => store.setName(c.id, v)}
                          className="w-44 font-sans"
                        />
                      ) : (
                        <a
                          href={nav.href('sheet', { character: c.id })}
                          className="font-sans text-base underline-offset-4 hover:underline"
                        >
                          {c.name}
                        </a>
                      )}
                      <span
                        className={cn(
                          chip,
                          c.kind === 'pc' && 'border-primary text-primary',
                        )}
                      >
                        {c.kind.toUpperCase()}
                      </span>
                    </div>
                    {!militiaOnly && (
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {summary(c)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {militiaOnly ? (
                      <NumField
                        ariaLabel={`${c.name} level`}
                        value={facts.level}
                        width="w-12"
                        onChange={(v) => setLevel(c, v)}
                      />
                    ) : (
                      <span className="font-mono text-base">{facts.level}</span>
                    )}
                  </td>
                  {scoreCells(c).map((cell, i) => (
                    <td key={ABILITIES[i]} className="px-1 py-1.5 text-center">
                      {cell}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">{presentation(c)}</td>
                  {militia && (
                    <td className="px-2 py-1.5">{roleChips(roster)}</td>
                  )}
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      size="sm"
                      variant={militiaOnly ? 'ghost' : 'outline'}
                      onClick={() =>
                        nav.go(militiaOnly ? 'buildout' : 'sheet', {
                          character: c.id,
                        })
                      }
                    >
                      {militiaOnly ? 'Build out' : 'Open sheet'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <ul className="space-y-2 md:hidden">
        {rows.map(({ character: c, roster }) => {
          const facts = militiaCharacterFacts(c);
          const militiaOnly = c.sheetMode === 'militiaOnly';
          return (
            <li key={c.id} className="border-foreground/20 bg-card border p-3">
              <div className="flex items-center gap-2">
                {militiaOnly ? (
                  <TextField
                    ariaLabel="Name"
                    value={c.name}
                    onChange={(v) => store.setName(c.id, v)}
                    className="min-w-0 flex-1 font-sans"
                  />
                ) : (
                  <a
                    href={nav.href('sheet', { character: c.id })}
                    className="flex-1 font-sans text-lg underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </a>
                )}
                <span
                  className={cn(
                    chip,
                    c.kind === 'pc' && 'border-primary text-primary',
                  )}
                >
                  {c.kind.toUpperCase()}
                </span>
                <span className="font-mono text-xs">lvl</span>
                {militiaOnly ? (
                  <NumField
                    ariaLabel={`${c.name} level`}
                    value={facts.level}
                    width="w-12"
                    onChange={(v) => setLevel(c, v)}
                  />
                ) : (
                  <span className="font-mono text-base">{facts.level}</span>
                )}
              </div>
              {!militiaOnly && (
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {summary(c)}
                </div>
              )}
              <div className="mt-2 grid grid-cols-6 gap-1 text-center">
                {ABILITIES.map((a) => (
                  <span
                    key={a}
                    className="text-muted-foreground font-mono text-[11px] uppercase"
                  >
                    {ABILITY_SHORT[a]}
                  </span>
                ))}
                {scoreCells(c)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {presentation(c)}
                {roleChips(roster)}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto min-h-11"
                  onClick={() =>
                    nav.go(militiaOnly ? 'buildout' : 'sheet', {
                      character: c.id,
                    })
                  }
                >
                  {militiaOnly ? 'Build out' : 'Open sheet'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-xs">
        Switching presentation keeps everything on the sheet. A Full Character
        shown as Militia-only keeps its classes, feats and gear; a Militia-only
        one keeps its scores and levels when it becomes Full. Militia-only rows
        edit here; Full rows are read-only here and edit on the sheet.
      </p>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-sans">
              Lower {pending?.character.name} to level {pending?.level}?
            </DialogTitle>
            <DialogDescription>
              This removes real levels and what they granted:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm">
            {pending?.removed.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending)
                  store.setMilitiaLevel(pending.character.id, pending.level);
                setPending(null);
              }}
            >
              Lower to {pending?.level}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
