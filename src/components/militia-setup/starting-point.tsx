import { useFormContext } from 'react-hook-form';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import { SetupField as Field, SetupSection, choices, yesNo } from './fields';

// Focus, rank, training, treasury and notoriety, shared by Setup's Starting
// point and militia value corrections.
export function SetupMilitiaValues() {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2">
      <Field
        name="state.militiaSnapshot.focus"
        label="Focus"
        options={choices(['Loyalty', 'Security', 'Secrecy'])}
      />
      <Field name="state.militiaSnapshot.rank" label="Rank" numeric />
      <Field name="state.militiaSnapshot.training" label="Training" numeric />
      <Field
        name="state.militiaSnapshot.treasuryCopper"
        label="Treasury (copper)"
        numeric
      />
      <Field name="state.militiaSnapshot.notoriety" label="Notoriety" numeric />
    </div>
  );
}

export function SetupStartingPoint() {
  const { setValue } = useFormContext<MilitiaSetup>();
  return (
    <SetupSection title="Starting point">
      <Field
        name="mode"
        label="Campaign progress"
        onChoice={(mode) =>
          setValue('state.context.firstMilitiaWeek', mode === 'new', {
            shouldDirty: true,
          })
        }
        options={[
          { value: 'new', label: 'New militia' },
          { value: 'existing', label: 'Existing militia' },
        ]}
      />
      <p className="text-muted-foreground text-sm">
        New militia defaults are rank 1, training 0 and 10 gp. For an existing
        militia, enter the current table state below. Changing the starting
        point keeps your entries.
      </p>
      <SetupMilitiaValues />
    </SetupSection>
  );
}

export function SetupWeek() {
  const { watch } = useFormContext<MilitiaSetup>();
  return (
    <SetupSection title="Week context">
      <div className="grid items-start gap-3 md:grid-cols-2">
        <Field name="state.week" label="Current week" numeric />
        <Field name="state.context.startDay" label="Week start day" numeric />
        {watch('mode') === 'new' && (
          <Field
            name="state.context.firstMilitiaWeek"
            label="First militia week"
            options={yesNo}
          />
        )}
        <Field
          name="state.context.uneventfulCarry"
          label="Previous week was uneventful"
          options={yesNo}
        />
        <Field
          name="state.context.lastBuyoffWeek"
          label="Last persistent buyoff week (optional)"
          numeric
        />
        <Field
          name="phase"
          label="Open phase"
          options={choices([
            'upkeep',
            'activity',
            'event',
            'persistent',
            'summary',
          ])}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        Setup records your week without resolving it. Existing militias run
        Upkeep. A newly founded militia skips its first-ever Upkeep,
        independently of the displayed week number.
      </p>
    </SetupSection>
  );
}
