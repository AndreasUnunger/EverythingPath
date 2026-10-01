'use client';
// PROTOTYPE (throwaway, #208) — Variant C timeline card shell: a one-line
// collapsed summary that expands in place to edit; warning badges on the
// card they concern; a highlight when the selected sheet number draws on it.

import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import { cn } from '~/lib/utils';
import type { Warning } from '../warnings';
import { WarningBadge, WarningCount } from './bits';

export type CardProps = {
  cardKey: string;
  /** "Level 3" / "Foundation" / "Now". */
  eyebrow: string;
  title: ReactNode;
  /** The collapsed one-liner. */
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  warnings: Warning[];
  onWarningAction?: (warning: Warning) => void;
  /** Sum this card contributes to the selected sheet number (undefined = not involved). */
  highlight?: number;
  /** Header-right controls: move, delete. */
  controls?: ReactNode;
  /** Drag reordering (levels only). */
  drag?: {
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    dragging: boolean;
    over: boolean;
  };
  /** Marks the level-up card. */
  accent?: boolean;
  children: ReactNode;
};

export function TimelineCard({
  cardKey,
  eyebrow,
  title,
  summary,
  open,
  onToggle,
  warnings,
  onWarningAction,
  highlight,
  controls,
  drag,
  accent,
  children,
}: CardProps) {
  const involved = highlight !== undefined;
  return (
    <li
      id={`card-${cardKey}`}
      className={cn(
        'border-foreground/20 bg-card relative border',
        involved && 'border-primary/70',
        accent && 'border-sky-500/60',
        drag?.dragging && 'opacity-40',
        drag?.over && 'border-t-primary border-t-2',
      )}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
    >
      {/* Timeline dot on the rail. */}
      <span
        aria-hidden
        className={cn(
          'bg-background border-foreground/40 absolute top-4 -left-[1.4rem] size-3 border-2',
          involved && 'border-primary bg-primary',
          accent && 'border-sky-400 bg-sky-400',
        )}
      />
      <div className="flex min-h-11 items-stretch">
        {drag && (
          <span
            draggable
            onDragStart={drag.onDragStart}
            className="text-muted-foreground hover:text-foreground hidden w-7 shrink-0 cursor-grab items-center justify-center md:flex"
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(
            'hover:bg-foreground/5 flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left',
            'pl-3 md:pl-2',
            !drag && 'md:pl-3',
          )}
        >
          {open ? (
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          )}
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <span className="text-muted-foreground shrink-0 font-mono text-xs tracking-wide uppercase">
              {eyebrow}
            </span>
            <span className="shrink-0 font-sans text-base">{title}</span>
            {!open && (
              <span className="text-muted-foreground w-full min-w-0 truncate font-mono text-xs md:w-auto md:flex-1">
                {summary}
              </span>
            )}
          </span>
          {involved && (
            <span className="text-primary shrink-0 font-mono text-xs">
              {highlight > 0 ? `+${highlight}` : highlight < 0 ? `−${-highlight}` : 'in'}
            </span>
          )}
          {!open && <WarningCount warnings={warnings} />}
        </button>
        {controls && (
          <div className="flex shrink-0 items-center gap-0.5 pr-1">
            {controls}
          </div>
        )}
      </div>
      {open && (
        <div className="border-foreground/10 space-y-3 border-t px-3 py-3">
          {warnings.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {warnings.map((w) => (
                <WarningBadge key={w.id} warning={w} onAction={onWarningAction} />
              ))}
            </div>
          )}
          {children}
        </div>
      )}
    </li>
  );
}
