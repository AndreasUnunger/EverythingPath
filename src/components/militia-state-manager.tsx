'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { LedgerShell } from '~/components/ledger-shell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  buildMilitiaCoreFormValues,
  buildWeekContextFormValues,
  buildQueueEffectFormValues,
  buildCacheStateFormValues,
  buildOrderStateFormValues,
  buildTrackedPersonFormValues,
  buildEventStateFormValues,
  cacheStateFormSchema,
  defaultCacheStateFormValues,
  defaultEventStateFormValues,
  defaultOrderStateFormValues,
  defaultQueueEffectFormValues,
  defaultTrackedPersonFormValues,
  eventStateFormSchema,
  militiaCoreFormSchema,
  orderStateFormSchema,
  queueEffectFormSchema,
  trackedPersonFormSchema,
  weekContextFormSchema,
  type CacheStateFormValues,
  type EventStateFormValues,
  type MilitiaCoreFormValues,
  type OrderStateFormValues,
  type QueueEffectRecord,
  type QueueEffectFormValues,
  type TrackedPersonFormValues,
  type WeekContextFormValues,
} from '~/components/militia-state-manager/types';
import {
  CacheStateFormCard,
  EventStateFormCard,
  MilitiaCoreFormCard,
  OrderStateFormCard,
  QueueEffectFormCard,
  TrackedPersonFormCard,
  WeekContextFormCard,
} from '~/components/militia-state-manager/form-cards';
import {
  StateList,
  StateListItem,
  StateSectionCard,
} from '~/components/militia-state-manager/section-cards';
import {
  formatCacheClassLabel,
  formatCacheStatusLabel,
  formatEventTypeLabel,
  formatOrderSourceActionLabel,
  formatOrderStatusLabel,
  formatQueuedEffectKindLabel,
  formatTrackedPersonKindLabel,
  formatTrackedPersonLocationLabel,
  formatTrackedPersonSourceActionLabel,
  formatTrackedPersonStatusLabel,
} from '~/lib/militia-state-options';
import {
  campaignQuery,
  militiaQuery,
  militiaStateSetupQuery,
  settlementLedgerQuery,
  marketplaceLedgerQuery,
  characterLedgerQuery,
} from '~/lib/sharedQueries';

type DialogState =
  | { kind: 'createMilitia' }
  | { kind: 'queueEffect'; index?: number }
  | { kind: 'cache'; cacheId?: string }
  | { kind: 'order'; orderId?: string }
  | { kind: 'person'; trackedPersonId?: string }
  | { kind: 'event'; eventStateId?: string }
  | null;

