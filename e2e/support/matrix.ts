import type { Project } from '@playwright/test';
import type { CaseKey } from '../fixtures/catalog';

export type SuiteMode = 'mandatory' | 'nightly';
// Access and the journeys split from it (#187 and the load timeouts in
// XxSqla, rUyJDK and qnkZrD): each owns a case seeded like `smoke` and runs on
// every browser project that runs access.
export const accessJourneyFiles = [
  'access.spec.ts',
  'campaign-home.spec.ts',
  'campaign-sections.spec.ts',
  'legacy-addresses.spec.ts',
  'legacy-week-links.spec.ts',
] as const;
export const criticalJourneys = [
  [
    'access.spec.ts',
    'organization members can open their campaign and outsiders cannot',
  ],
  // Split from access, which runs on every browser project: these run
  // wherever access runs (`accessJourneyFiles`).
  [
    'campaign-home.spec.ts',
    'members choose and edit their campaign home and outsiders never see it',
  ],
  [
    'campaign-sections.spec.ts',
    'members move between campaign sections at every width and through browser history',
  ],
  [
    'legacy-addresses.spec.ts',
    'unknown campaigns stay unavailable and legacy addresses lead members to their campaign',
  ],
  [
    'legacy-week-links.spec.ts',
    'legacy week links open their phase in a bounded week without moving other members',
  ],
  [
    'existing-militia.spec.ts',
    'existing militia state survives reload within its campaign',
  ],
  [
    'character-ledger.spec.ts',
    'players share character and officer assignment changes',
  ],
  [
    'complete-week.spec.ts',
    'a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload',
  ],
  ['realtime-action-slot.spec.ts', 'players share a Staged Action Choice'],
] as const;
const persistenceContract = [
  'canonical-persistence.spec.ts',
  'shared persistence contract uses authenticated isolated Convex',
] as const;

const confirmationContract = [
  'canonical-confirmation.spec.ts',
  'shared Confirmation contract commits reviewed weeks in isolated Convex',
] as const;

const cutoverJourney = [
  'canonical-cutover.spec.ts',
  'accepted campaign preserves canonical history and rejects retired paths',
] as const;

const workspaceFile = 'canonical-workspace.spec.ts';
// Formerly one journey; each part now owns a catalog case so the parts can run
// on separate cohorts. The first part keeps the original identity.
const workspaceJourneys = [
  [
    'players prepare shared Upkeep with independent navigation and save recovery',
    'workspaceUpkeep',
  ],
  [
    'players choose the nearest settlement at maximum notoriety and resolve team conditions',
    'workspaceNotoriety',
  ],
  [
    'players recover a team at an adjusted cost and confirm a week through Activity and Event',
    'workspaceRecovery',
  ],
  [
    'players review and buy off carried persistent events before confirming the week',
    'workspacePersistent',
  ],
  [
    'racing Confirmations commit one reviewed week and reject stale and delayed changes',
    'workspaceConfirmation',
  ],
] as const satisfies readonly (readonly [string, CaseKey])[];

export function workspaceCaseKey(title: string): CaseKey {
  const journey = workspaceJourneys.find(([candidate]) => candidate === title);
  if (!journey) throw new Error('Workspace journey has no catalog case');
  return journey[1];
}

export function browserProjects(mode: SuiteMode): Project[] {
  const tablet: Project = {
    name: 'chromium-tablet',
    testMatch: criticalJourneys.map(([file]) => file),
    dependencies: ['authentication'],
    use: {
      browserName: 'chromium',
      viewport: { width: 1194, height: 834 },
      hasTouch: true,
    },
  };
  const webkit: Project = {
    ...tablet,
    name: 'webkit-tablet',
    use: { ...tablet.use, browserName: 'webkit' },
  };
  const phone: Project = {
    name: 'chromium-phone',
    testMatch: [...accessJourneyFiles],
    dependencies: ['authentication'],
    use: {
      browserName: 'chromium',
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    },
  };
  const firefox: Project = {
    name: 'firefox-desktop',
    testMatch: [
      ...accessJourneyFiles,
      'existing-militia.spec.ts',
      'complete-week.spec.ts',
    ],
    dependencies: ['authentication'],
    use: {
      browserName: 'firefox',
      viewport: { width: 1440, height: 900 },
      hasTouch: false,
    },
  };
  const isNightly = mode === 'nightly';
  // Workers take test groups in project order, so the longest go first and the
  // parallel critical path stays short. Nightly runs WTH1EO and IKQBdO took:
  // Confirmation 134 s, persistence 121 s, the Workspace parts 15-81 s (255 s
  // in total), each project's access journey 46-50 s, and cutover 19 s.
  return [
    { name: 'authentication', testMatch: 'auth.setup.ts', retries: 0 },
    {
      ...tablet,
      name: 'canonical-confirmation',
      testMatch: confirmationContract[0],
    },
    {
      ...tablet,
      name: 'canonical-persistence',
      testMatch: persistenceContract[0],
    },
    { ...tablet, name: 'canonical-workspace', testMatch: workspaceFile },
    ...(isNightly ? [webkit, phone] : []),
    tablet,
    ...(isNightly ? [firefox] : []),
    { ...tablet, name: 'canonical-cutover', testMatch: cutoverJourney[0] },
  ];
}

export function requiredTests(mode: SuiteMode) {
  return browserProjects(mode).flatMap((project) =>
    project.name === 'authentication'
      ? [['auth.setup.ts', project.name, 'prepare fresh role sessions']]
      : [
          ...criticalJourneys,
          persistenceContract,
          confirmationContract,
          ...workspaceJourneys.map(
            ([title]) => [workspaceFile, title] as const,
          ),
          cutoverJourney,
        ]
          .filter(([file]) => [project.testMatch].flat().includes(file))
          .map(([file, title]) => [file, project.name!, title]),
  );
}
