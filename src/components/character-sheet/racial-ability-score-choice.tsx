'use client';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  abilityKeys,
  abilityLabels,
  type Ability,
} from '~/lib/character-sheet';
import type { RacialChoiceRowView } from './character-sheet-races-view-model';
import { ChoiceSelect, type ChoiceOption } from './choice-select';
import { racialAbilityScoreCopy } from './racial-ability-score-copy';
import { chip, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

const abilityOptions: ChoiceOption[] = abilityKeys.map((ability) => ({
  value: ability,
  label: `+2 ${abilityLabels[ability]}`,
}));

function isAbility(value: string): value is Ability {
  return abilityKeys.some((ability) => ability === value);
}

/**
 * The +2 of a representative ability-score-choice trait. Unchosen while it
 * counts, it wears the sheet's blue outline and contributes nothing; a
 * retained choice stays visible on a dormant row without counting.
 */
export function RacialAbilityScoreChoice({
  row,
  actions,
}: {
  row: RacialChoiceRowView;
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const status = actions.statusFor(row.rowId);
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  const choice = row.choice !== null && isAbility(row.choice) ? row.choice : '';
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <ChoiceSelect
        label={racialAbilityScoreCopy.choiceLabel}
        value={choice}
        options={abilityOptions}
        emptyLabel={racialAbilityScoreCopy.choose}
        isMissing={row.counting && choice === ''}
        isDim={!row.counting}
        disabled={isDisabled}
        className="w-48"
        onValueChange={(value) => {
          if (isDisabled) return;
          void actions.chooseAbilityScore(
            row.target,
            isAbility(value) ? value : null,
            row.rowId,
          );
        }}
      />
      {row.counting ? null : <span className={chip}>Not counting now</span>}
      <SaveFeedback
        status={status}
        savedText={racialAbilityScoreCopy.saved}
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
