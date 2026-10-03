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
import {
  describeWeapon,
  handsLabels,
  modeLabels,
} from './attack-routine-view-model';
import {
  action,
  chip,
  fieldLabel,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import type { SaveStatus } from './save-status';
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
// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const weaponCard =
  'h-auto flex-col items-start justify-start gap-0.5 px-2.5 py-1.5 text-left transition-transform motion-safe:hover:-translate-y-0.5';

/** A field's own save: Saving…, Saved, or the refusal with Try again. */
function FieldFeedback({
  status,
  label,
  onRetry,
  isDisabled,
}: {
  status: SaveStatus;
  label: string;
  onRetry: () => void;
  isDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
      {status.kind === 'error' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 px-2 text-xs md:h-7"
          disabled={isDisabled}
          onClick={onRetry}
        >
          Try again <span className="sr-only">saving {label}</span>
        </Button>
      ) : null}
    </div>
  );
}

function summarize(lines: Row['singleView']) {
  const first = lines[0];
  if (!first) return '';
  const range = first.range ? `, ${first.range.text}` : '';
  return `${lines.map((line) => line.attack.text).join('/')} (${first.damage.text}/${first.critical.text}${range})`;
}

/** The saved routine as the sheet calculates it, kept until the next result arrives. */
function Preview({ row }: { row: Row }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="border-foreground/15 space-y-1 border-t pt-3"
    >
      <h3 id={id} className={fieldLabel}>
        As it attacks now
      </h3>
      {row.singleView.length > 0 ? (
        <dl className="space-y-0.5 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Single attack</dt>
            <dd className="font-mono [overflow-wrap:anywhere]">
              {summarize(row.singleView)}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Full attack</dt>
            <dd className="font-mono [overflow-wrap:anywhere]">
              {summarize(row.fullView)}
            </dd>
          </div>
        </dl>
      ) : null}
      {row.warnings.map((warning) => (
        <p
          key={`${warning.check}:${warning.subject}`}
          className="text-xs [overflow-wrap:anywhere] text-amber-300"
        >
          {warning.message}
        </p>
      ))}
    </section>
  );
}

/**
 * One Attack Routine's editor (approved prototype's routine editor): a
 * panel on the right from 768px, a bottom sheet below. Every change saves
 * at once, field by field, with its acknowledgement beside it; there is no
 * Save step and closing discards nothing. Keyed by the routine's identity.
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
  const editor = useAttackRoutineForm({
    value: {
      name: row.name,
      weaponEntryId: row.weaponEntryId,
      hands: row.hands,
      mode: row.mode,
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
  const weaponWarning = row.warnings.find((warning) =>
    [
      'missingAttackWeapon',
      'inactiveAttackWeapon',
      'invalidAttackWeapon',
      'unavailableAttackWeapon',
    ].includes(warning.check),
  );
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
      <FieldFeedback
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
              <Preview row={row} />
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
