import type { PersistentChange } from '~/lib/rules-persistent-events';
import type { EventOutcomeChange } from '~/lib/rules-event-outcomes';
import type { ActivityProjection } from '~/lib/rules-activity';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { projectUpkeep } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'summary';
export type UpkeepRollField = Extract<
  WeeklyDraftEdit,
  { kind: 'upkeep_roll' }
>['field'];
export type RollFact = {
  field: UpkeepRollField;
  dice: (number | null)[];
  sides: number;
  modifier: number | null;
  total: number | null;
  dc: number | null;
  modifiers: { source: string; value: number }[];
};
export type UpkeepView = {
  phase: 'upkeep';
  skipped: boolean;
  ready: boolean;
  rolls: RollFact[];
  before: {
    rank: number;
    training: number;
    treasuryCopper: number;
    notoriety: number;
  };
  after: {
    rank: number;
    training: number;
    treasuryCopper: number;
    notoriety: number;
  };
  minimumTreasuryCopper: number;
  nearestSettlement: {
    required: boolean;
    selected: string | null;
    choices: { settlementId: string; name: string }[];
  };
  officers: { characterId: string; name: string | null; roles: string[] }[];
  transfers: {
    transferId: string;
    characterId: string;
    direction: 'deposit' | 'withdraw';
    copper: number;
  }[];
  teams: {
    teamId: string;
    name: string;
    status: 'active' | 'disabled' | 'missing' | 'blocked';
    decision: 'recover' | 'leave' | 'remove' | null;
    costCopper: number;
    recoveryAdjustment: { deltaCopper: number; reason: string } | null;
    roll: number | null;
    needsReturnRoll: boolean;
  }[];
  boons: Extract<
    ReturnType<typeof projectUpkeep>['plan'][number],
    { kind: 'boon' }
  >[];
  exceptions: {
    subjectId: string;
    ruleId: string;
    name: string;
    exceptionId: string;
    reason: string;
  }[];
  requirements: string[];
  warnings: string[];
};
export type ActivityView = {
  phase: 'activity';
  ready: boolean;
  occupiedSlots: number;
  slots: (ActivityProjection['slots'][number] & {
    requirements: string[];
    warnings: string[];
    calculatedCostCopper: number | null;
    exceptions: { exceptionId: string; ruleId: string; reason: string }[];
  })[];
  actions: { actionId: StagedActionChoice['actionId']; name: string }[];
  teams: { value: string; label: string; description: string }[];
  settlements: { value: string; label: string }[];
  people: { value: string; label: string }[];
  items: { value: string; label: string }[];
  caches: { value: string; label: string }[];
  events: { value: string; label: string }[];
  bonuses: { value: string; label: string }[];
  automaticSources: { value: string; label: string }[];
  modifierSources: { value: string; label: string }[];
  startDay: number;
  operatingSettlementId: string | null;
  checks: ActivityProjection['checks'];
  requirements: string[];
  warnings: string[];
};
export type EventView = {
  phase: 'event';
  ready: boolean;
  chance: number;
  chanceRoll: WeeklyDraft['event']['chanceRoll'] | null;
  guaranteed: boolean;
  occurrences: {
    occurrence: WeeklyDraft['event']['occurrences'][number];
    resolvedType: string | null;
    optionalMitigation: 'unavailable' | 'unattempted' | 'attempted';
    rollSides: Record<string, number>;
    exceptionChoices: WeeklyDraft['rulesExceptions'];
    changes: EventOutcomeChange[];
    mode: string | null;
    selected: boolean;
    negated: boolean;
    requirements: string[];
    warnings: string[];
    owner: { slotId: string; choice: StagedActionChoice } | null;
  }[];
  acknowledgements: WeeklyDraft['acknowledgements'];
  exceptions: WeeklyDraft['rulesExceptions'];
  checks: ActivityView['checks'];
  options: Record<string, { value: string; label: string }[]>;
  requirements: string[];
  warnings: string[];
};
export type PersistentView = {
  phase: 'persistent';
  ready: boolean;
  firstBuyoff: boolean;
  nextBuyoffWeek: number | null;
  buyoffCostCopper: number | null;
  options: EventView['options'];
  events: (WeeklyDraft['context']['carriedEvents'][number] & {
    name: string;
    ageWeeks: number;
    targetNames: string[];
    decision: WeeklyDraft['persistent']['decisions'][number] | null;
    ended: boolean;
    changes: PersistentChange[];
    checks: ActivityView['checks'];
    exceptions: WeeklyDraft['rulesExceptions'];
    requirements: string[];
    warnings: string[];
  })[];
  requirements: string[];
  warnings: string[];
};
export type PhaseView =
  | UpkeepView
  | ActivityView
  | EventView
  | PersistentView
  | {
      phase: 'summary';
      ready: boolean;
      baseline: CanonicalWeekState | null;
      outcome: CanonicalWeekState | null;
      requirements: string[];
      warnings: string[];
    };
export type WeeklyDraftWorkspace =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      week: number;
      phaseView: PhaseView;
      phases: { phase: Phase; available: boolean }[];
      feedback: 'idle' | 'pending' | 'saved' | 'failed' | 'confirming';
      canConfirm: boolean;
      forecastPending: boolean;
      pendingWork: boolean;
      edit(this: void, edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'>;
      viewPhase(this: void, phase: Phase): void;
      confirm(this: void): Promise<'accepted' | 'failed'>;
    };
