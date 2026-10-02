'use client';
import type { ReactNode } from 'react';
import { formatCharacterKind, type CharacterKind } from '~/lib/character-kind';
import { BaseScoresEditor } from './base-scores-editor';
import { CharacterSheetFrame, type BackLink } from './character-sheet-frame';
import { ClassLevels } from './class-levels';
import { CreationSettingsEditor } from './creation-settings-editor';
import { Block, chip, fieldLabel, RemoteNotice } from './sheet-parts';
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

// Where the Character belongs. The sheet read carries no campaign name, so a
// campaign sheet opened without one states the fact instead of a stand-in.
function CampaignMembership({
  isPrivate,
  campaignName,
}: {
  isPrivate: boolean;
  campaignName?: string;
}) {
  if (isPrivate)
    return (
      <>
        <span>No campaign</span>
        <span className="text-muted-foreground text-xs">
          Only you can see this character.
        </span>
      </>
    );
  if (campaignName)
    return <span className="[overflow-wrap:anywhere]">{campaignName}</span>;
  return (
    <span className="text-muted-foreground text-xs">
      Shared with a campaign.
    </span>
  );
}

// The campaign row under the summary (approved variant B's membership
// strip): where the Character belongs on the left, its one lifecycle action
// on the right. It scrolls with the body.
function CampaignRow({
  character,
  campaignName,
  action,
}: {
  character: ReadySheet['character'];
  campaignName?: string;
  action: ReactNode;
}) {
  return (
    <div
      data-sheet-campaign
      className="bg-sidebar/60 border-foreground/15 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border px-3 py-2 text-sm"
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={fieldLabel}>Campaign</span>
        <CampaignMembership
          isPrivate={!character.campaignId}
          campaignName={campaignName}
        />
        {character.isActive ? null : <span className={chip}>Archived</span>}
      </p>
      {action}
    </div>
  );
}

/**
 * The living sheet (approved variant B, #208): the pinned summary row, the
 * campaign row that scrolls with the body, then Character, Class Levels,
 * and Ability scores in the left five of the sheet's twelve columns with
 * the creation settings beside them. Each calculation warning sits by its
 * subject (unresolved HP under the Class Levels it is summed from); only
 * another player's acceptances are announced for the sheet.
 */
export function CharacterSheetView({
  sheet,
  controller,
  back,
  campaignName,
  lifecycle,
}: {
  sheet: ReadySheet;
  controller: Controller;
  back: BackLink;
  campaignName?: string;
  /** The Character's archive or delete control, bound to the route scope. */
  lifecycle: ReactNode;
}) {
  return (
    <CharacterSheetFrame back={back}>
      <SheetSummary name={sheet.character.name} calculated={sheet.calculated} />
      <CampaignRow
        character={sheet.character}
        campaignName={campaignName}
        action={lifecycle}
      />
      <RemoteNotice
        isShown={controller.warnings.hasRemoteChange}
        message="Warnings updated by another player."
        subject="warnings"
        onDismiss={controller.warnings.dismissRemoteChange}
      />
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
            warnings={sheet.warnings}
            warningController={controller.warnings}
            levels={controller.levels}
            saveHitPoints={controller.saveHitPoints}
          />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <BaseScoresEditor
            scores={sheet.baseScores}
            abilities={sheet.calculated.abilities}
            creationSettings={sheet.calculated.creationSettings}
            pointBuy={sheet.calculated.pointBuy}
            warnings={sheet.warnings}
            warningController={controller.warnings}
            save={controller.saveBaseScores}
          />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <CreationSettingsEditor
            settings={sheet.calculated.creationSettings}
            save={controller.saveCreationSettings}
          />
        </div>
      </div>
    </CharacterSheetFrame>
  );
}
