'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { CharacterDialog } from './character-dialog';
import {
  characterErrorMessage,
  characterFormSchema,
  characterPayload,
  defaultCharacterFormValues,
  type CharacterFormValues,
} from './types';

// Creates a shared campaign character from another page, e.g. Setup. The new
// record reaches every member through their own character queries; nothing
// else is assigned. A failed save keeps the dialog open with its values.
export function AddCharacterDialog({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: defaultCharacterFormValues,
  });
  const createCharacter = useMutation(api.character.createCharacter);
  async function submit(values: CharacterFormValues) {
    setSubmitError(undefined);
    try {
      await createCharacter({
        organizationId,
        character: { campaignId, ...characterPayload(values) },
      });
      setOpen(false);
      form.reset(defaultCharacterFormValues);
    } catch (error) {
      setSubmitError(characterErrorMessage(error, 'Failed to save character.'));
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setSubmitError(undefined);
          setOpen(true);
        }}
      >
        <UserPlus aria-hidden />
        Add character
      </Button>
      <CharacterDialog
        open={open}
        onOpenChange={setOpen}
        title="New Character"
        form={form}
        onSubmit={submit}
        submitError={submitError}
      />
    </>
  );
}
