import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { pair } from '../../../tests/rules/event-selection-fixture';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import {
  derivePhaseReadiness,
  phaseNavigation,
  confirmationDisabledReason,
} from './phase-readiness';

function facts({ draft, snapshot } = upkeepFixture()) {
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return { draft, source, preview };
}

test('phase decisions count unique identities while retaining identical messages', () => {
  const { draft, source, preview } = facts();
  preview.phases!.event.requirements = [
    'event:first:outcome',
    'event:first:outcome',
    'event:second:outcome',
  ];
  const { phases } = derivePhaseReadiness(draft, source, preview);
  const event = phases.find((item) => item.phase === 'event')!;
  expect(event.requirements).toEqual([
    { id: 'event:first:outcome', message: 'Event: Record the event outcome.' },
    { id: 'event:second:outcome', message: 'Event: Record the event outcome.' },
  ]);
  expect(event.ready).toBe(false);
});

test('phase warnings keep their identities and do not prevent ready decisions', () => {
  const { draft, source, preview } = facts();
  preview.phases!.event.ready = true;
  preview.phases!.event.requirements = [];
  preview.phases!.event.warnings = [
    'event:first:roll-range',
    'event:first:roll-range',
    'event:second:roll-range',
  ];
  const event = derivePhaseReadiness(draft, source, preview).phases.find(
    (item) => item.phase === 'event',
  )!;
  expect(event.ready).toBe(true);
  expect(event.requirements).toEqual([]);
  expect(event.warnings).toEqual([
    {
      id: 'event:first:roll-range',
      message:
        'Event: The roll is outside its usual range. The recorded value is retained for the table.',
    },
    {
      id: 'event:second:roll-range',
      message:
        'Event: The roll is outside its usual range. The recorded value is retained for the table.',
    },
  ]);
});

test('navigation keeps the locked Persistent position but skips it without wrapping', () => {
  const { draft, source, preview } = facts();
  const { phases } = derivePhaseReadiness(draft, source, preview);
  expect(phases.map(({ phase }) => phase)).toEqual([
    'upkeep',
    'activity',
    'event',
    'persistent',
    'summary',
  ]);
  expect(phases.find(({ phase }) => phase === 'persistent')!.available).toBe(
    false,
  );
  expect(phaseNavigation('event', phases)).toEqual({
    previous: 'activity',
    next: 'summary',
  });
  expect(phaseNavigation('summary', phases)).toEqual({
    previous: 'event',
    next: null,
  });
  expect(phaseNavigation('upkeep', phases)).toEqual({
    previous: null,
    next: 'activity',
  });
  // Eligibility is a start-of-week fact, independent of the projected endings.
  const eligibleDraft = {
    ...draft,
    context: { ...draft.context, persistentPhaseEligible: true },
  };
  const eligible = derivePhaseReadiness(eligibleDraft, source, preview).phases;
  expect(phaseNavigation('event', eligible)).toEqual({
    previous: 'activity',
    next: 'persistent',
  });
  expect(phaseNavigation('persistent', eligible)).toEqual({
    previous: 'event',
    next: 'summary',
  });
});

test.each([
  [{ confirming: true, reviewRequired: true }, 'Confirming the week…'],
  [
    { reviewRequired: true, forecastPending: true, pendingWork: true },
    'Review the updated week before confirming.',
  ],
  [
    { forecastPending: true },
    'Review will be ready when your changes are saved.',
  ],
  [{ pendingWork: true }, 'Review will be ready when your changes are saved.'],
  [{ canConfirm: true }, null],
  [{ decisions: 1 }, '1 decision left'],
  [{ decisions: 2 }, '2 decisions left'],
  [{}, 'Review the updated week before confirming.'],
])(
  'Summary disabled reason respects accepted review state %j',
  (state, expected) => {
    expect(
      confirmationDisabledReason({
        confirming: false,
        reviewRequired: false,
        forecastPending: false,
        pendingWork: false,
        canConfirm: false,
        decisions: 0,
        ...state,
      }),
    ).toBe(expected);
  },
);

test('Persistent availability stays fixed when carried events end or new events arise', () => {
  const fixture = persistentEventFixture('double_agent');
  fixture.draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  const ended = facts(fixture);
  expect(ended.preview.phases!.persistent.persistentEvents).toEqual([]);
  expect(
    derivePhaseReadiness(ended.draft, ended.source, ended.preview).phases.find(
      (item) => item.phase === 'persistent',
    )!.available,
  ).toBe(true);

  fixture.draft.context = {
    ...fixture.draft.context,
    carriedEvents: [],
    persistentPhaseEligible: false,
  };
  fixture.draft.persistent.decisions = [];
  fixture.draft.event.occurrences = pair(98);
  const newlyCreated = facts(fixture);
  expect(newlyCreated.preview.phases!.persistent.persistentEvents).toHaveLength(
    1,
  );
  expect(
    derivePhaseReadiness(
      newlyCreated.draft,
      newlyCreated.source,
      newlyCreated.preview,
    ).phases.find((item) => item.phase === 'persistent')!.available,
  ).toBe(false);
});

test('the first militia week reports Upkeep as skipped with nothing to decide', () => {
  const fixture = upkeepFixture();
  fixture.draft.context = { ...fixture.draft.context, firstMilitiaWeek: true };
  fixture.snapshot.notoriety = 100;
  const { draft, source, preview } = facts(fixture);
  const upkeep = derivePhaseReadiness(draft, source, preview).phases[0]!;
  expect(upkeep).toMatchObject({
    phase: 'upkeep',
    skipped: true,
    ready: true,
    requirements: [],
  });
  const ordinary = facts();
  expect(
    derivePhaseReadiness(ordinary.draft, ordinary.source, ordinary.preview)
      .phases[0]!.skipped,
  ).toBe(false);
});

test('Upkeep decisions read as the current choices, without the retired Remove option', () => {
  const fixture = upkeepFixture();
  fixture.snapshot.treasuryCopper = 1000;
  fixture.snapshot.notoriety = 100;
  fixture.snapshot.roster.teams.push(
    {
      teamId: 'scouts',
      teamType: 'patrons',
      name: 'Scouts',
      status: 'disabled',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
    {
      teamId: 'riders',
      teamType: 'patrons',
      name: 'Riders',
      status: 'disabled',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
  );
  fixture.draft.upkeep.teamDecisions = [
    { teamId: 'riders', decision: 'remove' },
  ];
  const { draft, source, preview } = facts(fixture);
  const upkeep = derivePhaseReadiness(draft, source, preview).phases[0]!;
  const message = (id: string) =>
    upkeep.requirements.find((item) => item.id === id)?.message;
  expect(message('team:scouts:recovery-decision')).toBe(
    'Scouts: Choose whether to recover this disabled team or leave it disabled.',
  );
  expect(message('team:riders:removal-exception')).toBe(
    'Riders: A staged Remove choice is no longer offered in Upkeep. Clear it in Upkeep, or remove the team in Militia corrections.',
  );
  expect(message('upkeep:notoriety:roll')).toBe(
    'Upkeep: Enter the Notoriety Loyalty roll.',
  );
  expect(message('upkeep:shortage:roll')).toBe(
    'Upkeep: Enter the treasury-shortage training roll.',
  );
});
