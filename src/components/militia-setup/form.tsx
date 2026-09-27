'use client';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '~/components/ui/button';
import {
  militiaSetupSchema,
  newMilitiaSetup,
  type MilitiaSetup,
} from '~/lib/canonical-setup';
import {
  militiaCorrectionSchema,
  setupErrorDescriptors,
  setupWarningDescriptors,
} from '~/lib/setup-validation';
import { SetupField as Field, SetupSection } from './fields';
import { SetupPeople, SetupTeams, type SetupCharacter } from './roster';
import { SetupCarriedEvents, SetupSettlements } from './world';
import { SetupAssets } from './assets';
import {
  SetupCharacterConditions,
  SetupMarketDayBenefits,
  SetupSkillBenefits,
} from './effects';
import { SetupOneUseBonuses, SetupQueuedEffects } from './carry';
import {
  SetupMilitiaValues,
  SetupStartingPoint,
  SetupWeek,
} from './starting-point';
export function MilitiaSetupForm({
  characters,
  onSave,
  initialValues,
  correction = false,
  stagedChoiceNotice,
}: {
  characters: SetupCharacter[];
  onSave: (setup: MilitiaSetup) => Promise<void>;
  initialValues?: MilitiaSetup;
  correction?: boolean;
  // A correction's effect on choices already staged for the open week.
  stagedChoiceNotice?: (setup: MilitiaSetup) => string | null;
}) {
  const form = useForm<MilitiaSetup>({
    resolver: zodResolver(
      correction ? militiaCorrectionSchema : militiaSetupSchema,
    ),
    defaultValues: initialValues ?? newMilitiaSetup('Loyalty'),
  });
  const [error, setError] = useState<string>();
  const values = form.watch();
  const warnings = setupWarningDescriptors(values);
  const parsed = militiaSetupSchema.safeParse(values);
  const staged = parsed.success ? stagedChoiceNotice?.(parsed.data) : null;
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
                : correction
                  ? 'The correction could not be saved. Your entries are retained. Review the latest ledger and try again.'
                  : 'Militia setup could not be saved. Your entries are retained. Try again, or open the current week if another player completed setup.',
            );
          }
        })}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-6">
          {correction ? (
            <SetupSection title="Militia values">
              <SetupMilitiaValues />
            </SetupSection>
          ) : (
            <>
              <SetupStartingPoint />
              <SetupWeek />
            </>
          )}
          <SetupPeople
            characters={characters}
            preserveCharacters={correction}
          />
          <SetupTeams characters={characters} />
          <SetupCharacterConditions characters={characters} />
          <SetupSettlements />
          {correction ? null : <SetupCarriedEvents characters={characters} />}
          <SetupAssets characters={characters} />
          {correction ? null : (
            <>
              <SetupQueuedEffects />
              <SetupOneUseBonuses />
            </>
          )}
          <SetupSkillBenefits characters={characters} />
          <SetupMarketDayBenefits />
          <Field
            name="notes"
            label={
              correction
                ? 'Reason for correction'
                : 'Setup notes / intentional rules deviations (optional)'
            }
          />
        </fieldset>
        {warnings.length > 0 && (
          <aside
            aria-label="Rules warnings"
            className="border-primary/40 bg-primary/10 space-y-2 border p-3"
          >
            <h2 className="font-semibold">Rules warnings</h2>
            {warnings.map(({ message }) => (
              <p key={message} className="text-sm">
                {message}
              </p>
            ))}
            <p className="text-sm">
              You can keep these values and explain your table ruling in the
              notes.
            </p>
          </aside>
        )}
        {staged && (
          <aside
            aria-label="Staged choices this week"
            className="space-y-1 border border-amber-500/60 p-3"
          >
            <h2 className="font-semibold">Staged choices this week</h2>
            <p role="note" className="text-sm">
              {staged}
            </p>
          </aside>
        )}
        {Object.keys(form.formState.errors).length > 0 && (
          <div role="alert" className="text-destructive space-y-1 border p-3">
            <p>Review the highlighted fields before saving.</p>
            {setupErrorDescriptors(values)
              .filter((issue) => issue.kind === 'refinement')
              .map((issue) => (
                <p key={`${issue.field}:${issue.message}`}>{issue.message}</p>
              ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {correction
            ? form.formState.isSubmitting
              ? 'Saving correction…'
              : 'Save correction'
            : form.formState.isSubmitting
              ? 'Starting militia…'
              : 'Start militia week'}
        </Button>
      </form>
    </FormProvider>
  );
}
