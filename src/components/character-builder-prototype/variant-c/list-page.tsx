'use client';
// PROTOTYPE (throwaway, #208) — Variant C characters home. Militia-only
// rows are edited in place; Full rows are read-only and open the timeline.

import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { ABILITY_SHORT } from '../catalog';
import { useProtoNav } from '../nav';
import { resolveSheet } from '../resolve';
import {
  levelsRemovedBy,
  useBuilderStore,
  useCampaign,
  useCampaignCharacters,
} from '../store';
import { ABILITIES, type Character } from '../types';
import { Chip, action } from './bits';

const th =
  'text-muted-foreground px-2 py-2 text-left font-mono text-xs font-normal tracking-wide uppercase';

export function ListPage({ campaignId }: { campaignId: string }) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const campaign = useCampaign(campaignId);
  const rows = useCampaignCharacters(campaignId);
  const hasMilitia = !!campaign?.militia;
  const [lowering, setLowering] = useState<{
    character: Character;
    level: number;
    removes: string[];
  } | null>(null);

  const setLevel = (character: Character, level: number) => {
    const removes = levelsRemovedBy(character, level);
    if (removes.length) setLowering({ character, level, removes });
    else store.setMilitiaLevel(character.id, level);
  };

  const facts = (c: Character) => resolveSheet(c, { permanentOnly: true }).militia;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 md:p-6 md:pb-20">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-sans text-2xl">
          {hasMilitia ? 'Characters & officers' : 'Characters'}
        </h1>
        <span className="text-muted-foreground text-sm">
          {hasMilitia
            ? 'Militia-only characters are quick numbers, edited here. Full Characters have a timeline.'
            : 'No militia in this campaign, so every character is a Full Character with a timeline.'}
        </span>
        <Button className={cn(action, 'ml-auto')} onClick={() => nav.go('create')}>
          <Plus /> New character
        </Button>
      </header>

      {/* Table from 768px. */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="border-foreground/20 border-b">
            <th className={th}>Name</th>
            {hasMilitia && <th className={th}>Role</th>}
            <th className={th}>Level</th>
            {ABILITIES.map((a) => (
              <th key={a} className={cn(th, 'text-center')}>
                {ABILITY_SHORT[a]}
              </th>
            ))}
            {hasMilitia && <th className={th}>Presentation</th>}
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ character: c, roster }) => {
            const militia = c.sheetMode === 'militiaOnly';
            const f = facts(c);
            return (
              <tr key={c.id} className="border-foreground/10 border-b">
                <td className="px-2 py-1">
                  {militia ? (
                    <Input
                      value={c.name}
                      aria-label="Name"
                      onChange={(e) => store.setName(c.id, e.target.value)}
                      className={cn(action, 'font-sans')}
                    />
                  ) : (
                    <button
                      type="button"
                      className="font-sans underline-offset-4 hover:underline"
                      onClick={() => nav.go('sheet', { character: c.id })}
                    >
                      {c.name}
                    </button>
                  )}
                  <span className="text-muted-foreground ml-2 font-mono text-xs uppercase">
                    {c.kind}
                  </span>
                </td>
                {hasMilitia && (
                  <td className="px-2 py-1">
                    {roster?.roles.map((r) => (
                      <Chip key={r} className="mr-1">
                        {r}
                      </Chip>
                    ))}
                    {roster && !roster.roles.length && (
                      <Chip muted>on roster</Chip>
                    )}
                  </td>
                )}
                <td className="px-2 py-1 font-mono">
                  {militia ? (
                    <Input
                      type="number"
                      aria-label="Level"
                      value={f.level}
                      onChange={(e) => setLevel(c, Number(e.target.value))}
                      className={cn(action, 'w-16 text-center font-mono')}
                    />
                  ) : (
                    f.level
                  )}
                </td>
                {ABILITIES.map((a) => (
                  <td key={a} className="px-1 py-1 text-center font-mono">
                    {militia ? (
                      <Input
                        type="number"
                        aria-label={ABILITY_SHORT[a]}
                        value={f.scores[a]}
                        onChange={(e) =>
                          store.setMilitiaScore(c.id, a, Number(e.target.value))
                        }
                        className={cn(action, 'w-14 px-1 text-center font-mono')}
                      />
                    ) : (
                      f.scores[a]
                    )}
                  </td>
                ))}
                {hasMilitia && (
                  <td className="px-2 py-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(action, 'font-mono text-xs')}
                      title="Switching keeps everything on the sheet"
                      onClick={() =>
                        store.setSheetMode(c.id, militia ? 'full' : 'militiaOnly')
                      }
                    >
                      {militia ? 'Militia-only → Full' : 'Full → Militia-only'}
                    </Button>
                  </td>
                )}
                <td className="px-2 py-1 text-right">
                  {militia ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={action}
                      onClick={() => nav.go('buildout', { character: c.id })}
                    >
                      Build out <ArrowRight />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={action}
                      onClick={() => nav.go('sheet', { character: c.id })}
                    >
                      Sheet <ArrowRight />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Cards below 768px. */}
      <ul className="space-y-2 md:hidden">
        {rows.map(({ character: c, roster }) => {
          const militia = c.sheetMode === 'militiaOnly';
          const f = facts(c);
          return (
            <li key={c.id} className="border-foreground/20 bg-card space-y-2 border p-3">
              <div className="flex items-center gap-2">
                {militia ? (
                  <Input
                    value={c.name}
                    aria-label="Name"
                    onChange={(e) => store.setName(c.id, e.target.value)}
                    className={cn(action, 'font-sans')}
                  />
                ) : (
                  <button
                    type="button"
                    className="font-sans text-lg"
                    onClick={() => nav.go('sheet', { character: c.id })}
                  >
                    {c.name}
                  </button>
                )}
                {roster?.roles.map((r) => (
                  <Chip key={r}>{r}</Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                <span className="text-muted-foreground">Level</span>
                {militia ? (
                  <Input
                    type="number"
                    aria-label="Level"
                    value={f.level}
                    onChange={(e) => setLevel(c, Number(e.target.value))}
                    className={cn(action, 'w-16 text-center font-mono')}
                  />
                ) : (
                  <span>{f.level}</span>
                )}
                {ABILITIES.map((a) => (
                  <span key={a} className="flex items-center gap-1">
                    <span className="text-muted-foreground">{ABILITY_SHORT[a]}</span>
                    {militia ? (
                      <Input
                        type="number"
                        aria-label={ABILITY_SHORT[a]}
                        value={f.scores[a]}
                        onChange={(e) =>
                          store.setMilitiaScore(c.id, a, Number(e.target.value))
                        }
                        className={cn(action, 'w-12 px-1 text-center font-mono')}
                      />
                    ) : (
                      <span>{f.scores[a]}</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {hasMilitia && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(action, 'font-mono text-xs')}
                    onClick={() =>
                      store.setSheetMode(c.id, militia ? 'full' : 'militiaOnly')
                    }
                  >
                    {militia ? 'Militia-only → Full' : 'Full → Militia-only'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(action, 'ml-auto')}
                  onClick={() =>
                    nav.go(militia ? 'buildout' : 'sheet', { character: c.id })
                  }
                >
                  {militia ? 'Build out' : 'Sheet'} <ArrowRight />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMilitia && (
        <p className="text-muted-foreground text-sm">
          Switching a character between Militia-only and Full changes only how
          it is shown: the sheet keeps everything, including real levels.
        </p>
      )}

      <Dialog open={!!lowering} onOpenChange={(o) => !o && setLowering(null)}>
        <DialogContent>
          <DialogTitle className="font-sans">
            Lower {lowering?.character.name} to level {lowering?.level}?
          </DialogTitle>
          <DialogDescription>
            This removes real levels, with everything they granted:
          </DialogDescription>
          <ul className="font-mono text-sm">
            {lowering?.removes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" className={action} onClick={() => setLowering(null)}>
              Keep them
            </Button>
            <Button
              variant="destructive"
              className={action}
              onClick={() => {
                if (lowering)
                  store.setMilitiaLevel(lowering.character.id, lowering.level);
                setLowering(null);
              }}
            >
              Remove levels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
