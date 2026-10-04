'use client';
import { useId } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { AttackFieldFeedback } from './attack-field-feedback';
import { chip, fieldLabel, RemoteNotice } from './sheet-parts';
import { useAttackWeaponEndForm } from './use-attack-routine-form';
import type { useCharacterSheet } from './use-character-sheet';

type Attacks = ReturnType<typeof useCharacterSheet>['attacks'];
type Weapon = Attacks['weapons'][number];
export type { AttackWeaponEnd as WeaponEnd } from '~/lib/character-sheet-attack-types';
import type { AttackWeaponEnd as WeaponEnd } from '~/lib/character-sheet-attack-types';

const endLabels = { primary: 'Primary end', otherEnd: 'Other end' } as const;

/**
 * One end of a Gear weapon, edited in the routine's panel: Masterwork,
 * Enhancement and Material. They belong to the weapon, so every routine
 * using it shares them. Each field saves at once with its acknowledgement
 * beside it; a double weapon's two ends save separately. Keyed by the Gear
 * weapon and end.
 */
export function AttackWeaponEndEditor({
  weapon,
  end,
  attacks,
  isReadOnly,
  describedBy,
}: {
  weapon: Weapon;
  end: WeaponEnd;
  attacks: Attacks;
  isReadOnly: boolean;
  describedBy?: string;
}) {
  const fieldId = useId();
  const isDouble = weapon.weapon.otherEnd !== undefined;
  const subject = isDouble
    ? `${weapon.label}, ${endLabels[end].toLowerCase()}`
    : weapon.label;
  const editor = useAttackWeaponEndForm({
    value: end === 'primary' ? weapon.primaryState : weapon.otherEndState,
    operationId: attacks.operationId,
    save: (patch) => attacks.saveWeaponEnd(weapon.entryId, end, patch),
  });
  const { form } = editor;
  const isDirty = form.formState.isDirty;
  type Field = 'masterwork' | 'enhancement' | 'material';

  function feedback(field: Field) {
    return (
      <AttackFieldFeedback
        status={editor.statusFor(field)}
        label={`${field} for ${subject}`}
        isDisabled={isReadOnly}
        onRetry={() => void editor.retry(field)}
      />
    );
  }

  return (
    <Form {...form}>
      <fieldset aria-label={subject} className="min-w-0 space-y-1.5">
        <legend
          aria-hidden
          className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 pb-1"
        >
          <span className="min-w-0 font-sans text-sm [overflow-wrap:anywhere]">
            {weapon.label}
          </span>
          {isDouble ? (
            <span className={cn(chip, 'text-muted-foreground')}>
              {endLabels[end]}
            </span>
          ) : null}
        </legend>
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'Changed by another player. Your edits are kept.'
              : 'Changed by another player.'
          }
          subject={subject}
          onDismiss={editor.dismissRemoteChange}
        />
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <FormField
            control={form.control}
            name="enhancement"
            render={({ field, fieldState }) => (
              <FormItem className="w-28 gap-1">
                <FormLabel className={fieldLabel}>Enhancement</FormLabel>
                <FormControl
                  aria-describedby={cn(
                    describedBy,
                    fieldState.error && `${fieldId}-enhancement-error`,
                  )}
                >
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={isReadOnly}
                    className="h-11 w-20 text-center font-mono md:h-8"
                    onChange={(event) =>
                      void editor.change('enhancement', event.target.value)
                    }
                  />
                </FormControl>
                <FormMessage
                  id={`${fieldId}-enhancement-error`}
                  role={fieldState.error ? 'alert' : undefined}
                  className={fieldState.error ? undefined : 'hidden'}
                />
                {feedback('enhancement')}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="masterwork"
            render={({ field }) => (
              <FormItem className="gap-1">
                <span aria-hidden className={fieldLabel}>
                  &nbsp;
                </span>
                <FormLabel className="min-h-11 cursor-pointer gap-2 font-mono text-sm font-normal md:min-h-8">
                  <FormControl aria-describedby={describedBy}>
                    <Checkbox
                      name={field.name}
                      ref={field.ref}
                      checked={field.value}
                      disabled={isReadOnly}
                      onBlur={field.onBlur}
                      onCheckedChange={(checked) =>
                        void editor.change('masterwork', checked)
                      }
                    />
                  </FormControl>
                  <span>Masterwork</span>
                </FormLabel>
                {feedback('masterwork')}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="material"
            render={({ field, fieldState }) => (
              <FormItem className="min-w-0 flex-1 basis-36 gap-1">
                <FormLabel className={fieldLabel}>Material</FormLabel>
                <FormControl
                  aria-describedby={cn(
                    describedBy,
                    fieldState.error && `${fieldId}-material-error`,
                  )}
                >
                  <Input
                    {...field}
                    type="text"
                    autoComplete="off"
                    disabled={isReadOnly}
                    className="h-11 w-full md:h-8"
                    onChange={(event) =>
                      void editor.change('material', event.target.value)
                    }
                  />
                </FormControl>
                <FormMessage
                  id={`${fieldId}-material-error`}
                  role={fieldState.error ? 'alert' : undefined}
                  className={fieldState.error ? undefined : 'hidden'}
                />
                {feedback('material')}
              </FormItem>
            )}
          />
        </div>
      </fieldset>
    </Form>
  );
}
