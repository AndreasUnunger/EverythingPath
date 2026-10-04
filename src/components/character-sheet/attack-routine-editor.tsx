'use client';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useBreakpoint } from '~/components/use-breakpoint';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { weaponCard } from './attack-routine-card-style';
import {
  describeWeapon,
  handsLabels,
  modeLabels,
} from './attack-routine-view-model';
import { AttackFieldFeedback } from './attack-field-feedback';
import { AttackRoutineOffHandField } from './attack-routine-off-hand-field';
import { AttackRoutinePreview } from './attack-routine-preview';
import {
  AttackWeaponEndEditor,
  type WeaponEnd,
} from './attack-weapon-end-editor';
import {
  action,
  chip,
  fieldLabel,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import {
  attackRoutineHandsSchema,
  attackRoutineModeSchema,
  useAttackRoutineForm,
  type AttackRoutineValues,
} from './use-attack-routine-form';
import type { useCharacterSheet } from './use-character-sheet';

type Attacks = ReturnType<typeof useCharacterSheet>['attacks'];
type Row = Attacks['rows'][number];
type Field = keyof AttackRoutineValues;

const hint = 'text-muted-foreground text-xs';

/**
 * One Attack Routine's editor (approved prototype's routine editor): a
 * panel on the right from 768px, a bottom sheet below. Every change saves
 * at once, field by field, with its acknowledgement beside it; there is no
 * Save step and closing discards nothing. Below the main weapon come the
 * off hand and the details of each weapon end in use. Keyed by the
 * routine's identity.
 */
export function AttackRoutineEditor({
  row,
  attacks,
  onClose,
  restoreFocus,
}: {
  row: Row;
  attacks: Attacks;
  onClose: () => void;
  /** Where focus goes once the panel has closed. */
  restoreFocus?: () => void;
}) {
  const isWide = useBreakpoint('wide');
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const weaponLabelId = useId();
  const handsLabelId = useId();
  const modeLabelId = useId();
  const detailsLabelId = useId();
  const editor = useAttackRoutineForm({
    value: {
      name: row.name,
      weaponEntryId: row.weaponEntryId,
      hands: row.hands,
      mode: row.mode,
      offHand: row.offHand ?? null,
    },
    save: (patch) => attacks.edit(row.entryId, patch),
    operationId: attacks.operationId,
  });
  const { form } = editor;
  const values = form.watch();
  const isDirty = form.formState.isDirty;
  const isReadOnly = maintenance.readOnly;
  const describedBy = isReadOnly ? reasonId : undefined;
  const removal = attacks.statusFor(row.entryId);
  const weapon = attacks.weapons.find(
    (candidate) => candidate.entryId === values.weaponEntryId,
  );
  const weaponWarning = row.warnings.find(
    (warning) =>
      warning.subject === row.entryId &&
      [
        'missingAttackWeapon',
        'inactiveAttackWeapon',
        'invalidAttackWeapon',
        'unavailableAttackWeapon',
      ].includes(warning.check),
  );
  const offHand = values.offHand ?? null;
  const offHandWeapon =
    offHand?.kind === 'weapon'
      ? attacks.weapons.find(
          (candidate) => candidate.entryId === offHand.weaponEntryId,
        )
      : undefined;
  // Each Gear weapon's ends once: the main weapon's, then a separate off hand's.
  const ends = [
    ...(weapon
      ? [
          { weapon, end: 'primary' as WeaponEnd },
          ...(weapon.weapon.otherEnd
            ? [{ weapon, end: 'otherEnd' as WeaponEnd }]
            : []),
        ]
      : []),
    ...(offHandWeapon && offHandWeapon.entryId !== weapon?.entryId
      ? [{ weapon: offHandWeapon, end: 'primary' as WeaponEnd }]
      : []),
  ];
  const isLightInTwoHands =
    weapon?.weapon.handedness === 'light' && values.hands === 'two';

  function change<Name extends Field>(
    field: Name,
    next: AttackRoutineValues[Name],
  ) {
    if (isReadOnly) return;
    void editor.change(field, next);
  }
  function feedback(field: Field, label: string) {
    return (
      <AttackFieldFeedback
        status={editor.statusFor(field)}
        label={label}
        isDisabled={isReadOnly}
        onRetry={() => void editor.retry(field)}
      />
    );
  }
  async function remove() {
    if (await attacks.remove(row.entryId)) onClose();
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={isWide ? 'right' : 'bottom'}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!restoreFocus) return;
          event.preventDefault();
          restoreFocus();
        }}
        className={cn(
          'gap-0',
          isWide
            ? 'w-full sm:max-w-md'
            : 'max-h-[85vh] pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="font-sans text-xl font-normal">
            Attack routine
          </SheetTitle>
        </SheetHeader>
        <MaintenanceReasonScope id={reasonId}>
          <Form {...form}>
            <form
              noValidate
              aria-label={`Edit ${row.name}`}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
              onSubmit={(event) => event.preventDefault()}
            >
              <RemoteNotice
                isShown={editor.hasRemoteChange}
                message={
                  isDirty
                    ? 'Changed by another player. Your edits are kept.'
                    : 'Changed by another player.'
                }
                subject={row.name}
                onDismiss={editor.dismissRemoteChange}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem className="gap-1">
                    <FormLabel className={fieldLabel}>Routine name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        autoComplete="off"
                        disabled={isReadOnly}
                        className="h-11 font-sans md:h-9"
                        onChange={(event) => change('name', event.target.value)}
                      />
                    </FormControl>
                    <FormMessage
                      role={fieldState.error ? 'alert' : undefined}
                      className={fieldState.error ? undefined : 'hidden'}
                    />
                    {feedback('name', 'routine name')}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weaponEntryId"
                render={({ field, fieldState }) => (
                  <FormItem className="gap-1">
                    <span id={weaponLabelId} className={fieldLabel}>
                      Main weapon
                    </span>
                    {weapon ? null : (
                      <p className="text-xs text-amber-300">
                        {weaponWarning?.message}
                      </p>
                    )}
                    {attacks.weapons.length === 0 ? (
                      <p className={hint}>No weapons in Gear.</p>
                    ) : (
                      <FormControl>
                        <RadioGroup
                          aria-labelledby={weaponLabelId}
                          name={field.name}
                          value={field.value}
                          disabled={isReadOnly}
                          onBlur={field.onBlur}
                          onValueChange={(next) =>
                            change('weaponEntryId', next)
                          }
                          className="grid-cols-1 gap-1 sm:grid-cols-2"
                        >
                          {attacks.weapons.map((choice) => (
                            <RadioGroupItem
                              key={choice.entryId}
                              value={choice.entryId}
                              aria-label={
                                choice.active
                                  ? choice.label
                                  : `${choice.label}, switched off`
                              }
                              aria-describedby={cn(
                                `${weaponLabelId}-${choice.entryId}`,
                                describedBy,
                              )}
                              className={weaponCard}
                            >
                              <span className="flex w-full flex-wrap items-baseline gap-x-2">
                                <span className="min-w-0 font-sans text-base [overflow-wrap:anywhere]">
                                  {choice.label}
                                </span>
                                {choice.active ? null : (
                                  <span
                                    className={cn(
                                      chip,
                                      'text-muted-foreground',
                                    )}
                                  >
                                    Switched off
                                  </span>
                                )}
                              </span>
                              <span
                                id={`${weaponLabelId}-${choice.entryId}`}
                                className="text-muted-foreground text-xs [overflow-wrap:anywhere]"
                              >
                                {describeWeapon(choice.weapon)}
                              </span>
                            </RadioGroupItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                    )}
                    <FormMessage
                      role={fieldState.error ? 'alert' : undefined}
                      className={fieldState.error ? undefined : 'hidden'}
                    />
                    {feedback('weaponEntryId', 'main weapon')}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hands"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <span id={handsLabelId} className={fieldLabel}>
                      Held in
                    </span>
                    <FormControl>
                      <RadioGroup
                        aria-labelledby={handsLabelId}
                        name={field.name}
                        value={field.value}
                        disabled={isReadOnly}
                        onBlur={field.onBlur}
                        onValueChange={(next) =>
                          change('hands', attackRoutineHandsSchema.parse(next))
                        }
                        className="grid-cols-2 gap-1"
                      >
                        {(['one', 'two'] as const).map((hands) => (
                          <RadioGroupItem
                            key={hands}
                            value={hands}
                            aria-describedby={describedBy}
                          >
                            {handsLabels[hands]}
                          </RadioGroupItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    {isLightInTwoHands ? (
                      <p className={hint}>
                        A light weapon in two hands still adds Strength once.
                      </p>
                    ) : null}
                    {feedback('hands', 'held in')}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <span id={modeLabelId} className={fieldLabel}>
                      Attack mode
                    </span>
                    <FormControl>
                      <RadioGroup
                        aria-labelledby={modeLabelId}
                        name={field.name}
                        value={field.value}
                        disabled={isReadOnly}
                        onBlur={field.onBlur}
                        onValueChange={(next) =>
                          change('mode', attackRoutineModeSchema.parse(next))
                        }
                        className="grid-cols-3 gap-1"
                      >
                        {(['melee', 'ranged', 'thrown'] as const).map(
                          (mode) => (
                            <RadioGroupItem
                              key={mode}
                              value={mode}
                              aria-describedby={describedBy}
                            >
                              {modeLabels[mode]}
                            </RadioGroupItem>
                          ),
                        )}
                      </RadioGroup>
                    </FormControl>
                    {feedback('mode', 'attack mode')}
                  </FormItem>
                )}
              />
              <AttackRoutineOffHandField
                row={row}
                attacks={attacks}
                editor={editor}
                mainWeaponEntryId={values.weaponEntryId}
                offHand={offHand}
                isReadOnly={isReadOnly}
                describedBy={describedBy}
              />
              {ends.length > 0 ? (
                <section
                  aria-labelledby={detailsLabelId}
                  className="border-foreground/15 space-y-3 border-t pt-3"
                >
                  <div>
                    <h3 id={detailsLabelId} className={fieldLabel}>
                      Weapon details
                    </h3>
                    <p className={hint}>
                      Shared by every routine that uses the weapon.
                    </p>
                  </div>
                  {ends.map(({ weapon: gear, end }) => (
                    <AttackWeaponEndEditor
                      key={`${gear.entryId}:${end}`}
                      weapon={gear}
                      end={end}
                      attacks={attacks}
                      isReadOnly={isReadOnly}
                      describedBy={describedBy}
                    />
                  ))}
                </section>
              ) : null}
              <AttackRoutinePreview row={row} />
              <MaintenanceReason
                id={reasonId}
                notice={maintenance}
                className="text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    action,
                    'hover:text-destructive hover:border-destructive rounded-none',
                  )}
                  aria-describedby={describedBy}
                  disabled={removal.kind === 'saving' || isReadOnly}
                  onClick={() => void remove()}
                >
                  Remove routine
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(action, 'rounded-none font-sans')}
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
              <SaveFeedback
                status={removal}
                savedText=""
                savingText="Removing…"
                shouldHideWhenIdle
              />
            </form>
          </Form>
        </MaintenanceReasonScope>
      </SheetContent>
    </Sheet>
  );
}
