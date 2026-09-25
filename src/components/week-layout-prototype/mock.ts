// PROTOTYPE — mock week for Wayfinder #101. Nothing here reads or writes Convex.

export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'summary';
export type Feedback = 'idle' | 'pending' | 'saved' | 'failed' | 'confirming';

export type Knobs = {
  persistentEligible: boolean;
  allReady: boolean;
  feedback: Feedback;
  reviewRequired: boolean;
  remoteEdit: boolean;
  setupNotes: boolean;
};

export const initialKnobs = (): Knobs => ({
  persistentEligible: true,
  allReady: false,
  feedback: 'idle',
  reviewRequired: false,
  remoteEdit: false,
  setupNotes: true,
});

export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Summary',
};

export const phaseOrder: Phase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
];

export const feedbackText: Record<Feedback, string> = {
  idle: 'Prepare the week together.',
  pending: 'Saving changes…',
  saved: 'Changes saved.',
  failed: 'Changes could not be saved. The latest saved values are shown.',
  confirming: 'Confirming the week…',
};

export const setupNotesText =
  'Started mid-campaign at week 11. Treasury includes the 40 gp Ekkerd gift the GM granted outside the rules.';

const requirementsByPhase: Record<Phase, string[]> = {
  upkeep: [],
  activity: [
    'Action Slot 2 (Earn Gold): choose a team',
    'Action Slot 3 (Gather Information): enter the d20 roll',
  ],
  event: ['Enter the event chance roll (d100)'],
  persistent: ['Choose what to do about Theft (week 9)'],
  summary: [],
};

const warningsByPhase: Record<Phase, string[]> = {
  upkeep: ['The attrition Loyalty d20 of 23 is outside the usual range.'],
  activity: [
    'Action Slot 4 is over the action allowance for rank 3.',
    'Recruit Team would leave the treasury below the 50 gp minimum.',
  ],
  event: [],
  persistent: [],
  summary: [],
};

export type Readiness = {
  phase: Phase;
  available: boolean;
  requirements: string[];
  warnings: string[];
  ready: boolean;
};

export function readiness(knobs: Knobs): Readiness[] {
  return phaseOrder.map((phase) => {
    const available = phase !== 'persistent' || knobs.persistentEligible;
    const requirements =
      !available || knobs.allReady
        ? []
        : phase === 'summary'
          ? []
          : requirementsByPhase[phase];
    const warnings = available ? warningsByPhase[phase] : [];
    return { phase, available, requirements, warnings, ready: requirements.length === 0 };
  });
}

export function weekRequirements(knobs: Knobs) {
  return readiness(knobs).flatMap((r) =>
    r.requirements.map((text) => ({ phase: r.phase, text })),
  );
}

export function weekWarnings(knobs: Knobs) {
  return readiness(knobs).flatMap((r) =>
    r.warnings.map((text) => ({ phase: r.phase, text })),
  );
}

export function canConfirm(knobs: Knobs) {
  return (
    weekRequirements(knobs).length === 0 &&
    knobs.feedback !== 'pending' &&
    knobs.feedback !== 'failed' &&
    knobs.feedback !== 'confirming' &&
    !knobs.reviewRequired
  );
}

export function confirmBlocker(knobs: Knobs) {
  const left = weekRequirements(knobs).length;
  if (knobs.feedback === 'confirming') return 'Confirming the week…';
  if (knobs.reviewRequired) return 'Review the updated week first';
  if (left > 0) return `${left} decision${left === 1 ? '' : 's'} left`;
  if (knobs.feedback === 'pending') return 'Review will be ready when your changes are saved';
  if (knobs.feedback === 'failed') return 'Review the latest saved values first';
  return 'Ready to confirm';
}

export type Stat = {
  key: string;
  label: string;
  now: string;
  forecast?: string;
  trend?: 'up' | 'down';
  note?: string;
};

export function militiaStatus(knobs: Knobs): Stat[] {
  return [
    { key: 'rank', label: 'Rank', now: '3' },
    { key: 'training', label: 'Training', now: '42', forecast: '45', trend: 'up' },
    {
      key: 'treasury',
      label: 'Treasury',
      now: '118 gp',
      forecast: '96 gp',
      trend: 'down',
      note: 'min 50 gp',
    },
    { key: 'notoriety', label: 'Notoriety', now: '12', forecast: '14', trend: 'up' },
    { key: 'focus', label: 'Focus', now: 'Secrecy' },
    { key: 'teams', label: 'Teams', now: '5 active', note: '1 disabled · 1 missing' },
    { key: 'slots', label: 'Actions', now: '4 of 3', note: 'Strategist +2 ready' },
    { key: 'event', label: 'Event chance', now: '35%' },
    {
      key: 'persistent',
      label: 'Persistent',
      now: knobs.persistentEligible ? '1 carried' : 'none',
    },
  ];
}

export const reputation = [
  { name: 'Phaendar', value: 18 },
  { name: 'Ekkerd', value: 9 },
  { name: 'Tamran', value: -3 },
];
