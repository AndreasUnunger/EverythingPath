'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import { ChoiceCards } from './choice-cards';
import { TeamRecovery } from './team-recovery';
import { upkeepWarningMessages } from './upkeep-warnings';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RollFact, UpkeepView as UpkeepFacts } from './types';
import { RollTotalField } from './roll-total-field';
export const rollNames = {
  check: 'Attrition Loyalty',
  training: 'Attrition training',
  notoriety: 'Maximum-notoriety training',
  notorietyCheck: 'Notoriety Loyalty',
  loss: 'Treasury-shortage training',
};
const modifierLabels: Record<string, string> = {
  'rank-focus': 'Rank and focus',
  officers: 'Officers',
  helpful: 'Settlement support',
  overseer: 'Overseer',
};
function Roll({
  fact,
  edit,
  disabled,
}: {
  fact: RollFact;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{rollNames[fact.field]}</h3>
        <span className="text-muted-foreground font-mono text-xs">
          {fact.count}d{fact.sides}
          {fact.dc !== null ? ` · DC ${fact.dc}` : ''}
        </span>
      </div>
      <RollTotalField
        label={`${rollNames[fact.field]} roll`}
        spec={fact}
        recorded={fact.recorded}
        required
        disabled={disabled}
        onRoll={(roll) =>
          edit({ kind: 'upkeep_roll', field: fact.field, roll })
        }
      />
      {fact.modifier !== null && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            Calculated bonus{' '}
            <strong className="font-mono">
              {fact.modifier >= 0 ? '+' : ''}
              {fact.modifier}
            </strong>
          </span>
          <span>
            Total <strong className="font-mono">{fact.total ?? '—'}</strong>
          </span>
        </div>
      )}
      {fact.modifiers.length > 0 && (
        <ul className="text-muted-foreground text-xs">
          {fact.modifiers.map((modifier) => (
            <li key={modifier.source}>
              {modifierLabels[modifier.source] ?? 'Other rule modifier'}:{' '}
              {modifier.value >= 0 ? '+' : ''}
              {modifier.value}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
const transferSchema = z.object({
  characterId: z.string().min(1, 'Choose an officer.'),
  direction: z.enum(['deposit', 'withdraw']),
  amount: z
    .string()
    .min(1, 'An amount is required.')
    .regex(/^[0-9]+$/, 'Use digits only.')
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      'Enter a smaller whole number.',
    ),
});
function Transfers({
  view,
  edit,
  disabled,
}: {
  view: UpkeepFacts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  const officers = view.officers.filter((person) => person.roles.length);
  const form = useForm({
    defaultValues: {
      characterId: officers.length === 1 ? officers[0]!.characterId : '',
      direction: 'deposit' as const,
      amount: '',
    },
    resolver: zodResolver(transferSchema),
  });
  const submit = form.handleSubmit((values) => {
    edit({
      kind: 'upkeep_transfer',
      transfer: {
        transferId: crypto.randomUUID(),
        characterId: values.characterId,
        direction: values.direction,
        copper: Number(values.amount),
      },
    });
    form.reset({ ...values, amount: '' });
  });
  return (
    <Card className="space-y-3 p-4">
      <h3 className="font-semibold">Treasury transfers</h3>
      <p className="text-muted-foreground text-sm">
        Transfers take effect after training losses and rank changes.
      </p>
      <Form {...form}>
        <form
          noValidate
          onSubmit={submit}
          className="grid items-start gap-3 sm:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="characterId"
            render={({ field }) => (
              <FormItem className="min-w-0 sm:col-span-2">
                <ChoiceCards
                  label="Officer"
                  value={field.value}
                  disabled={disabled}
                  onChange={field.onChange}
                  choices={officers.map((person) => ({
                    value: person.characterId,
                    label: person.name ?? person.roles.join(', '),
                    description: person.roles.join(', '),
                  }))}
                />
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormItem className="min-w-0 sm:col-span-2">
                <ChoiceCards
                  label="Transfer direction"
                  value={field.value}
                  disabled={disabled}
                  onChange={field.onChange}
                  choices={[
                    {
                      value: 'deposit',
                      label: 'Deposit',
                      description: 'Give copper to the militia.',
                    },
                    {
                      value: 'withdraw',
                      label: 'Withdraw',
                      description: 'Take copper from the treasury.',
                    },
                  ]}
                />
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer amount (copper)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    disabled={disabled}
                    onChange={(event) => {
                      const text = event.target.value;
                      if (!/^[0-9]*$/.test(text)) {
                        form.setError('amount', {
                          message: 'Use digits only.',
                        });
                        return;
                      }
                      form.clearErrors('amount');
                      field.onChange(text);
                    }}
                  />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="sm:mt-6"
            disabled={disabled || officers.length === 0}
          >
            Stage transfer
          </Button>
        </form>
      </Form>
      {view.transfers.length > 0 && (
        <ul className="space-y-2">
          {view.transfers.map((transfer) => (
            <li
              key={transfer.transferId}
              className="flex items-center justify-between gap-3 border-t pt-2 text-sm"
            >
              <span>
                {transfer.direction === 'deposit' ? 'Deposit' : 'Withdraw'}{' '}
                {transfer.copper} copper ·{' '}
                {view.officers.find(
                  (person) => person.characterId === transfer.characterId,
                )?.name ?? 'Officer'}
              </span>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  edit({
                    kind: 'clear_upkeep_transfer',
                    transferId: transfer.transferId,
                  })
                }
              >
                Remove transfer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
function ReasonedDecision({
  label,
  current,
  disabled,
  onSave,
  onClear,
}: {
  label: string;
  current: string;
  disabled: boolean;
  onSave: (reason: string) => void;
  onClear: () => void;
}) {
  const form = useForm({
    values: { reason: current },
    resolver: zodResolver(
      z.object({ reason: z.string().trim().min(1, 'A reason is required.') }),
    ),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => onSave(values.reason))}
        className="space-y-2"
      >
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Input {...field} disabled={disabled} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={disabled}>
            Record decision
          </Button>
          {current && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={onClear}
            >
              Clear decision
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
export function UpkeepView({
  view,
  edit,
  disabled,
}: {
  view: UpkeepFacts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  return (
    <section aria-label="Upkeep" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs">Training after Upkeep</p>
          <p className="font-mono text-2xl" data-testid="upkeep-training">
            {view.after.training}
          </p>
          <p className="text-muted-foreground text-xs">
            Starting training: {view.before.training}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs">Treasury after Upkeep</p>
          <p className="font-mono text-2xl" data-testid="upkeep-treasury">
            {view.after.treasuryCopper} cp
          </p>
          <p className="text-muted-foreground text-xs">
            Minimum treasury: {view.minimumTreasuryCopper} cp
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs">Rank after Upkeep</p>
          <p className="font-mono text-2xl">{view.after.rank}</p>
          <p className="text-muted-foreground text-xs">
            Rank changes are calculated automatically.
          </p>
        </Card>
      </div>
      {view.skipped ? (
        <Card className="p-4">
          Upkeep is skipped for the militia’s first week.
        </Card>
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {view.rolls.map((fact) => (
              <Roll
                key={`${fact.field}:${fact.sides}:${fact.count}`}
                fact={fact}
                edit={edit}
                disabled={disabled}
              />
            ))}
          </div>
          {view.nearestSettlement.choices.length > 0 && (
            <Card className="space-y-2 p-4">
              <ChoiceCards
                label={`Nearest settlement${view.nearestSettlement.required ? ' · required' : ''}`}
                value={view.nearestSettlement.selected ?? 'none'}
                disabled={disabled}
                choices={[
                  { value: 'none', label: 'No selection' },
                  ...view.nearestSettlement.choices.map((settlement) => ({
                    value: settlement.settlementId,
                    label: settlement.name,
                  })),
                ]}
                onChange={(value) =>
                  edit({
                    kind: 'upkeep_settlement',
                    settlementId: value === 'none' ? null : value,
                  })
                }
              />
            </Card>
          )}
          {view.teams.map((team) => (
            <TeamRecovery
              key={team.teamId}
              team={team}
              edit={edit}
              disabled={disabled}
            />
          ))}
          {view.boons.map((boon) => (
            <Card key={boon.subjectId} className="space-y-3 p-4">
              <h3 className="font-semibold">
                Rank {boon.reward.rank} boon ·{' '}
                {view.officers.find(
                  (person) => person.characterId === boon.characterId,
                )?.name ?? 'Character'}
              </h3>
              <p className="text-sm">
                {boon.reward.kind === 'gift'
                  ? `${boon.reward.gift}, up to ${boon.reward.maxValueCopper} copper${boon.reward.fullyChargedWands ? '; wands fully charged' : ''}`
                  : boon.reward.kind === 'skilled'
                    ? `${boon.reward.skillRanks} skill rank`
                    : boon.reward.kind === 'title'
                      ? `${boon.reward.title}: ${boon.reward.feats.join(', ')}`
                      : `${boon.reward.xpPerPc ?? 0} XP per character`}
              </p>
              <ReasonedDecision
                label="Boon outcome"
                current={boon.acknowledgement?.outcome ?? ''}
                disabled={disabled}
                onSave={(outcome) =>
                  edit({
                    kind: 'acknowledge',
                    acknowledgement: {
                      acknowledgementId:
                        boon.acknowledgement?.acknowledgementId ??
                        `ack:${boon.subjectId}`,
                      subjectId: boon.subjectId,
                      outcome,
                    },
                  })
                }
                onClear={() => {
                  if (boon.acknowledgement)
                    edit({
                      kind: 'clear_acknowledgement',
                      acknowledgementId: boon.acknowledgement.acknowledgementId,
                    });
                }}
              />
            </Card>
          ))}
          {view.exceptions.map((exception) => (
            <Card
              key={exception.exceptionId}
              className="space-y-3 border-amber-500/50 p-4"
            >
              <h3 className="font-semibold">Table ruling · {exception.name}</h3>
              <p className="text-sm">
                {exception.ruleId === 'upkeep-team-removal'
                  ? 'Removing this team departs from normal Upkeep.'
                  : exception.ruleId === 'upkeep-recovery-funds'
                    ? 'This recovery exceeds the available treasury.'
                    : exception.ruleId === 'upkeep-transfer-funds'
                      ? 'This withdrawal exceeds the available treasury.'
                      : 'This transfer needs an officer or a table ruling.'}
              </p>
              <ReasonedDecision
                label="Reason for the rules exception"
                current={exception.reason}
                disabled={disabled}
                onSave={(reason) =>
                  edit({
                    kind: 'rules_exception',
                    exception: {
                      exceptionId: exception.exceptionId,
                      subjectId: exception.subjectId,
                      ruleId: exception.ruleId,
                      reason,
                    },
                  })
                }
                onClear={() =>
                  edit({
                    kind: 'clear_rules_exception',
                    exceptionId: exception.exceptionId,
                  })
                }
              />
            </Card>
          ))}
          <Transfers view={view} edit={edit} disabled={disabled} />
        </>
      )}
      {view.warnings.length > 0 && (
        <ul
          aria-label="Upkeep warnings"
          className="space-y-2 rounded-md border border-amber-500/50 p-3 text-sm"
        >
          {upkeepWarningMessages(view).map((message) => (
            <li key={message} role="note">
              {message}
            </li>
          ))}
        </ul>
      )}
      {!view.ready && (
        <p className="text-muted-foreground text-sm">
          Complete the required rolls and decisions to finish Upkeep.
        </p>
      )}
    </section>
  );
}
