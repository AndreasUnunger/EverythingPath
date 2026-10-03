import { AbilityChanges } from './ability-changes';
import { BaseScoresEditor } from './base-scores-editor';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { CharacterSheetEntries } from './character-sheet-entries';
import { CharacterSheetSkeleton } from './character-sheet-frame';
import { ClassLevels } from './class-levels';
import { CreationSettingsEditor } from './creation-settings-editor';
import { DefensesBlock } from './defenses-block';
import { FavoredClassesEditor } from './favored-classes-editor';
import { OffenseBlock } from './offense-block';
import { PersonalAdjustments } from './personal-adjustments';
import { Block, RemoteNotice } from './sheet-parts';
import { SheetSummary } from './sheet-summary';
import { Skills } from './skills';
import { characterId } from './character-sheet-test-fixture';
import { useCharacterSheet } from './use-character-sheet';
import {
  describeIncompleteHp,
  listUnplacedSelections,
} from './character-sheet-view-helpers';

type SheetBlock =
  | 'scores'
  | 'adjustments'
  | 'abilityChanges'
  | 'levels'
  | 'settings'
  | 'favoredClasses'
  | 'defenses'
  | 'offense'
  | 'summary'
  | 'entries'
  | 'skills';

// Exercise the real controller and selected public blocks against the same
// read snapshots as page integration tests, without rendering unrelated UI.
export function CharacterSheetBlocks({ blocks }: { blocks: SheetBlock[] }) {
  const controller = useCharacterSheet({ organizationId: 'org', characterId });
  const sheet = controller.sheet;
  if (!sheet)
    return (
      <CharacterSheetSkeleton
        back={{ href: '/campaigns/campaign-1/characters', label: 'Characters' }}
      />
    );
  const incompleteHpReason = describeIncompleteHp(sheet.levels);
  return (
    <BreakdownResolverProvider
      previewSituation={controller.previewSituation}
      adjustments={sheet.adjustments}
    >
      <RemoteNotice
        isShown={controller.warnings.hasRemoteChange}
        message="Warnings updated by another player."
        subject="warnings"
        onDismiss={controller.warnings.dismissRemoteChange}
      />
      {blocks.map((block) => {
        switch (block) {
          case 'skills':
            return <Skills key={block} controller={controller} />;
          case 'scores':
            return (
              <BaseScoresEditor
                key={block}
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
            );
          case 'adjustments':
            return (
              <PersonalAdjustments
                key={block}
                rows={sheet.adjustments}
                actions={controller.adjustments}
                warnings={sheet.warnings}
                warningController={controller.warnings}
              />
            );
          case 'abilityChanges':
            return (
              <AbilityChanges
                key={block}
                rows={sheet.abilityChanges}
                actions={controller.abilityChanges}
              />
            );
          case 'levels':
            return (
              <ClassLevels
                key={block}
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
            );
          case 'settings':
            return (
              <CreationSettingsEditor
                key={block}
                settings={sheet.calculated.creationSettings}
                save={controller.saveCreationSettings}
              />
            );
          case 'favoredClasses':
            return (
              <Block key={block} title="Character">
                <FavoredClassesEditor
                  classChoices={sheet.classChoices}
                  favoredClassIds={sheet.favoredClassIds}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                  save={controller.saveFavoredClasses}
                />
              </Block>
            );
          case 'defenses':
            return (
              <DefensesBlock
                key={block}
                statistics={sheet.calculated.derivedStatistics}
              />
            );
          case 'offense':
            return (
              <OffenseBlock
                key={block}
                statistics={sheet.calculated.derivedStatistics}
              />
            );
          case 'summary':
            return (
              <SheetSummary
                key={block}
                name={sheet.character.name}
                calculated={sheet.calculated}
                incompleteHpReason={incompleteHpReason}
              />
            );
          case 'entries':
            return (
              <CharacterSheetEntries
                key={block}
                rows={sheet.sheetEntries}
                conditionEffects={sheet.calculated.conditionEffects}
                actions={controller.sheetEntries}
                warnings={sheet.warnings}
                warningController={controller.warnings}
              />
            );
        }
      })}
    </BreakdownResolverProvider>
  );
}
