'use client';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { EventCheckRow } from './event-check-row';
import { OverseerSupportControl } from './overseer-support-control';
import { newModifierSource } from './persistent-check-edits';
import { RollTotalField } from './roll-total-field';
import type {
  PersistentBonusChoice,
  PersistentRecordedModifier,
  PersistentRetained,
  PersistentRivalryCheck,
  PersistentTheftCheck,
  PersistentView,
  RivalrySkill,
} from './types';
import { signed } from './upkeep-parts';
import type { ModifierChange, PersistentCheck } from './use-persistent-check';
import { WholeNumberField } from './whole-number-field';

// The inputs of a carried event's saved check: Theft's Loyalty check row
// with its Overseer toggle, or Rivalry's officer check fields, each with the
// modifiers recorded on its roll and any recorded fields the check does not
// use. Everything here renders the view's facts; the hook builds each edit.

type Event = PersistentView['events'][number];
type Result = 'accepted' | 'failed';

const skills: { value: RivalrySkill; label: string }[] = [
  { value: 'diplomacy', label: 'Diplomacy' },
  { value: 'bluff', label: 'Bluff' },
  { value: 'intimidate', label: 'Intimidate' },
];

export function TheftCheckInputs({
  event,
  check,
  actions,
  disabled,
}: {
  event: Event;
  check: PersistentTheftCheck;
  actions: PersistentCheck;
  disabled: boolean;
}) {
  const subject = `${event.name} Loyalty check`;
  // The engine's own composition of this check carries the Overseer's
  // actual contribution for the toggle.
  const mitigation = event.checks.find(
    (entry) => entry.checkId === `${event.eventId}:mitigation`,
  );
  return (
    <div className="min-w-0 space-y-3">
      <EventCheckRow
        facts={check.row}
        recorded={check.recorded}
        disabled={disabled}
        onRoll={(roll) => void actions.setTheftRoll(roll)}
        support={
          <OverseerSupportControl
            eventId={event.eventId}
            check="loyalty"
            subject={subject}
            breakdown={mitigation?.modifiers}
          />
        }
      />
      <CheckModifiers
        subject={subject}
        modifiers={check.modifiers}
        bonusChoices={check.bonusChoices}
        hasRoll={Boolean(check.recorded)}
        disabled={disabled}
        onChange={(change) => actions.changeModifier('theft', change)}
      />
      {event.retained.length > 0 && (
        <RetainedDetails
          retained={event.retained}
          actions={actions}
          disabled={disabled}
        />
      )}
    </div>
  );
}

