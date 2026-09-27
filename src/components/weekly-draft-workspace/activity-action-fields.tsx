'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  actionChoiceRolls,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import {
  destinationValue,
  type ActionDetail,
  type DetailConsumables,
  type DetailOption,
  type DetailRoll,
  type PeopleTeamActionId,
} from './activity-action-detail';
import {
  recruitmentCheckFormSchema,
  recruitmentCheckFromForm,
  type ActionFieldEdits,
  type RecruitmentCheckForm,
} from './activity-action-edits';
import { signed } from './activity-check-row';
import { activityLabel } from './activity-labels';
import { ActivityModifierForm } from './activity-modifier-form';
import { ActivityOptionCards } from './activity-option-cards';
import { ActivityText } from './activity-text';
import { RollTotalField } from './roll-total-field';
import { WholeNumberField } from './whole-number-field';

// The detail editor for the people and team actions: the action's own
// choices as option cards, then the cost, the dice rolls with their table
// modifiers, and the consumables every action shares. Each control writes
// one named field edit; the host renders the acknowledgements and exceptions.

type Choice<Id extends PeopleTeamActionId = PeopleTeamActionId> = Extract<
  StagedActionChoice,
  { actionId: Id }
>;
type Detail<Id extends PeopleTeamActionId> = Extract<
  ActionDetail,
  { actionId: Id }
>;
type FieldError = { field: string; message: string } | null;
type Ctx = {
  edits: ActionFieldEdits;
  disabled: boolean;
  fieldError: FieldError;
};
type Fields<Id extends PeopleTeamActionId> = {
  choice: Choice<Id>;
  detail: Detail<Id>;
  ctx: Ctx;
};

const CHECK_KINDS = ['loyalty', 'secrecy', 'security'] as const;

function Field({
  name,
  ctx,
  children,
}: {
  name: string;
  ctx: Ctx;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      {children}
      {ctx.fieldError?.field === name && (
        <p role="alert" className="text-destructive text-sm">
          {ctx.fieldError.message}
        </p>
      )}
    </div>
  );
}

