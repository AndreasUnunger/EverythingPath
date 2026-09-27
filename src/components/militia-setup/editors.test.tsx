import { useState, type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import { SetupAssets } from './assets';
import { SetupCarriedEffects } from './carry';
import { MilitiaSetupForm } from './form';
import { SetupPeople, SetupTeams, type SetupCharacter } from './roster';
import { SetupStartingPoint } from './starting-point';
afterEach(cleanup);

const hero: SetupCharacter = {
  characterId: 'hero',
  name: 'Hero',
  level: 3,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  isActive: true,
};
let values: () => MilitiaSetup;
function Harness({
  children,
  onSubmit = vi.fn(),
}: {
  children: ReactNode;
  onSubmit?: () => void;
}) {
  const form = useForm<MilitiaSetup>({
    defaultValues: newMilitiaSetup('Loyalty'),
  });
  values = form.getValues;
  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  );
}
const headings = () =>
  screen.getAllByRole('heading').map((heading) => heading.textContent);

test('[setup.editors.subsections] Assets and Carried effects show only the selected lists', () => {
  render(
    <Harness>
      <SetupAssets characters={[]} subsections={['orders', 'marketplaces']} />
      <SetupCarriedEffects
        characters={[]}
        subsections={['skillBenefits', 'marketDayBenefits']}
      />
    </Harness>,
  );
  expect(headings()).toEqual([
    'Orders',
    'Marketplaces',
    'Carried skill benefits',
    'Carried Market Day benefits',
  ]);
  cleanup();
  render(
    <Harness>
      <SetupAssets characters={[]} />
      <SetupCarriedEffects characters={[]} />
    </Harness>,
  );
  expect(headings()).toEqual([
    'Items',
    'Caches',
    'Orders',
    'Marketplaces',
    'Carried persistent events',
    'Queued effects',
    'One-use bonuses',
    'Carried skill benefits',
    'Carried Market Day benefits',
  ]);
});

test('[setup.editors.rehost] Setup and the full correction form keep their sections and order', () => {
  render(<MilitiaSetupForm characters={[hero]} onSave={vi.fn()} />);
  expect(headings()).toEqual([
    'Starting point',
    'Week context',
    'Characters and officers',
    'Teams',
    'Character conditions',
    'Settlements',
    'Carried persistent events',
    'Items',
    'Caches',
    'Orders',
    'Marketplaces',
    'Queued effects',
    'One-use bonuses',
    'Carried skill benefits',
    'Carried Market Day benefits',
  ]);
  cleanup();
  render(<MilitiaSetupForm characters={[hero]} onSave={vi.fn()} correction />);
  expect(headings()).toEqual([
    'Militia values',
    'Characters and officers',
    'Teams',
    'Character conditions',
    'Settlements',
    'Items',
    'Caches',
    'Orders',
    'Marketplaces',
    'Carried skill benefits',
    'Carried Market Day benefits',
  ]);
  expect(
    screen.queryByRole('group', { name: 'Campaign progress' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'Reason for correction' }),
  ).toBeVisible();
});

function Steps() {
  const [step, setStep] = useState<'start' | 'people' | 'teams'>('start');
  return (
    <>
      <button type="button" onClick={() => setStep('start')}>
        Go to Starting point
      </button>
      <button type="button" onClick={() => setStep('people')}>
        Go to People
      </button>
      <button type="button" onClick={() => setStep('teams')}>
        Go to Teams
      </button>
      {step === 'start' && <SetupStartingPoint />}
      {step === 'people' && <SetupPeople characters={[hero]} />}
      {step === 'teams' && <SetupTeams characters={[hero]} />}
    </>
  );
}

test('[setup.editors.steps] one form keeps raw invalid input and entries while step editors unmount, and editors never submit', () => {
  const submit = vi.fn();
  render(
    <Harness onSubmit={submit}>
      <Steps />
    </Harness>,
  );
  const go = (name: string) =>
    fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Rank' }), {
    target: { value: 'oops' },
  });
  go('Existing militia');
  go('Go to People');
  go('Add Hero');
  go('commandant');
  go('Go to Teams');
  go('Add team');
  fireEvent.change(screen.getByRole('textbox', { name: 'Team name' }), {
    target: { value: 'Scouts' },
  });
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Manager' })).getByRole('button', {
      name: 'Hero',
    }),
  );
  go('Go to Starting point');
  expect(screen.getByRole('textbox', { name: 'Rank' })).toHaveValue('oops');
  expect(
    screen.getByRole('button', { name: 'Existing militia' }),
  ).toHaveAttribute('aria-pressed', 'true');
  go('Go to Teams');
  expect(screen.getByRole('textbox', { name: 'Team name' })).toHaveValue(
    'Scouts',
  );
  go('Go to People');
  // Removing a person clears their roles and managers without losing teams.
  go('Remove Hero');
  expect(values().state.militiaSnapshot).toMatchObject({
    rank: 'oops',
    characters: [],
    roster: {
      people: [],
      officers: [],
      teams: [{ name: 'Scouts', managerCharacterId: null }],
    },
  });
  expect(values().mode).toBe('existing');
  expect(submit).not.toHaveBeenCalled();
});
