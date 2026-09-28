'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import {
  characterFormSchema,
  defaultCharacterFormValues,
  getCharacterErrorMessage,
  toCharacterFormValues,
  toCharacterPayload,
  type CharacterFormValues,
  type CharacterRecord,
} from './types';

export type CharacterRecordForm = {
  form: UseFormReturn<CharacterFormValues>;
  /** The existing record being edited; undefined when adding one. */
  record: CharacterRecord | undefined;
  /** The last refused write, shown in the dialog. */
  submitError: string | undefined;
  /** The write in flight: its button shows progress, every button waits. */
  pending: 'save' | 'archive' | null;
  save: () => void;
  /** Archives or un-archives the record together with the edited fields. */
  toggleArchive: () => void;
  clearError: () => void;
};

// One character record's form and its writes through the existing record
// APIs. Every write sends the whole validated form, so Archive and
// Un-archive keep unsaved edits instead of dropping them, and Save keeps the
// record's archive state. Values live as long as the hook's owner: a refused
// write keeps them; `onSaved` runs after an accepted one.
export function useCharacterRecord({
  campaignId,
  organizationId,
  record,
  onSaved,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
  record?: CharacterRecord;
  onSaved: () => void;
}): CharacterRecordForm {
  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: record
      ? toCharacterFormValues(record)
      : defaultCharacterFormValues,
  });
  const [submitError, setSubmitError] = useState<string>();
  const [pending, setPending] = useState<CharacterRecordForm['pending']>(null);
  // Set before validation settles, so a second press never writes twice.
  const busy = useRef(false);
  const createCharacter = useMutation(api.character.createCharacter);
  const updateCharacter = useMutation(api.character.updateCharacter);

  async function write(values: CharacterFormValues, archive: boolean) {
    const payload = toCharacterPayload(values);
    setPending(archive ? 'archive' : 'save');
    setSubmitError(undefined);
    try {
      if (record)
        await updateCharacter({
          organizationId,
          characterId: record._id,
          patch: archive
            ? { ...payload, isActive: record.isActive === false }
            : payload,
        });
      else
        await createCharacter({
          organizationId,
          character: { campaignId, ...payload },
        });
      onSaved();
    } catch (error) {
      setSubmitError(
        getCharacterErrorMessage(
          error,
          archive && record?.isActive !== false
            ? 'Failed to archive character.'
            : 'Failed to save character.',
        ),
      );
    } finally {
      setPending(null);
    }
  }

  function submit(archive: boolean) {
    if (busy.current) return;
    busy.current = true;
    void form
      .handleSubmit((values) => write(values, archive))()
      .finally(() => {
        busy.current = false;
      });
  }

  return {
    form,
    record,
    submitError,
    pending,
    save: () => submit(false),
    toggleArchive: () => submit(true),
    clearError: () => setSubmitError(undefined),
  };
}
