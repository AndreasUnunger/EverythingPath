'use client';

import type { ActivityRollSectionConfig } from '~/components/week-board/activity-rolls-panel';
import {
  getCheckBonusHelperText,
  getCommandantTrainingHelperText,
  getRecruitmentCheckType,
  type OfficerEffects,
} from '~/components/week-board/officer-effects';
import type { ActivityRollTotals } from '~/components/week-board/roll-totals';
import type { ActionId } from '~/components/week-board/types';
import { mergeSyncedValue } from '~/components/week-board/sync-merge';

export type ActivityRollKey = keyof ActivityRollTotals;
export type ActivityRollDraft = Record<ActivityRollKey, string>;

export const ACTIVITY_ROLL_KEYS: ActivityRollKey[] = [
  'activateBlackMarketCheckTotal',
  'activateBlackMarketNotorietyIncreaseTotal',
  'dismissTeamCheckTotal',
  'dismissTeamNotorietyIncreaseTotal',
  'drillMilitiaCheckTotal',
  'drillMilitiaTrainingGainTotal',
  'earnGoldCheckTotal',
  'earnGoldTotal',
  'earnGoldNotorietyIncreaseTotal',
  'gatherInformationCheckTotal',
  'gatherInformationNotorietyIncreaseTotal',
  'knowledgeCheckTotal',
  'recruitTeamCheckTotal',
  'recruitTeamNotorietyIncreaseTotal',
  'reduceDangerCheckTotal',
  'reduceDangerNotorietyIncreaseTotal',
  'rescueCharacterCheckTotal',
  'rescueCharacterTargetLevelTotal',
  'rescueCharacterNotorietyIncreaseTotal',
  'restoreCharacterCostTotal',
  'secureCacheCheckTotal',
  'specialActionCostTotal',
  'specialOrderItemCostTotal',
  'spreadPropagandaCheckTotal',
  'specialOrderDeliveryDaysTotal',
];

export type SummaryRow = {
  label: string;
  value: string;
};

export function toActivityRollDraft(totals: ActivityRollTotals): ActivityRollDraft {
  return Object.fromEntries(
    ACTIVITY_ROLL_KEYS.map((key) => [key, totals[key]?.toString() ?? '']),
  ) as ActivityRollDraft;
}

export function mergeActivityRollDraftWithServer({
  currentDraft,
  previousServerDraft,
  nextServerDraft,
}: {
  currentDraft: ActivityRollDraft;
  previousServerDraft: ActivityRollDraft;
  nextServerDraft: ActivityRollDraft;
}) {
  return Object.fromEntries(
    ACTIVITY_ROLL_KEYS.map((key) => {
      return [
        key,
        mergeSyncedValue({
          currentValue: currentDraft[key],
          previousServerValue: previousServerDraft[key],
          nextServerValue: nextServerDraft[key],
        }),
      ];
    }),
  ) as ActivityRollDraft;
}

export function isParsableActivityRollTotal(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return Number.isFinite(Number(trimmed));
}

export function buildActivityRollSummaryRows({
  stagedActionIds,
  totals,
  officerEffects,
  strategistBonusActionId,
  recruitTeamId,
}: {
  stagedActionIds: string[];
  totals: ActivityRollTotals;
  officerEffects: OfficerEffects;
  strategistBonusActionId: ActionId | null;
  recruitTeamId?: string;
}): SummaryRow[] {
  const draft = toActivityRollDraft(totals);
  const sections = buildActivityRollSections({
    rank: 1,
    stagedActionIds,
    draft,
    setField: () => undefined,
    officerEffects,
    strategistBonusActionId,
    recruitTeamId,
  });
  return sections.flatMap((section) =>
    section.fields
      .map((field) => ({
        label: `${section.title} ${field.label}`,
        value: draft[field.key as ActivityRollKey].trim(),
      }))
      .filter((row) => row.value.length > 0),
  );
}

