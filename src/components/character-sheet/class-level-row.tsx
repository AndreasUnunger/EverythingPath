'use client';
import { useId } from 'react';
import { Form } from '~/components/ui/form';
import { cn } from '~/lib/utils';
import { RowCatalogDefinition } from './row-catalog-definition';
import type { ChoiceOption } from './choice-select';
import { ClassLevelActions } from './class-level-actions';
import {
  AbilityIncreaseCell,
  ChoicesFeedback,
  ClassChoiceCell,
  FavoredClassBonusCell,
} from './class-level-choices';
import { ClassLevelHitPoints } from './class-level-hit-points';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useClassLevelChoicesForm } from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;
type LevelRow = ReadySheet['levels'][number];
type LevelMetadata = ReadySheet['calculated']['classLevels'][number];

/** The row's DOM anchor: found again after an append or a deletion. */
export function getLevelAnchorId(entryId: string) {
  return `sheet-level-${entryId}`;
}

/** Level · Class · Hit points · Favored · Ability · actions, from tablet width. */
export const levelColumns =
  'md:grid-cols-[4.5rem_minmax(8rem,10rem)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:gap-x-3';

const cell = 'col-span-2 md:col-span-1 md:row-start-1';
const actionsCell =
  'col-start-2 row-start-1 flex items-center justify-end md:col-start-6';

function findClass(
  classChoices: ReadySheet['classChoices'],
  id: string | null,
) {
  const classChoice = classChoices.find((choice) => choice._id === id);
  if (classChoice?.detail.kind !== 'class') return null;
  return {
    name: classChoice.name,
    hitDie: 'hitDie' in classChoice.detail ? classChoice.detail.hitDie : null,
  };
}

/**
 * One Class Level, mounted once per stable entry and kept through reorders
 * so its drafts, focus and field errors travel with it. Its label is its
 * current position. The class, favored class bonus and ability increase are
 * chosen in place and saved as chosen; hit points are typed and saved with
 * their own button. Each warning sits by the field it is about; the level's
 * rank allocation is spent and warned about in the Skills block, and its
 * class's weapon proficiency choice is made in the Proficiencies block.
 */
export function ClassLevelRow({
  row,
  index,
  count,
  metadata,
  classChoices,
  warnings,
  warningController,
  saveHitPoints,
  saveClassLevel,
  isChangingLevels,
  moveLevel,
  insertLevel,
  onDelete,
}: {
  row: LevelRow;
  index: number;
  count: number;
  metadata: LevelMetadata | undefined;
  classChoices: ReadySheet['classChoices'];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  saveHitPoints: Controller['saveHitPoints'];
  saveClassLevel: Controller['saveClassLevel'];
  isChangingLevels: boolean;
  moveLevel: Controller['levels']['move'];
  insertLevel: Controller['levels']['insert'];
  onDelete: () => void;
}) {
  const level = index + 1;
  const headingId = useId();
  const chosenClass = findClass(classChoices, row.state.classEntryId);
  const classOptions: ChoiceOption[] = classChoices.map((choice) => ({
    value: choice._id,
    label: choice.name,
  }));
  const choices = useClassLevelChoicesForm({
    classEntryId: row.state.classEntryId,
    classChoices,
    favoredClassBonus: row.state.favoredClassBonus,
    abilityIncrease: row.state.abilityIncrease,
    save: async (changes) => {
      await saveClassLevel(row._id, changes);
    },
  });
  const cellProps = { level, editor: choices, warnings, warningController };
  return (
    <li
      id={getLevelAnchorId(row._id)}
      aria-labelledby={headingId}
      className={cn(
        'border-foreground/20 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 border p-2 md:items-start',
        levelColumns,
      )}
    >
      <h3
        id={headingId}
        tabIndex={-1}
        className="col-start-1 row-start-1 self-center font-mono text-base md:py-1.5"
      >
        Level {level}
      </h3>
      <Form {...choices.form}>
        <ClassChoiceCell
          {...cellProps}
          classOptions={classOptions}
          classLabel={
            chosenClass && metadata?.classLevel
              ? `${chosenClass.name} ${metadata.classLevel}`
              : null
          }
          className={cn(cell, 'md:col-start-2')}
        />
        <ClassLevelHitPoints
          level={level}
          hpGained={row.state.hpGained}
          hitDie={chosenClass?.hitDie ?? null}
          warnings={warnings}
          warningController={warningController}
          save={(hpGained) => saveHitPoints(row._id, hpGained)}
          className={cn(cell, 'md:col-start-3')}
        />
        <FavoredClassBonusCell
          {...cellProps}
          className={cn(cell, 'md:col-start-4')}
        />
        <AbilityIncreaseCell
          {...cellProps}
          isDue={metadata?.abilityIncreaseDue ?? false}
          className={cn(cell, 'md:col-start-5')}
        />
        <ClassLevelActions
          level={level}
          className={chosenClass?.name ?? 'Unspecified'}
          headingId={headingId}
          isFirst={index === 0}
          isLast={index === count - 1}
          isBusy={isChangingLevels}
          cellClassName={actionsCell}
          onInsertBefore={() => void insertLevel(level)}
          onMove={(position) => void moveLevel(row._id, position)}
          onDelete={onDelete}
        />
        <ChoicesFeedback
          level={level}
          editor={choices}
          className="col-span-2 md:col-span-6"
        />
      </Form>
      <RowCatalogDefinition
        rowId={row._id}
        target={{ kind: 'entry', entryId: row._id }}
        className="col-span-2 mt-0 min-w-0 md:col-span-6"
      />
    </li>
  );
}
