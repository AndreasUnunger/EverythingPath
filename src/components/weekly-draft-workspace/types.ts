import type { CanonicalRoster } from '~/lib/canonical-roster';
import type { ReferenceFacts } from './reference-facts';
import type { CanonicalResolutionEffects } from '~/lib/canonical-weekly-resolution';
import type { PersistentChange } from '~/lib/rules-persistent-events';
import type { EventOutcomeChange } from '~/lib/rules-event-outcomes';
import type { ActivityProjection } from '~/lib/rules-activity';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { projectUpkeep } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { RollReadFacts } from './roll-facts';
export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'summary';
export type UpkeepRollField = Extract<
  WeeklyDraftEdit,
  { kind: 'upkeep_roll' }
>['field'];
// `dice` holds the legacy per-die editor slots and is null when the recorded
// roll is a dice total, which has no individual dice to show or fabricate.
export type RollFact = RollReadFacts & {
  field: UpkeepRollField;
  count: number;
  dice: (number | null)[] | null;
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
  officers: {
    characterId: string;
    name: string | null;
    roles: CanonicalRoster['officers'][number]['role'][];
  }[];
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
    roll: RollReadFacts;
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
  chanceModifier: number | null;
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
      effects: Omit<CanonicalResolutionEffects, 'adjudication'> | null;
      adjustments: WeeklyDraft['tableAdjustments'];
      exceptions: (WeeklyDraft['rulesExceptions'][number] & { name: string })[];
      acknowledgements: (WeeklyDraft['acknowledgements'][number] & {
        name: string;
      })[];
      people: { characterId: string; name: string }[];
      options: EventView['options'];
      ready: boolean;
      baseline: CanonicalWeekState | null;
      outcome: CanonicalWeekState | null;
      requirements: string[];
      warnings: string[];
    };
export type PhaseReadiness = {
  phase: Phase;
  available: boolean;
  ready: boolean;
  requirements: { id: string; message: string }[];
  warnings: { id: string; message: string }[];
};
export type WeeklyDraftWorkspace =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      setupNotes?: string;
      week: number;
      phaseView: PhaseView;
      phases: PhaseReadiness[];
      referenceFacts: ReferenceFacts;
      navigation: { previous: Phase | null; next: Phase | null };
      confirmationDisabledReason: string | null;
      feedback: 'idle' | 'pending' | 'saved' | 'failed' | 'confirming';
      editingDisabled: boolean;
      remoteChange: { sequence: number; phases: readonly Phase[] } | null;
      confirmedWeek: { transitionId: string; week: number } | null;
      dismissConfirmedWeek(this: void): void;
      failureReason: string | null;
      canConfirm: boolean;
      reviewRequired: boolean;
      forecastPending: boolean;
      pendingWork: boolean;
      edit(this: void, edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'>;
      viewPhase(this: void, phase: Phase): void;
      confirm(this: void): Promise<'accepted' | 'failed'>;
    };
