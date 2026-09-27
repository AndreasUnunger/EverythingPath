'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CharacterDialog } from './character-dialog';
import {
  getCharacterErrorMessage,
  characterFormSchema,
  toCharacterPayload,
  defaultCharacterFormValues,
  type CharacterFormValues,
} from './types';

// Creates a shared campaign character from another page, e.g. Setup. The new
// record reaches every member through their own character queries; nothing
// else is assigned. Its values live as long as this component, so a failed
// save, or closing and reopening, keeps them; a successful save clears them.
export function AddCharacterDialog({
  campaignId,
  organizationId,
  open,
  onOpenChange,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
        character: { campaignId, ...toCharacterPayload(values) },
      });
      onOpenChange(false);
      form.reset(defaultCharacterFormValues);
    } catch (error) {
      setSubmitError(
        getCharacterErrorMessage(error, 'Failed to save character.'),
      );
    }
  }
  return (
    <CharacterDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSubmitError(undefined);
        onOpenChange(next);
      }}
      title="New Character"
      form={form}
      onSubmit={submit}
      submitError={submitError}
    />
  );
}
