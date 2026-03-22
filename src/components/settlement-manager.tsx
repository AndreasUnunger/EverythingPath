'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { militiaQuery, settlementLedgerQuery } from '~/lib/sharedQueries';
import { SettlementFormCard } from './settlement-manager/settlement-form-card';
import { SettlementListCard } from './settlement-manager/settlement-list-card';
import {
  defaultSettlementFormValues,
  settlementFormSchema,
  type SettlementFormValues,
  type SettlementId,
  type SettlementRecord,
} from './settlement-manager/types';

export function SettlementManager({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const [editingId, setEditingId] = useState<SettlementId | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string>();

  const form = useForm<SettlementFormValues>({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: defaultSettlementFormValues,
  });

  const { data: settlements = [], isLoading } = settlementLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );
  const { data: militia, isLoading: isLoadingMilitia } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );

  const upsertSettlement = useMutation(db.militia.upsertSettlementState);

  if (!selectedCampaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to manage settlements.
      </p>
    );
  }

  if (!canQuery) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Waiting for organization access sync...
      </p>
    );
  }

  if (isLoadingMilitia) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Loading militia...
      </p>
    );
  }

  if (!militia) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Create a militia to track settlements.
      </p>
    );
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(undefined);
    setFormError(undefined);
    form.reset(defaultSettlementFormValues);
  }

  function startCreate() {
    setEditingId(undefined);
    setFormError(undefined);
    form.reset(defaultSettlementFormValues);
    setIsFormOpen(true);
  }

  function startEdit(settlement: SettlementRecord) {
    setEditingId(settlement._id);
    setFormError(undefined);
    form.reset({
      settlementKey: settlement.settlementKey,
      reputation: settlement.reputation,
      securedState: settlement.isSecured ? 'secured' : 'unsecured',
    });
    setIsFormOpen(true);
  }

  async function submitForm(values: SettlementFormValues) {
    if (!militia) {
      return;
    }

    setFormError(undefined);

    try {
      await upsertSettlement({
        organizationId,
        militiaId: militia._id,
        settlementId: editingId,
        settlementKey: values.settlementKey.trim(),
        reputation: values.reputation,
        isSecured: values.securedState === 'secured',
      });

      closeForm();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save settlement.'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-card flex items-center justify-between border-2 border-b-0 p-4">
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">
            Settlement Ledger
          </h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {isLoading
              ? 'Loading...'
              : `Tracking ${settlements.length} settlement${settlements.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            Add settlements here for mid-campaign setup and any new places where
            the militia starts operating.
          </p>
        </div>

        <Button
          onClick={startCreate}
          className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
        >
          Add Settlement
        </Button>
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsFormOpen(true);
            return;
          }
          closeForm();
        }}
      >
        <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl">
              {editingId ? 'Edit Settlement' : 'Add Settlement'}
            </DialogTitle>
            <DialogDescription className="font-mono text-sm">
              Track settlement reputation and secured status for militia play.
            </DialogDescription>
          </DialogHeader>
          <SettlementFormCard
            form={form}
            onSubmit={submitForm}
            onCancel={closeForm}
            submitError={formError}
          />
        </DialogContent>
      </Dialog>

      <SettlementListCard settlements={settlements} onEdit={startEdit} />
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