export function MilitiaStateManager({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [formError, setFormError] = useState<string>();
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string>();

  const { data: militia, isLoading: militiaLoading } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );
  const { data: campaignContext } = campaignQuery(organizationId, canQuery);
  const { data: setupState, isLoading: setupLoading } = militiaStateSetupQuery(
    selectedCampaignId,
    organizationId,
    canQuery && Boolean(militia),
  );
  const { data: settlements } = settlementLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery && Boolean(militia),
  );
  const { data: marketplaceLedger } = marketplaceLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery && Boolean(militia),
  );
  const { data: characters } = characterLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery && Boolean(militia),
    true,
  );

  const createMilitia = useMutation(db.militia.createMilitia);
  const updateMilitiaCoreState = useMutation(db.militia.updateMilitiaCoreState);
  const upsertWeekContextState = useMutation(db.militia.upsertWeekContextState);
  const upsertCacheState = useMutation(db.militia.upsertCacheState);
  const deleteCacheState = useMutation(db.militia.deleteCacheState);
  const upsertOrderState = useMutation(db.militia.upsertOrderState);
  const deleteOrderState = useMutation(db.militia.deleteOrderState);
  const upsertTrackedPersonState = useMutation(db.militia.upsertTrackedPersonState);
  const deleteTrackedPersonState = useMutation(db.militia.deleteTrackedPersonState);
  const upsertEventState = useMutation(db.militia.upsertEventState);
  const deleteEventState = useMutation(db.militia.deleteEventState);
  const updateCampaignInGameDate = useMutation(db.campaign.updateCampaignInGameDate);
  const selectedCampaign =
    campaignContext?.state === 'ready'
      ? campaignContext.campaigns.find(
          (campaign) => campaign._id === selectedCampaignId,
        )
      : undefined;

  const coreForm = useForm<MilitiaCoreFormValues>({
    resolver: zodResolver(militiaCoreFormSchema),
    values: militia
      ? buildMilitiaCoreFormValues(militia, selectedCampaign?.inGameDate)
      : {
          name: '',
          inGameDate: selectedCampaign?.inGameDate
            ? new Date(selectedCampaign.inGameDate).toISOString().slice(0, 10)
            : '',
          rank: '1',
          highestBoonReached: '1',
          HQLocation: '',
          treasury: '0',
          notoriety: '0',
          focus: 'none',
          training: '0',
        },
  });
  const weekForm = useForm<WeekContextFormValues>({
    resolver: zodResolver(weekContextFormSchema),
    values: setupState
      ? buildWeekContextFormValues(setupState.currentWeekState)
      : {
          weekNumber: '1',
          phase: 'activity',
          isFirstWeek: 'yes',
          skippedUpkeepThisWeek: 'yes',
          uneventfulBonusCarry: '0',
          lastPersistentBuyoffWeek: '',
        },
  });
  const queueEffectForm = useForm<QueueEffectFormValues>({
    resolver: zodResolver(queueEffectFormSchema),
    defaultValues: defaultQueueEffectFormValues,
  });
  const cacheForm = useForm<CacheStateFormValues>({
    resolver: zodResolver(cacheStateFormSchema),
    defaultValues: defaultCacheStateFormValues,
  });
  const orderForm = useForm<OrderStateFormValues>({
    resolver: zodResolver(orderStateFormSchema),
    defaultValues: defaultOrderStateFormValues,
  });
  const personForm = useForm<TrackedPersonFormValues>({
    resolver: zodResolver(trackedPersonFormSchema),
    defaultValues: defaultTrackedPersonFormValues,
  });
  const eventForm = useForm<EventStateFormValues>({
    resolver: zodResolver(eventStateFormSchema),
    defaultValues: defaultEventStateFormValues,
  });

  const queueEffects = (setupState?.currentWeekState.queuedEffects ?? []).map(
    (effect, index) => ({ ...effect, index }),
  );
  const marketplaces = marketplaceLedger?.marketplaces ?? [];
  const settlementOptions = (settlements ?? []).map((settlement) => settlement.settlementKey);
  const characterOptions =
    characters?.map((character) => ({
      _id: character._id,
      name: character.name,
      kind: character.kind,
      level: character.level,
      charisma: character.charisma,
    })) ?? [];

  function closeDialog() {
    setDialogState(null);
    setFormError(undefined);
  }

  function openCreateMilitia() {
    coreForm.reset({
      name: '',
      inGameDate: selectedCampaign?.inGameDate
        ? new Date(selectedCampaign.inGameDate).toISOString().slice(0, 10)
        : '',
      rank: '1',
      highestBoonReached: '1',
      HQLocation: '',
      treasury: '0',
      notoriety: '0',
      focus: 'none',
      training: '0',
    });
    setFormError(undefined);
    setDialogState({ kind: 'createMilitia' });
  }

  function openQueueEffectEditor(effect?: QueueEffectRecord) {
    queueEffectForm.reset(
      effect ? buildQueueEffectFormValues(effect) : defaultQueueEffectFormValues,
    );
    setFormError(undefined);
    setDialogState(effect ? { kind: 'queueEffect', index: effect.index } : { kind: 'queueEffect' });
  }

  function openCacheEditor(cacheId?: string) {
    const existing = setupState?.caches.find((cache) => cache._id === cacheId);
    cacheForm.reset(existing ? buildCacheStateFormValues(existing) : defaultCacheStateFormValues);
    setFormError(undefined);
    setDialogState(cacheId ? { kind: 'cache', cacheId } : { kind: 'cache' });
  }

  function openOrderEditor(orderId?: string) {
    const existing = setupState?.orders.find((order) => order._id === orderId);
    orderForm.reset(existing ? buildOrderStateFormValues(existing) : defaultOrderStateFormValues);
    setFormError(undefined);
    setDialogState(orderId ? { kind: 'order', orderId } : { kind: 'order' });
  }

  function openTrackedPersonEditor(trackedPersonId?: string) {
    const existing = setupState?.trackedPeople.find((person) => person._id === trackedPersonId);
    personForm.reset(
      existing ? buildTrackedPersonFormValues(existing) : defaultTrackedPersonFormValues,
    );
    setFormError(undefined);
    setDialogState(
      trackedPersonId ? { kind: 'person', trackedPersonId } : { kind: 'person' },
    );
  }

  function openEventEditor(eventStateId?: string) {
    const existing = setupState?.eventStates.find((event) => event._id === eventStateId);
    eventForm.reset(existing ? buildEventStateFormValues(existing) : defaultEventStateFormValues);
    setFormError(undefined);
    setDialogState(eventStateId ? { kind: 'event', eventStateId } : { kind: 'event' });
  }

  async function submitCreateMilitia(values: MilitiaCoreFormValues) {
    if (!selectedCampaignId) return;

    try {
      await createMilitia({
        militia: {
          name: values.name.trim(),
          campaignId: selectedCampaignId,
          rank: Number(values.rank),
          highestBoonReached: Number(values.highestBoonReached),
          HQLocation: values.HQLocation.trim(),
          treasury: Number(values.treasury),
          notoriety: Number(values.notoriety),
          focus: values.focus === 'none' ? null : values.focus,
          training: Number(values.training),
        },
        organizationId,
      });
      await updateCampaignInGameDate({
        organizationId,
        campaignId: selectedCampaignId,
        inGameDate: toCampaignInGameDate(values.inGameDate),
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to create militia.'));
    }
  }

  async function submitCore(values: MilitiaCoreFormValues) {
    if (!militia || !selectedCampaignId) return;
    try {
      await updateMilitiaCoreState({
        organizationId,
        militiaId: militia._id,
        name: values.name.trim(),
        rank: Number(values.rank),
        highestBoonReached: Number(values.highestBoonReached),
        HQLocation: values.HQLocation.trim(),
        treasury: Number(values.treasury),
        notoriety: Number(values.notoriety),
        focus: values.focus === 'none' ? null : values.focus,
        training: Number(values.training),
      });
      await updateCampaignInGameDate({
        organizationId,
        campaignId: selectedCampaignId,
        inGameDate: toCampaignInGameDate(values.inGameDate),
      });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save militia state.'));
    }
  }

  async function submitWeek(values: WeekContextFormValues) {
    if (!militia) return;
    try {
      await upsertWeekContextState({
        organizationId,
        militiaId: militia._id,
        weekNumber: Number(values.weekNumber),
        phase: values.phase,
        isFirstWeek: values.isFirstWeek === 'yes',
        skippedUpkeepThisWeek: values.skippedUpkeepThisWeek === 'yes',
        uneventfulBonusCarry: Number(values.uneventfulBonusCarry),
        lastPersistentBuyoffWeek: values.lastPersistentBuyoffWeek.trim()
          ? Number(values.lastPersistentBuyoffWeek)
          : undefined,
        queuedEffects: setupState?.currentWeekState.queuedEffects ?? [],
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save week context.'));
    }
  }

  async function submitQueueEffect(values: QueueEffectFormValues) {
    if (!militia || !setupState) return;
    try {
      const nextEffects = [...setupState.currentWeekState.queuedEffects];
      const nextEntry = {
        kind: values.kind,
        appliesWeek: Number(values.appliesWeek),
        note: values.note?.trim() ? values.note.trim() : undefined,
      };
      if (dialogState?.kind === 'queueEffect' && dialogState.index !== undefined) {
        nextEffects[dialogState.index] = nextEntry;
      } else {
        nextEffects.push(nextEntry);
      }
      await upsertWeekContextState({
        organizationId,
        militiaId: militia._id,
        weekNumber: setupState.currentWeekState.weekNumber,
        phase: setupState.currentWeekState.phase,
        isFirstWeek: setupState.currentWeekState.isFirstWeek,
        skippedUpkeepThisWeek: setupState.currentWeekState.skippedUpkeepThisWeek,
        uneventfulBonusCarry: setupState.currentWeekState.uneventfulBonusCarry,
        lastPersistentBuyoffWeek: setupState.currentWeekState.lastPersistentBuyoffWeek,
        queuedEffects: nextEffects,
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save queued effect.'));
    }
  }

  async function removeQueueEffect(index: number) {
    if (!militia || !setupState) return;
    const deleteKey = `queue:${index}`;
    setPendingDeleteKey(deleteKey);
    try {
      const nextEffects = setupState.currentWeekState.queuedEffects.filter(
        (_, effectIndex) => effectIndex !== index,
      );
      await upsertWeekContextState({
        organizationId,
        militiaId: militia._id,
        weekNumber: setupState.currentWeekState.weekNumber,
        phase: setupState.currentWeekState.phase,
        isFirstWeek: setupState.currentWeekState.isFirstWeek,
        skippedUpkeepThisWeek: setupState.currentWeekState.skippedUpkeepThisWeek,
        uneventfulBonusCarry: setupState.currentWeekState.uneventfulBonusCarry,
        lastPersistentBuyoffWeek: setupState.currentWeekState.lastPersistentBuyoffWeek,
        queuedEffects: nextEffects,
      });
    } finally {
      setPendingDeleteKey(undefined);
    }
  }

  async function submitCache(values: CacheStateFormValues) {
    if (!militia) return;
    try {
      await upsertCacheState({
        organizationId,
        militiaId: militia._id,
        cacheId:
          dialogState?.kind === 'cache' && dialogState.cacheId
            ? (dialogState.cacheId as Id<'militiaCache'>)
            : undefined,
        label: values.label.trim(),
        cacheClass: values.cacheClass,
        location: values.location.trim(),
        contentsSummary: values.contentsSummary.trim(),
        status: values.status,
        isSecureLocation: values.secureLocation === 'yes',
        createdWeek: Number(values.createdWeek),
        updatedWeek: Number(values.updatedWeek),
        retrievedWeek: values.retrievedWeek.trim() ? Number(values.retrievedWeek) : undefined,
        lostWeek: values.lostWeek.trim() ? Number(values.lostWeek) : undefined,
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save cache.'));
    }
  }

  async function removeCache(cacheId: string) {
    if (!militia) return;
    const deleteKey = `cache:${cacheId}`;
    setPendingDeleteKey(deleteKey);
    try {
      await deleteCacheState({
        organizationId,
        militiaId: militia._id,
        cacheId: cacheId as Id<'militiaCache'>,
      });
    } finally {
      setPendingDeleteKey(undefined);
    }
  }

  async function submitOrder(values: OrderStateFormValues) {
    if (!militia) return;
    try {
      await upsertOrderState({
        organizationId,
        militiaId: militia._id,
        orderId:
          dialogState?.kind === 'order' && dialogState.orderId
            ? (dialogState.orderId as Id<'militiaOrder'>)
            : undefined,
        description: values.description.trim(),
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
        costPaid: values.costPaid.trim() ? Number(values.costPaid) : undefined,
        deliveryDays: Number(values.deliveryDays),
        orderedWeek: Number(values.orderedWeek),
        dueWeek: Number(values.dueWeek),
        status: values.status,
        deliveredWeek: values.deliveredWeek.trim() ? Number(values.deliveredWeek) : undefined,
        sourceAction: values.sourceAction === 'none' ? undefined : values.sourceAction,
        marketplaceId: values.marketplaceId
          ? (values.marketplaceId as Id<'militiaMarketplace'>)
          : undefined,
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save order.'));
    }
  }

  async function removeOrder(orderId: string) {
    if (!militia) return;
    const deleteKey = `order:${orderId}`;
    setPendingDeleteKey(deleteKey);
    try {
      await deleteOrderState({
        organizationId,
        militiaId: militia._id,
        orderId: orderId as Id<'militiaOrder'>,
      });
    } finally {
      setPendingDeleteKey(undefined);
    }
  }

  async function submitTrackedPerson(values: TrackedPersonFormValues) {
    if (!militia) return;
    try {
      const selectedCharacter =
        values.targetSource === 'character' && values.characterId
          ? characterOptions.find((character) => character._id === values.characterId)
          : undefined;
      await upsertTrackedPersonState({
        organizationId,
        militiaId: militia._id,
        trackedPersonId:
          dialogState?.kind === 'person' && dialogState.trackedPersonId
            ? (dialogState.trackedPersonId as Id<'militiaCharacterStatus'>)
            : undefined,
        characterId:
          values.targetSource === 'character' && values.characterId
            ? (values.characterId as Id<'character'>)
            : undefined,
        displayName:
          values.targetSource === 'character'
            ? (selectedCharacter?.name ?? '')
            : values.displayName.trim(),
        personKind: values.personKind,
        status: values.status,
        level: values.level.trim() ? Number(values.level) : undefined,
        locationType: values.locationType,
        settlementKey: values.settlementKey?.trim() ? values.settlementKey.trim() : undefined,
        siteName: values.siteName?.trim() ? values.siteName.trim() : undefined,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
        activeUntilWeek: values.activeUntilWeek.trim() ? Number(values.activeUntilWeek) : undefined,
        hiddenSinceWeek: values.hiddenSinceWeek.trim() ? Number(values.hiddenSinceWeek) : undefined,
        capturedSinceWeek: values.capturedSinceWeek.trim()
          ? Number(values.capturedSinceWeek)
          : undefined,
        rescuedWeek: values.rescuedWeek.trim() ? Number(values.rescuedWeek) : undefined,
        restoredWeek: values.restoredWeek.trim() ? Number(values.restoredWeek) : undefined,
        rescueDcOverride: values.rescueDcOverride.trim()
          ? Number(values.rescueDcOverride)
          : undefined,
        sourceAction: values.sourceAction,
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save tracked person.'));
    }
  }

  async function removeTrackedPerson(trackedPersonId: string) {
    if (!militia) return;
    const deleteKey = `person:${trackedPersonId}`;
    setPendingDeleteKey(deleteKey);
    try {
      await deleteTrackedPersonState({
        organizationId,
        militiaId: militia._id,
        trackedPersonId: trackedPersonId as Id<'militiaCharacterStatus'>,
      });
    } finally {
      setPendingDeleteKey(undefined);
    }
  }

  async function submitEvent(values: EventStateFormValues) {
    if (!militia) return;
    try {
      await upsertEventState({
        organizationId,
        militiaId: militia._id,
        eventStateId:
          dialogState?.kind === 'event' && dialogState.eventStateId
            ? (dialogState.eventStateId as Id<'militiaEventState'>)
            : undefined,
        weekNumber: Number(values.weekNumber),
        eventType: values.eventType,
        isPersistent: values.isPersistent === 'yes',
        startedWeek: Number(values.startedWeek),
        endedWeek: values.endedWeek.trim() ? Number(values.endedWeek) : undefined,
        mitigationUntilWeek: values.mitigationUntilWeek.trim()
          ? Number(values.mitigationUntilWeek)
          : undefined,
        resolved: values.resolved === 'yes',
      });
      closeDialog();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save event state.'));
    }
  }

  async function removeEvent(eventStateId: string) {
    if (!militia) return;
    const deleteKey = `event:${eventStateId}`;
    setPendingDeleteKey(deleteKey);
    try {
      await deleteEventState({
        organizationId,
        militiaId: militia._id,
        eventStateId: eventStateId as Id<'militiaEventState'>,
      });
    } finally {
      setPendingDeleteKey(undefined);
    }
  }

  if (!selectedCampaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to edit militia state.
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

  if (militiaLoading || (militia && setupLoading)) {
    return (
      <p className="text-muted-foreground font-mono text-sm">Loading militia state...</p>
    );
  }

  if (!militia) {
    return (
      <LedgerShell
        title="Militia State"
        meta="Create the militia record first, then fill in the remaining campaign state below."
        isOpen={isOpen}
        onToggle={() => {
          if (isOpen) {
            closeDialog();
          }
          setIsOpen((prev) => !prev);
        }}
        actions={
          isOpen ? (
            <Button
              type="button"
              onClick={openCreateMilitia}
              className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
            >
              Initialize Militia
            </Button>
          ) : null
        }
      >
        <>
            <p className="text-muted-foreground font-mono text-sm">
              Use this instead of the fixed rank-1 placeholder when picking up the tool mid-campaign.
            </p>
            <Dialog
              open={dialogState?.kind === 'createMilitia'}
              onOpenChange={(open) => !open && closeDialog()}
            >
              <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle className="font-sans text-xl">Initialize Militia</DialogTitle>
                  <DialogDescription className="font-mono text-sm">
                    Start from your current campaign state instead of a rank-1 default.
                  </DialogDescription>
                </DialogHeader>
                <MilitiaCoreFormCard
                  form={coreForm}
                  onSubmit={submitCreateMilitia}
                  onCancel={closeDialog}
                  submitError={formError}
                />
              </DialogContent>
            </Dialog>
        </>
      </LedgerShell>
    );
  }

  return (
    <LedgerShell
      title="Militia State"
      meta="Edit the canonical militia state directly for mid-campaign pickup and corrections."
      isOpen={isOpen}
      onToggle={() => {
        if (isOpen) {
          closeDialog();
        }
        setIsOpen((prev) => !prev);
      }}
    >
      <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StateSectionCard
            title="Militia Core"
            subtitle="Directly edit the canonical militia values used by the week board."
          >
            <MilitiaCoreFormCard
              form={coreForm}
              onSubmit={submitCore}
              submitError={dialogState === null ? formError : undefined}
              showCancel={false}
            />
          </StateSectionCard>

          <StateSectionCard
            title="Week Context"
            subtitle="Set the current position in the militia flow and the queued next-week effects."
          >
            <WeekContextFormCard
              form={weekForm}
              onSubmit={submitWeek}
              submitError={dialogState === null ? formError : undefined}
              showCancel={false}
            />
          </StateSectionCard>
          </div>

          <StateSectionCard
            title="Queued Effects"
            subtitle="These are the week-to-week modifiers that will apply automatically later."
            actionLabel="Add Queued Effect"
            onAdd={() => openQueueEffectEditor()}
          >
            <StateList emptyText="No queued effects recorded yet.">
              {queueEffects.map((effect) => (
                <StateListItem
                  key={`${effect.kind}:${effect.index}`}
                  title={formatQueuedEffectKindLabel(effect.kind)}
                  badges={[`Week ${effect.appliesWeek}`]}
                  body={
                    effect.note ? (
                      <p className="text-muted-foreground font-mono text-sm">{effect.note}</p>
                    ) : (
                      <p className="text-muted-foreground font-mono text-sm">No note</p>
                    )
                  }
                  onEdit={() => openQueueEffectEditor(effect)}
                  onDelete={() => void removeQueueEffect(effect.index)}
                  deleting={pendingDeleteKey === `queue:${effect.index}`}
                />
              ))}
            </StateList>
          </StateSectionCard>

        <StateSectionCard
          title="Tracked Caches"
          subtitle="Manual cache setup for mid-campaign onboarding and corrections."
          actionLabel="Add Cache"
          onAdd={() => openCacheEditor()}
        >
          <StateList emptyText="No caches tracked yet.">
            {(setupState?.caches ?? []).map((cache) => (
              <StateListItem
                key={cache._id}
                title={cache.label}
                badges={[
                  formatCacheClassLabel(cache.cacheClass),
                  formatCacheStatusLabel(cache.status),
                ]}
                body={
                  <>
                    <p className="text-muted-foreground font-mono text-sm">
                      {cache.location} • {cache.contentsSummary}
                    </p>
                    <p className="text-muted-foreground font-mono text-sm">
                      Created week {cache.createdWeek} • Updated week {cache.updatedWeek}
                    </p>
                  </>
                }
                onEdit={() => openCacheEditor(cache._id)}
                onDelete={() => void removeCache(cache._id)}
                deleting={pendingDeleteKey === `cache:${cache._id}`}
              />
            ))}
          </StateList>
        </StateSectionCard>

        <StateSectionCard
          title="Tracked Orders"
          subtitle="Manual order and delivery state for special orders and market purchases."
          actionLabel="Add Order"
          onAdd={() => openOrderEditor()}
        >
          <StateList emptyText="No orders tracked yet.">
            {(setupState?.orders ?? []).map((order) => (
              <StateListItem
                key={order._id}
                title={order.description}
                badges={[formatOrderStatusLabel(order.status)]}
                body={
                  <>
                    <p className="text-muted-foreground font-mono text-sm">
                      Ordered week {order.orderedWeek} • Due week {order.dueWeek}
                      {order.deliveryDays ? ` • ${order.deliveryDays} days` : ''}
                    </p>
                    <p className="text-muted-foreground font-mono text-sm">
                      Source:{' '}
                      {order.sourceAction
                        ? formatOrderSourceActionLabel(order.sourceAction)
                        : 'None'}
                    </p>
                  </>
                }
                onEdit={() => openOrderEditor(order._id)}
                onDelete={() => void removeOrder(order._id)}
                deleting={pendingDeleteKey === `order:${order._id}`}
              />
            ))}
          </StateList>
        </StateSectionCard>

        <StateSectionCard
          title="Tracked People"
          subtitle="Seed hidden, captured, recovering, or contact state directly."
          actionLabel="Add Tracked Person"
          onAdd={() => openTrackedPersonEditor()}
        >
          <StateList emptyText="No tracked people recorded yet.">
            {(setupState?.trackedPeople ?? []).map((person) => (
              <StateListItem
                key={person._id}
                title={person.displayName}
                badges={[
                  formatTrackedPersonStatusLabel(person.status),
                  formatTrackedPersonKindLabel(person.personKind),
                ]}
                body={
                  <>
                    <p className="text-muted-foreground font-mono text-sm">
                      {formatTrackedPersonLocationLabel(person.locationType)}
                      {person.settlementKey ? ` • ${person.settlementKey}` : ''}
                      {person.siteName ? ` • ${person.siteName}` : ''}
                    </p>
                    <p className="text-muted-foreground font-mono text-sm">
                      Source:{' '}
                      {person.sourceAction
                        ? formatTrackedPersonSourceActionLabel(person.sourceAction)
                        : 'Manual'}
                    </p>
                  </>
                }
                onEdit={() => openTrackedPersonEditor(person._id)}
                onDelete={() => void removeTrackedPerson(person._id)}
                deleting={pendingDeleteKey === `person:${person._id}`}
              />
            ))}
          </StateList>
        </StateSectionCard>

          <StateSectionCard
            title="Event State"
            subtitle="Edit persistent and already-recorded event rows for the current militia."
            actionLabel="Add Event State"
            onAdd={() => openEventEditor()}
          >
            <StateList emptyText="No event state rows recorded yet.">
              {(setupState?.eventStates ?? []).map((eventState) => (
                <StateListItem
                  key={eventState._id}
                  title={formatEventTypeLabel(eventState.eventType)}
                  badges={[
                    eventState.isPersistent ? 'Persistent' : 'Single',
                    eventState.resolved ? 'Resolved' : 'Open',
                  ]}
                  body={
                    <>
                      <p className="text-muted-foreground font-mono text-sm">
                        Week {eventState.weekNumber} • Started {eventState.startedWeek}
                      </p>
                      <p className="text-muted-foreground font-mono text-sm">
                        Mitigation until: {eventState.mitigationUntilWeek ?? 'None'}
                      </p>
                    </>
                  }
                  onEdit={() => openEventEditor(eventState._id)}
                  onDelete={() => void removeEvent(eventState._id)}
                  deleting={pendingDeleteKey === `event:${eventState._id}`}
                />
              ))}
            </StateList>
          </StateSectionCard>

          <Dialog open={dialogState !== null} onOpenChange={(open) => !open && closeDialog()}>
            <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle className="font-sans text-xl">{getDialogTitle(dialogState)}</DialogTitle>
                <DialogDescription className="font-mono text-sm">
                  {getDialogDescription(dialogState)}
                </DialogDescription>
              </DialogHeader>

              {dialogState?.kind === 'createMilitia' ? (
                <MilitiaCoreFormCard
                  form={coreForm}
                  onSubmit={submitCreateMilitia}
                  onCancel={closeDialog}
                  submitError={formError}
                />
              ) : null}
              {dialogState?.kind === 'queueEffect' ? (
                <QueueEffectFormCard
                  form={queueEffectForm}
                  onSubmit={submitQueueEffect}
                  onCancel={closeDialog}
                  submitError={formError}
                />
              ) : null}
              {dialogState?.kind === 'cache' ? (
                <CacheStateFormCard
                  form={cacheForm}
                  onSubmit={submitCache}
                  onCancel={closeDialog}
                  submitError={formError}
                />
              ) : null}
              {dialogState?.kind === 'order' ? (
                <OrderStateFormCard
                  form={orderForm}
                  onSubmit={submitOrder}
                  onCancel={closeDialog}
                  submitError={formError}
                  marketplaceOptions={marketplaces.map((marketplace) => ({
                    value: marketplace._id,
                    label: marketplace.label,
                  }))}
                />
              ) : null}
              {dialogState?.kind === 'person' ? (
                <TrackedPersonFormCard
                  form={personForm}
                  onSubmit={submitTrackedPerson}
                  onCancel={closeDialog}
                  submitError={formError}
                  characterOptions={characterOptions}
                  settlementOptions={settlementOptions}
                />
              ) : null}
              {dialogState?.kind === 'event' ? (
                <EventStateFormCard
                  form={eventForm}
                  onSubmit={submitEvent}
                  onCancel={closeDialog}
                  submitError={formError}
                />
              ) : null}
            </DialogContent>
          </Dialog>
      </>
    </LedgerShell>
  );
}

function getDialogTitle(dialogState: DialogState) {
  if (!dialogState) return '';
  switch (dialogState.kind) {
    case 'createMilitia':
      return 'Initialize Militia';
    case 'queueEffect':
      return dialogState.index !== undefined ? 'Edit Queued Effect' : 'Add Queued Effect';
    case 'cache':
      return dialogState.cacheId ? 'Edit Cache' : 'Add Cache';
    case 'order':
      return dialogState.orderId ? 'Edit Order' : 'Add Order';
    case 'person':
      return dialogState.trackedPersonId ? 'Edit Tracked Person' : 'Add Tracked Person';
    case 'event':
      return dialogState.eventStateId ? 'Edit Event State' : 'Add Event State';
  }
}

function getDialogDescription(dialogState: DialogState) {
  if (!dialogState) return '';
  switch (dialogState.kind) {
    case 'createMilitia':
      return 'Create the militia record from current campaign values instead of the default placeholder.';
    case 'queueEffect':
      return 'Queued effects persist across weeks until their apply week is reached.';
    case 'cache':
      return 'Caches are durable records and should match the table state, not just the current week draft.';
    case 'order':
      return 'Use this for special orders and market deliveries already in flight.';
    case 'person':
      return 'Tracked people cover hidden, captured, recovering, and contact states.';
    case 'event':
      return 'Use this to seed or correct ongoing militia event state.';
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

function toCampaignInGameDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
}
