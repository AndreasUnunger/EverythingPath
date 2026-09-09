'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '~/components/ui/button';
import {
  rosterWarnings,
  type CanonicalRoster,
  type RosterCharacter,
} from '~/lib/canonical-roster';
import {
  rosterFormSchema,
  rosterFormValues,
  type RosterFormValues,
} from './canonical-roster/form';
import { PeopleFields } from './canonical-roster/people-fields';
import { TeamFields } from './canonical-roster/team-fields';

// Shared ledger/setup form for the isolated canonical path. Its owner supplies
// an exact-revision save; no live route is connected before cutover.
export function CanonicalRosterEditor({
  roster,
  revision,
  characters,
  maxTeams,
  onSave,
}: {
  roster: CanonicalRoster;
  revision: number | null;
  characters: RosterCharacter[];
  maxTeams: number;
  onSave: (
    roster: CanonicalRoster,
    expectedRevision: number | null,
  ) => Promise<number>;
}) {
  const form = useForm<RosterFormValues, unknown, CanonicalRoster>({
    resolver: zodResolver(rosterFormSchema),
    defaultValues: rosterFormValues(roster),
  });
  const [baseRevision, setBaseRevision] = useState(revision);
  const [message, setMessage] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const parsed = rosterFormSchema.safeParse(form.watch());
  const warnings = parsed.success
    ? rosterWarnings(parsed.data, characters, maxTeams)
    : [];
  return (
    <form
      noValidate
      className="bg-card space-y-4 border-2 p-4 font-mono"
      onSubmit={form.handleSubmit(async (values) => {
        setSaveError(undefined);
        setMessage(undefined);
        try {
          const acceptedRevision = await onSave(values, baseRevision);
          setBaseRevision(acceptedRevision);
          form.reset(rosterFormValues(values));
          setMessage('Roster saved.');
        } catch (error) {
          setSaveError(
            error instanceof Error
              ? error.message
              : 'Could not save the roster.',
          );
        }
      })}
    >
      <h2 className="font-sans text-2xl font-bold">Militia roster</h2>
      <p className="text-muted-foreground text-sm">
        Keep each team and officer listed separately. Select an assigned role
        again to unassign it. Character records remain in the ledger.
      </p>
      <fieldset disabled={form.formState.isSubmitting} className="space-y-6">
        <PeopleFields form={form} characters={characters} />
        <TeamFields form={form} characters={characters} />
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
        <p
          role="status"
          className="border-primary/40 bg-primary/10 border p-3 text-sm"
        >
          The roster has changed. Reload the roster to review the latest
          changes.
        </p>
      )}
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-destructive text-sm">
          Review the highlighted fields before saving.
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-destructive text-sm">
          {saveError}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save roster
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={() => {
            form.reset(rosterFormValues(roster));
            setBaseRevision(revision);
            setSaveError(undefined);
            setMessage(undefined);
          }}
        >
          Reload roster
        </Button>
      </div>
    </form>
  );
}
