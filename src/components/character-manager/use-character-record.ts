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
// APIs. Every write first validates the whole form. An edit sends only the
// fields changed since opening; Archive and Un-archive send those edits in
// the same write, so unsaved edits are never dropped, and Save keeps the
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
  // The values the dialog opened with; later record changes don't reset
  // the form, so the player's input is never replaced under them.
  const [initialValues] = useState(() =>
    record ? toCharacterFormValues(record) : defaultCharacterFormValues,
  );
  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: initialValues,
  });
  const [submitError, setSubmitError] = useState<string>();
  const [pending, setPending] = useState<CharacterRecordForm['pending']>(null);
  // Set before validation settles, so a second press never writes twice.
  const busy = useRef(false);
  const createCharacter = useMutation(api.character.createCharacter);
  const updateCharacter = useMutation(api.character.updateCharacter);
  const archiveCharacter = useMutation(api.character.archiveCharacter);

  // The fields this player changed since opening: an edit never writes back
  // a field another player changed in the meantime.
  function edits(values: CharacterFormValues) {
    const payload = toCharacterPayload(values);
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          values[key as keyof CharacterFormValues] !==
          initialValues[key as keyof CharacterFormValues],
      ),
    ) as Partial<typeof payload>;
  }

  async function writeRecord(
    current: CharacterRecord,
    values: CharacterFormValues,
    archive: boolean,
  ) {
    const patch = edits(values);
    const changed = Object.keys(patch).length > 0;
    const isActive = current.isActive === false;
    if (archive && !changed)
      await archiveCharacter({
        organizationId,
        characterId: current._id,
        isActive,
      });
    else if (archive || changed)
      await updateCharacter({
        organizationId,
        characterId: current._id,
        patch: archive ? { ...patch, isActive } : patch,
      });
  }

  async function write(values: CharacterFormValues, archive: boolean) {
    setPending(archive ? 'archive' : 'save');
    setSubmitError(undefined);
    try {
      if (record) await writeRecord(record, values, archive);
      else
        await createCharacter({
          organizationId,
          character: { campaignId, ...toCharacterPayload(values) },
        });
      onSaved();
    } catch (error) {
      setSubmitError(
        getCharacterErrorMessage(
          error,
          !archive
            ? 'Failed to save character.'
            : record?.isActive === false
              ? 'Failed to un-archive character.'
              : 'Failed to archive character.',
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
