import type { CanonicalRoster } from '~/lib/canonical-roster';
import type { ReferenceFacts } from './reference-facts';
import type { CanonicalResolutionEffects } from '~/lib/canonical-weekly-resolution';
import type { PersistentChange } from '~/lib/rules-persistent-events';
import type { EventOutcomeChange } from '~/lib/rules-event-outcomes';
import type {
  EventDispatch,
  EventTableArithmetic,
} from '~/lib/rules-event-selection';
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
  // Null in the militia's first week, when Upkeep is skipped entirely.
  sections: UpkeepSections | null;
};
// A warning or blocker message owned by one Upkeep item; the view shows it
// under that item while the frame lists the same codes in This phase.
export type UpkeepIssue = { code: string; message: string };
export type UpkeepCheck<Result extends string> = RollFact & {
  // Null while the roll is missing, incomplete or otherwise not calculable.
  result: Result | null;
  issues: UpkeepIssue[];
};
// A training roll. `rank` is added by the rules (never entered) and
// `trainingDelta` is this step's calculated change, null until known.
export type UpkeepLoss = RollFact & {
  rank: number | null;
  multiplier: number;
  trainingDelta: number | null;
  issues: UpkeepIssue[];
};
// Open: applicable and still needs an input here. Waiting: an earlier step
// must be resolved before this one can be known. Inapplicable sections
// collapse to one line with their reason.
export type UpkeepSectionStatus =
  | 'inapplicable'
  | 'waiting'
  | 'open'
  | 'resolved';
