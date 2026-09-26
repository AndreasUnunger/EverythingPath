import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';
import type { Phase } from './types';
import { CampaignWorkspaceProvider } from './campaign-workspace-provider';
import { useWeeklyDraftWorkspace } from './use-weekly-draft-workspace';
import { CanonicalWorkspaceScreen, WeeklyWorkspaceBoard } from './board';

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

function fixture(): WorkspaceGateway & { advance: () => () => void } {
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
  let source = workspaceSourceSchema.parse({
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
  let authority = createMemoryDraftAuthority(draft, source.snapshot);
  let successorDelivery: Promise<void> | undefined;
  const listeners = new Set<Parameters<WorkspaceGateway['subscribe']>[0]>();
  return {
    subscribe(next) {
      listeners.add(next);
      next(source);
      return () => listeners.delete(next);
    },
    transport() {
      const transport = authority.transport;
      const delivery = successorDelivery;
      if (!delivery) return transport;
      return {
        ...transport,
        async read() {
          await delivery;
          return transport.read();
        },
        subscribe(next, failed) {
          let active = true;
          const stop = transport.subscribe((observation) => {
            void delivery.then(() => {
              if (active) next(observation);
            });
          }, failed);
          return () => {
            active = false;
            stop();
          };
        },
      };
    },
    advance() {
      let release!: () => void;
      successorDelivery = new Promise<void>((resolve) => {
        release = resolve;
      });
      const successor = createWeeklyDraft({
        draftId: 'successor',
        week: 5,
        slotIds: ['left'],
        context: {
          firstMilitiaWeek: false,
          startDay: 28,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
        },
      });
      authority = createMemoryDraftAuthority(successor, source.snapshot);
      source = {
        ...source,
        key: { ...source.key, draftId: successor.draftId },
      };
      for (const next of listeners) next(source);
      return release;
    },
  };
}

// The shell reads the same snapshot the board renders; there is no copy.
function WeekProbe() {
  const workspace = useWeeklyDraftWorkspace();
  return (
    <p>
      Shell week: {workspace.status === 'ready' ? workspace.week : 'unknown'}
    </p>
  );
}
// Same composition as the campaign shell: one owner above shell chrome and
// the Week route's board.
function host(props: {
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  return (
    <CampaignWorkspaceProvider
      campaignId="campaign"
      active
      openingPhase={props.phase}
    >
      <WeekProbe />
      <WeeklyWorkspaceBoard
        {...props}
        setupHref="/campaigns/campaign/setup"
        historyHref="/campaigns/campaign/history"
      />
    </CampaignWorkspaceProvider>
  );
}

test('[shell.phase] address phase changes move this player without rebuilding the Workspace', async () => {
  const gateway = fixture();
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  const view = render(host({ phase: 'event', onPhaseChange }));
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(factory).toHaveBeenCalledTimes(1);
  expect(factory.mock.calls[0]?.[2]).toBe('event');
  expect(screen.getByText('Shell week: 4')).toBeInTheDocument();
  view.rerender(host({ phase: 'activity', onPhaseChange }));
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Activity' }),
  ).toBeVisible();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(onPhaseChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review & confirm' }));
  expect(onPhaseChange).toHaveBeenLastCalledWith('summary');
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Review & confirm' }),
  ).toBeVisible();
  view.rerender(host({ phase: 'persistent', onPhaseChange }));
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Review & confirm' }),
  ).toBeVisible();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Finished weeks' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/history',
  );
  view.unmount();
  expect(factory).toHaveBeenCalledTimes(1);
});

test('[shell.standalone] the standalone screen hosts one owner with the same links', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  render(<CanonicalWorkspaceScreen campaign="campaign" phase="upkeep" />);
  await screen.findByRole('heading', { name: 'Week 4 · Upkeep' });
  expect(factory).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Finished weeks' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/history',
  );
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
  render(host({ phase: 'upkeep' }));
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
  render(host({ phase: 'upkeep' }));
  expect(screen.getByRole('status')).toHaveTextContent('No militia yet.');
  expect(screen.getByRole('link', { name: 'Set up militia' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/setup',
  );
  expect(screen.getByText('Shell week: unknown')).toBeInTheDocument();
});

test.each(['event', 'summary'] as const)(
  '[shell.successor] a player viewing %s opens an arriving successor on Upkeep and updates the address',
  async (opening) => {
    const gateway = fixture();
    factory.mockImplementation((_client, _campaign, initialPhase) => ({
      ...gateway,
      initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
    }));
    const onPhaseChange = vi.fn();
    render(host({ phase: opening, onPhaseChange }));
    await screen.findByRole('heading', {
      name: `Week 4 · ${opening === 'event' ? 'Event' : 'Review & confirm'}`,
    });
    let release!: () => void;
    act(() => {
      release = gateway.advance();
    });
    await screen.findByText('Loading the week…');
    await act(async () => release());
    await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
    expect(onPhaseChange).toHaveBeenLastCalledWith('upkeep');
    expect(screen.getByText('Shell week: 5')).toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(1);
  },
);

test('[shell.successor-control] the gateway opening phase does not override successor Upkeep without an address phase', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => ({ ...gateway, initialPhase: 'event' }));
  render(host({}));
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  let release!: () => void;
  act(() => {
    release = gateway.advance();
  });
  await screen.findByText('Loading the week…');
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 5 · Upkeep' });
  expect(factory).toHaveBeenCalledTimes(1);
});

