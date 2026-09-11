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
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepView } from './types';
import { ChoiceCards } from './choice-cards';
import { WholeNumberField } from './whole-number-field';

type Team = UpkeepView['teams'][number];
function RecoveryCost({
  team,
  edit,
  disabled,
}: {
  team: Team;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  const form = useForm({
    values: {
      cost: String(
        team.costCopper - (team.recoveryAdjustment?.deltaCopper ?? 0),
      ),
      reason: team.recoveryAdjustment?.reason ?? '',
    },
    resolver: zodResolver(
      z
        .object({
          cost: z
            .string()
            .min(1, 'A cost is required.')
            .regex(/^[0-9]+$/, 'Use digits only.')
            .refine(
              (value) => Number.isSafeInteger(Number(value)),
              'Enter a smaller whole number.',
            ),
          reason: z.string().trim(),
        })
        .refine(
          (values) =>
            Number(values.cost) === team.costCopper || values.reason.length > 0,
          {
            path: ['reason'],
            message: 'A reason is required for a changed recovery cost.',
          },
        ),
    ),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-3"
        onSubmit={form.handleSubmit((values) => {
          const deltaCopper = team.costCopper - Number(values.cost);
          edit({
            kind: 'upkeep_team',
            teamId: team.teamId,
            decision: {
              teamId: team.teamId,
              decision: 'recover',
              costCopper: team.costCopper,
            },
            recoveryAdjustment:
              deltaCopper === 0 ? null : { deltaCopper, reason: values.reason },
          });
        })}
      >
        <p className="text-muted-foreground text-sm">
          Rules recovery cost: {team.costCopper} copper. A changed cost becomes
          a reasoned treasury adjustment after the weekly rules outcome.
        </p>
        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recovery cost (copper)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  inputMode="numeric"
                  disabled={disabled}
                  onChange={(event) => {
                    if (!/^[0-9]*$/.test(event.target.value)) {
                      form.setError('cost', { message: 'Use digits only.' });
                      return;
                    }
                    form.clearErrors('cost');
                    field.onChange(event.target.value);
                  }}
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
              <FormLabel>Reason for recovery adjustment</FormLabel>
              <FormControl>
                <Input {...field} disabled={disabled} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={disabled}>
          Stage recovery
        </Button>
        {team.recoveryAdjustment && (
          <p role="note" className="text-sm">
            Recovery adjustment:{' '}
            {team.recoveryAdjustment.deltaCopper >= 0 ? '+' : ''}
            {team.recoveryAdjustment.deltaCopper} copper ·{' '}
            {team.recoveryAdjustment.reason}
          </p>
        )}
      </form>
    </Form>
  );
}
export function TeamRecovery({
  team,
  edit,
  disabled,
}: {
  team: Team;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  return (
    <Card
      role="group"
      aria-label={`${team.name} recovery`}
      className="space-y-3 p-4"
    >
      <h3 className="font-semibold">
        {team.name} · {team.status}
      </h3>
      <ChoiceCards
        label="Team decision"
        value={team.decision}
        disabled={disabled}
        choices={[
          ...(team.status === 'disabled'
            ? [
                {
                  value: 'recover',
                  label: 'Recover team',
                  description: `Restore the team for ${team.costCopper} copper.`,
                },
              ]
            : []),
          {
            value: 'leave',
            label: 'Leave team',
            description: 'Keep the team in its current condition.',
          },
          {
            value: 'remove',
            label: 'Remove team',
            description: 'Remove the team with a reasoned table ruling.',
          },
        ]}
        onChange={(value) => {
          const decision = z.enum(['recover', 'leave', 'remove']).parse(value);
          edit({
            kind: 'upkeep_team',
            teamId: team.teamId,
            decision: {
              teamId: team.teamId,
              decision,
              costCopper: team.costCopper,
              ...(team.roll === null
                ? {}
                : {
                    roll: {
                      dice: [team.roll],
                      sides: 20,
                      provenance: { kind: 'table' },
                      modifiers: [],
                    },
                  }),
            },
          });
        }}
      />
      {team.status === 'disabled' && (
        <RecoveryCost team={team} edit={edit} disabled={disabled} />
      )}
      {team.needsReturnRoll && (
        <WholeNumberField
          label={`${team.name} return die`}
          value={team.roll}
          required
          disabled={disabled}
          onValue={(value) =>
            edit({
              kind: 'upkeep_team',
              teamId: team.teamId,
              decision: {
                teamId: team.teamId,
                decision: team.decision ?? 'leave',
                ...(value === null
                  ? {}
                  : {
                      roll: {
                        dice: [value],
                        sides: 20,
                        provenance: { kind: 'table' },
                        modifiers: [],
                      },
                    }),
              },
            })
          }
        />
      )}
    </Card>
  );
}
