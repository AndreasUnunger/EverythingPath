'use client';
import type { ReactNode } from 'react';
import { formatCharacterKind, type CharacterKind } from '~/lib/character-kind';
import { AbilityChanges } from './ability-changes';
import { BaseScoresEditor } from './base-scores-editor';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { BuildOutControl } from './build-out-control';
import { CharacterCompanions } from './character-companions';
import { CharacterSheetEntries } from './character-sheet-entries';
import { CharacterSheetFrame, type BackLink } from './character-sheet-frame';
import { CharacterSheetGrants } from './character-sheet-grants';
import { CharacterSheetRaces } from './character-sheet-races';
import { ClassLevels } from './class-levels';
import { DefensesBlock } from './defenses-block';
import { FavoredClassesEditor } from './favored-classes-editor';
import { OffenseBlock } from './offense-block';
import { PersonalAdjustments } from './personal-adjustments';
import { CreationSettingsEditor } from './creation-settings-editor';
import { Block, chip, fieldLabel, RemoteNotice } from './sheet-parts';
import { SheetSummary } from './sheet-summary';
import { Skills } from './skills';
import { SpellcastingBlock } from './spellcasting-block';
import type { useCharacterSheet } from './use-character-sheet';
import {
  describeIncompleteHp,
  listUnplacedSelections,
} from './character-sheet-view-helpers';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;

// The race block renders the racial sections itself; the Grants block keeps
// every other kind.
const racialKinds = new Set(['race', 'racialTrait']);
function listNonRacialSections(sections: ReadySheet['grants']) {
  return sections.filter((section) => !racialKinds.has(section.kind));
}

// Existing metadata, shown; this slice has no sheet-side identity editor.
// The name is in the summary row, so it is not repeated here. A minimal
// Character offers its one-way Build out here, once.
function CharacterBlock({
  kind,
  notes,
  buildOut,
  favoredClasses,
}: {
  kind: CharacterKind;
  notes: string;
  buildOut: Controller['buildOut'];
  favoredClasses: ReactNode;
}) {
  return (
    <Block
      title="Character"
      aside={
        buildOut.available ? <BuildOutControl buildOut={buildOut} /> : null
      }
    >
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
      <div className="mt-2">{favoredClasses}</div>
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
 * campaign row that scrolls with the body, then Character, Race, Class Levels,
 * and Ability scores with their damage and drain in the left five of the
 * sheet's twelve columns, with the skills, personal adjustments, sheet entries,
 * granted and dormant entries, Companions and the creation settings beside them,
 * then the Spellcasting section across the full width. Each calculation warning sits by its
 * subject (unresolved HP under the Class Levels it is summed from, a
 * formula under its Modifier); only another player's acceptances are
 * announced for the sheet.
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
      <BreakdownResolverProvider
        previewSituation={controller.previewSituation}
        adjustments={sheet.adjustments}
        spellcastings={sheet.calculated.spellcastings}
      >
        <SheetSummary
          name={sheet.character.name}
          calculated={sheet.calculated}
          incompleteHpReason={describeIncompleteHp(sheet.levels)}
        />
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
              buildOut={controller.buildOut}
              favoredClasses={
                <FavoredClassesEditor
                  classChoices={sheet.classChoices}
                  favoredClassIds={sheet.favoredClassIds}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                  save={controller.saveFavoredClasses}
                />
              }
            />
          </div>
          <div className="min-w-0 lg:col-span-12">
            <CharacterSheetRaces
              races={sheet.races}
              statistics={sheet.raceStatistics}
              raceNames={sheet.raceNames}
              calculated={sheet.calculated}
              actions={controller.races}
              grants={controller.grants}
              warnings={sheet.warnings}
              warningController={controller.warnings}
            />
          </div>
          <div className="min-w-0 lg:col-span-12">
            <ClassLevels
              rows={sheet.levels}
              metadata={sheet.calculated.classLevels}
              classChoices={sheet.classChoices}
              unplacedSelections={listUnplacedSelections(sheet)}
              warnings={sheet.warnings}
              advisory={sheet.warning}
              showMissingChoices={sheet.showMissingChoices}
              warningController={controller.warnings}
              levels={controller.levels}
              saveHitPoints={controller.saveHitPoints}
              saveClassLevel={controller.saveClassLevel}
            />
          </div>
          <div className="min-w-0 space-y-3 lg:col-span-5">
            <BaseScoresEditor
              scores={sheet.baseScores}
              abilities={sheet.calculated.abilities}
              creationSettings={sheet.calculated.creationSettings}
              pointBuy={sheet.calculated.pointBuy}
              warnings={sheet.warnings}
              warningController={controller.warnings}
              breakdowns={sheet.calculated.breakdowns}
              modifierBreakdowns={sheet.calculated.abilityModifierBreakdowns}
              permanent={sheet.permanentCalculated.abilities}
              save={controller.saveBaseScores}
            />
            <DefensesBlock statistics={sheet.calculated.derivedStatistics} />
            <OffenseBlock statistics={sheet.calculated.derivedStatistics} />
            <AbilityChanges
              rows={sheet.abilityChanges}
              actions={controller.abilityChanges}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
            <Skills controller={controller} />
            <PersonalAdjustments
              rows={sheet.adjustments}
              actions={controller.adjustments}
              warnings={sheet.warnings}
              warningController={controller.warnings}
            />
            <CharacterSheetEntries
              rows={sheet.sheetEntries}
              conditionEffects={sheet.calculated.conditionEffects}
              actions={controller.sheetEntries}
              warnings={sheet.warnings}
              warningController={controller.warnings}
            />
            <CharacterSheetGrants
              sections={listNonRacialSections(sheet.grants)}
              actions={controller.grants}
              warnings={sheet.warnings}
              warningController={controller.warnings}
            />
            <CharacterCompanions controller={controller.companions} />
            <CreationSettingsEditor
              settings={sheet.calculated.creationSettings}
              save={controller.saveCreationSettings}
            />
          </div>
          <div className="min-w-0 lg:col-span-12">
            <SpellcastingBlock
              spellcastings={sheet.calculated.spellcastings}
              unresolved={sheet.calculated.spellcastingUnresolved}
            />
          </div>
        </div>
      </BreakdownResolverProvider>
    </CharacterSheetFrame>
  );
}
