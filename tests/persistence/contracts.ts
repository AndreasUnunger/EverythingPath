import type {
  DraftTransport,
  DraftOperation,
  DraftObservation,
} from '../../src/lib/weekly-draft-persistence-contract';
import { DraftTransportFailure } from '../../src/lib/weekly-draft-persistence-contract';
import { createDraftPersistence } from '../../src/lib/weekly-draft-persistence';
import type { WeeklyDraftEdit } from '../../src/lib/weekly-draft-contract';

export type PersistenceContractHarness = {
  first: DraftTransport;
  second: DraftTransport;
  close(this: void): Promise<void>;
  dispose(this: void): Promise<void>;
};
export type PersistenceContractFactory =
  () => Promise<PersistenceContractHarness>;
const roll = (value: number) => ({
  dice: [value],
  sides: 100,
  provenance: { kind: 'table' as const },
  modifiers: [],
});
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function rejects(action: Promise<unknown>, message: string) {
  let rejected = false;
  try {
    await action;
  } catch {
    rejected = true;
  }
  check(rejected, message);
}
function observationAt(transport: DraftTransport, revision: number) {
  const result = deferred<DraftObservation>();
  const stop = transport.subscribe(
    (value) => {
      if (value.revision >= revision) result.resolve(value);
    },
    (error) => {
      throw error;
    },
  );
  return { promise: result.promise, stop };
}