// The campaign shell mounts the owner without an opening phase (it cannot
// read the page's address during render), so the board must apply the
// requested phase itself once the store is ready.
function delayed(gateway: WorkspaceGateway) {
  let release!: () => void;
  const delivery = new Promise<void>((resolve) => {
    release = resolve;
  });
  const wrapped: WorkspaceGateway = {
    ...gateway,
    transport(source) {
      const transport = gateway.transport(source);
      return {
        ...transport,
        async read() {
          await delivery;
          return transport.read();
        },
        subscribe(next, failed) {
          let active = true;
          const stop = transport.subscribe((observation) => {
            void delivery.then(() => {
              if (active) next(observation);
            });
          }, failed);
          return () => {
            active = false;
            stop();
          };
        },
      };
    },
  };
  return { gateway: wrapped, release };
}
function shellHost(props: {
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  return (
    <CampaignWorkspaceProvider campaignId="campaign" active>
      <WeekProbe />
      <WeeklyWorkspaceBoard {...props} />
    </CampaignWorkspaceProvider>
  );
}

test('[shell.opening] a non-Upkeep address phase opens once the delayed initial observation arrives', async () => {
  const { gateway, release } = delayed(fixture());
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  render(shellHost({ phase: 'event', onPhaseChange }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  expect(onPhaseChange).not.toHaveBeenCalled();
  expect(factory).toHaveBeenCalledTimes(1);
});

test('[shell.opening-change] an address phase change while loading wins over the opening phase', async () => {
  const { gateway, release } = delayed(fixture());
  factory.mockImplementation((_client, _campaign, initialPhase) => ({
    ...gateway,
    initialPhase: initialPhase as WorkspaceGateway['initialPhase'],
  }));
  const onPhaseChange = vi.fn();
  const view = render(shellHost({ phase: 'event', onPhaseChange }));
  view.rerender(shellHost({ phase: 'summary', onPhaseChange }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
  await act(async () => release());
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  expect(onPhaseChange).not.toHaveBeenCalled();
  expect(factory).toHaveBeenCalledTimes(1);
});

// An edit made from another phase's editor reaches every step at once: the
// frame reads the same optimistic snapshot the editors do.
function EditProbe() {
  const workspace = useWeeklyDraftWorkspace();
  if (workspace.status !== 'ready') return null;
  const upkeep = workspace.phases.find((step) => step.phase === 'upkeep')!;
  return (
    <>
      <p data-testid="upkeep-ids">
        {upkeep.requirements.map((item) => item.id).join(',')}
      </p>
      <p data-testid="upkeep-caption">
        {upkeep.ready ? 'Ready' : `${upkeep.requirements.length} to decide`}
      </p>
      <button
        type="button"
        onClick={() =>
          void workspace.edit({
            kind: 'upkeep_roll',
            field: 'check',
            roll: {
              dice: [10],
              sides: 20,
              provenance: { kind: 'table' },
              modifiers: [],
            },
          })
        }
      >
        Probe roll
      </button>
    </>
  );
}

test('[frame.readiness] every position shows readiness from one optimistic snapshot, keeps a locked Persistent visible and skips it', async () => {
  const gateway = fixture();
  factory.mockImplementation(() => gateway);
  render(
    <CampaignWorkspaceProvider campaignId="campaign" active>
      <EditProbe />
      <WeeklyWorkspaceBoard phase="event" />
    </CampaignWorkspaceProvider>,
  );
  await screen.findByRole('heading', { name: 'Week 4 · Event' });
  const stepper = within(
    screen.getByRole('navigation', { name: 'Week phases' }),
  );
  const upkeep = stepper.getByRole('button', { name: 'Upkeep' });
  const ids = () => screen.getByTestId('upkeep-ids').textContent;
  const before = ids();
  expect(before).not.toBe('');
  expect(upkeep).toHaveAccessibleDescription(
    screen.getByTestId('upkeep-caption').textContent,
  );
  expect(upkeep).toHaveAccessibleDescription(/to decide$/);
  const persistent = stepper.getByRole('button', { name: 'Persistent' });
  expect(persistent).toBeDisabled();
  expect(persistent).toHaveAccessibleDescription('No carried events');
  expect(stepper.getByRole('button', { name: 'Event' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  expect(
    screen.getByRole('button', { name: 'Next: Review & confirm' }),
  ).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Previous: Activity' }),
  ).toBeEnabled();
  expect(
    stepper.getByRole('button', { name: 'Review & confirm' }),
  ).not.toHaveAttribute('aria-describedby');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Probe roll' }));
  });
  await waitFor(() => expect(ids()).not.toBe(before));
  expect(upkeep).toHaveAccessibleDescription(
    screen.getByTestId('upkeep-caption').textContent,
  );
  // Still on Event: readiness refreshed without moving this player.
  expect(
    screen.getByRole('heading', { name: 'Week 4 · Event' }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Next: Review & confirm' }),
  );
  await screen.findByRole('heading', { name: 'Week 4 · Review & confirm' });
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous: Event' })).toBeEnabled();
  const lines = document.querySelectorAll('[data-week-readiness]');
  for (const line of lines)
    expect(line).toHaveTextContent(/^(\d+ decisions? left|Review .*)$/);
  expect(screen.getByRole('button', { name: 'Confirm week' })).toBeDisabled();
});
