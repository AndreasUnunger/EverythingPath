import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `pnpm -s mvp:status`: launch progress per class and race, read from the
 * committed launch inventory and the curation admission records
 * (`scripts/catalog/legal/*.json`). Read-only. A required row counts under
 * every root with a semantic path to it; the total line counts each required
 * row once. A row is met when the inventory inspection reports no launch
 * failure for it. A notice is missing when a required `notice/<code>` row the
 * root reaches is not verified: the inventory reads that row's state from the
 * notice's current readiness (holds in force after the clearances, and a
 * reviewed Registry identity or confirmation). A content row keeps only the
 * notice holds the clearances don't name; a cleared hold stays in its legal
 * record as evidence.
 */
export type MvpStatusInput = {
  roots: readonly { key: string; name: string; kind: string }[];
  rows: readonly {
    key: string;
    requirement: 'required' | 'optional';
    holds: readonly { reason: string; owner: { issue: number } }[];
    noticeEvidence: { state: string };
  }[];
  failures: readonly { key: string }[];
  incoming: Readonly<Record<string, readonly { keys: readonly string[] }[]>>;
  admissions: ReadonlyMap<string, { disposition?: string }>;
};

type Row = MvpStatusInput['rows'][number];

const groups: readonly { title: string; kinds: readonly string[] }[] = [
  { title: 'Classes', kinds: ['class'] },
  { title: 'Races', kinds: ['race'] },
];

const legend =
  'Held reasons: "notice chain" counts notice holds still in force (the inventory drops a hold the notice clearances name); a required notice that is not verified counts under "missing notices".';

/** Legal-record hold ids name their kind; free-text holds count by owner. */
function holdReason({ reason, owner }: Row['holds'][number]) {
  if (/-notice-[^\s]+-complete-chain$/.test(reason)) return 'notice chain';
  if (/^[a-z0-9-]+-whole-content-/i.test(reason)) return 'whole content';
  if (/^[a-z0-9-]+-broken-reference-/i.test(reason)) return 'broken reference';
  if (/^[a-z0-9-]+$/i.test(reason)) return 'recorded hold';
  return `#${owner.issue}`;
}

function missingNotice({ key, noticeEvidence }: Row) {
  return key.startsWith('notice/') && noticeEvidence.state !== 'verified'
    ? key.slice('notice/'.length)
    : undefined;
}

function countText(counts: ReadonlyMap<string, number>) {
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .map(([reason, count]) => `${reason} ${count}`)
    .join(', ');
}

function rootLine(
  name: string,
  rows: readonly Row[],
  {
    failing,
    admissions,
  }: Pick<MvpStatusInput, 'admissions'> & { failing: ReadonlySet<string> },
) {
  const disposition = (row: Row) => admissions.get(row.key)?.disposition ?? '';
  const reasons = new Map<string, number>();
  const missing = new Set<string>();
  let held = 0;
  for (const row of rows) {
    const notice = missingNotice(row);
    if (notice) missing.add(notice);
    if (row.holds.length === 0) continue;
    held += 1;
    for (const reason of new Set(row.holds.map(holdReason)))
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const met = rows.filter(({ key }) => !failing.has(key)).length;
  const admitted = rows.filter((row) =>
    /(?:^|\/)admitted$/.test(disposition(row)),
  ).length;
  const omitted = rows.filter((row) =>
    /omitted|excluded/.test(disposition(row)),
  ).length;
  const codes = [...missing].sort();
  return [
    `  ${name}: ${rows.length} required`,
    `${met} met`,
    `${admitted} admitted`,
    `${held} held${held ? ` (${countText(reasons)})` : ''}`,
    `${omitted} omitted`,
    `missing notices ${codes.length}${codes.length ? `: ${codes.join(' ')}` : ''}`,
  ].join(', ');
}

export function mvpStatusLines(input: MvpStatusInput) {
  const failing = new Set(input.failures.map(({ key }) => key));
  const required = input.rows.filter(
    ({ requirement }) => requirement === 'required',
  );
  const reached = (root: string) =>
    required.filter(
      ({ key }) =>
        key === root ||
        (input.incoming[key] ?? []).some(({ keys }) => keys[0] === root),
    );
  const byName = [...input.roots].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const grouped = groups.flatMap(({ kinds }) => kinds);
  const sections = [
    ...groups,
    {
      title: 'Other roots',
      kinds: input.roots
        .map(({ kind }) => kind)
        .filter((kind) => !grouped.includes(kind)),
    },
  ];
  const lines = [legend];
  for (const { title, kinds } of sections) {
    const roots = byName.filter(({ kind }) => kinds.includes(kind));
    if (roots.length === 0) continue;
    lines.push(title);
    for (const root of roots)
      lines.push(
        rootLine(
          title === 'Other roots' ? `${root.name} (${root.kind})` : root.name,
          reached(root.key),
          { failing, admissions: input.admissions },
        ),
      );
  }
  const met = required.filter(({ key }) => !failing.has(key)).length;
  lines.push(`${met} of ${required.length} launch requirements met`);
  return lines;
}

async function main() {
  const [{ parseLaunchInventory }, { inspectLaunchInventory }, legal] =
    await Promise.all([
      import('./catalog/launch-inventory-document.ts'),
      import('./catalog/launch-inventory.ts'),
      import('./catalog/launch-inventory-sources.ts'),
    ]);
  const manifest = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const report = inspectLaunchInventory(manifest);
  const lines = mvpStatusLines({
    roots: manifest.roots,
    rows: manifest.rows,
    failures: report.launchFailures,
    incoming: report.incoming,
    admissions: await legal.readLaunchLegalInventories('.'),
  });
  process.stdout.write(
    `Launch status of ${report.scopeVersion} (${report.identity}); a row reached from several roots counts under each.\n${lines.join('\n')}\n`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  await main();