// The officer check that ends a Rivalry: the character, skill, skill bonus
// and roll on one wrapping row, the result beside them as in the Event check
// rows. The bonus and roll wait until the stored check can name both the
// character and the skill.
export function RivalryCheckInputs({
  event,
  check,
  actions,
  disabled,
}: {
  event: Event;
  check: PersistentRivalryCheck;
  actions: PersistentCheck;
  disabled: boolean;
}) {
  const subject = `${event.name} officer check`;
  const characterId = useId();
  const skillId = useId();
  const stored = check.characterId !== null && check.skill !== null;
  return (
    <fieldset aria-label={subject} className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-full min-w-0 space-y-1 sm:w-60">
          <Label htmlFor={characterId} className="text-xs">
            Character
          </Label>
          <Select
            value={actions.characterId ?? ''}
            disabled={disabled}
            onValueChange={(id) => void actions.setCharacter(id)}
          >
            <SelectTrigger
              id={characterId}
              className="min-h-11 w-full sm:min-h-9"
            >
              <SelectValue placeholder="Choose a character" />
            </SelectTrigger>
            <SelectContent>
              {check.characters.map((character) => (
                <SelectItem
                  key={character.value}
                  value={character.value}
                  disabled={!character.available}
                >
                  {character.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-0 space-y-1 sm:w-40">
          <Label htmlFor={skillId} className="text-xs">
            Skill
          </Label>
          <Select
            value={actions.skill ?? ''}
            disabled={disabled}
            onValueChange={(skill) =>
              void actions.setSkill(skill as RivalrySkill)
            }
          >
            <SelectTrigger id={skillId} className="min-h-11 w-full sm:min-h-9">
              <SelectValue placeholder="Choose a skill" />
            </SelectTrigger>
            <SelectContent>
              {skills.map((skill) => (
                <SelectItem key={skill.value} value={skill.value}>
                  {skill.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-0 sm:w-28">
          <WholeNumberField
            signed
            label="Skill bonus"
            value={check.skillBonus}
            required={check.required.skillBonus}
            disabled={disabled || !stored}
            onValue={(value) => void actions.setSkillBonus(value)}
          />
        </div>
        <div className="w-full min-w-0 sm:w-56">
          <RollTotalField
            label="Officer check roll"
            spec={check.spec}
            recorded={check.recorded}
            required={check.required.roll}
            disabled={disabled || !stored}
            onRoll={(roll) => void actions.setOfficerRoll(roll)}
          />
        </div>
      </div>
      {!stored && (
        <p className="text-muted-foreground text-xs">
          Choose the character and skill first.
        </p>
      )}
      <div className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]">
        {check.modifier === null ? (
          <p className="text-muted-foreground">
            The bonus is shown once the skill bonus is in.
          </p>
        ) : (
          <p className="flex flex-wrap gap-x-3">
            <span>
              Bonus{' '}
              <strong className="font-mono">{signed(check.modifier)}</strong>
            </span>
            {check.total !== null ? (
              <span>
                = <strong className="font-mono">{check.total}</strong> vs DC 20
              </span>
            ) : (
              <span className="text-muted-foreground">
                vs DC 20 · total after the roll
              </span>
            )}
          </p>
        )}
        {check.breakdown.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {check.breakdown
              .map((entry) => `${entry.label} ${signed(entry.value)}`)
              .join(' · ')}
          </p>
        )}
        {check.resultText !== null && (
          <p>
            {check.succeeded ? 'Success' : 'Failure'} · {check.resultText}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          The character’s own skill check: no officer or Overseer bonus applies.
        </p>
      </div>
      {check.unavailable && (
        <p role="note" className="text-sm text-amber-300">
          This character is no longer in the militia. Choose another character.
        </p>
      )}
      {check.notOfficer && (
        <p role="note" className="text-sm text-amber-300">
          Not an officer: this check needs a Rules Exception, recorded below.
        </p>
      )}
      <CheckModifiers
        subject={subject}
        modifiers={check.modifiers}
        bonusChoices={[]}
        hasRoll={Boolean(check.recorded)}
        disabled={disabled}
        onChange={(change) => actions.changeModifier('rivalry', change)}
      />
      {event.retained.length > 0 && (
        <RetainedDetails
          retained={event.retained}
          actions={actions}
          disabled={disabled}
        />
      )}
    </fieldset>
  );
}

// The modifiers recorded on one check's roll: a list with in-place edit and
// removal, and a small form behind "+ Modifier". A modifier belongs to its
// roll, so nothing can be added before the roll is in. A failed save keeps
// the form open with what was typed.
type Editing = { kind: 'add' } | { kind: 'edit'; index: number };
const alerts = {
  save: 'This modifier wasn’t saved. Try again.',
  remove: 'This modifier wasn’t removed. Try again.',
};

function CheckModifiers({
  subject,
  modifiers,
  bonusChoices,
  hasRoll,
  disabled,
  onChange,
}: {
  subject: string;
  modifiers: PersistentRecordedModifier[];
  bonusChoices: PersistentBonusChoice[];
  hasRoll: boolean;
  disabled: boolean;
  onChange: (change: ModifierChange) => Promise<Result>;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [alert, setAlert] = useState<keyof typeof alerts | null>(null);
  const open = (next: Editing) => {
    setAlert(null);
    setEditing(next);
  };
  const close = () => {
    setAlert(null);
    setEditing(null);
  };
  async function save(change: ModifierChange) {
    setAlert(null);
    const result = await onChange(change);
    if (result === 'accepted') setEditing(null);
    else setAlert('save');
    return result;
  }
  async function remove(index: number) {
    setAlert(null);
    const result = await onChange({ kind: 'remove', index });
    if (result === 'failed') setAlert('remove');
  }
  const current =
    editing?.kind === 'edit' ? modifiers[editing.index] : undefined;
  return (
    <div className="min-w-0 space-y-2">
      {modifiers.length > 0 && (
        <ul aria-label={`${subject} modifiers`} className="space-y-1 text-sm">
          {modifiers.map((modifier) => (
            <li
              key={modifier.index}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="font-mono">{signed(modifier.value)}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {modifier.label}
              </span>
              <span className="flex gap-1 sm:ml-auto">
                {modifier.kind !== 'bonus' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 sm:min-h-8"
                    disabled={disabled}
                    aria-label={`Edit modifier ${modifier.label}`}
                    onClick={() =>
                      open({ kind: 'edit', index: modifier.index })
                    }
                  >
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  disabled={disabled}
                  aria-label={`Remove modifier ${modifier.label}`}
                  onClick={() => void remove(modifier.index)}
                >
                  Remove
                </Button>
              </span>
              {modifier.note && (
                <span
                  role="note"
                  className="w-full min-w-0 text-xs [overflow-wrap:anywhere] text-amber-300"
                >
                  {modifier.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <ModifierForm
          key={editing.kind === 'add' ? 'add' : editing.index}
          initial={current ?? null}
          bonusChoices={editing.kind === 'add' ? bonusChoices : []}
          disabled={disabled}
          alert={alert === 'save' ? alerts.save : null}
          onCancel={close}
          onSave={({ sourceId, value, reason }) =>
            save(
              editing.kind === 'edit'
                ? { kind: 'edit', index: editing.index, value, reason }
                : {
                    kind: 'add',
                    modifier: {
                      sourceId: sourceId ?? newModifierSource(),
                      value,
                      reason,
                    },
                  },
            )
          }
        />
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !hasRoll}
            aria-label="Add modifier"
            className="text-muted-foreground min-h-11 sm:min-h-8"
            onClick={() => open({ kind: 'add' })}
          >
            <Plus aria-hidden />
            Modifier
          </Button>
          {!hasRoll && (
            <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
              Enter the roll first: modifiers are recorded with it.
            </p>
          )}
          {alert && (
            <p role="alert" className="text-destructive text-sm">
              {alerts[alert]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// One modifier's form: a rules bonus from the list, or a custom table
// modifier with a signed value and a reason. Validation is structural only;
// whether an entry counts is the rules' fact, shown as a note on the row.
const CUSTOM = '__custom__';
const wholeNumber = /^[+-]?\d+$/;
const modifierSchema = z
  .object({ source: z.string(), value: z.string(), reason: z.string() })
  .superRefine((values, ctx) => {
    if (values.source !== CUSTOM) return;
    const value = values.value.trim();
    if (value === '')
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Enter a value.',
      });
    else if (!wholeNumber.test(value) || !Number.isSafeInteger(Number(value)))
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Enter a whole number, such as -2 or 3.',
      });
    if (values.reason.trim() === '')
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required.',
      });
  });

function ModifierForm({
  initial,
  bonusChoices,
  disabled,
  alert,
  onSave,
  onCancel,
}: {
  initial: PersistentRecordedModifier | null;
  bonusChoices: PersistentBonusChoice[];
  disabled: boolean;
  alert: string | null;
  onSave: (modifier: {
    sourceId?: string;
    value: number;
    reason: string;
  }) => Promise<Result>;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      source: bonusChoices[0]?.sourceId ?? CUSTOM,
      value: initial ? String(initial.value) : '',
      reason: initial?.reason ?? '',
    },
    resolver: zodResolver(modifierSchema),
  });
  const custom = form.watch('source') === CUSTOM;
  const saving = form.formState.isSubmitting;
  const submit = form.handleSubmit(async (values) => {
    const bonus = bonusChoices.find(
      (choice) => choice.sourceId === values.source,
    );
    await onSave(
      bonus
        ? { sourceId: bonus.sourceId, value: bonus.value, reason: bonus.label }
        : // "-0" would otherwise record a negative zero.
          {
            value: Number(values.value.trim()) || 0,
            reason: values.reason.trim(),
          },
    );
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={submit}
        aria-label={initial ? 'Edit modifier' : 'New modifier'}
        className="bg-background/50 max-w-xl min-w-0 space-y-3 rounded-md border p-3"
      >
        {bonusChoices.length > 0 && (
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modifier</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="min-h-11 w-full sm:min-h-9">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bonusChoices.map((choice) => (
                      <SelectItem key={choice.sourceId} value={choice.sourceId}>
                        {choice.label} {signed(choice.value)}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={CUSTOM}>
                      Custom table modifier
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
        )}
        {custom && (
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="font-mono"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" disabled={disabled} />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />
          </div>
        )}
        {alert && (
          <p role="alert" className="text-destructive text-sm">
            {alert}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled || saving}>
            {saving ? 'Saving…' : initial ? 'Save modifier' : 'Add modifier'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Recorded check fields an older editor wrote that this check does not use,
// each removable on its own so nothing is dropped silently.
function RetainedDetails({
  retained,
  actions,
  disabled,
}: {
  retained: PersistentRetained[];
  actions: PersistentCheck;
  disabled: boolean;
}) {
  const remove = 'min-h-11 sm:ml-auto sm:min-h-8';
  return (
    <div className="text-muted-foreground min-w-0 space-y-2 rounded-md border p-3 text-sm">
      <h4 className="text-xs font-medium">
        Also recorded, not used by this check
      </h4>
      <ul className="space-y-1">
        {retained.map((entry) =>
          entry.field === 'targets' ? (
            <li key={entry.field} className="min-w-0 space-y-1">
              <span className="block">Targets</span>
              <ul className="space-y-1 pl-3">
                {entry.targets.map((name, index) => (
                  <li
                    // Targets may repeat a name: number repeats for stable keys.
                    key={`${name}#${entry.targets.slice(0, index).filter((other) => other === name).length}`}
                    className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
                  >
                    <span className="text-foreground min-w-0 [overflow-wrap:anywhere]">
                      {name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={remove}
                      disabled={disabled}
                      aria-label={`Remove retained target ${name}`}
                      onClick={() => void actions.removeRetainedTarget(index)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li
              key={entry.field}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {entry.label}:{' '}
                <span className="text-foreground">{entry.value}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={remove}
                disabled={disabled}
                aria-label={`Remove retained ${entry.label}`}
                onClick={() => void actions.clearRetained(entry.field)}
              >
                Remove
              </Button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
