'use client';
import { formatCharacterKind, type CharacterKind } from '~/lib/character-kind';
import { BaseScoresEditor } from './base-scores-editor';
import { CharacterSheetFrame, type BackLink } from './character-sheet-frame';
import { ClassLevels } from './class-levels';
import { Block, fieldLabel } from './sheet-parts';
import { SheetSummary } from './sheet-summary';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;

// Existing metadata, shown; this slice has no sheet-side identity editor.
// The name is in the summary row, so it is not repeated here.
function CharacterBlock({
  kind,
  notes,
}: {
  kind: CharacterKind;
  notes: string;
}) {
  return (
    <Block title="Character">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4 lg:grid-cols-8">
        <div className="flex flex-col gap-0.5">
          <dt className={fieldLabel}>Kind</dt>
          <dd className="text-sm">{formatCharacterKind(kind)}</dd>
        </div>
        <div className="col-span-2 flex flex-col gap-0.5 md:col-span-3 lg:col-span-7">
          <dt className={fieldLabel}>Notes</dt>
          <dd className="text-sm [overflow-wrap:anywhere]">
            {notes.trim() ? notes : '—'}
          </dd>
        </div>
      </dl>
    </Block>
  );
}

/**
 * The living sheet (approved variant B, #208): the pinned summary row, the
 * campaign row that scrolls with the body, then Character, Class Levels and
 * Ability scores in the left five of the sheet's twelve columns. The other
 * seven stay empty until their blocks exist.
 */
export function CharacterSheetView({
  sheet,
  controller,
  back,
  campaignName,
}: {
  sheet: ReadySheet;
  controller: Controller;
  back: BackLink;
  campaignName: string;
}) {
  return (
    <CharacterSheetFrame back={back}>
      <SheetSummary name={sheet.character.name} calculated={sheet.calculated} />
      <p className="text-muted-foreground mb-3 text-xs">
        <span className={fieldLabel}>Campaign</span>{' '}
        <span className="[overflow-wrap:anywhere]">{campaignName}</span>
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-12">
          <CharacterBlock
            kind={sheet.character.kind}
            notes={sheet.character.description}
          />
        </div>
        <div className="min-w-0 lg:col-span-12">
          <ClassLevels
            rows={sheet.levels}
            warning={sheet.warning}
            levels={controller.levels}
            saveHitPoints={controller.saveHitPoints}
          />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <BaseScoresEditor
            scores={sheet.baseScores}
            abilities={sheet.calculated.abilities}
            save={controller.saveBaseScores}
          />
        </div>
      </div>
    </CharacterSheetFrame>
  );
}
