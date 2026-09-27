'use client';
import { Plus, X } from 'lucide-react';
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
import { cn } from '~/lib/utils';
import type { UpkeepSections, UpkeepTransfer } from './types';
import { clearRulesException, type UpkeepEdit } from './upkeep-edits';
import { IssueNotes, ReasonedDecision, signedGold, Step } from './upkeep-parts';
import {
  recordTransferFundsException,
  removeTransfer,
} from './upkeep-transfer-edits';
import { useTransferForm } from './use-transfer-form';
import { formatGold } from './week-frame/reference-copy';

// Step 5: the staged deposits and withdrawals in order, and the form that
// stages another. Players may stage transfers before the earlier steps are
// resolved; the treasury line only appears once those are known.

const directionLabels = { deposit: 'Deposit', withdraw: 'Withdrawal' };

function StagedTransfer({
  item,
  edit,
  disabled,
}: {
  item: UpkeepTransfer;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const fundsException = item.fundsException;
  const deposit = item.direction === 'deposit';
  return (
    <li className="space-y-2 rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {directionLabels[item.direction]}
          {item.legacyCharacterName !== null &&
            ` · ${item.legacyCharacterName}`}
        </span>
        <span className="shrink-0 font-mono text-sm">
          {signedGold(deposit ? item.copper : -item.copper)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${deposit ? 'deposit' : 'withdrawal'} of ${formatGold(item.copper)}`}
          disabled={disabled}
          className="shrink-0"
          onClick={() => {
            for (const e of removeTransfer(item)) edit(e);
          }}
        >
          <X />
        </Button>
      </div>
      {item.theftCopper !== null && (
        <p className="text-muted-foreground text-sm">
          Theft withholds {formatGold(-item.theftCopper)} of this deposit.
        </p>
      )}
      <IssueNotes issues={item.issues} />
      {fundsException && (
        <div className="space-y-2 border-l-2 border-amber-500/60 pl-3">
          <p className="text-sm">
            This withdrawal exceeds the available treasury.
          </p>
          <ReasonedDecision
            label="Reason for the rules exception"
            current={fundsException.reason}
            disabled={disabled}
            onSave={(reason) => {
              const e = recordTransferFundsException(item, reason);
              if (e) edit(e);
            }}
            onClear={() =>
              edit(clearRulesException(fundsException.exceptionId))
            }
          />
        </div>
      )}
    </li>
  );
}

// Deposit / Withdraw, an amount in gp and Add. The hook stages the edit and
// keeps an invalid amount in the field with its message.
function TransferForm({
  edit,
  disabled,
}: {
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const { form, submit } = useTransferForm(edit);
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-wrap items-start gap-x-3 gap-y-2"
      >
        <FormField
          name="direction"
          render={({ field }) => (
            <div
              role="group"
              aria-label="Transfer direction"
              className="inline-flex rounded-md border p-0.5 sm:mt-[1.375rem]"
            >
              {(['deposit', 'withdraw'] as const).map((direction) => {
                const pressed = field.value === direction;
                return (
                  <button
                    key={direction}
                    type="button"
                    aria-pressed={pressed}
                    disabled={disabled}
                    onClick={() => field.onChange(direction)}
                    className={cn(
                      'focus-visible:ring-ring/50 min-h-9 rounded-sm px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
                      pressed
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {direction === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </button>
                );
              })}
            </div>
          )}
        />
        <FormField
          name="amount"
          render={({ field }) => (
            <FormItem className="w-full sm:w-40">
              <FormLabel>Transfer amount (gp)</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  className="font-mono"
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={disabled}
          className="sm:mt-[1.375rem]"
        >
          <Plus />
          Add
        </Button>
      </form>
    </Form>
  );
}

export function Deposits({
  transfers,
  edit,
  disabled,
}: {
  transfers: UpkeepSections['transfers'];
  edit: UpkeepEdit;
  disabled: boolean;
}) {
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
      {transfers.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No deposits or withdrawals this week.
        </p>
      ) : (
        <ul aria-label="Staged transfers" className="space-y-2">
          {transfers.items.map((item) => (
            <StagedTransfer
              key={item.transferId}
              item={item}
              edit={edit}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
      {transfers.adjustments.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {`Table Adjustments apply after the whole week and are not included above: ${transfers.adjustments
            .map((adjustment) =>
              adjustment.operation === 'add'
                ? `${adjustment.label} ${signedGold(adjustment.copper)}`
                : `${adjustment.label}: treasury set to ${formatGold(adjustment.copper)}`,
            )
            .join('; ')}.`}
        </p>
      )}
      <TransferForm edit={edit} disabled={disabled} />
      <IssueNotes issues={transfers.issues} />
    </Step>
  );
}
