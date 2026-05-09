'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { LedgerShell } from '~/components/ledger-shell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import {
  defaultMarketplaceFormValues,
  marketplaceFormSchema,
  type MarketplaceFormInput,
  type MarketplaceFormValues,
} from '~/components/marketplace-manager/types';
import { MarketplaceFormCard } from '~/components/marketplace-manager/marketplace-form-card';
import { MarketplaceListCard } from '~/components/marketplace-manager/marketplace-list-card';
import { getMarketplaceProfile } from '~/lib/militia-marketplace-rules';
import { marketplaceLedgerQuery, militiaQuery } from '~/lib/sharedQueries';
import { isTeamId } from '~/lib/team-ids';
import type { ITrackedMarketplace } from '~/lib/types';

export function MarketplaceLedger({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<
    ITrackedMarketplace | undefined
  >();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();

  const form = useForm<MarketplaceFormInput, unknown, MarketplaceFormValues>({
    resolver: zodResolver(marketplaceFormSchema),
    defaultValues: defaultMarketplaceFormValues,
  });

  const { data: militia, isLoading: isLoadingMilitia } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );
  const { data: marketplaceLedger, isLoading } = marketplaceLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );

  const upsertMarketplace = useMutation(db.militia.upsertMarketplaceState);
  const deleteMarketplace = useMutation(db.militia.deleteMarketplaceState);

  if (!selectedCampaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to review marketplaces.
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
        Create a militia to track marketplaces.
      </p>
    );
  }

  const marketplaces = marketplaceLedger?.marketplaces ?? [];
  const currentWeek = marketplaceLedger?.currentWeek;
  const activeCount = marketplaces.filter((marketplace) => marketplace.isActive).length;
  const knownTeamIds = militia.teams.map((team) => team.id);

  function closeForm() {
    setEditingMarketplace(undefined);
    setFormError(undefined);
    setIsFormOpen(false);
    form.reset(defaultMarketplaceFormValues);
  }

  function applyProfileDefaults({
    sourceAction,
    teamId,
  }: {
    sourceAction: MarketplaceFormValues['sourceAction'];
    teamId: string;
  }) {
    const profile = getMarketplaceProfile({
      actionId: sourceAction,
      teamId: teamId.trim() || undefined,
    });
    if (!profile) {
      return;
    }

    form.setValue('availabilityTier', profile.availabilityTier, {
      shouldDirty: true,
    });
    form.setValue('availabilityThreshold', String(profile.availabilityThreshold), {
      shouldDirty: true,
    });
    form.setValue('saleValuePercent', String(profile.saleValuePercent), {
      shouldDirty: true,
    });
    form.setValue('contrabandAllowed', profile.contrabandAllowed ? 'yes' : 'no', {
      shouldDirty: true,
    });
  }

  function startCreate() {
    setEditingMarketplace(undefined);
    setFormError(undefined);
    form.reset({
      ...defaultMarketplaceFormValues,
      createdWeek: currentWeek !== undefined ? String(currentWeek) : '',
      activeUntilWeek: currentWeek !== undefined ? String(currentWeek) : '',
    });
    setIsFormOpen(true);
  }

  function startEdit(marketplace: ITrackedMarketplace) {
    setEditingMarketplace(marketplace);
    setFormError(undefined);
    form.reset({
      label: marketplace.label,
      sourceAction: marketplace.sourceAction,
      teamId: isTeamId(marketplace.teamId) ? marketplace.teamId : '',
      availabilityTier: marketplace.availabilityTier,
      availabilityThreshold: String(marketplace.availabilityThreshold),
      saleValuePercent: String(marketplace.saleValuePercent),
      contrabandAllowed: marketplace.contrabandAllowed ? 'yes' : 'no',
      createdWeek: String(marketplace.createdWeek),
      activeUntilWeek: String(marketplace.activeUntilWeek),
      marketDayDiscountPercent:
        marketplace.marketDayDiscountPercent !== undefined
          ? String(marketplace.marketDayDiscountPercent)
          : '',
      marketDayAppliedWeek:
        marketplace.marketDayAppliedWeek !== undefined
          ? String(marketplace.marketDayAppliedWeek)
          : '',
      notes: marketplace.notes ?? '',
    });
    setIsFormOpen(true);
  }

  async function submitForm(values: MarketplaceFormValues) {
    if (!militia) {
      return;
    }

    if (!isTeamId(values.teamId)) {
      form.setError('teamId', {
        type: 'manual',
        message: 'Team is required',
      });
      return;
    }

    setFormError(undefined);

    try {
      await upsertMarketplace({
        organizationId,
        militiaId: militia._id,
        marketplaceId: editingMarketplace?._id as never,
        label: values.label.trim(),
        sourceAction: values.sourceAction,
        teamId: values.teamId,
        availabilityTier: values.availabilityTier,
        availabilityThreshold: Number(values.availabilityThreshold),
        saleValuePercent: Number(values.saleValuePercent),
        contrabandAllowed: values.contrabandAllowed === 'yes',
        createdWeek: Number(values.createdWeek),
        activeUntilWeek: Number(values.activeUntilWeek),
        marketDayDiscountPercent: values.marketDayDiscountPercent.trim()
          ? Number(values.marketDayDiscountPercent)
          : undefined,
        marketDayAppliedWeek: values.marketDayAppliedWeek.trim()
          ? Number(values.marketDayAppliedWeek)
          : undefined,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      });

      closeForm();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save marketplace.'));
    }
  }

  async function handleDelete(marketplace: ITrackedMarketplace) {
    if (!militia) {
      return;
    }

    setPendingDeleteId(marketplace._id);
    try {
      await deleteMarketplace({
        organizationId,
        militiaId: militia._id,
        marketplaceId: marketplace._id as never,
      });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to delete marketplace.'));
    } finally {
      setPendingDeleteId(undefined);
    }
  }

  function toggleLedger() {
    if (isOpen) {
      closeForm();
    }
    setIsOpen((prev) => !prev);
  }

  return (
    <LedgerShell
      title="Marketplace Ledger"
      meta={
        isLoading
          ? 'Loading...'
          : `${marketplaces.length} tracked marketplace${marketplaces.length === 1 ? '' : 's'} • ${activeCount} active${currentWeek ? ` in week ${currentWeek}` : ''}`
      }
      subtitle="Add or edit marketplaces here for mid-campaign setup, and review their linked orders without opening the week board."
      isOpen={isOpen}
      onToggle={toggleLedger}
      actions={
        isOpen ? (
          <Button
            type="button"
            onClick={startCreate}
            className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
          >
            Add Marketplace
          </Button>
        ) : null
      }
    >
      <>
          <Dialog
            open={isFormOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeForm();
                return;
              }
              setIsFormOpen(true);
            }}
          >
            <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle className="font-sans text-xl">
                  {editingMarketplace ? 'Edit Marketplace' : 'Add Marketplace'}
                </DialogTitle>
                <DialogDescription className="font-mono text-sm">
                  Track brokered markets and black markets here when onboarding an existing campaign or correcting table state.
                </DialogDescription>
              </DialogHeader>
              <MarketplaceFormCard
                form={form}
                onSubmit={submitForm}
                onCancel={closeForm}
                submitError={formError}
                knownTeamIds={knownTeamIds}
                applyProfileDefaults={applyProfileDefaults}
              />
            </DialogContent>
          </Dialog>

          <MarketplaceListCard
            marketplaces={marketplaces}
            onEdit={startEdit}
            onDelete={(marketplace) => void handleDelete(marketplace)}
            pendingDeleteId={pendingDeleteId}
          />
      </>
    </LedgerShell>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
