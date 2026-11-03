// @vitest-environment node
import { expect, it } from 'vitest';
import { mvpStatusLines } from '../scripts/mvp-status';

const owner = (issue: number) => ({ issue });
const path = (...keys: string[]) => ({ keys });
const verified = { state: 'verified' };
const held = { state: 'held' };

it('counts each root’s required rows and ends with the met total', () => {
  const lines = mvpStatusLines({
    roots: [
      { key: 'pf1/fighter', name: 'Fighter', kind: 'class' },
      { key: 'pf1/dwarf', name: 'Dwarf', kind: 'race' },
    ],
    rows: [
      {
        key: 'pf1/fighter',
        requirement: 'required',
        noticeEvidence: held,
        holds: [{ reason: 'Fighter launch proof.', owner: owner(596) }],
      },
      {
        key: 'pf1/feat-met',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'pf1/feat-held',
        requirement: 'required',
        noticeEvidence: held,
        holds: [
          {
            reason: 'feats-330-abcdefghijklmnop-whole-content-abcdefghijklmnop',
            owner: owner(330),
          },
          {
            reason: 'feats-330-abcdefghijklmnop-notice-PZO1115-complete-chain',
            owner: owner(330),
          },
        ],
      },
      {
        key: 'pf1/shared',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'notice/PZO1110',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'pf1/dwarf',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'pf1/optional',
        requirement: 'optional',
        noticeEvidence: held,
        holds: [{ reason: 'Not launch.', owner: owner(1) }],
      },
    ],
    failures: [
      { key: 'pf1/fighter' },
      { key: 'pf1/feat-held' },
      { key: 'pf1/feat-held' },
      { key: 'pf1/shared' },
      { key: 'notice/PZO1110' },
      { key: 'pf1/dwarf' },
      { key: 'pf1/optional' },
    ],
    incoming: {
      'pf1/feat-met': [path('pf1/fighter', 'pf1/feat-met')],
      'pf1/feat-held': [path('pf1/fighter', 'pf1/feat-held')],
      'pf1/shared': [
        path('pf1/fighter', 'pf1/feat-met', 'pf1/shared'),
        path('pf1/dwarf', 'pf1/shared'),
      ],
      'notice/PZO1110': [path('pf1/fighter', 'notice/PZO1110')],
      'pf1/optional': [path('pf1/fighter', 'pf1/optional')],
    },
    admissions: new Map([
      ['pf1/feat-met', { disposition: 'admitted' }],
      ['pf1/feat-held', { disposition: 'held' }],
      ['pf1/shared', { disposition: 'dependently-omitted' }],
      ['pf1/dwarf', { disposition: 'supported/admitted' }],
    ]),
  });

  expect(lines).toContain(
    '  Fighter: 5 required, 1 met, 1 admitted, 2 held (#596 1, notice chain 1, whole content 1), 1 omitted, missing notices 1: PZO1110',
  );
  expect(lines).toContain(
    '  Dwarf: 2 required, 0 met, 1 admitted, 0 held, 1 omitted, missing notices 0',
  );
  expect(lines.at(-1)).toBe('1 of 6 launch requirements met');
  expect(lines[0]).toBe(
    'Held reasons: "notice chain" counts notice holds whose notice is not verified; "recorded notice holds, cleared (still failing in the inventory)" counts notice holds whose notice is verified but which the inventory still records and fails.',
  );
});

it('lists only notices whose readiness is not verified', () => {
  const lines = mvpStatusLines({
    roots: [{ key: 'pf1/wizard', name: 'Wizard', kind: 'class' }],
    rows: [
      {
        key: 'pf1/wizard',
        requirement: 'required',
        noticeEvidence: held,
        holds: [],
      },
      {
        key: 'pf1/cleared',
        requirement: 'required',
        noticeEvidence: held,
        holds: [
          {
            reason: 'spells-516-abcdefghijklmnop-notice-PZO1115-complete-chain',
            owner: owner(516),
          },
        ],
      },
      {
        key: 'notice/PZO1115',
        requirement: 'required',
        noticeEvidence: verified,
        holds: [],
      },
      {
        key: 'notice/PZO1123',
        requirement: 'required',
        noticeEvidence: verified,
        holds: [],
      },
      {
        key: 'notice/PZO9488',
        requirement: 'required',
        noticeEvidence: held,
        holds: [],
      },
      {
        key: 'notice/PZO9999',
        requirement: 'optional',
        noticeEvidence: held,
        holds: [],
      },
    ],
    failures: [
      { key: 'pf1/wizard' },
      { key: 'pf1/cleared' },
      { key: 'notice/PZO9488' },
      { key: 'notice/PZO9999' },
    ],
    incoming: {
      'pf1/cleared': [path('pf1/wizard', 'pf1/cleared')],
      'notice/PZO1115': [path('pf1/wizard', 'pf1/cleared', 'notice/PZO1115')],
      'notice/PZO1123': [path('pf1/wizard', 'notice/PZO1123')],
      'notice/PZO9488': [path('pf1/wizard', 'notice/PZO9488')],
      'notice/PZO9999': [path('pf1/wizard', 'notice/PZO9999')],
    },
    admissions: new Map(),
  });

  // The cleared PZO1115 hold id stays on its row, but the notice is verified;
  // PZO1123 is verified with no hold; only PZO9488 is not ready.
  expect(lines).toContain(
    '  Wizard: 5 required, 2 met, 0 admitted, 1 held (recorded notice holds, cleared (still failing in the inventory) 1), 0 omitted, missing notices 1: PZO9488',
  );
});