function OptionField({
  ctx,
  field,
  label,
  options,
  value,
  otherLabel,
  description,
  onSelect,
  onClear,
}: {
  ctx: Ctx;
  field: string;
  label: string;
  options: DetailOption[];
  value: string | null;
  otherLabel: string;
  description?: ReactNode;
  // Default to the plain field edit of `field`.
  onSelect?: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <Field name={field} ctx={ctx}>
      <ActivityOptionCards
        label={label}
        options={options}
        value={value}
        otherLabel={otherLabel}
        description={description}
        disabled={ctx.disabled}
        onSelect={onSelect ?? ((next) => ctx.edits.set(field, next))}
        onClear={onClear ?? (() => ctx.edits.clear(field))}
      />
    </Field>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="text-sm text-amber-300">
      {children}
    </p>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

function LevelField({
  ctx,
  level,
  ruleLevel,
}: {
  ctx: Ctx;
  level: number | undefined;
  ruleLevel: number | null;
}) {
  return (
    <Field name="characterLevel" ctx={ctx}>
      <WholeNumberField
        label="Character level"
        value={level ?? ruleLevel}
        disabled={ctx.disabled}
        onValue={(next) => ctx.edits.set('characterLevel', next ?? undefined)}
        description={
          level === undefined && ruleLevel !== null
            ? 'From the character’s record.'
            : ruleLevel !== null
              ? `Record: level ${ruleLevel}. The rules use the recorded level.`
              : 'Level not recorded for this character.'
        }
      />
    </Field>
  );
}

function OfficerRoleFields({
  choice,
  detail,
  ctx,
}: Fields<'change_officer_role'>) {
  return (
    <>
      <OptionField
        ctx={ctx}
        field="characterId"
        label="Character"
        options={detail.characters}
        value={choice.characterId ?? null}
        otherLabel="Other characters"
      />
      {detail.heldRoles !== null && (
        <p className="text-sm">
          {detail.heldRoles.length > 0
            ? `Roles at this slot: ${detail.heldRoles.map(activityLabel).join(', ')}`
            : 'Holds no officer role at this slot.'}
        </p>
      )}
      <OptionField
        ctx={ctx}
        field="fromRole"
        label="From role"
        options={detail.fromRoles}
        value={choice.fromRole ?? null}
        otherLabel="Not held at this slot"
      />
      <OptionField
        ctx={ctx}
        field="toRole"
        label="To role"
        options={detail.toRoles}
        value={choice.toRole ?? null}
        otherLabel="Already held"
      />
      <Muted>
        Leave From role empty to take a new role; leave To role empty to only
        give one up.
      </Muted>
      <Muted>
        This is a staged weekly action: the officer change happens in slot order
        when the week is confirmed, and later slots already count it.
      </Muted>
    </>
  );
}

// The table-chosen check for a team type without recruitment rules.
function RecruitmentCheckFields({
  recorded,
  ctx,
}: {
  recorded: Choice<'recruit_team'>['recruitmentCheck'];
  ctx: Ctx;
}) {
  const form = useForm({
    // No check is chosen until the table picks one; the schema requires it.
    values: recorded
      ? { check: recorded.check, dc: String(recorded.dc) }
      : ({ dc: '' } as RecruitmentCheckForm),
    mode: 'onBlur',
    resolver: zodResolver(recruitmentCheckFormSchema),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        aria-label="Recruitment check"
        onSubmit={form.handleSubmit((values) =>
          ctx.edits.setRecruitmentCheck(recruitmentCheckFromForm(values)),
        )}
        className="space-y-2"
      >
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,8rem)]">
          <FormField
            control={form.control}
            name="check"
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-1">
                <FormLabel className="text-xs">Recruitment check</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={ctx.disabled}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a check" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CHECK_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind} className="min-h-10">
                        {activityLabel(kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="min-h-5">
                  <FormMessage role="alert" />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dc"
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-1">
                <FormLabel className="text-xs">Recruitment DC</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    disabled={ctx.disabled}
                  />
                </FormControl>
                <div className="min-h-5">
                  <FormMessage role="alert" />
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={ctx.disabled}>
            Save recruitment check
          </Button>
          {recorded && <ClearRecruitmentCheck ctx={ctx} />}
        </div>
      </form>
    </Form>
  );
}

function ClearRecruitmentCheck({ ctx }: { ctx: Ctx }) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={ctx.disabled}
      onClick={() => ctx.edits.setRecruitmentCheck(null)}
    >
      Clear recruitment check
    </Button>
  );
}

function RecruitTeamFields({ choice, detail, ctx }: Fields<'recruit_team'>) {
  const recruitment = detail.recruitment;
  const typeName =
    detail.teamTypes.find((option) => option.value === choice.teamType)
      ?.label ?? 'This team type';
  return (
    <>
      <OptionField
        ctx={ctx}
        field="teamType"
        label="Team type"
        options={detail.teamTypes}
        value={choice.teamType ?? null}
        otherLabel="No recruitment rules (needs a Rules Exception)"
      />
      {recruitment.kind !== 'none' && (
        <Field name="recruitmentCheck" ctx={ctx}>
          {recruitment.kind === 'rules' && (
            <p className="text-sm">
              Recruitment check: {activityLabel(recruitment.check)} DC{' '}
              {recruitment.dc}, from the team table.
            </p>
          )}
          {recruitment.kind === 'table' && (
            <div className="space-y-2">
              <Muted>
                This team type has no recruitment rules. With a Rules Exception,
                the table chooses the check and DC.
              </Muted>
              <RecruitmentCheckFields
                recorded={choice.recruitmentCheck}
                ctx={ctx}
              />
            </div>
          )}
          {recruitment.kind === 'retained' && choice.recruitmentCheck && (
            <div className="space-y-2">
              <Note>
                The recorded table check (
                {activityLabel(choice.recruitmentCheck.check)} DC{' '}
                {choice.recruitmentCheck.dc}) is not used: {typeName} recruit
                with {activityLabel(recruitment.rules.check)} DC{' '}
                {recruitment.rules.dc}.
              </Note>
              <ClearRecruitmentCheck ctx={ctx} />
            </div>
          )}
        </Field>
      )}
    </>
  );
}

function UpgradeTeamFields({ choice, detail, ctx }: Fields<'upgrade_team'>) {
  return (
    <>
      <OptionField
        ctx={ctx}
        field="targetTeamId"
        label="Team to upgrade"
        options={detail.targets}
        value={choice.targetTeamId ?? null}
        otherLabel="Other teams"
      />
      <OptionField
        ctx={ctx}
        field="toTeamType"
        label="Upgrade to"
        options={detail.destinations}
        value={choice.toTeamType ?? null}
        otherLabel="Not on this team’s upgrade path (needs a Rules Exception)"
        description={
          choice.targetTeamId
            ? undefined
            : 'Choose the team first to see its upgrade path.'
        }
      />
    </>
  );
}

function RescueFields({ choice, detail, ctx }: Fields<'rescue_character'>) {
  return (
    <>
      <OptionField
        ctx={ctx}
        field="characterId"
        label="Character"
        options={detail.characters}
        value={choice.characterId ?? null}
        otherLabel="Not captured"
      />
      <LevelField
        ctx={ctx}
        level={choice.characterLevel}
        ruleLevel={detail.ruleLevel}
      />
      <OptionField
        ctx={ctx}
        field="destination"
        label="Destination"
        options={detail.destinations}
        value={destinationValue(choice)}
        otherLabel="No active refuge (needs a Rules Exception)"
        onSelect={(next) => ctx.edits.setDestination(next)}
        onClear={() => ctx.edits.setDestination(null)}
      />
    </>
  );
}

const TARGET_PRESENT: DetailOption[] = [
  {
    value: 'true',
    label: 'Present',
    description: null,
    eligible: true,
    missing: false,
  },
  {
    value: 'false',
    label: 'Not present',
    description: 'Needs a Rules Exception',
    eligible: false,
    missing: false,
  },
];

function RestoreFields({ choice, detail, ctx }: Fields<'restore_character'>) {
  const restorative = choice.mode === 'restorative_effect';
  const effectRecorded =
    choice.effect !== undefined || choice.effectLevel !== undefined;
  return (
    <>
      <OptionField
        ctx={ctx}
        field="mode"
        label="Mode"
        options={detail.modes}
        value={choice.mode ?? null}
        otherLabel="Other modes"
      />
      {detail.scope === 'party' && choice.characterId === undefined && (
        <Muted>Restores every player character on the roster.</Muted>
      )}
      {(detail.scope === 'individual' || choice.characterId !== undefined) && (
        <>
          {detail.scope === 'party' && (
            <Note>
              Party restoration covers every player character; the recorded
              character is not used. Clear it or choose an individual mode.
            </Note>
          )}
          <OptionField
            ctx={ctx}
            field="characterId"
            label="Character"
            options={detail.characters}
            value={choice.characterId ?? null}
            otherLabel="Captured (needs a Rules Exception)"
          />
          <LevelField
            ctx={ctx}
            level={choice.characterLevel}
            ruleLevel={detail.ruleLevel}
          />
        </>
      )}
      {(restorative || effectRecorded) && (
        <div className="space-y-3">
          {!restorative && (
            <Note>
              Not used by this mode; kept until you clear or replace it.
            </Note>
          )}
          <Field name="effect" ctx={ctx}>
            <ActivityText
              name="Effect"
              value={choice.effect ?? ''}
              disabled={ctx.disabled}
              onValue={(text) =>
                ctx.edits.set('effect', text.trim() || undefined)
              }
            />
          </Field>
          <Field name="effectLevel" ctx={ctx}>
            <WholeNumberField
              label="Effect level"
              value={choice.effectLevel ?? null}
              disabled={ctx.disabled}
              onValue={(next) =>
                ctx.edits.set('effectLevel', next ?? undefined)
              }
            />
          </Field>
          {!restorative && (
            <div className="flex flex-wrap gap-2">
              {choice.effect !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={ctx.disabled}
                  onClick={() => ctx.edits.clear('effect')}
                >
                  Clear effect
                </Button>
              )}
              {choice.effectLevel !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={ctx.disabled}
                  onClick={() => ctx.edits.clear('effectLevel')}
                >
                  Clear effect level
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <OptionField
        ctx={ctx}
        field="targetPresent"
        label="Target present"
        options={TARGET_PRESENT}
        value={
          choice.targetPresent === undefined
            ? null
            : String(choice.targetPresent)
        }
        otherLabel="Other"
        onSelect={(next) => ctx.edits.set('targetPresent', next === 'true')}
        onClear={() => ctx.edits.clear('targetPresent')}
      />
    </>
  );
}

function Specific({
  choice,
  detail,
  ctx,
}: {
  choice: Choice;
  detail: ActionDetail;
  ctx: Ctx;
}) {
  switch (detail.actionId) {
    case 'change_officer_role':
      return choice.actionId === detail.actionId ? (
        <OfficerRoleFields choice={choice} detail={detail} ctx={ctx} />
      ) : null;
    case 'recruit_team':
      return choice.actionId === detail.actionId ? (
        <RecruitTeamFields choice={choice} detail={detail} ctx={ctx} />
      ) : null;
    case 'upgrade_team':
      return choice.actionId === detail.actionId ? (
        <UpgradeTeamFields choice={choice} detail={detail} ctx={ctx} />
      ) : null;
    case 'dismiss_team':
      return choice.actionId === detail.actionId ? (
        <OptionField
          ctx={ctx}
          field="targetTeamId"
          label="Team to dismiss"
          options={detail.targets}
          value={choice.targetTeamId ?? null}
          otherLabel="Other teams"
        />
      ) : null;
    case 'rescue_character':
      return choice.actionId === detail.actionId ? (
        <RescueFields choice={choice} detail={detail} ctx={ctx} />
      ) : null;
    case 'restore_character':
      return choice.actionId === detail.actionId ? (
        <RestoreFields choice={choice} detail={detail} ctx={ctx} />
      ) : null;
    case 'lie_low':
      return (
        <Muted>
          Lie Low has no other choices. When the week is confirmed, Notoriety
          falls by one for each team.
        </Muted>
      );
    default:
      return null;
  }
}

function RollBlock({
  roll,
  choice,
  ctx,
}: {
  roll: DetailRoll;
  choice: Choice;
  ctx: Ctx;
}) {
  const [adding, setAdding] = useState(false);
  const recorded = actionChoiceRolls(choice)[roll.field];
  // Each entry is removed by its recorded position, so repeated or legacy
  // modifiers clear one at a time.
  const positioned = (recorded?.modifiers ?? []).map((modifier, index) => ({
    modifier,
    index,
  }));
  const name = roll.label.toLowerCase();
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">
        {`${roll.label} · ${roll.spec.count}d${roll.spec.sides}`}
      </legend>
      {roll.when && (
        <p className="text-muted-foreground text-xs">{roll.when}</p>
      )}
      <RollTotalField
        label={`${roll.label} roll`}
        spec={roll.spec}
        recorded={recorded}
        required={roll.required}
        disabled={ctx.disabled}
        onRoll={(next) => ctx.edits.setRoll(roll.field, next)}
      />
      {recorded && (
        <div className="space-y-2">
          {recorded.modifiers.length > 0 && (
            <ul
              aria-label={`${roll.label} roll modifiers`}
              className="max-w-xl divide-y rounded-md border text-sm"
            >
              {positioned.map(({ modifier, index }) => (
                <li
                  key={index}
                  className="flex min-h-11 items-center gap-3 px-3 py-1.5"
                >
                  <span className="w-8 shrink-0 font-mono">
                    {signed(modifier.value)}
                  </span>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {modifier.reason}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${name} roll modifier ${modifier.reason}`}
                    disabled={ctx.disabled}
                    onClick={() =>
                      ctx.edits.removeRollModifier(roll.field, index)
                    }
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground text-xs">
            The rules use the dice total; these modifiers are kept with the roll
            for the table.
          </p>
          {adding ? (
            <ActivityModifierForm
              bonusChoices={[]}
              disabled={ctx.disabled}
              onAdd={(modifier) => {
                ctx.edits.addRollModifier(roll.field, modifier);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2"
              disabled={ctx.disabled}
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden />
              Add {name} roll modifier
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}

function Consumables({
  consumables,
  ctx,
}: {
  consumables: DetailConsumables;
  ctx: Ctx;
}) {
  if (consumables.selected.length === 0 && consumables.available.length === 0)
    return null;
  return (
    <Field name="consumableIds" ctx={ctx}>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Consumables</h3>
        <p className="text-muted-foreground text-xs">
          A consumable bonus is used by this choice’s check.
        </p>
        {consumables.selected.length > 0 && (
          <ul
            aria-label="Selected consumables"
            className="max-w-xl divide-y rounded-md border text-sm"
          >
            {consumables.selected.map((entry) => (
              <li
                key={entry.value}
                className="flex min-h-11 items-center gap-3 px-3 py-1.5"
              >
                <span className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
                  <span className="block">{entry.label}</span>
                  {entry.missing && (
                    <span role="note" className="block text-xs text-amber-300">
                      Missing
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove consumable ${entry.label}`}
                  disabled={ctx.disabled}
                  onClick={() => ctx.edits.removeConsumable(entry.value)}
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {consumables.available.length > 0 && (
          <Select
            value=""
            disabled={ctx.disabled}
            onValueChange={(value) => ctx.edits.addConsumable(value)}
          >
            <SelectTrigger
              aria-label="Add consumable"
              className="w-full max-w-xl"
            >
              <SelectValue placeholder="Add consumable…" />
            </SelectTrigger>
            <SelectContent>
              {consumables.available.map((entry) => (
                <SelectItem
                  key={entry.value}
                  value={entry.value}
                  className="min-h-10"
                >
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </Field>
  );
}

export function ActivityActionFields({
  choice,
  detail,
  calculatedCostCopper,
  disabled,
  edits,
  fieldError,
}: {
  choice: Choice;
  detail: ActionDetail;
  calculatedCostCopper: number | null;
  disabled: boolean;
  edits: ActionFieldEdits;
  // A structural save failure for one choice field, shown under its control.
  fieldError: FieldError;
}) {
  const ctx: Ctx = { edits, disabled, fieldError };
  return (
    <div className="min-w-0 space-y-4">
      <Specific choice={choice} detail={detail} ctx={ctx} />
      <Field name="costCopper" ctx={ctx}>
        <WholeNumberField
          label="Cost (copper)"
          value={choice.costCopper ?? calculatedCostCopper}
          disabled={disabled}
          onValue={(next) => edits.set('costCopper', next ?? undefined)}
          description={
            calculatedCostCopper !== null
              ? `Calculated: ${calculatedCostCopper} cp`
              : 'The rules calculate no cost for this action.'
          }
        />
      </Field>
      {detail.rolls.length > 0 && (
        <Field name="rolls" ctx={ctx}>
          <div className="space-y-4">
            {detail.rolls.map((roll) => (
              <RollBlock
                key={roll.field}
                roll={roll}
                choice={choice}
                ctx={ctx}
              />
            ))}
          </div>
        </Field>
      )}
      {detail.consumables && (
        <Consumables consumables={detail.consumables} ctx={ctx} />
      )}
    </div>
  );
}
