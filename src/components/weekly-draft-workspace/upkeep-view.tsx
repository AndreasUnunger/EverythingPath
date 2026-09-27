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
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepSections, UpkeepView as UpkeepFacts } from './types';
import { IssueNotes, ReasonedDecision, Step } from './upkeep-parts';
import { Attrition, Notoriety, Shortage } from './upkeep-steps';
import { TeamConditions } from './upkeep-teams';
import { formatGold } from './week-frame/reference-copy';

// Upkeep as the numbered rules steps: team conditions, training attrition,
// maximum notoriety, treasury shortage, rank, then deposits and withdrawals.
// Each section reports only its own effect; the week frame carries readiness
// and the whole-week totals.

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
function Rank({
  view,
  rank,
  edit,
  disabled,
}: {
  view: UpkeepFacts;
  rank: UpkeepSections['rank'];
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  return (
    <Step
      number={4}
      title="Rank"
      status={rank.status}
      effect={
        rank.after === null
          ? 'Waiting for the steps above'
          : rank.after === rank.before
            ? `Stays rank ${rank.before}`
            : `Rank ${rank.before} → ${rank.after}`
      }
    >
      {rank.after === null && (
        <p className="text-muted-foreground text-sm">
          Rank is worked out once every roll and decision above is in.
        </p>
      )}
      {view.boons.map((boon) => (
        <Card key={boon.subjectId} className="space-y-3 p-4">
          <h4 className="font-semibold">
            Rank {boon.reward.rank} boon ·{' '}
            {view.officers.find(
              (person) => person.characterId === boon.characterId,
            )?.name ?? 'Character'}
          </h4>
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
      <IssueNotes issues={rank.issues} />
    </Step>
  );
}
function Deposits({
  view,
  transfers,
  edit,
  disabled,
}: {
  view: UpkeepFacts;
  transfers: UpkeepSections['transfers'];
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  const exceptions = view.exceptions.filter((exception) =>
    exception.ruleId.startsWith('upkeep-transfer-'),
  );
  return (
    <Step
      number={5}
      title="Deposits and withdrawals"
      status={transfers.status}
      effect={
        transfers.beforeCopper === null || transfers.afterCopper === null
          ? 'Waiting for the steps above'
          : `Treasury ${formatGold(transfers.beforeCopper)} → ${formatGold(transfers.afterCopper)}`
      }
    >
      <Transfers view={view} edit={edit} disabled={disabled} />
      {exceptions.map((exception) => (
        <Card
          key={exception.exceptionId}
          className="space-y-3 border-amber-500/50 p-4"
        >
          <h4 className="font-semibold">Table ruling · {exception.name}</h4>
          <p className="text-sm">
            {exception.ruleId === 'upkeep-transfer-funds'
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
      <IssueNotes issues={transfers.issues} />
    </Step>
  );
}
// `correctionsHref` links a retained Remove choice to Militia corrections,
// where teams are removed now; without it the link stays off.
export function UpkeepView({
  view,
  edit,
  disabled,
  correctionsHref,
}: {
  view: UpkeepFacts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  correctionsHref?: string;
}) {
  const sections = view.sections;
  if (view.skipped || !sections)
    return (
      <section aria-label="Upkeep">
        <Card className="space-y-1 p-4">
          <p>Upkeep is skipped for the militia’s first week.</p>
          <p className="text-muted-foreground text-sm">
            No team recovery, attrition, rank or transfers this week.
          </p>
        </Card>
      </section>
    );
  return (
    <section aria-label="Upkeep" className="space-y-6">
      <TeamConditions
        teams={sections.teams}
        correctionsHref={correctionsHref}
        edit={edit}
        disabled={disabled}
      />
      <Attrition
        attrition={sections.attrition}
        rank={view.before.rank}
        edit={edit}
        disabled={disabled}
      />
      <Notoriety
        notoriety={sections.notoriety}
        edit={edit}
        disabled={disabled}
      />
      <Shortage shortage={sections.shortage} edit={edit} disabled={disabled} />
      <Rank view={view} rank={sections.rank} edit={edit} disabled={disabled} />
      <Deposits
        view={view}
        transfers={sections.transfers}
        edit={edit}
        disabled={disabled}
      />
      {sections.general.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Also this week</p>
          <IssueNotes issues={sections.general} />
        </div>
      )}
    </section>
  );
}
