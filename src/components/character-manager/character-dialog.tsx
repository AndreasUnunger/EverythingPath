import type { UseFormReturn } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { CharacterFormCard } from './character-form-card';
import type { CharacterFormValues } from './types';

// The character record dialog: every record field with its validation and
// the save error. Closing it leaves the values for its owner to keep or reset.
export function CharacterDialog({
  open,
  onOpenChange,
  title,
  form,
  onSubmit,
  submitError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: UseFormReturn<CharacterFormValues>;
  onSubmit: (values: CharacterFormValues) => Promise<void>;
  submitError?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl">{title}</DialogTitle>
          <DialogDescription className="font-mono text-sm">
            Update the character record. Officer assignments are in the militia
            ledger.
          </DialogDescription>
        </DialogHeader>
        <CharacterFormCard
          form={form}
          onSubmit={onSubmit}
          submitError={submitError}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
