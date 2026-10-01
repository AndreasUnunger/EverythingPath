'use client';
// PROTOTYPE (throwaway, #208) — Variant C left pane: the timeline.
// Foundation → Level 1 … Level n → Now. Levels can be moved (drag or
// arrows) and deleted; later levels renumber. Warnings sit on the card they
// concern; the few that concern the whole sheet sit above the rail.

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { type DragEvent, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { CLASSES } from '../catalog';
import type { ClassLevelEntry } from '../sheet';
import {
  classLevelLabel,
  classLevelShortLabel,
  classLevels,
  useBuilderStore,
} from '../store';
import type { Character, ResolvedSheet } from '../types';
import type { Warning } from '../warnings';
import { WarningBadge, action } from './bits';
import { TimelineCard } from './card';
import { FoundationCardBody, foundationSummary } from './foundation-card';
import { LevelCardBody, levelSummary } from './level-card';
import { FOUNDATION, NOW, type CardKey, cardOfEntry } from './model';
import { NowCardBody, nowSummary } from './now-card';

export type TimelineProps = {
  character: Character;
  sheet: ResolvedSheet;
  warnings: Warning[];
  open: Set<CardKey>;
  onToggle: (key: CardKey) => void;
  /** Card → sum it contributes to the selected sheet number. */
  highlight: Map<CardKey, number>;
  /** The level-up card (accent, option grid). */
  focusLevelId: string | null;
  hasMilitia: boolean;
  onAddLevel: () => void;
};

/** Which card each warning belongs on; null = the whole sheet. */
function warningCard(character: Character, w: Warning): CardKey | null {
  if (w.where.startsWith('classLevel:')) return w.where.slice(11);
  if (w.where === 'abilities' || w.where === 'race') return FOUNDATION;
  if (w.where.startsWith('entry:'))
    return cardOfEntry(character, w.where.slice(6));
  if (w.action?.gainedAtClassLevel) return w.action.gainedAtClassLevel;
  return null;
}

export function Timeline({
  character,
  sheet,
  warnings,
  open,
  onToggle,
  highlight,
  focusLevelId,
  hasMilitia,
  onAddLevel,
}: TimelineProps) {
  const store = useBuilderStore();
  const levels = classLevels(character);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClassLevelEntry | null>(null);

  const byCard = new Map<CardKey | null, Warning[]>();
  for (const w of warnings) {
    const card = warningCard(character, w);
    byCard.set(card, [...(byCard.get(card) ?? []), w]);
  }
  const applyAction = (w: Warning) => {
    if (w.action?.kind === 'addEntry')
      store.addEntry(character.id, w.action.catalogKey, {
        gainedAtClassLevel: w.action.gainedAtClassLevel,
      });
  };
  const unspecified = levels.filter((l) => !l.state.classKey);

  const dragProps = (level: ClassLevelEntry) => ({
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      setDragId(level.id);
    },
    onDragOver: (e: DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      setOverId(level.id);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragId && dragId !== level.id)
        store.moveClassLevel(character.id, dragId, level.state.position);
      setDragId(null);
      setOverId(null);
    },
    dragging: dragId === level.id,
    over: overId === level.id && dragId !== level.id,
  });

  const general = byCard.get(null) ?? [];

  return (
    <div className="space-y-3">
      {general.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {general.map((w) => (
            <WarningBadge key={w.id} warning={w} onAction={applyAction} />
          ))}
        </div>
      )}
      <ol
        className="border-foreground/30 ml-2 space-y-2 border-l-2 pl-5"
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
      >
        <TimelineCard
          cardKey={FOUNDATION}
          eyebrow="Foundation"
          title={character.name || 'Unnamed'}
          summary={foundationSummary(character)}
          open={open.has(FOUNDATION)}
          onToggle={() => onToggle(FOUNDATION)}
          warnings={byCard.get(FOUNDATION) ?? []}
          onWarningAction={applyAction}
          highlight={highlight.get(FOUNDATION)}
        >
          <FoundationCardBody
            character={character}
            sheet={sheet}
            hasMilitia={hasMilitia}
          />
        </TimelineCard>

        <li id="timeline-levels" aria-hidden className="h-0" />
        {unspecified.length > 1 && (
          <li className="relative">
            <span
              aria-hidden
              className="bg-background border-foreground/40 absolute top-3 -left-[1.4rem] size-3 border-2 border-dashed"
            />
            <Select
              value=""
              onValueChange={(v) =>
                unspecified.forEach((l) =>
                  store.updateClassLevel(character.id, l.id, { classKey: v }),
                )
              }
            >
              <SelectTrigger className={cn(action, 'border-dashed')}>
                <SelectValue
                  placeholder={`Set all ${unspecified.length} unspecified levels to…`}
                />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {c.summary}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        )}
        {levels.map((level, i) => (
          <TimelineCard
            key={level.id}
            cardKey={level.id}
            eyebrow={`Level ${level.state.position}`}
            title={classLevelShortLabel(character, level.id)}
            summary={levelSummary(character, level)}
            open={open.has(level.id)}
            onToggle={() => onToggle(level.id)}
            warnings={byCard.get(level.id) ?? []}
            onWarningAction={applyAction}
            highlight={highlight.get(level.id)}
            accent={focusLevelId === level.id}
            drag={dragProps(level)}
            controls={
              <>
                {!open.has(level.id) && !level.state.classKey && (
                  <Select
                    value=""
                    onValueChange={(v) =>
                      store.updateClassLevel(character.id, level.id, {
                        classKey: v,
                      })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-8 border-dashed font-mono text-xs"
                      aria-label={`Class for level ${level.state.position}`}
                    >
                      <SelectValue placeholder="choose class" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSES.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() =>
                    store.moveClassLevel(character.id, level.id, level.state.position - 1)
                  }
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move down"
                  disabled={i === levels.length - 1}
                  onClick={() =>
                    store.moveClassLevel(character.id, level.id, level.state.position + 1)
                  }
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete level"
                  className="hover:text-destructive"
                  onClick={() => setDeleting(level)}
                >
                  <Trash2 />
                </Button>
              </>
            }
          >
            <LevelCardBody
              character={character}
              level={level}
              pickerGrid={focusLevelId === level.id || open.has(level.id)}
            />
          </TimelineCard>
        ))}

        <li className="relative flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="bg-background border-foreground/40 absolute top-3 -left-[1.4rem] size-3 border-2 border-dashed"
          />
          <Button
            type="button"
            variant="outline"
            className={cn(action, 'border-dashed')}
            onClick={onAddLevel}
          >
            <Plus /> Add level {levels.length + 1}
          </Button>
        </li>

        <TimelineCard
          cardKey={NOW}
          eyebrow="Now"
          title="Gear & effects"
          summary={nowSummary(character)}
          open={open.has(NOW)}
          onToggle={() => onToggle(NOW)}
          warnings={byCard.get(NOW) ?? []}
          onWarningAction={applyAction}
          highlight={highlight.get(NOW)}
        >
          <NowCardBody character={character} />
        </TimelineCard>
      </ol>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogTitle className="font-sans">
            Delete {deleting ? classLevelLabel(character, deleting.id) : ''}?
          </DialogTitle>
          <DialogDescription>
            The feats and class features gained at this level go with it, and
            later levels renumber. You can add it back any time.
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={action}
              onClick={() => setDeleting(null)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={action}
              onClick={() => {
                if (deleting) store.removeClassLevel(character.id, deleting.id);
                setDeleting(null);
              }}
            >
              Delete level
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