export async function runPersistenceContract(
  createHarness: PersistenceContractFactory,
) {
  async function scenario(
    run: (
      harness: PersistenceContractHarness,
      operation: (
        baseRevision: number,
        edit: WeeklyDraftEdit,
      ) => DraftOperation,
    ) => Promise<void>,
  ) {
    const harness = await createHarness();
    try {
      const initial = await harness.first.read();
      check(
        initial.status === 'open' &&
          initial.revision === 0 &&
          initial.draft?.activity.slots.length === 3,
        'Shared fixture must start at revision zero with three empty slots',
      );
      let id = 0;
      await run(harness, (baseRevision, edit) => ({
        draftId: initial.draftId,
        operationId: `contract-${++id}`,
        baseRevision,
        edit,
      }));
    } finally {
      await harness.dispose();
    }
  }
  await scenario(async ({ first, second, close }, op) => {
    const watcher = observationAt(second, 2);
    try {
      const left = op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: { choiceId: 'a', actionId: 'earn_gold' },
      });
      check(
        (await first.send(left)).acceptedRevision === 1,
        'First edit increments once',
      );
      const right = op(0, {
        kind: 'stage',
        slotId: 'right',
        choice: { choiceId: 'b', actionId: 'earn_gold' },
      });
      check(
        (await second.send(right)).acceptedRevision === 2,
        'Disjoint stale target accepts',
      );
      const shared = await watcher.promise;
      check(
        shared.draft?.activity.slots[0]?.choice?.choiceId === 'a' &&
          shared.draft.activity.slots[1]?.choice?.choiceId === 'b',
        'Both players observe shared accepted state',
      );
      check(
        (await first.send(left)).acceptedRevision === 1 &&
          (await first.read()).revision === 2,
        'Duplicate identity cannot increment again',
      );
      await rejects(
        first.send({
          ...left,
          edit: { kind: 'clear', slotId: 'left', choiceId: 'a' },
        }),
        'Identity reuse with another intent must fail',
      );
      const before = await first.read();
      await rejects(
        second.send(
          op(1, {
            kind: 'swap',
            fromSlotId: 'left',
            toSlotId: 'right',
            choiceId: 'a',
            otherChoiceId: 'b',
          }),
        ),
        'Swap must reject if either target changed',
      );
      check(
        JSON.stringify(await first.read()) === JSON.stringify(before),
        'Rejected atomic operation cannot change either target',
      );
      await close();
      check(
        (await first.send(left)).acceptedRevision === 1,
        'Lost acknowledgement retry remains deduplicated after close',
      );
      await rejects(
        first.send(op(2, { kind: 'clear', slotId: 'left', choiceId: 'a' })),
        'Closed draft cannot accept a new edit',
      );
    } finally {
      watcher.stop();
    }
  });
  await scenario(async ({ first, second }, op) => {
    const choice = { choiceId: 'a', actionId: 'earn_gold' as const };
    await first.send(op(0, { kind: 'stage', slotId: 'left', choice }));
    await first.send(
      op(1, {
        kind: 'detail',
        slotId: 'left',
        choiceId: 'a',
        choice: { ...choice, costCopper: 12 },
      }),
    );
    await second.send(
      op(1, {
        kind: 'detail',
        slotId: 'left',
        choiceId: 'a',
        choice: { ...choice, rolls: { check: roll(10) } },
      }),
    );
    const result = (await first.read()).draft?.activity.slots[0]?.choice;
    check(
      result?.costCopper === 12 && result.rolls?.check?.dice[0] === 10,
      'Disjoint detail fields merge without dropping accepted changes',
    );
    const before = await first.read();
    await rejects(
      second.send(
        op(1, {
          kind: 'detail',
          slotId: 'left',
          choiceId: 'a',
          choice: { ...choice, costCopper: 18 },
        }),
      ),
      'Same detail conflicts',
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'replace',
          slotId: 'left',
          choiceId: 'a',
          choice: { choiceId: 'replacement', actionId: 'earn_gold' },
        }),
      ),
      'Whole choice conflicts with changed detail',
    );
    check(
      JSON.stringify(await first.read()) === JSON.stringify(before),
      'Failed details leave accepted state intact',
    );
    await first.send(
      op(3, {
        kind: 'replace',
        slotId: 'left',
        choiceId: 'a',
        choice: { choiceId: 'replacement', actionId: 'earn_gold' },
      }),
    );
    await rejects(
      second.send(
        op(3, {
          kind: 'detail',
          slotId: 'left',
          choiceId: 'a',
          choice: { ...choice, costCopper: 20 },
        }),
      ),
      'Same-action replacement invalidates old choice identity',
    );
  });
  await scenario(async ({ first }) => {
    let attempts = 0;
    const sent: DraftOperation[] = [];
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        attempts++;
        sent.push(structuredClone(operation));
        const receipt = await first.send(operation);
        if (attempts === 1)
          throw new DraftTransportFailure('Acknowledgement dropped');
        return receipt;
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      check(
        (await adapter.edit({ kind: 'event_chance', roll: roll(24) })) ===
          'accepted',
        'Dropped acknowledgement recovers',
      );
      check(
        attempts === 2 && JSON.stringify(sent[0]) === JSON.stringify(sent[1]),
        'Retry preserves exact operation identity and payload',
      );
      check(
        (await first.read()).revision === 1,
        'Dropped response increments once',
      );
      check(
        (await adapter.edit({
          kind: 'clear',
          slotId: 'left',
          choiceId: 'missing',
        })) === 'failed',
        'Server rejection surfaces failure',
      );
      check(Number(attempts) === 3, 'Server rejection must not retry');
    } finally {
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second }, op) => {
    const entered = deferred<void>();
    const release = deferred<void>();
    let calls = 0;
    const acknowledgements: number[] = [];
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        calls++;
        if (calls === 1) {
          entered.resolve();
          await release.promise;
        }
        return await first.send(operation);
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      const one = adapter
        .edit({ kind: 'event_chance', roll: roll(15) })
        .then((result) => {
          acknowledgements.push(1);
          return result;
        });
      const two = adapter
        .edit({ kind: 'event_chance', roll: roll(25) })
        .then((result) => {
          acknowledgements.push(2);
          return result;
        });
      await entered.promise;
      check(
        adapter.getSnapshot().pending === 2 && calls === 1,
        'Pending acknowledgement is immediate and dispatch ordered',
      );
      release.resolve();
      check(
        (await one) === 'accepted' && (await two) === 'accepted',
        'Rapid same-field local edits process as sequential intents',
      );
      check(
        acknowledgements.join(',') === '1,2' &&
          (await first.read()).draft?.event.chanceRoll?.dice[0] === 25,
        'Acknowledgements and final outcome follow submission order',
      );
      const remote = await second.send(
        op(2, { kind: 'event_chance', roll: roll(35) }),
      );
      check(
        remote.acceptedRevision === 3,
        'Second player can continue editing',
      );
    } finally {
      release.resolve();
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second }, op) => {
    const committed = deferred<void>();
    const release = deferred<void>();
    let calls = 0;
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        calls++;
        const receipt = await first.send(operation);
        if (calls === 1) {
          committed.resolve();
          await release.promise;
        }
        return receipt;
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      const initial = adapter.getSnapshot().observation!;
      const firstEdit = adapter.edit({ kind: 'event_chance', roll: roll(15) });
      const queued = adapter.edit({ kind: 'event_chance', roll: roll(25) });
      await committed.promise;
      const remoteObserved = observationAt(first, 2);
      try {
        await second.send(op(1, { kind: 'event_chance', roll: roll(35) }));
        await remoteObserved.promise;
      } finally {
        remoteObserved.stop();
      }
      release.resolve();
      check(
        (await firstEdit) === 'accepted' && (await queued) === 'failed',
        'Queued remote conflict must fail instead of overwriting',
      );
      check(
        adapter.getSnapshot().observation?.revision === 2 &&
          (await first.read()).draft?.event.chanceRoll?.dice[0] === 35,
        'Old acknowledgement must not regress remote observation',
      );
      check(
        initial.revision === 0,
        'Published observations are immutable values',
      );
    } finally {
      release.resolve();
      adapter.dispose();
    }
  });
  await scenario(async ({ first, second }, op) => {
    await first.send(
      op(0, {
        kind: 'event_tree',
        occurrences: [
          {
            eventId: 'buyoff-target',
            origin: { kind: 'rolled' },
            eventType: 'theft',
            persistent: true,
          },
        ],
      }),
    );
    await first.send(
      op(1, {
        kind: 'persistent_decision',
        decision: { kind: 'buyoff', eventId: 'buyoff-target' },
      }),
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'persistent_decision',
          decision: { kind: 'unattempted', eventId: 'buyoff-target' },
        }),
      ),
      'Stale same-event decision cannot overwrite staged buyoff',
    );
    const accepted = await second.read();
    check(
      accepted.revision === 2 &&
        accepted.draft?.event.occurrences[0]?.persistentDecision?.kind === 'buyoff',
      'Both players retain the accepted buyoff without a second revision',
    );
  });

  await scenario(async ({ first, second }, op) => {
    const event = {
      eventId: 'persistent',
      origin: { kind: 'rolled' as const },
      eventType: 'theft' as const,
      persistent: true,
    };
    await first.send(op(0, { kind: 'event_tree', occurrences: [event] }));
    await first.send(
      op(1, {
        kind: 'persistent_decision',
        decision: { kind: 'unattempted', eventId: event.eventId },
      }),
    );
    await rejects(
      second.send(op(1, { kind: 'event_tree', occurrences: [event] })),
      'Whole event tree conflicts with nested decision',
    );
    await first.send(op(2, { kind: 'event_tree', occurrences: [event] }));
    await rejects(
      second.send(
        op(2, {
          kind: 'persistent_decision',
          decision: { kind: 'mitigate', eventId: event.eventId },
        }),
      ),
      'Nested decision conflicts with replaced event tree',
    );
    const choice = {
      choiceId: 'guarantee',
      actionId: 'guarantee_event' as const,
      selectedEventId: 'candidate',
      candidates: [{ ...event, eventId: 'candidate' }],
    };
    await first.send(op(3, { kind: 'stage', slotId: 'left', choice }));
    await second.send(
      op(4, {
        kind: 'persistent_decision',
        decision: { kind: 'mitigate', eventId: 'candidate' },
      }),
    );
    await rejects(
      first.send(
        op(4, {
          kind: 'move',
          fromSlotId: 'left',
          toSlotId: 'right',
          choiceId: choice.choiceId,
        }),
      ),
      'Atomic move conflicts with nested candidate decision',
    );
    check(
      (await first.read()).draft?.activity.slots[1]?.choice === null,
      'Failed move leaves destination empty',
    );
    await first.send(
      op(5, {
        kind: 'move',
        fromSlotId: 'left',
        toSlotId: 'right',
        choiceId: choice.choiceId,
      }),
    );
    await rejects(
      second.send(
        op(5, {
          kind: 'persistent_decision',
          decision: { kind: 'unattempted', eventId: 'candidate' },
        }),
      ),
      'Candidate decision cannot follow an obsolete owner slot',
    );
  });

  await scenario(async ({ first }, op) => {
    const before = await first.read();
    await rejects(
      first.send(
        op(0, {
          kind: 'stage',
          slotId: 'left',
          choice: {
            choiceId: 'foreign',
            actionId: 'rescue_character',
            characterId: 'outside-campaign',
          },
        }),
      ),
      'Foreign entity cannot enter shared source',
    );
    check(
      JSON.stringify(await first.read()) === JSON.stringify(before),
      'Rejected references do not advance revision',
    );
    await first.send(
      op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: { choiceId: 'a', actionId: 'earn_gold' },
      }),
    );
    await first.send(
      op(1, {
        kind: 'stage',
        slotId: 'right',
        choice: { choiceId: 'b', actionId: 'lie_low' },
      }),
    );
    await first.send(
      op(2, {
        kind: 'swap',
        fromSlotId: 'left',
        toSlotId: 'right',
        choiceId: 'a',
        otherChoiceId: 'b',
      }),
    );
    const swapped = await first.read();
    check(
      swapped.revision === 3 &&
        swapped.draft?.activity.slots[0]?.choice?.choiceId === 'b' &&
        swapped.draft.activity.slots[1]?.choice?.choiceId === 'a',
      'Swap commits both slots in exactly one revision',
    );
    await first.send(op(3, { kind: 'clear', slotId: 'left', choiceId: 'b' }));
    await first.send(
      op(4, {
        kind: 'move',
        fromSlotId: 'right',
        toSlotId: 'left',
        choiceId: 'a',
      }),
    );
    const moved = await first.read();
    check(
      moved.revision === 5 &&
        moved.draft?.activity.slots[0]?.choice?.choiceId === 'a' &&
        moved.draft.activity.slots[1]?.choice === null,
      'Move atomically preserves choice identity',
    );
  });
  await scenario(async ({ first }) => {
    const entered = deferred<void>();
    const release = deferred<void>();
    let calls = 0;
    const controlled: DraftTransport = {
      ...first,
      async send(operation) {
        if (++calls === 1) {
          entered.resolve();
          await release.promise;
        }
        return await first.send(operation);
      },
    };
    const adapter = createDraftPersistence(controlled);
    try {
      await adapter.ready;
      const staged = { choiceId: 'scout', actionId: 'special' as const };
      const replacement = {
        choiceId: 'new-scout',
        actionId: 'special' as const,
      };
      const edits = [
        adapter.edit({ kind: 'stage', slotId: 'left', choice: staged }),
        adapter.edit({
          kind: 'detail',
          slotId: 'left',
          choiceId: staged.choiceId,
          choice: { ...staged, instruction: 'Scout ruins', costCopper: 0 },
        }),
        adapter.edit({
          kind: 'replace',
          slotId: 'left',
          choiceId: staged.choiceId,
          choice: replacement,
        }),
        adapter.edit({
          kind: 'detail',
          slotId: 'left',
          choiceId: replacement.choiceId,
          choice: { ...replacement, instruction: 'Scout road', costCopper: 10 },
        }),
        adapter.edit({
          kind: 'move',
          fromSlotId: 'left',
          toSlotId: 'right',
          choiceId: replacement.choiceId,
        }),
        adapter.edit({
          kind: 'detail',
          slotId: 'right',
          choiceId: replacement.choiceId,
          choice: { ...replacement, instruction: 'Scout road', costCopper: 0 },
        }),
        adapter.edit({
          kind: 'detail',
          slotId: 'right',
          choiceId: replacement.choiceId,
          choice: { ...replacement, instruction: 'Scout ruins' },
        }),
      ];
      await entered.promise;
      release.resolve();
      check(
        (await Promise.all(edits)).every((result) => result === 'accepted'),
        'Queued stage/replace/move details and clearing a pending field must all accept in order',
      );
      const result = await first.read();
      const choice = result.draft?.activity.slots[1]?.choice;
      check(
        result.revision === 7 &&
          result.draft?.activity.slots[0]?.choice === null &&
          choice?.actionId === 'special' &&
          choice.instruction === 'Scout ruins' &&
          choice.costCopper === undefined,
        'Pending local choices preserve the final entered detail values',
      );
    } finally {
      release.resolve();
      adapter.dispose();
    }
  });
  await scenario(async ({ first }, op) => {
    await first.send(
      op(0, {
        kind: 'stage',
        slotId: 'left',
        choice: {
          choiceId: 'recruit',
          actionId: 'recruit_team',
          teamType: 'informants',
        },
      }),
    );
    await first.send(
      op(1, {
        kind: 'table_adjustments',
        adjustments: [
          {
            kind: 'team_status',
            adjustmentId: 'injured',
            teamId: 'recruit:recruit',
            status: 'disabled',
            reason: 'New team arrived injured',
          },
        ],
      }),
    );
    await first.send(
      op(2, {
        kind: 'stage',
        slotId: 'right',
        choice: {
          choiceId: 'dismiss',
          actionId: 'dismiss_team',
          targetTeamId: 'recruit:recruit',
        },
      }),
    );
    await rejects(
      first.send(
        op(3, {
          kind: 'swap',
          fromSlotId: 'left',
          toSlotId: 'right',
          choiceId: 'recruit',
          otherChoiceId: 'dismiss',
        }),
      ),
      'A reference cannot precede the Activity choice creating its identity',
    );
    check(
      (await first.read()).revision === 3,
      'Partial ordered draft-created references stage without allowing future references',
    );
  });
  await scenario(async ({ first, second }, op) => {
    let revision = 0;
    const acknowledge = (id: string): WeeklyDraftEdit => ({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: id,
        subjectId: 'table',
        outcome: 'Recorded at table',
      },
    });
    const exception = (id: string): WeeklyDraftEdit => ({
      kind: 'rules_exception',
      exception: {
        exceptionId: id,
        subjectId: 'table',
        ruleId: 'homebrew',
        reason: 'Agreed at table',
      },
    });
    const staleAck = op(0, acknowledge('original-ack'));
    const staleException = op(0, exception('original-exception'));
    for (let index = 0; index < 9; index++) {
      const ackId = index === 0 ? 'original-ack' : `later-ack-${index}`;
      const exceptionId =
        index === 0 ? 'original-exception' : `later-exception-${index}`;
      for (const edit of [
        acknowledge(ackId),
        { kind: 'clear_acknowledgement' as const, acknowledgementId: ackId },
        exception(exceptionId),
        { kind: 'clear_rules_exception' as const, exceptionId },
      ]) {
        await first.send(op(revision++, edit));
      }
    }
    const before = await second.read();
    check(
      before.revision === 36 &&
        before.draft?.acknowledgements.length === 0 &&
        before.draft.rulesExceptions.length === 0,
      'Repeated create/clear leaves empty current input collections',
    );
    check(
      before.targetRevisions.length >= 18,
      'Transport hydrates conflict tombstones across multiple target pages',
    );
    await rejects(
      second.send(staleAck),
      'Cleared acknowledgement tombstone prevents stale recreation',
    );
    await rejects(
      second.send(staleException),
      'Cleared exception tombstone prevents stale recreation',
    );
    check(
      JSON.stringify(await second.read()) === JSON.stringify(before),
      'Stale recreation must not change accepted source',
    );
  });
  await scenario(async ({ first, second }, op) => {
    await first.send(
      op(0, {
        kind: 'upkeep_roll',
        field: 'check',
        roll: {
          dice: [0],
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    );
    await second.send(
      op(0, {
        kind: 'upkeep_roll',
        field: 'training',
        roll: {
          dice: [3],
          sides: 6,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    );
    let current = await first.read();
    check(
      current.draft?.upkeep.rolls.check?.dice[0] === 0 &&
        current.draft.upkeep.rolls.training?.dice[0] === 3,
      'Disjoint focused Upkeep rolls coexist and zero remains entered',
    );
    await rejects(
      second.send(op(0, { kind: 'upkeep_roll', field: 'check', roll: null })),
      'Stale focused clear cannot erase another player roll',
    );
    await first.send(
      op(2, { kind: 'upkeep_roll', field: 'check', roll: null }),
    );
    current = await second.read();
    check(
      current.draft?.upkeep.rolls.check === undefined &&
        current.draft?.upkeep.rolls.training?.dice[0] === 3,
      'Explicit clear removes only its roll',
    );
  });
  await scenario(async ({ first, second }, op) => {
    const firstEvent = {
      eventId: 'first-event',
      origin: { kind: 'rolled' as const },
    };
    const secondEvent = {
      eventId: 'second-event',
      origin: { kind: 'replacement' as const, parentEventId: 'first-event' },
    };
    await first.send(
      op(0, { kind: 'event_tree', occurrences: [firstEvent, secondEvent] }),
    );
    await first.send(
      op(1, {
        kind: 'event_occurrence',
        occurrence: { ...firstEvent, tableRoll: roll(50) },
      }),
    );
    await second.send(
      op(1, {
        kind: 'event_occurrence',
        occurrence: { ...secondEvent, tableRoll: roll(45) },
      }),
    );
    const observed = await first.read();
    check(
      observed.draft?.event.occurrences[0]?.tableRoll?.dice[0] === 50 &&
        observed.draft.event.occurrences[1]?.tableRoll?.dice[0] === 45,
      'Disjoint stale occurrence inputs coexist',
    );
    await rejects(
      second.send(
        op(1, {
          kind: 'event_occurrence',
          occurrence: { ...firstEvent, tableRoll: roll(46) },
        }),
      ),
      'Same occurrence rejects stale inputs',
    );
    await rejects(
      second.send(op(1, { kind: 'event_tree', occurrences: [] })),
      'Stale tree removal cannot erase accepted occurrence inputs',
    );
    await first.send(op(3, { kind: 'event_tree', occurrences: [] }));
    await rejects(
      second.send(
        op(3, {
          kind: 'event_occurrence',
          occurrence: { ...secondEvent, tableRoll: roll(47) },
        }),
      ),
      'A removed occurrence cannot be resurrected',
    );
    await first.send(
      op(4, {
        kind: 'stage',
        slotId: 'left',
        choice: {
          choiceId: 'event-choice',
          actionId: 'guarantee_event',
          candidates: [firstEvent],
        },
      }),
    );
    await first.send(
      op(5, {
        kind: 'event_occurrence',
        occurrence: { ...firstEvent, tableRoll: roll(45) },
      }),
    );
    const choice = (await second.read()).draft?.activity.slots[0]?.choice;
    check(
      choice?.actionId === 'guarantee_event' &&
        choice.candidates?.[0]?.tableRoll?.dice[0] === 45,
      'Occurrence edits retain Activity ownership',
    );
    await rejects(
      second.send(
        op(5, {
          kind: 'detail',
          slotId: 'left',
          choiceId: 'event-choice',
          choice: {
            choiceId: 'event-choice',
            actionId: 'guarantee_event',
            candidates: [],
          },
        }),
      ),
      'Candidate replacement conflicts with edited occurrences',
    );
    await first.send(
      op(6, {
        kind: 'move',
        fromSlotId: 'left',
        toSlotId: 'right',
        choiceId: 'event-choice',
      }),
    );
    await rejects(
      second.send(
        op(6, {
          kind: 'event_occurrence',
          occurrence: { ...firstEvent, tableRoll: roll(46) },
        }),
      ),
      'Delayed occurrence edits conflict with owner movement',
    );
  });
}
