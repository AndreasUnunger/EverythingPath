'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import {
  ActivityRollsPanel,
  type ActivityRollSectionConfig,
} from '~/components/week-board/activity-rolls-panel';
import { useDebouncedAutosave } from '~/hooks/use-debounced-autosave';

type ActivityRollTotals = {
  activateBlackMarketCheckTotal?: number;
  activateBlackMarketNotorietyIncreaseTotal?: number;
  dismissTeamCheckTotal?: number;
  dismissTeamNotorietyIncreaseTotal?: number;
  drillMilitiaCheckTotal?: number;
  drillMilitiaTrainingGainTotal?: number;
  earnGoldCheckTotal?: number;
  earnGoldTotal?: number;
  earnGoldNotorietyIncreaseTotal?: number;
  gatherInformationCheckTotal?: number;
  gatherInformationNotorietyIncreaseTotal?: number;
  knowledgeCheckTotal?: number;
  recruitTeamCheckTotal?: number;
  recruitTeamNotorietyIncreaseTotal?: number;
  reduceDangerCheckTotal?: number;
  reduceDangerNotorietyIncreaseTotal?: number;
  rescueCharacterCheckTotal?: number;
  rescueCharacterTargetLevelTotal?: number;
  rescueCharacterNotorietyIncreaseTotal?: number;
  secureCacheCheckTotal?: number;
  spreadPropagandaCheckTotal?: number;
  specialOrderDeliveryDaysTotal?: number;
};

type ActivityRollKey = keyof ActivityRollTotals;
type ActivityRollDraft = Record<ActivityRollKey, string>;

const ACTIVITY_ROLL_KEYS: ActivityRollKey[] = [
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
  'secureCacheCheckTotal',
  'spreadPropagandaCheckTotal',
  'specialOrderDeliveryDaysTotal',
];

function toDraft(totals: ActivityRollTotals): ActivityRollDraft {
  return Object.fromEntries(
    ACTIVITY_ROLL_KEYS.map((key) => [key, totals[key]?.toString() ?? '']),
  ) as ActivityRollDraft;
}

function isParsableManualTotal(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return Number.isFinite(Number(trimmed));
}

function parseOptionalManualTotal(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export function buildActivityRollSummaryRows({
  stagedActionIds,
  totals,
}: {
  stagedActionIds: string[];
  totals: ActivityRollTotals;
}): SummaryRow[] {
  const draft = toDraft(totals);
  const sections = buildSections({
    rank: 1,
    stagedActionIds,
    draft,
    setField: () => undefined,
  });
  return sections.flatMap((section) =>
    section.fields.map((field) => ({
      label: `${section.title} ${field.label}`,
      value: draft[field.key as ActivityRollKey].trim() || 'Not entered',
    })),
  );
}

export type SummaryRow = {
  label: string;
  value: string;
};

function buildSections({
  rank,
  stagedActionIds,
  draft,
  setField,
}: {
  rank: number;
  stagedActionIds: string[];
  draft: ActivityRollDraft;
  setField: (key: ActivityRollKey, value: string) => void;
}) {
  const has = (id: string) => stagedActionIds.includes(id);

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
        },
        {
          key: 'drillMilitiaTrainingGainTotal',
          label: 'training gain total',
          value: draft.drillMilitiaTrainingGainTotal,
          onChange: (value) => setField('drillMilitiaTrainingGainTotal', value),
          disabled: !drillCanTrainingGain,
          placeholder: drillGainPlaceholder,
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
        },
        {
          key: 'rescueCharacterTargetLevelTotal',
          label: 'target level',
          value: draft.rescueCharacterTargetLevelTotal,
          onChange: (value) =>
            setField('rescueCharacterTargetLevelTotal', value),
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

  if (has('secure_cache')) {
    pushSection({
      key: 'secure_cache',
      title: 'Secure Cache',
      fields: [
        {
          key: 'secureCacheCheckTotal',
          label: 'check total',
          value: draft.secureCacheCheckTotal,
          onChange: (value) => setField('secureCacheCheckTotal', value),
          placeholder: 'Enter Secrecy check total',
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
        },
      ],
    });
  }

  if (has('special_order')) {
    pushSection({
      key: 'special_order',
      title: 'Special Order',
      fields: [
        {
          key: 'specialOrderDeliveryDaysTotal',
          label: 'delivery days total',
          value: draft.specialOrderDeliveryDaysTotal,
          onChange: (value) =>
            setField('specialOrderDeliveryDaysTotal', value),
          placeholder: 'Enter delivery days roll total (2d6 or expedited)',
        },
      ],
    });
  }

  return sections;
}

export function ActivityRollsController({
  militiaId,
  organizationId,
  rank,
  stagedActionIds,
  serverTotals,
  onErrorAction,
  className,
  showTitle = true,
}: {
  militiaId: Id<'militia'> | undefined;
  organizationId: string;
  rank: number;
  stagedActionIds: string[];
  serverTotals: ActivityRollTotals;
  onErrorAction: (message: string) => void;
  className?: string;
  showTitle?: boolean;
}) {
  const saveWeekBoardState = useMutation(db.weekBoard.saveWeekBoardState);
  const [draft, setDraft] = useState<ActivityRollDraft>(() => toDraft(serverTotals));

  useEffect(() => {
    setDraft(toDraft(serverTotals));
  }, [serverTotals]);

  const setField = (key: ActivityRollKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const sections = useMemo(
    () => buildSections({ rank, stagedActionIds, draft, setField }),
    [rank, stagedActionIds, draft],
  );

  const enabledFieldKeys = useMemo(() => {
    return new Set<ActivityRollKey>(
      sections.flatMap((section) =>
        section.fields
          .filter((field) => !field.disabled)
          .map((field) => field.key as ActivityRollKey),
      ),
    );
  }, [sections]);

  useDebouncedAutosave({
    enabled: Boolean(militiaId),
    deps: [militiaId, organizationId, draft, serverTotals, enabledFieldKeys],
    shouldSkip: () => {
      if (!militiaId) return true;
      const normalized = ACTIVITY_ROLL_KEYS.map((key) => {
        const active = enabledFieldKeys.has(key);
        return {
          local: active ? draft[key] : '',
          server: active ? (serverTotals[key]?.toString() ?? '') : '',
        };
      });

      if (normalized.every((row) => row.local === row.server)) return true;
      return !normalized.every((row) => isParsableManualTotal(row.local));
    },
    run: async () => {
      if (!militiaId) return;
      const activityRollTotals = Object.fromEntries(
        ACTIVITY_ROLL_KEYS.map((key) => {
          const active = enabledFieldKeys.has(key);
          return [key, active ? draft[key] : undefined];
        }),
      );

      await saveWeekBoardState({
        organizationId,
        militiaId,
        patch: { activityRollTotals },
      });
    },
    onError: (error) => {
      onErrorAction(getErrorMessage(error, 'Failed to auto-save Activity roll totals.'));
    },
  });

  return (
    <ActivityRollsPanel
      sections={sections}
      className={className}
      showTitle={showTitle}
    />
  );
}
