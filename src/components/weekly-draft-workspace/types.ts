import type { WeekReviewFacts } from '../week-review/review-facts';
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
import type { RollSpec } from '~/lib/raw-roll';
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
    // What the open step still needs from the table, or null when settled.
    need: 'decision' | 'roll' | null;
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
// A requirement or warning code with its player-facing message.
export type ActivityIssue = { code: string; message: string };
// One team as Activity sees it: its post-Upkeep condition, or a team that an
// earlier Recruit Team choice in this week stages.
export type ActivityTeamFact = {
  teamId: string;
  name: string;
  teamType: string | null;
  typeName: string | null;
  tier: number | null;
  condition: CanonicalRoster['teams'][number]['status'];
  // A queued effect or a carried Rivalry keeps it out of this Activity.
  unavailable: boolean;
  // Set for a team staged by the Recruit Team choice in Action Slot N.
  recruitedInSlot: number | null;
};
export type ActivityCheck = {
  spec: RollSpec;
  organizationCheck: 'loyalty' | 'secrecy' | 'security' | null;
  dc: number | null;
  // Null until the rules reach this check (for example before a team is
  // chosen); the entered dice total is never folded into the bonus.
  modifier: number | null;
  total: number | null;
  breakdown: { source: string; label: string; value: number }[];
};
// A modifier recorded on the check roll. Helpful and bonus entries select a
// rules source; custom entries carry their own reason; automatic sources are
// calculated anyway, so a recorded copy is ignored; unknown ones come from
// older data and stay visible and removable.
export type ActivityRecordedModifier = {
  index: number;
  sourceId: string;
  kind: 'helpful' | 'bonus' | 'custom' | 'automatic' | 'unknown';
  label: string;
  value: number;
  reason: string;
  warning: string | null;
};
export type ActivityBonusChoice = {
  sourceId: string;
  label: string;
  value: number;
};
export type ActivitySlotStatus =
  | { kind: 'empty' }
  | { kind: 'ready' }
  | { kind: 'todo'; count: number };
export type ActivityAllowance = {
  occupied: number;
  // The allowance after every slot: what a newly added slot receives.
  actions: number;
  rank: number;
  rankActions: number | null;
  strategist: boolean;
  // Positions where the ordered fold changes the allowance (an officer
  // change adding or removing the Strategist's action).
  changes: { slotNumber: number; allowance: number }[];
  // Why extra empty slots cannot be removed right now, if they cannot.
  removalBlocked: 'upkeep' | 'unknown' | null;
};
export type ActivityView = {
  phase: 'activity';
  ready: boolean;
  occupiedSlots: number;
  allowance: ActivityAllowance;
  slots: (ActivityProjection['slots'][number] & {
    number: number;
    actionName: string | null;
    status: ActivitySlotStatus;
    // Every issue of the choice, requirements first.
    issues: ActivityIssue[];
    warningCount: number;
    removable: boolean;
    // The recorded team reference, its name, or null when it no longer
    // matches any team this Activity knows.
    team: { teamId: string; name: string | null } | null;
    check: ActivityCheck | null;
    modifiers: ActivityRecordedModifier[];
    bonusChoices: ActivityBonusChoice[];
    requirements: string[];
    warnings: string[];
    calculatedCostCopper: number | null;
    exceptions: { exceptionId: string; ruleId: string; reason: string }[];
  })[];
  teamRoster: ActivityTeamFact[];
  // Present while the operating settlement is Helpful.
  helpful: {
    settlementName: string;
    usedIn: { slotId: string; slotNumber: number }[];
  } | null;
  operating: {
    selected: string | null;
    // The recorded settlement is no longer one of the campaign's.
    missing: boolean;
    choices: { value: string; label: string; reputation: string | null }[];
  };
  // Actions an event currently blocks this Activity.
  blockedActions: StagedActionChoice['actionId'][];
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
// Where an Activity or Event result that ended a carried event is edited.
// `anchor` is the DOM id of its slot or occurrence, when it can be found.
export type PersistentSourceLink = {
  phase: 'activity' | 'event';
  anchor: string | null;
};
export type PersistentView = {
  phase: 'persistent';
  ready: boolean;
  firstBuyoff: boolean;
  // "First buyoff available now", "Buyoff available now" or the week the
  // four-week wait ends, from the week-start facts.
  buyoffAvailability: string;
  // Includes buyoffs staged this week; null only without a preview.
  nextBuyoffWeek: number | null;
  // Null while earlier phases leave the rank open: never a guessed cost.
  buyoffCostCopper: number | null;
  // Earlier phases whose open requirements hold Persistent back.
  earlierPhases: Phase[];
  options: EventView['options'];
  events: (WeeklyDraft['context']['carriedEvents'][number] & {
    name: string;
    // The event type's display name, e.g. "Low Morale".
    typeLabel: string;
    ageWeeks: number;
    // The recorded within-week order, e.g. "2nd that week".
    orderLabel: string;
    targetNames: string[];
    decision: WeeklyDraft['persistent']['decisions'][number] | null;
    ended: boolean;
    // Set when a resolved Activity or Event result ended this event: the
    // section then offers no Persistent decision of its own.
    endedBy: { label: string; link: PersistentSourceLink } | null;
    result: { tone: 'ends' | 'stays' | 'attention'; text: string };
    leaveNote: string;
    // Theft's Loyalty check or Rivalry's officer check; null otherwise.
    check: { label: string; note: string } | null;
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
      /** The six-section presentation facts from the live adapter. */
      review: WeekReviewFacts;
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
    };
