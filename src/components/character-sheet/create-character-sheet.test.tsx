import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CreateCharacterSheet } from './create-character-sheet';

// Creating a Character for the living sheet (#256), from a prepared
// campaign's Characters page.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
const navigate = vi.fn();
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));

vi.mock('@convex/_generated/api', () => ({
  api: { characterSheet: { create: 'create' } },
}));
vi.mock('convex/react', () => ({
  useMutation: (name: string) => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ name, args, resolve, reject });
    }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  useNavigationGuard: () => ({
    navigate,
    requestDeparture: vi.fn(),
    hasPendingWork: () => false,
  }),
}));
// Radix Select needs layout APIs jsdom lacks; a native select keeps the
// labelled control and its PC/NPC options.
vi.mock('~/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      aria-label="Kind"
      disabled={disabled}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

test('maintenance disables character creation and its fields with the reason beside the form', async () => {
  const form = renderForm();
  fireEvent.change(form.name, { target: { value: 'Nara' } });
  fireEvent.change(form.notes, { target: { value: 'Scout' } });
  fireEvent.change(form.kind, { target: { value: 'npc' } });
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  form.rerender(
    <CreateCharacterSheet
      organizationId="org"
      campaignId={'campaign-1' as Id<'campaign'>}
    />,
  );
  expect(form.name).toBeDisabled();
  expect(form.name).toHaveValue('Nara');
  expect(form.notes).toBeDisabled();
  expect(form.notes).toHaveValue('Scout');
  expect(form.kind).toBeDisabled();
  expect(form.kind).toHaveValue('npc');
  expect(
    screen.getByRole('button', { name: 'Create character' }),
  ).toBeDisabled();
  expect(screen.getByText(message)).toBeVisible();
  form.create();
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'New character' }));
  });
  expect(calls).toEqual([]);
  expect(navigate).not.toHaveBeenCalled();
});

function renderForm() {
  const view = render(
    <CreateCharacterSheet
      organizationId="org"
      campaignId={'campaign-1' as Id<'campaign'>}
    />,
  );
  return {
    rerender: view.rerender,
    name: screen.getByRole('textbox', { name: 'Name' }),
    notes: screen.getByRole('textbox', { name: 'Notes' }),
    kind: screen.getByRole('combobox', { name: 'Kind' }),
    create: () =>
      fireEvent.click(screen.getByRole('button', { name: 'Create character' })),
  };
}

test('a missing name is refused in place and nothing is created', async () => {
  const form = renderForm();
  expect(form.kind).toHaveValue('pc');
  form.create();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Character name is required',
  );
  expect(form.name).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);
  expect(navigate).not.toHaveBeenCalled();
});

test('double activation sends one request, a refusal keeps the entries, and a confirmed creation opens the new sheet', async () => {
  const form = renderForm();
  fireEvent.change(form.name, { target: { value: 'Nara' } });
  fireEvent.change(form.notes, { target: { value: 'Scout' } });
  fireEvent.change(form.kind, { target: { value: 'npc' } });
  form.create();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Creating…' }));
  expect(calls).toHaveLength(1);
  expect(calls[0]!.name).toBe('create');
  expect(calls[0]!.args).toMatchObject({
    organizationId: 'org',
    campaignId: 'campaign-1',
    name: 'Nara',
    kind: 'npc',
    description: 'Scout',
  });
  expect(typeof calls[0]!.args.operationId).toBe('string');
  await act(async () => {
    calls[0]!.reject(
      new ConvexError(
        'Character sheets are available only in fixture campaigns.',
      ),
    );
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Character wasn't created: Character sheets are available only in fixture campaigns. Your entries are kept. Try again.",
  );
  expect(form.name).toHaveValue('Nara');
  expect(form.notes).toHaveValue('Scout');
  expect(form.kind).toHaveValue('npc');
  expect(navigate).not.toHaveBeenCalled();
  form.create();
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => {
    calls[1]!.resolve('character-9');
  });
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      '/campaigns/campaign-1/characters/character-9',
    ),
  );
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Opening sheet…' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('an unknown outcome says the character may exist rather than claiming failure', async () => {
  const form = renderForm();
  fireEvent.change(form.name, { target: { value: 'Nara' } });
  form.create();
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    calls[0]!.reject(new Error('Connection closed'));
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Character may have been created. Check the character list before trying again.',
  );
  expect(form.name).toHaveValue('Nara');
  expect(
    screen.getByRole('button', { name: 'Create character' }),
  ).toBeEnabled();
});
