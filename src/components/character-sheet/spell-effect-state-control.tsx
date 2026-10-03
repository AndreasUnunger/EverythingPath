'use client';
import type { Id } from '@convex/_generated/dataModel';
import { Gauge } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { SpellEffectStateEditor } from './spell-effect-state-editor';
import type { SheetEntryStateInput } from './use-character-sheet-entries';

/**
 * A shared Spell Effect's definition facts, and the one thing its sheet may
 * change without customizing it: the recorded caster level.
 */
export function SpellEffectStateControl({
  entryId,
  name,
  casterLevel,
  defaultCasterLevel,
  lastsOverOneDay,
  editState,
}: {
  entryId: Id<'characterSheetEntry'>;
  name: string;
  casterLevel: number;
  defaultCasterLevel: number;
  lastsOverOneDay: boolean;
  editState: (
    entryId: Id<'characterSheetEntry'>,
    input: SheetEntryStateInput,
  ) => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-muted-foreground font-mono text-xs">
          Default CL {defaultCasterLevel} ·{' '}
          {lastsOverOneDay
            ? 'Lasts more than one day'
            : 'Lasts one day or less'}
        </p>
        <Button
          ref={toggle}
          type="button"
          variant={isOpen ? 'secondary' : 'ghost'}
          size="sm"
          className="text-muted-foreground hover:text-foreground h-11 gap-1 px-1.5 font-mono text-xs md:h-7"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Gauge aria-hidden className="size-3.5" />
          Edit caster level <span className="sr-only">{name}</span>
        </Button>
      </div>
      <div id={panelId}>
        {isOpen ? (
          <SpellEffectStateEditor
            key={entryId}
            entryId={entryId}
            name={name}
            casterLevel={casterLevel}
            defaultCasterLevel={defaultCasterLevel}
            editState={editState}
            onClose={() => {
              setIsOpen(false);
              toggle.current?.focus();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