export function buildActivityRollSections({
  rank,
  stagedActionIds,
  draft,
  setField,
  officerEffects,
  strategistBonusActionId,
  recruitTeamId,
}: {
  rank: number;
  stagedActionIds: string[];
  draft: ActivityRollDraft;
  setField: (key: ActivityRollKey, value: string) => void;
  officerEffects: OfficerEffects;
  strategistBonusActionId: ActionId | null;
  recruitTeamId?: string;
}) {
  const has = (id: string) => stagedActionIds.includes(id);
  const recruitCheckType = getRecruitmentCheckType(recruitTeamId);

  const drillDc = 10 + rank;
  const drillCheck = parseOptionalManualTotal(draft.drillMilitiaCheckTotal);
  const drillCanTrainingGain = drillCheck !== undefined && drillCheck >= drillDc;
  const drillGainPlaceholder =
    drillCheck === undefined
      ? `Enter Loyalty check total first (DC ${drillDc}).`
      : drillCanTrainingGain
        ? 'Success: enter total training gained (2d6 + applicable bonuses).'
        : 'Failed check: no training gain from Drill Militia this week.';

  const reduceCheck = parseOptionalManualTotal(draft.reduceDangerCheckTotal);
  const reduceCanNotoriety = reduceCheck !== undefined && reduceCheck < 15;
  const reduceNotorietyPlaceholder =
    reduceCheck === undefined
      ? 'Enter Security check total first (DC 15).'
      : reduceCanNotoriety
        ? 'Failed check: enter notoriety increase total (1d4).'
        : 'Success: no notoriety increase from Reduce Danger.';

  const blackMarketCheck = parseOptionalManualTotal(
    draft.activateBlackMarketCheckTotal,
  );
  const blackMarketCanNotoriety =
    blackMarketCheck !== undefined && blackMarketCheck < 20;
  const blackMarketNotorietyPlaceholder =
    blackMarketCheck === undefined
      ? 'Enter Secrecy check total first (DC 20).'
      : blackMarketCanNotoriety
        ? 'Failed check: enter Notoriety increase total (1d6).'
        : 'Success: no Notoriety increase from this action.';

  const dismissCheck = parseOptionalManualTotal(draft.dismissTeamCheckTotal);
  const dismissCanNotoriety = dismissCheck !== undefined && dismissCheck < 10;
  const dismissNotorietyPlaceholder =
    dismissCheck === undefined
      ? 'Enter Loyalty check total first (DC 10).'
      : dismissCanNotoriety
        ? 'Failed check: enter Notoriety increase total (1d6).'
        : 'Success: no Notoriety increase from this action.';

  const canEarnGoldSecondary =
    parseOptionalManualTotal(draft.earnGoldCheckTotal) !== undefined;
  const canGatherInformationSecondary =
    parseOptionalManualTotal(draft.gatherInformationCheckTotal) !== undefined;
  const canRecruitSecondary =
    parseOptionalManualTotal(draft.recruitTeamCheckTotal) !== undefined;
  const canRescueSecondary =
    parseOptionalManualTotal(draft.rescueCharacterCheckTotal) !== undefined &&
    parseOptionalManualTotal(draft.rescueCharacterTargetLevelTotal) !== undefined;

  const sections: ActivityRollSectionConfig[] = [];
  const pushSection = (section: ActivityRollSectionConfig) => sections.push(section);

  if (has('activate_black_market')) {
    pushSection({
      key: 'activate_black_market',
      title: 'Activate Black Market',
      fields: [
        {
          key: 'activateBlackMarketCheckTotal',
          label: 'check total',
          value: draft.activateBlackMarketCheckTotal,
          onChange: (value) => setField('activateBlackMarketCheckTotal', value),
          placeholder: 'Enter Secrecy check total (DC 20)',
          helperText: getCheckBonusHelperText({
            checkType: 'secrecy',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'activate_black_market',
          }),
        },
        {
          key: 'activateBlackMarketNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.activateBlackMarketNotorietyIncreaseTotal,
          onChange: (value) =>
            setField('activateBlackMarketNotorietyIncreaseTotal', value),
          disabled: !blackMarketCanNotoriety,
          placeholder: blackMarketNotorietyPlaceholder,
        },
      ],
    });
  }

  if (has('dismiss_team')) {
    pushSection({
      key: 'dismiss_team',
      title: 'Dismiss Team',
      fields: [
        {
          key: 'dismissTeamCheckTotal',
          label: 'check total',
          value: draft.dismissTeamCheckTotal,
          onChange: (value) => setField('dismissTeamCheckTotal', value),
          placeholder: 'Enter Loyalty check total (DC 10)',
          helperText: getCheckBonusHelperText({
            checkType: 'loyalty',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'dismiss_team',
          }),
        },
        {
          key: 'dismissTeamNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.dismissTeamNotorietyIncreaseTotal,
          onChange: (value) => setField('dismissTeamNotorietyIncreaseTotal', value),
          disabled: !dismissCanNotoriety,
          placeholder: dismissNotorietyPlaceholder,
        },
      ],
    });
  }

  if (has('drill_militia')) {
    pushSection({
      key: 'drill_militia',
      title: 'Drill Militia',
      fields: [
        {
          key: 'drillMilitiaCheckTotal',
          label: 'check total',
          value: draft.drillMilitiaCheckTotal,
          onChange: (value) => setField('drillMilitiaCheckTotal', value),
          placeholder: `Enter Loyalty check total (DC ${drillDc})`,
          helperText: getCheckBonusHelperText({
            checkType: 'loyalty',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'drill_militia',
          }),
        },
        {
          key: 'drillMilitiaTrainingGainTotal',
          label: 'training gain total',
          value: draft.drillMilitiaTrainingGainTotal,
          onChange: (value) => setField('drillMilitiaTrainingGainTotal', value),
          disabled: !drillCanTrainingGain,
          placeholder: drillGainPlaceholder,
          helperText: getCommandantTrainingHelperText(officerEffects),
        },
      ],
    });
  }

  if (has('earn_gold')) {
    pushSection({
      key: 'earn_gold',
      title: 'Earn Gold',
      fields: [
        {
          key: 'earnGoldCheckTotal',
          label: 'check total',
          value: draft.earnGoldCheckTotal,
          onChange: (value) => setField('earnGoldCheckTotal', value),
          placeholder: 'Enter Loyalty check total',
          helperText: getCheckBonusHelperText({
            checkType: 'loyalty',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'earn_gold',
          }),
        },
        {
          key: 'earnGoldTotal',
          label: 'gold total',
          value: draft.earnGoldTotal,
          onChange: (value) => setField('earnGoldTotal', value),
          disabled: !canEarnGoldSecondary,
          placeholder: canEarnGoldSecondary
            ? 'Enter gold gained total'
            : 'Enter Loyalty check total first',
        },
        {
          key: 'earnGoldNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.earnGoldNotorietyIncreaseTotal,
          onChange: (value) => setField('earnGoldNotorietyIncreaseTotal', value),
          disabled: !canEarnGoldSecondary,
          placeholder: canEarnGoldSecondary
            ? 'Optional: Notoriety increase total on natural 1 (1d6)'
            : 'Enter Loyalty check total first',
        },
      ],
    });
  }

  if (has('gather_information')) {
    pushSection({
      key: 'gather_information',
      title: 'Gather Information',
      fields: [
        {
          key: 'gatherInformationCheckTotal',
          label: 'check total',
          value: draft.gatherInformationCheckTotal,
          onChange: (value) => setField('gatherInformationCheckTotal', value),
          placeholder: 'Enter Secrecy check total (DC 15 + team modifiers)',
          helperText: getCheckBonusHelperText({
            checkType: 'secrecy',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'gather_information',
          }),
        },
        {
          key: 'gatherInformationNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.gatherInformationNotorietyIncreaseTotal,
          onChange: (value) =>
            setField('gatherInformationNotorietyIncreaseTotal', value),
          disabled: !canGatherInformationSecondary,
          placeholder: canGatherInformationSecondary
            ? 'Optional: Notoriety increase total on natural 1 (1d6)'
            : 'Enter Secrecy check total first',
        },
      ],
    });
  }

  if (has('knowledge_check')) {
    pushSection({
      key: 'knowledge_check',
      title: 'Knowledge Check',
      fields: [
        {
          key: 'knowledgeCheckTotal',
          label: 'total',
          value: draft.knowledgeCheckTotal,
          onChange: (value) => setField('knowledgeCheckTotal', value),
          placeholder: 'Enter Secrecy check + rank total',
          helperText: getCheckBonusHelperText({
            checkType: 'secrecy',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'knowledge_check',
          }),
        },
      ],
    });
  }

  if (has('recruit_team')) {
    pushSection({
      key: 'recruit_team',
      title: 'Recruit Team',
      fields: [
        {
          key: 'recruitTeamCheckTotal',
          label: 'check total',
          value: draft.recruitTeamCheckTotal,
          onChange: (value) => setField('recruitTeamCheckTotal', value),
          placeholder: 'Enter recruitment check total',
          helperText: recruitCheckType
            ? getCheckBonusHelperText({
                checkType: recruitCheckType,
                officerEffects,
                isStrategistBonusAction: strategistBonusActionId === 'recruit_team',
              })
            : undefined,
        },
        {
          key: 'recruitTeamNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.recruitTeamNotorietyIncreaseTotal,
          onChange: (value) =>
            setField('recruitTeamNotorietyIncreaseTotal', value),
          disabled: !canRecruitSecondary,
          placeholder: canRecruitSecondary
            ? 'Optional: Notoriety increase total on natural 1 (1d6)'
            : 'Enter recruitment check total first',
        },
      ],
    });
  }

  if (has('reduce_danger')) {
    pushSection({
      key: 'reduce_danger',
      title: 'Reduce Danger',
      fields: [
        {
          key: 'reduceDangerCheckTotal',
          label: 'check total',
          value: draft.reduceDangerCheckTotal,
          onChange: (value) => setField('reduceDangerCheckTotal', value),
          placeholder: 'Enter Security check total (DC 15)',
          helperText: getCheckBonusHelperText({
            checkType: 'security',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'reduce_danger',
          }),
        },
        {
          key: 'reduceDangerNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.reduceDangerNotorietyIncreaseTotal,
          onChange: (value) =>
            setField('reduceDangerNotorietyIncreaseTotal', value),
          disabled: !reduceCanNotoriety,
          placeholder: reduceNotorietyPlaceholder,
        },
      ],
    });
  }

  if (has('rescue_character')) {
    pushSection({
      key: 'rescue_character',
      title: 'Rescue Character',
      fields: [
        {
          key: 'rescueCharacterCheckTotal',
          label: 'check total',
          value: draft.rescueCharacterCheckTotal,
          onChange: (value) => setField('rescueCharacterCheckTotal', value),
          placeholder: 'Enter Security check total',
          helperText: getCheckBonusHelperText({
            checkType: 'security',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'rescue_character',
          }),
        },
        {
          key: 'rescueCharacterTargetLevelTotal',
          label: 'target level',
          value: draft.rescueCharacterTargetLevelTotal,
          onChange: (value) => setField('rescueCharacterTargetLevelTotal', value),
          placeholder: 'Enter captured character level',
        },
        {
          key: 'rescueCharacterNotorietyIncreaseTotal',
          label: 'notoriety increase total',
          value: draft.rescueCharacterNotorietyIncreaseTotal,
          onChange: (value) =>
            setField('rescueCharacterNotorietyIncreaseTotal', value),
          disabled: !canRescueSecondary,
          placeholder: canRescueSecondary
            ? 'Enter Notoriety increase total from outcome'
            : 'Enter check and target level first',
        },
      ],
    });
  }

  if (has('restore_character')) {
    pushSection({
      key: 'restore_character',
      title: 'Restore Character',
      fields: [
        {
          key: 'restoreCharacterCostTotal',
          label: 'treasury cost total',
          value: draft.restoreCharacterCostTotal,
          onChange: (value) => setField('restoreCharacterCostTotal', value),
          placeholder:
            'Optional: Enter paid restorative cost total (e.g. 1125, 6125, 1700, 1650)',
        },
      ],
    });
  }

  if (has('spread_propaganda')) {
    pushSection({
      key: 'spread_propaganda',
      title: 'Spread Propaganda',
      fields: [
        {
          key: 'spreadPropagandaCheckTotal',
          label: 'check total',
          value: draft.spreadPropagandaCheckTotal,
          onChange: (value) => setField('spreadPropagandaCheckTotal', value),
          placeholder: 'Enter Loyalty check total (DC 20)',
          helperText: getCheckBonusHelperText({
            checkType: 'loyalty',
            officerEffects,
            isStrategistBonusAction: strategistBonusActionId === 'spread_propaganda',
          }),
        },
      ],
    });
  }

  if (has('special')) {
    pushSection({
      key: 'special',
      title: 'Special',
      fields: [
        {
          key: 'specialActionCostTotal',
          label: 'treasury cost total',
          value: draft.specialActionCostTotal,
          onChange: (value) => setField('specialActionCostTotal', value),
          placeholder: 'Optional: enter GM-defined treasury cost total',
        },
      ],
    });
  }

  return sections;
}

function parseOptionalManualTotal(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
