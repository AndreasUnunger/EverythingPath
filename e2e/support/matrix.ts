import type { Project } from '@playwright/test';

export type SuiteMode = 'mandatory' | 'nightly';
export const criticalJourneys = [
  [
    'access.spec.ts',
    'organization members can open their campaign and outsiders cannot',
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
    'a player confirms a complete week and reloads its outcome',
  ],
  ['realtime-action-slot.spec.ts', 'players share a Staged Action Choice'],
] as const;

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
  return [
    { name: 'authentication', testMatch: 'auth.setup.ts', retries: 0 },
    tablet,
    ...(mode === 'nightly'
      ? [
          {
            ...tablet,
            name: 'webkit-tablet',
            use: { ...tablet.use, browserName: 'webkit' as const },
          },
          {
            name: 'firefox-desktop',
            testMatch: [
              'access.spec.ts',
              'existing-militia.spec.ts',
              'complete-week.spec.ts',
            ],
            dependencies: ['authentication'],
            use: {
              browserName: 'firefox' as const,
              viewport: { width: 1440, height: 900 },
              hasTouch: false,
            },
          },
          {
            name: 'chromium-phone',
            testMatch: 'access.spec.ts',
            dependencies: ['authentication'],
            use: {
              browserName: 'chromium' as const,
              viewport: { width: 390, height: 844 },
              hasTouch: true,
              isMobile: true,
            },
          },
        ]
      : []),
  ];
}

export function requiredTests(mode: SuiteMode) {
  return browserProjects(mode).flatMap((project) =>
    project.name === 'authentication'
      ? [['auth.setup.ts', project.name, 'prepare fresh role sessions']]
      : criticalJourneys
          .filter(([file]) => [project.testMatch].flat().includes(file))
          .map(([file, title]) => [file, project.name!, title]),
  );
}
