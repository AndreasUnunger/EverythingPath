'use client';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '~/components/ui/button';
import {
  militiaSetupSchema,
  newMilitiaSetup,
  prepareMilitiaSetup,
  type MilitiaSetup,
} from '~/lib/canonical-setup';
import { SetupField as Field, SetupSection, choices, yesNo } from './fields';
import { SetupRoster, type SetupCharacter } from './roster';
import { SetupWorld } from './world';
import { SetupAssets } from './assets';
import { SetupCharacterConditions, SetupEventBenefits } from './effects';
import { SetupCarry } from './carry';
export function MilitiaSetupForm({
  characters,
  onSave,
}: {
  characters: SetupCharacter[];
  onSave: (setup: MilitiaSetup) => Promise<void>;
}) {
  const form = useForm<MilitiaSetup>({
    resolver: zodResolver(militiaSetupSchema),
    defaultValues: newMilitiaSetup('Loyalty'),
  });
  const [error, setError] = useState<string>();
  const values = form.watch();
  const parsed = militiaSetupSchema.safeParse(values);
  const warnings = parsed.success
    ? prepareMilitiaSetup(parsed.data, 'setup-review').warnings
    : [];
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="space-y-6 [&_button]:h-auto [&_button]:min-h-9 [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal [&_fieldset]:min-w-0"
        onSubmit={form.handleSubmit(async (setup) => {
          setError(undefined);
          try {
            await onSave(setup);
          } catch (error) {
            setError(
              error instanceof ConvexError && typeof error.data === 'string'
                ? error.data
                : 'Militia setup could not be saved. Your entries are retained. Try again, or open the current week if another player completed setup.',
            );
          }
        })}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-6">
          <SetupSection title="Starting point">
            <Field
              name="mode"
              label="Campaign progress"
              onChoice={(mode) =>
                form.setValue(
                  'state.context.firstMilitiaWeek',
                  mode === 'new',
                  {
                    shouldDirty: true,
                  },
                )
              }
              options={[
                { value: 'new', label: 'New militia' },
                { value: 'existing', label: 'Existing militia' },
              ]}
            />
            <p className="text-muted-foreground text-sm">
              New militia defaults are rank 1, training 0 and 10 gp. For an
              existing militia, enter the current table state below. Changing
              the starting point keeps your entries.
            </p>
            <div className="grid items-start gap-3 md:grid-cols-2">
              <Field
                name="state.militiaSnapshot.focus"
                label="Focus"
                options={choices(['Loyalty', 'Security', 'Secrecy'])}
              />
              <Field name="state.militiaSnapshot.rank" label="Rank" numeric />
              <Field
                name="state.militiaSnapshot.training"
                label="Training"
                numeric
              />
              <Field
                name="state.militiaSnapshot.treasuryCopper"
                label="Treasury (copper)"
                numeric
              />
              <Field
                name="state.militiaSnapshot.notoriety"
                label="Notoriety"
                numeric
              />
            </div>
          </SetupSection>
          <SetupSection title="Week context">
            <div className="grid items-start gap-3 md:grid-cols-2">
              <Field name="state.week" label="Current week" numeric />
              <Field
                name="state.context.startDay"
                label="Week start day"
                numeric
              />
              {values.mode === 'new' && (
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
              Setup records your week without resolving it. Existing militias
              run Upkeep. A newly founded militia skips its first-ever Upkeep,
              independently of the displayed week number.
            </p>
          </SetupSection>
          <SetupRoster characters={characters} />
          <SetupCharacterConditions characters={characters} />
          <SetupWorld characters={characters} />
          <SetupAssets characters={characters} />
          <SetupCarry />
          <SetupEventBenefits characters={characters} />
          <Field
            name="notes"
            label="Setup notes / intentional rules deviations (optional)"
          />
        </fieldset>
        {warnings.length > 0 && (
          <aside
            aria-label="Rules warnings"
            className="border-primary/40 bg-primary/10 space-y-2 border p-3"
          >
            <h2 className="font-semibold">Rules warnings</h2>
            {warnings.map((warning) => (
              <p key={warning} className="text-sm">
                {warning}
              </p>
            ))}
            <p className="text-sm">
              You can keep these values and explain your table ruling in the
              notes.
            </p>
          </aside>
        )}
        {Object.keys(form.formState.errors).length > 0 && (
          <div role="alert" className="text-destructive space-y-1 border p-3">
            <p>Review the highlighted fields before starting.</p>
            {parsed.success
              ? null
              : parsed.error.issues
                  .filter((issue) => issue.code === 'custom')
                  .map((issue) => (
                    <p key={`${issue.path.join('.')}:${issue.message}`}>
                      {issue.message}
                    </p>
                  ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? 'Starting militia…'
            : 'Start militia week'}
        </Button>
      </form>
    </FormProvider>
  );
}
