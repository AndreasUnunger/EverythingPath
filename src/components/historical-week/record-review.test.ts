import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  confirmedWeek,
  legacyRecord,
} from '../../../tests/history/resolution-record-fixtures';
import type {
  ResultCell,
  ReviewItem,
  WeekReviewFacts,
} from '~/components/week-review/review-facts';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { phaseView } from '../weekly-draft-workspace/phase-view';
import { recordWeekReview } from './record-review';

function liveReview(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Aubrin' },
      { characterId: 'strategist', name: 'Kasvarina' },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('summary', draft, source, preview);
  if (view.phase !== 'summary') throw new Error('Expected Summary');
  return view.review;
}

const items = (facts: WeekReviewFacts, index: number) =>
  facts.sections[index]!.items;
const item = (facts: WeekReviewFacts, index: number, title: string) => {
  const found = items(facts, index).find((entry) => entry.title === title);
  if (!found)
    throw new Error(
      `No "${title}" in ${items(facts, index)
        .map((entry) => entry.title)
        .join(', ')}`,
    );
  return found;
};
const notes = (entry: ReviewItem) =>
  entry.notes.map((note) =>
    note.kind === 'warning'
      ? note.message
      : note.kind === 'outcome'
        ? note.text
        : note.reason,
  );
const cellKey = (cell: ResultCell) =>
  cell.kind === 'value' ? `value:${cell.key}` : cell.kind;
const row = (facts: WeekReviewFacts, group: string, label: string) => {
  const found = facts.result.rows.find(
    (entry) => entry.group === group && entry.label === label,
  );
  if (!found) throw new Error(`No ${group} · ${label} row`);
  return found;
};

/** Everything a player can read in the facts, for opaque-identity checks. */
function visibleText(facts: WeekReviewFacts) {
  return [
    ...facts.sections.flatMap((section) => [
      section.title,
      section.statusText ?? '',
      ...section.chips,
      ...section.items.flatMap((entry) => [
        entry.title,
        ...entry.details,
        ...entry.effects.map((effect) => effect.text),
        ...notes(entry),
        ...entry.notes.flatMap((note) =>
          note.kind === 'exception' ? [note.rule] : [],
        ),
      ]),
    ]),
    ...facts.unassociated.map((note) =>
      note.kind === 'warning'
        ? note.message
        : note.kind === 'outcome'
          ? note.text
          : `${note.rule} ${note.reason}`,
    ),
    ...facts.adjustments.flatMap((entry) => [
      entry.kind,
      entry.effect,
      entry.reason,
    ]),
    ...facts.result.rows.flatMap((entry) =>
      [entry.now, entry.baseline, entry.final].map((cell) =>
        cell.kind === 'unavailable' ? (cell.text ?? '') : cell.text,
      ),
    ),
    ...facts.result.rows.flatMap((entry) => [entry.group, entry.label]),
  ].join('\n');
}

