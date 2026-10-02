'use client';
// PROTOTYPE (throwaway, #208) — Variant B, round 2: the Character pages.
// A Full Character gets the living sheet, with its name in the vitals row
// and the membership strip under it; a Militia-only one gets the header
// with Build out and a compact card with what the militia reads. Create,
// level up and build out are URL actions that end on the same sheet.

import { Hammer } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { useBuildoutFlow, useCreateFlow, useLevelUpRedirect } from '../flows';
import { Missing } from '../shell/placeholders';
import { useCharacter, useResolved, useWarnings } from '../store';
import type { Character } from '../types';
import { LivingSheet } from './living-sheet';
import {
  CharacterHeader,
  CharacterTitle,
  LevelField,
  MembershipStrip,
  MilitiaScoresGrid,
  NameField,
  useBuildOut,
  useMilitiaLevel,
} from './page-bits';
import { action, characterMain } from './shared';

// ------------------------------------------------------ Militia-only body

/** What the militia reads, edited in place; Build out opens the whole sheet. */
function MilitiaOnlyBody({ character }: { character: Character }) {
  const level = useMilitiaLevel();
  const buildOut = useBuildOut();
  return (
    <Card className="gap-3 p-4">
      <p className="text-muted-foreground text-sm">
        Militia-only: this shows only what the militia needs. Name, level and
        the six scores are edited here, on Characters & officers too. Build out
        to open the whole sheet.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Name
          </span>
          <NameField character={character} className="w-full" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Level
          </span>
          <LevelField character={character} setLevel={level.setLevel} />
        </label>
      </div>
      <MilitiaScoresGrid character={character} editable className="max-w-md" />
      <div>
        <Button
          type="button"
          className={action}
          onClick={() => buildOut.ask(character)}
        >
          <Hammer /> Build out
        </Button>
      </div>
      {level.dialog}
      {buildOut.dialog}
    </Card>
  );
}

// --------------------------------------------------------------- pages

/** The sheet: everything editable, breakdowns on tap. */
export function SheetPage({ characterId }: { characterId: string }) {
  const character = useCharacter(characterId);
  const sheet = useResolved(characterId);
  const warnings = useWarnings(characterId);
  const buildOut = useBuildOut();
  if (!character || !sheet) return <Missing noun="character" />;

  if (character.sheetMode === 'militiaOnly')
    return (
      <main className={characterMain}>
        <CharacterHeader
          character={character}
          actions={
            <Button
              type="button"
              className={action}
              onClick={() => buildOut.ask(character)}
            >
              <Hammer /> Build out
            </Button>
          }
        />
        <MilitiaOnlyBody character={character} />
        {buildOut.dialog}
      </main>
    );

  return (
    <main className={characterMain}>
      <LivingSheet
        key={character.id}
        character={character}
        sheet={sheet}
        warnings={warnings}
        heading={<CharacterTitle character={character} />}
        below={<MembershipStrip character={character} className="mb-3" />}
      />
    </main>
  );
}

/** The moment between a URL action and the sheet it opens. */
function Working({ text }: { text: string }) {
  return (
    <main className={characterMain}>
      <p className="text-muted-foreground">{text}</p>
    </main>
  );
}

/** `?page=levelup`: appends the level, then the sheet scrolled to it. */
export function LevelUpPage({ characterId }: { characterId: string }) {
  const character = useLevelUpRedirect(characterId);
  if (!character) return <Missing noun="character" />;
  return <Working text="Adding a level…" />;
}

/** `?page=create`: a new Character from nothing, then its sheet. */
export function CreatePage() {
  useCreateFlow();
  return <Working text="Starting a blank sheet…" />;
}

/** `?page=buildout`: builds the Character out, then its sheet. */
export function BuildoutPage({ characterId }: { characterId: string }) {
  const character = useBuildoutFlow(characterId);
  if (!character) return <Missing noun="character" />;
  return <Working text="Building out…" />;
}