export type UpkeepLegacyRemoval = {
  // The reasoned exception recorded with the retired Remove choice, if any.
  exceptionId: string | null;
  reason: string | null;
};
export type UpkeepDisabledTeam = {
  teamId: string;
  name: string;
  typeName: string;
  tier: number | null;
  decision: 'recover' | 'leave' | null;
  legacyRemoval: UpkeepLegacyRemoval | null;
  rulesCostCopper: number;
  enteredCostCopper: number;
  adjustment: { deltaCopper: number; reason: string } | null;
  // Present while the recovery needs, or already has, a reasoned exception.
  fundsException: {
    exceptionId: string;
    reason: string;
    required: boolean;
  } | null;
  issues: UpkeepIssue[];
};
export type UpkeepMissingTeam = {
  teamId: string;
  name: string;
  typeName: string;
  tier: number | null;
  legacyRemoval: UpkeepLegacyRemoval | null;
  return:
    | { kind: 'scheduled'; week: number; status: 'active' | 'disabled' }
    | {
        kind: 'check';
        check: Omit<
          UpkeepCheck<'returns' | 'stays-missing' | 'lost'>,
          'field' | 'dice'
        >;
      }
    | null;
  issues: UpkeepIssue[];
};
export type UpkeepSections = {
  teams: {
    status: UpkeepSectionStatus;
    treasuryBeforeCopper: number;
    // Rules Baseline treasury after paying decided recoveries.
    treasuryAfterRecoveryCopper: number;
    // Post-baseline Table Adjustments from changed recovery prices.
    adjustments: { teamId: string; name: string; deltaCopper: number }[];
    disabled: UpkeepDisabledTeam[];
    missing: UpkeepMissingTeam[];
    // Staged decisions for teams no longer on the roster (for example after
    // a Militia correction removed them); each blocks until cleared.
    orphans: { teamId: string }[];
  };
  attrition: {
    status: UpkeepSectionStatus;
    trainingDelta: number | null;
    check: UpkeepCheck<'natural-20' | 'success' | 'failure'>;
    training: UpkeepLoss | null;
  };
  notoriety: {
    status: UpkeepSectionStatus;
    notoriety: number;
    threshold: number;
    trainingDelta: number | null;
    loss: UpkeepLoss | null;
    check: UpkeepCheck<'success' | 'failure'> | null;
    settlement: {
      required: boolean;
      selected: string | null;
      choices: {
        settlementId: string;
        name: string;
        reputation: string | null;
      }[];
      change: { name: string; before: string; after: string } | null;
      issues: UpkeepIssue[];
    } | null;
  };
  shortage: {
    status: UpkeepSectionStatus;
    treasuryAfterRecoveryCopper: number;
    minimumCopper: number;
    trainingDelta: number | null;
    loss: UpkeepLoss | null;
  };
  rank: {
    status: UpkeepSectionStatus;
    before: number;
    after: number | null;
    issues: UpkeepIssue[];
  };
  transfers: {
    status: UpkeepSectionStatus;
    beforeCopper: number | null;
    afterCopper: number | null;
    issues: UpkeepIssue[];
  };
  // Warnings no single item owns, such as archived officers' check bonuses.
  general: UpkeepIssue[];
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
export type EventOccurrenceFacts = {
  occurrence: WeeklyDraft['event']['occurrences'][number];
  // Display label such as "Event 2A.1"; never an identity.
  label: string;
  resolvedType: string | null;
  optionalMitigation: 'unavailable' | 'unattempted' | 'attempted';
  exceptionChoices: WeeklyDraft['rulesExceptions'];
  changes: EventOutcomeChange[];
  mode: EventDispatch['mode'] | null;
  selected: boolean;
  negated: boolean;
  requirements: string[];
  warnings: string[];
  owner: { slotId: string; choice: StagedActionChoice } | null;
};
// What an event block says about its occurrence this week. Every status has
// its own words; colour never carries the distinction alone.
export type EventBlockStatus =
  | 'preparing'
  | 'awaiting_roll'
  | 'happens'
  | 'twice'
  | 'no_additional_effect'
  | 'two_more'
  | 'reroll'
  | 'rerolled'
  | 'cannot_occur'
  | 'kept'
  | 'sabotaged'
  | 'candidate'
  | 'not_chosen'
  | 'not_used'
  | 'needs_repair';
export type EventIssue = { code: string; message: string };
// An event's corpus rules for one block; `twice` only when it applies there.
export type EventBlockRules = {
  name: string;
  text: string[];
  twice: string | null;
};
export type EventBlock = {
  eventId: string;
  label: string;
  item: EventOccurrenceFacts;
  // False until the occurrence exists in the accepted draft: its inputs wait.
  saved: boolean;
  status: EventBlockStatus;
  statusLabel: string;
  statusText: string;
  origin: string;
  table: {
    raw: number | null;
    // Recorded extra table modifiers, with why the rules ignore one if they do.
    modifiers: EventTableArithmetic['modifiers'];
    total: number | null;
    name: string | null;
  };
  // The corpus rules for the rolled event; null until the table roll is
  // complete. `twice` is set only when its Twice clause applies here.
  rules: EventBlockRules | null;
  candidate: { slotId: string; choiceId: string; chosen: boolean } | null;
  // Active nested events (Roll Twice children, a replacement) in order.
  children: EventBlock[];
  // Recorded children the current roll does not use; restored if it returns.
  hidden: EventBlock[];
  // A position the rules do not ask for: clearing its last input removes it.
  surplus: boolean;
  // The existing tree/candidate edit removing this surplus position once its
  // table roll is cleared; null when clearing must keep the position.
  removal: WeeklyDraftEdit | null;
  issues: EventIssue[];
};
export type EventChanceStep = {
  applies: 'roll' | 'guaranteed' | 'forced_calm';
  effect: string;
  explanation: string | null;
  breakdown: { label: string; value: number }[];
  required: boolean;
  raw: number | null;
  total: number | null;
  result: 'event' | 'quiet' | null;
  operating: {
    name: string;
    reputation: string | null;
    // Null while the operating settlement's reputation is unknown.
    modifier: number | null;
  } | null;
  sources: { choiceId: string; label: string }[];
  issues: EventIssue[];
};
export type EventCandidateSet = {
  slotId: string;
  choiceId: string;
  label: string;
  // False when the choice guarantees nothing this week (for example a calm week).
  active: boolean;
  selectedEventId: string | null;
  blocks: EventBlock[];
  issues: EventIssue[];
};
export type EventView = {
  phase: 'event';
  ready: boolean;
  chance: number;
  chanceRoll: WeeklyDraft['event']['chanceRoll'] | null;
  chanceModifier: number | null;
  guaranteed: boolean;
  chanceStep: EventChanceStep;
  automatic: {
    sources: { sourceId: string; label: string; count: number }[];
    blocks: EventBlock[];
    issues: EventIssue[];
  } | null;
  rolled: {
    applies: boolean;
    effect: string;
    reason: string | null;
    blocks: EventBlock[];
    issues: EventIssue[];
  };
  candidates: EventCandidateSet[];
  // Recorded top-level events the rules do not use this week.
  inactive: EventBlock[];
  outcome: { complete: boolean; lines: string[] };
  preparation: 'idle' | 'preparing' | 'failed';
  occurrences: EventOccurrenceFacts[];
  // Event-identified wording for every Event requirement and warning code.
  messages: Record<string, string>;
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
      // Event-identified wording for Event codes (see EventView['messages']).
      eventMessages?: Record<string, string>;
      ready: boolean;
      baseline: CanonicalWeekState | null;
      outcome: CanonicalWeekState | null;
      requirements: string[];
      warnings: string[];
    };
export type PhaseReadiness = {
  phase: Phase;
  available: boolean;
  // Upkeep in the militia's first week: nothing applies or is required.
  skipped?: boolean;
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
      // Preparing the Event positions the rules ask for, shared by every phase.
      eventPreparation?: {
        status: 'idle' | 'preparing' | 'failed';
        retry(this: void): void;
      };
    };