describe('[HIST-05] frozen Resolution Record adapter', () => {
  test('[rules.HIST-05.frozen-parity] a confirmed record tells the same six-section story as the live review of the week it recorded', () => {
    const { draft, snapshot, record } = confirmedWeek();
    const live = liveReview(draft, snapshot);
    const frozen = recordWeekReview(record);
    expect(frozen.mode).toBe('record');
    const shape = (facts: WeekReviewFacts) =>
      facts.sections.map((section) => ({
        number: section.number,
        title: section.title,
        status: section.status,
        chips: section.chips,
        // Effect keys name each consequence's subject and plan position.
        effects: section.items.flatMap((entry) =>
          entry.effects.map((effect) => effect.key),
        ),
        outcomes: section.items.flatMap((entry) =>
          entry.notes.flatMap((note) =>
            note.kind === 'outcome' ? [`${entry.key}:${note.text}`] : [],
          ),
        ),
        exceptions: section.items.flatMap((entry) =>
          entry.notes.flatMap((note) =>
            note.kind === 'exception'
              ? [`${entry.key}:${note.exceptionId}:${note.reason}`]
              : [],
          ),
        ),
      }));
    expect(shape(frozen)).toEqual(shape(live));
    expect(
      frozen.adjustments.map(({ notes: _notes, ...entry }) => entry),
    ).toEqual(live.adjustments.map(({ notes: _notes, ...entry }) => entry));
    const messages = (facts: WeekReviewFacts) =>
      facts.adjustments.flatMap((entry) =>
        entry.notes.map((note) =>
          note.kind === 'warning' ? note.message : '',
        ),
      );
    expect(messages(frozen)).toEqual(messages(live));
    expect(messages(frozen)).toEqual([
      'Table Adjustment: The officer was rescued',
    ]);
    // The same Result: rows, and every column's recorded value.
    const columns = (facts: WeekReviewFacts) =>
      facts.result.rows.map((entry) => ({
        key: entry.key,
        now: cellKey(entry.now),
        baseline: cellKey(entry.baseline),
        final: cellKey(entry.final),
        changed: entry.changed,
        finalDiffers: entry.finalDiffers,
      }));
    expect(columns(frozen)).toEqual(columns(live));
    expect(frozen.result).toMatchObject({
      complete: true,
      nextWeek: live.result.nextWeek,
    });
  });

  test('[rules.HIST-05.frozen-names] record-local names, officers at confirmation and recorded week context, with no opaque identities', () => {
    const { record } = confirmedWeek();
    const facts = recordWeekReview(record);
    // The record stores no character names: they stay distinct by number.
    expect(item(facts, 0, 'Treasury deposit · Character 2').effects).toEqual([
      expect.objectContaining({ text: 'Treasury +7 gp' }),
    ]);
    expect(
      item(facts, 1, 'Slot 1 · Change Officer Role').effects.map((e) => e.text),
    ).toEqual(['Character 1 becomes Ambassador · Character 1 leaves Overseer']);
    // The event's recorded type names it alongside its Event phase label.
    expect(items(facts, 2).map((entry) => entry.title)).toEqual([
      'Event chance',
      'Event 1 · Calm before the Storm',
    ]);
    expect(item(facts, 2, 'Event 1 · Calm before the Storm').details).toEqual([
      'Table roll: dice 54 (1d100)',
    ]);
    expect(row(facts, 'Officers', 'Ambassador')).toMatchObject({
      now: { kind: 'absent' },
      final: { kind: 'value', text: 'Character 1' },
    });
    expect(row(facts, 'Officers', 'Strategist').now).toMatchObject({
      text: 'Character 2',
    });
    expect(row(facts, 'Next week', 'Operating from')).toMatchObject({
      final: { kind: 'value', text: 'Town' },
    });
    expect(
      row(facts, 'Next week', 'Uneventful-week benefit').now,
    ).toMatchObject({ text: 'No' });
    expect(row(facts, 'Next week', 'Skip first Upkeep').now).toMatchObject({
      text: 'No',
    });
    expect(visibleText(facts)).not.toMatch(
      /\b(rescuers-permission|rescue-done|wand-available|storm|old-event|gear|role-slot|strategist|pc|id-transfer)\b/,
    );
  });

  test('[rules.HIST-05.frozen-legacy] an older record without a source snapshot stays readable from its own loose facts and says what was not recorded', () => {
    const facts = recordWeekReview(legacyRecord());
    expect(facts.result.nextWeek).toBe(10);
    expect(facts.result.complete).toBe(false);
    // No source snapshot: militia values at confirmation were not recorded,
    // while the recorded week context still is.
    expect(row(facts, 'Militia', 'Treasury')).toMatchObject({
      now: { kind: 'unavailable', text: 'Not recorded' },
      baseline: { kind: 'value', text: '5 gp' },
      final: { kind: 'value', text: '4.93 gp' },
      finalDiffers: true,
      difference:
        'Table Adjustments change the Rules Baseline 5 gp to 4.93 gp.',
    });
    expect(row(facts, 'Militia', 'Training')).toMatchObject({
      now: { kind: 'unavailable' },
      changed: false,
    });
    expect(row(facts, 'Next week', 'Uneventful-week benefit')).toMatchObject({
      now: { text: 'Yes' },
      baseline: { kind: 'unavailable', text: 'Not recorded' },
      final: { text: 'No' },
    });
    expect(row(facts, 'Next week', 'Operating from').final).toMatchObject({
      text: 'Settlement 1',
    });
    // A loose older fact is kept under Show all; its absence from another
    // artifact is not recorded, so it is never presented as a change.
    expect(row(facts, 'Recorded facts', 'Note')).toMatchObject({
      baseline: { kind: 'unavailable', text: 'Not recorded' },
      final: { text: 'Reconstructed from the table log' },
      changed: false,
      difference: null,
    });
    // Without a Rules Baseline the ended event still reads as a change.
    expect(row(facts, 'Persistent events', 'Sickness · Event 1')).toMatchObject(
      {
        now: { kind: 'value' },
        baseline: { kind: 'unavailable' },
        final: { kind: 'absent', text: 'Not carried' },
        changed: true,
        finalDiffers: false,
      },
    );
    // Rows keep their groups together whichever column records them first.
    expect([...new Set(facts.result.rows.map((entry) => entry.group))]).toEqual(
      ['Militia', 'Next week', 'Persistent events', 'Recorded facts'],
    );
    // Plans this format never kept are not invented; recorded inputs remain.
    expect(facts.sections.map((section) => section.status)).toEqual([
      'incomplete',
      'incomplete',
      'incomplete',
      'complete',
    ]);
    expect(item(facts, 0, 'Team 1').details).toEqual([
      'Recover · recorded cost 15 gp',
    ]);
    expect(item(facts, 0, 'Training attrition').details).toEqual([
      'Loyalty check roll: dice 14 (1d20) · +2 Drill bonus',
      'Training loss roll: dice 3, 4 (2d4)',
    ]);
    expect(item(facts, 0, 'Treasury deposit · Character 1').details).toEqual([
      'Recorded amount 7 gp',
    ]);
    const gold = item(facts, 1, 'Slot 1 · Earn Gold · Team 1');
    expect(gold.details).toEqual([
      'Check roll: dice 11 (1d20)',
      'Recorded cost 2.5 gp',
    ]);
    expect(notes(gold)).toEqual(['The scouts worked while recovering']);
    // A missing subject's exception stays in its phase, without repair advice.
    expect(items(facts, 1).at(-1)).toMatchObject({
      missing: true,
      notes: [
        expect.objectContaining({
          reason: 'An extra day was allowed then',
          obsolete: false,
        }),
      ],
    });
    // The older Event tree records each occurrence's own type.
    expect(items(facts, 2).map((entry) => entry.title)).toEqual([
      'Event chance',
      'Event 1 · Roll Twice',
      'Event 1.1 · War Games',
      'Event 1.2 · Festival',
    ]);
    expect(item(facts, 2, 'Event chance').details).toEqual([
      'Operating from Settlement 1',
    ]);
    expect(notes(item(facts, 2, 'Event 1.2 · Festival'))).toEqual([
      'The town feasted with the militia',
    ]);
    // Persistent keeps its recorded amount and the historical buyoff warning.
    const plague = item(facts, 3, 'Sickness · Event 1');
    expect(plague.details).toEqual([
      'Affects Team 1',
      'Decision: Buyoff',
      'Recorded buyoff amount 90 gp',
      'Buyoff costs 90 gp',
      'Bought off',
    ]);
    expect(plague.effects.map((effect) => effect.text)).toEqual([
      'Treasury −90 gp',
      'Ends',
    ]);
    expect(notes(plague)).toEqual([
      'Sickness · Event 1: The recorded amount differs from the calculated buyoff cost.',
    ]);
    expect(facts.sections[3].chips).toEqual([
      'Treasury −90 gp',
      '1 event ends',
    ]);
    // Facts linked to nothing in the week remain, identical texts distinct.
    expect(facts.unassociated.map((note) => note.key)).toEqual([
      'outcome:id-stray',
      'warning:1',
      'warning:2',
      'warning:3',
    ]);
    expect(facts.unassociated[0]).toMatchObject({
      text: 'Table outcome: A ruling from an earlier tool',
    });
    expect(facts.unassociated[1]).toMatchObject({
      message: 'The team allowance was exceeded.',
    });
    expect(facts.adjustments).toEqual([
      expect.objectContaining({
        number: 1,
        kind: 'Militia value',
        effect: 'Treasury −0.07 gp',
        reason: 'Paid the ferryman',
      }),
    ]);
    expect(visibleText(facts)).not.toContain('id-');
  });

  test('[rules.HIST-05.frozen-rolls] older individual dice and newer dice totals each read exactly as recorded', () => {
    const dice = recordWeekReview(confirmedWeek().record);
    const totals = recordWeekReview(confirmedWeek({ rolls: 'totals' }).record);
    const table = (facts: WeekReviewFacts) =>
      item(facts, 2, 'Event 1 · Calm before the Storm').details;
    expect(table(dice)).toEqual(['Table roll: dice 54 (1d100)']);
    expect(table(totals)).toEqual(['Table roll: dice total 54 (1d100)']);
    expect(
      item(totals, 1, 'Slot 2 · Rescue Character · Rescuers').details[0],
    ).toBe('Check roll: dice total 20 (1d20)');
  });

  test('[rules.HIST-05.record-only] reading never changes the record, and nothing outside the record can change what it shows', () => {
    const { draft, snapshot, record } = confirmedWeek();
    const before = structuredClone(record);
    // The fixture is deeply frozen: any write while reading would throw.
    const facts = recordWeekReview(record);
    expect(record).toEqual(before);
    // Today's militia moves on: teams renamed, officers reassigned, the
    // workspace draft edited. The record, and so its review, is unaffected.
    snapshot.roster.teams[0]!.name = 'Renamed today';
    snapshot.roster.officers = [];
    draft.tableAdjustments = [];
    expect(recordWeekReview(structuredClone(record))).toEqual(facts);
    expect(recordWeekReview.length).toBe(1);
  });
});

