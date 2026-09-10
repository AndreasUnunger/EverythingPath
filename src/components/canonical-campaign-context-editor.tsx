'use client';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '~/components/ui/button';
import {
  campaignContextSchema,
  campaignContextWarnings,
  type CampaignContext,
} from '~/lib/canonical-campaign-context';
import { FactField as F, yesNo } from './campaign-context/fields';
import { SettlementAssets } from './campaign-context/settlement-assets';
import { Events, type NamedReference } from './campaign-context/events';
import { Orders } from './campaign-context/orders';
import { Carry } from './campaign-context/carry';

// Reusable ledger/setup editor, deliberately not mounted on live routes before cutover.
export function CanonicalCampaignContextEditor({
  context,
  revision,
  onSave,
  teams,
  characters,
}: {
  context: CampaignContext;
  revision: number | null;
  onSave: (
    context: CampaignContext,
    expectedRevision: number | null,
  ) => Promise<number>;
  teams: NamedReference[];
  characters: NamedReference[];
}) {
  const form = useForm<CampaignContext>({
    resolver: zodResolver(campaignContextSchema),
    defaultValues: context,
  });
  const [baseRevision, setBaseRevision] = useState(revision);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const values = form.watch();
  const parsed = campaignContextSchema.safeParse(values);
  const warnings = parsed.success ? campaignContextWarnings(parsed.data) : [];
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="bg-card space-y-6 border-2 p-4 font-mono"
        onSubmit={form.handleSubmit(async (facts) => {
          setError(undefined);
          setSaved(false);
          try {
            const accepted = await onSave(facts, baseRevision);
            setBaseRevision(accepted);
            form.reset(facts);
            setSaved(true);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'Could not save campaign facts.',
            );
          }
        })}
      >
        <h2 className="font-sans text-2xl font-bold">Campaign facts</h2>
        <p className="text-muted-foreground text-sm">
          Keep the current table state here. Blank optional numbers mean unknown
          or not recorded; enter 0 to record zero. Mitigation does not end an
          event. Recording delivery does not imply receipt.
        </p>
        <fieldset disabled={form.formState.isSubmitting} className="space-y-6">
          <div className="grid items-start gap-3 md:grid-cols-2">
            <F name="treasuryCopper" label="Treasury (copper)" numeric />
            <F name="startDay" label="Week start day" numeric />
            <F
              name="firstMilitiaWeek"
              label="First militia week"
              choices={yesNo}
            />
            <F
              name="uneventfulCarry"
              label="Uneventful carry"
              choices={yesNo}
            />
            <F name="lastBuyoffWeek" label="Last militia buyoff week" numeric />
            <F
              name="operatingSettlementId"
              label="Operating settlement"
              choices={[
                { value: null, label: 'Unknown' },
                ...values.settlements.map((x) => ({
                  value: x.settlementId,
                  label: x.name || 'Unnamed settlement',
                })),
              ]}
            />
          </div>
          <SettlementAssets />
          <Events teams={teams} characters={characters} />
          <Orders />
          <Carry teams={teams} />
        </fieldset>
        {warnings.length > 0 && (
          <div
            aria-label="Rules warnings"
            className="border-primary/40 bg-primary/10 space-y-2 border p-3"
          >
            {warnings.map((warning) => (
              <p key={warning} className="text-sm">
                {warning}
              </p>
            ))}
          </div>
        )}
        {(revision ?? -1) > (baseRevision ?? -1) && (
          <p role="status">
            Campaign facts have changed. Reload to review the latest changes.
          </p>
        )}
        {Object.keys(form.formState.errors).length > 0 && (
          <p role="alert" className="text-destructive text-sm">
            Review the highlighted fields before saving.
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {saved && <p role="status">Campaign facts saved.</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save campaign facts
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={form.formState.isSubmitting}
            onClick={() => {
              form.reset(context);
              setBaseRevision(revision);
              setError(undefined);
              setSaved(false);
            }}
          >
            Reload campaign facts
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
