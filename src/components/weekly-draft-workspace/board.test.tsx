import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import {
  WeekLabelProvider,
  useWeekLabel,
} from '~/components/campaign-shell/campaign-context';
import type { WorkspaceGateway } from './gateway';
import { CanonicalWorkspaceScreen } from './board';

const factory = vi.fn<(...args: unknown[]) => WorkspaceGateway | null>();
vi.mock('./gateway', () => ({
  createConvexWorkspaceGateway: (...args: unknown[]) => factory(...args),
}));
const convex = {};
vi.mock('convex/react', () => ({
  useConvex: () => convex,
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
afterEach(cleanup);

function fixture(): WorkspaceGateway {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    sourceRevision: 0,
    snapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    },
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  return {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
}

function WeekProbe() {
  const { week } = useWeekLabel();
  return <p>Shell week: {week ?? 'unknown'}</p>;
}
function wrap(children: ReactNode) {
  return (
    <WeekLabelProvider>
      <WeekProbe />
      {children}
    </WeekLabelProvider>
  );
}

test('[shell.phase] address phase changes move this player without rebuilding the Workspace', async () => {
  const gateway = fixture();
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  const view = render(
    wrap(
      <CanonicalWorkspaceScreen
        campaign="campaign"
        phase="event"
        onPhaseChange={onPhaseChange}
      />,
    ),
  );
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(factory).toHaveBeenCalledTimes(1);
  expect(factory.mock.calls[0]?.[2]).toBe('event');
  expect(screen.getByText('Shell week: 4')).toBeInTheDocument();
  view.rerender(
    wrap(
      <CanonicalWorkspaceScreen
        campaign="campaign"
        phase="activity"
        onPhaseChange={onPhaseChange}
      />,
    ),
  );
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Activity' }),
  ).toBeVisible();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(onPhaseChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
  expect(onPhaseChange).toHaveBeenLastCalledWith('summary');
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Summary' }),
  ).toBeVisible();
  view.rerender(
    wrap(
      <CanonicalWorkspaceScreen
        campaign="campaign"
        phase="persistent"
        onPhaseChange={onPhaseChange}
      />,
    ),
  );
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Summary' }),
  ).toBeVisible();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Finished weeks' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/history',
  );
  view.unmount();
  expect(factory).toHaveBeenCalledTimes(1);
});

test('[shell.failed] a failed week offers a page-local retry that rebuilds the Workspace', async () => {
  const gateway = fixture();
  factory
    .mockImplementationOnce(() => ({
      ...gateway,
      subscribe(_next, failed) {
        failed();
        return () => undefined;
      },
    }))
    .mockImplementation(() => gateway);
  render(wrap(<CanonicalWorkspaceScreen campaign="campaign" phase="upkeep" />));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The week could not be loaded.',
  );
  expect(screen.queryByText('Reload the week')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(factory).toHaveBeenCalledTimes(2);
});

test('[shell.no-militia] a campaign without a militia keeps setup reachable within the campaign', () => {
  factory.mockImplementation(() => ({
    subscribe(next) {
      next(null);
      return () => undefined;
    },
    transport: () => {
      throw new Error('unused');
    },
  }));
  render(wrap(<CanonicalWorkspaceScreen campaign="campaign" phase="upkeep" />));
  expect(screen.getByRole('status')).toHaveTextContent('No militia yet.');
  expect(screen.getByRole('link', { name: 'Set up militia' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/setup',
  );
  expect(screen.getByText('Shell week: unknown')).toBeInTheDocument();
});