test('[rules.HIST-05.frozen-boundary] the frozen adapter imports no live store, backend, React or rules resolver', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const files = [
    'record-review.ts',
    'record-artifacts.ts',
    'record-names.ts',
    'record-event-tree.ts',
  ];
  const pattern = /import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/g;
  // Pure shared presentation, structural schemas and static label catalogs.
  const values = new Set([
    '~/lib/canonical-weekly-source',
    '~/lib/weekly-draft-contract',
    '~/lib/militia-event-table',
    '../weekly-draft-workspace/activity-labels',
    '../weekly-draft-workspace/summary-messages',
  ]);
  for (const file of files) {
    const source = readFileSync(path.join(directory, file), 'utf8');
    for (const match of source.matchAll(pattern)) {
      const typeOnly = match[1] !== undefined;
      const specifier = match[2]!;
      const allowed =
        typeOnly ||
        specifier.startsWith('./') ||
        specifier.startsWith('~/components/week-review/') ||
        values.has(specifier);
      expect(allowed, `${file} imports ${specifier}`).toBe(true);
      for (const forbidden of [
        'convex',
        'store',
        'react',
        'use-',
        'rules-',
        'canonical-weekly-resolution',
        'weekly-draft-workspace/workspace',
      ])
        expect(specifier, `${file} imports ${specifier}`).not.toContain(
          forbidden,
        );
    }
  }
});
