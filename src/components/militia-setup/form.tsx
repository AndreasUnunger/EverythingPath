'use client';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '~/components/ui/button';
import { militiaSetupSchema, type MilitiaSetup } from '~/lib/canonical-setup';
import {
  militiaCorrectionSchema,
  setupErrorDescriptors,
  setupWarningDescriptors,
} from '~/lib/setup-validation';
import {
  SetupField as Field,
  SetupSection,
  SetupSectionCaptions,
} from './fields';
import { withRecordKinds } from '~/lib/setup-characters';
import { SetupPeople, SetupTeams, type SetupCharacter } from './roster';
import { SetupSettlements } from './world';
import { SetupAssets } from './assets';
import {
  SetupCharacterConditions,
  SetupMarketDayBenefits,
  SetupSkillBenefits,
} from './effects';
import { SetupMilitiaValues } from './starting-point';
// The correction form keeps the section captions guided Setup dropped: #139's
// approval removes only its own listed hints.
const correctionCaptions = {
  'Characters and officers':
    'Choose people from the campaign ledger. Leave Hit Dice blank to use the character’s level.',
  'Character conditions':
    'Record the location and condition of characters the militia can hide, rescue or restore.',
  Orders:
    'Record the agreed delivery date, including expedition or enchantment time. Receipt is a separate decision.',
  'Carried Market Day benefits':
    'Market Day gives a 5% discount in the selected settlements for its recorded duration.',
};
// The existing full correction form: every correctable section behind one
// required reason. Guided Setup lives in `guided.tsx`; Militia corrections
// replace this form later.
export function MilitiaCorrectionForm({
  characters,
  onSave,
  initialValues,
  stagedChoiceNotice,
}: {
  characters: SetupCharacter[];
  onSave: (setup: MilitiaSetup) => Promise<void>;
  initialValues: MilitiaSetup;
  // A correction's effect on choices already staged for the open week.
  stagedChoiceNotice?: (setup: MilitiaSetup) => string | null;
}) {
  const form = useForm<MilitiaSetup>({
    resolver: zodResolver(militiaCorrectionSchema),
    defaultValues: initialValues,
  });
  const [error, setError] = useState<string>();
  const values = form.watch();
  const warnings = setupWarningDescriptors(withRecordKinds(values, characters));
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
                : 'The correction could not be saved. Your entries are retained. Review the latest ledger and try again.',
            );
          }
        })}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-6">
          <SetupSectionCaptions value={correctionCaptions}>
            <SetupSection title="Militia values">
              <SetupMilitiaValues />
            </SetupSection>
            <SetupPeople characters={characters} preserveCharacters />
            <SetupTeams characters={characters} />
            <SetupCharacterConditions characters={characters} />
            <SetupSettlements />
            <SetupAssets characters={characters} />
            <SetupSkillBenefits characters={characters} />
            <SetupMarketDayBenefits />
          </SetupSectionCaptions>
          <Field name="notes" label="Reason for correction" />
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
          {form.formState.isSubmitting
            ? 'Saving correction…'
            : 'Save correction'}
        </Button>
      </form>
    </FormProvider>
  );
}
