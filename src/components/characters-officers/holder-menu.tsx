'use client';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '~/components/ui/button';
import type { OfficerRole, RoleHolder } from '~/lib/officer-board';
import { cn } from '~/lib/utils';
import type { OpenCorrection } from './use-character-corrections';

/** What Correct officers offers a holder: Move to… and Remove. */
export type HolderActions = Pick<
  OpenCorrection,
  'moveTargets' | 'move' | 'remove'
>;

type Open = 'closed' | 'menu' | 'move';

const item =
  'focus-visible:ring-ring/50 hover:bg-foreground/10 flex min-h-11 w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset md:min-h-9';

// A holder's "⋯" options: a disclosure whose list offers Move to… (which
// swaps the list for the roles they do not hold) and Remove. Escape and a
// press outside close it; a choice closes it and hands focus to the card.
export function HolderMenu({
  holder,
  role,
  roleLabel,
  actions,
  onDone,
}: {
  holder: RoleHolder;
  role: OfficerRole;
  roleLabel: string;
  actions: HolderActions;
  /** After Move or Remove, when this holder leaves the card. */
  onDone: () => void;
}) {
  const id = useId();
  const menuId = `${id}-menu`;
  const [open, setOpen] = useState<Open>('closed');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const expanded = open !== 'closed';

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen('closed');
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  // The first item takes focus when the list opens or shows the targets.
  useEffect(() => {
    if (open === 'closed') return;
    root.current?.querySelector<HTMLElement>('[data-menu-item]')?.focus();
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen('closed');
    if (refocus) trigger.current?.focus();
  };
  const choose = (act: () => void) => {
    setOpen('closed');
    act();
    onDone();
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!expanded) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      root.current?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [],
    );
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  const targets =
    open === 'move' ? actions.moveTargets(holder.characterId, role) : [];
  return (
    <div
      ref={root}
      className="relative ml-auto self-center"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Tabbing away closes; a pointer press is handled above.
        if (
          expanded &&
          event.relatedTarget instanceof Node &&
          !root.current?.contains(event.relatedTarget)
        )
          setOpen('closed');
      }}
    >
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="icon"
        className="-my-2 size-11 md:-my-1 md:size-8"
        aria-label={`Options for ${holder.name}`}
        aria-expanded={expanded}
        aria-controls={expanded ? menuId : undefined}
        onClick={() => (expanded ? close(false) : setOpen('menu'))}
      >
        <MoreHorizontal aria-hidden />
      </Button>
      {expanded && (
        <div
          id={menuId}
          className="border-foreground/30 bg-popover text-popover-foreground absolute top-full right-0 z-30 mt-1 w-44 border py-1 shadow-lg"
        >
          {open === 'menu' ? (
            <ul role="list">
              <li>
                <button
                  type="button"
                  data-menu-item
                  className={item}
                  aria-expanded={false}
                  onClick={() => setOpen('move')}
                >
                  Move to…
                  <ChevronRight aria-hidden className="size-4 shrink-0" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  data-menu-item
                  className={item}
                  aria-label={`Remove ${holder.name} as ${roleLabel}`}
                  onClick={() =>
                    choose(() => actions.remove(role, holder.characterId))
                  }
                >
                  Remove
                </button>
              </li>
            </ul>
          ) : (
            <>
              <p className="text-muted-foreground px-3 pt-1 pb-1.5 font-mono text-xs tracking-wide uppercase">
                Move to
              </p>
              {targets.length === 0 ? (
                <p className="text-muted-foreground px-3 pb-1.5 text-sm">
                  None available.
                </p>
              ) : (
                <ul role="list">
                  {targets.map((target) => (
                    <li key={target.role}>
                      <button
                        type="button"
                        data-menu-item
                        className={cn(item, 'font-sans')}
                        aria-label={`Move to ${target.label}`}
                        onClick={() =>
                          choose(() =>
                            actions.move(holder.characterId, role, target.role),
                          )
                        }
                      >
                        {target.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
