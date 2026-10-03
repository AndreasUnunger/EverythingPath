'use client';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
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
import {
  abilityKeys,
  abilityLabels,
  abilityTargets,
  type AbilityScores,
  type CreationSettings,
} from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { InlineWarnings } from './inline-warning';
import { StatBreakdown } from './stat-breakdown';
import {
  action,
  Block,
  fieldLabel,
  formatModifier,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useBaseScoresForm } from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;
type Abilities = ReadySheet['calculated']['abilities'];

// "{spent} / {budget} points" while the cost resolves; amber only while a
// point-buy warning is open. Under budget is a counter, not a warning.
function PointCounter({
  pointBuy,
  budget,
  hasOpenWarning,
}: {
  pointBuy: NonNullable<ReadySheet['calculated']['pointBuy']>;
  budget: number;
  hasOpenWarning: boolean;
}) {
  return (
    <p
      className={cn(
        'font-mono text-xs',
        hasOpenWarning ? 'text-amber-300' : 'text-muted-foreground',
      )}
    >
      {pointBuy.spent === null
        ? 'Point-buy cost unresolved.'
        : `${pointBuy.spent} / ${budget} points`}
    </p>
  );
}

// Label | base input | calculated total | modifier, the message under the row.
const columns = 'grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_3rem] gap-x-3';

/**
 * The one permanent base-scores entry: six fields that are always present,
 * with no remove or disable control. The field holds the stored base score;
 * the total beside it is the calculated score with every adjustment, and
 * opens its breakdown. A typed draft stays in its field while its save is
 * pending.
 */
export function BaseScoresEditor({
  scores,
  abilities,
  creationSettings,
  pointBuy,
  warnings,
  warningController,
  breakdowns,
  save,
}: {
  scores: AbilityScores;
  abilities: Abilities;
  creationSettings: CreationSettings;
  pointBuy: ReadySheet['calculated']['pointBuy'];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  breakdowns: ReadySheet['calculated']['breakdowns'];
  save: Controller['saveBaseScores'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useBaseScoresForm({ scores, save });
  const isSaving = editor.status.kind === 'saving';
  const pointBuyWarnings = warnings.filter(
    (warning) => warning.target.kind === 'pointBuy',
  );
  return (
    <Block
      title="Ability scores"
      aside={
        pointBuy && creationSettings.abilityMethod.kind === 'pointBuy' ? (
          <PointCounter
            pointBuy={pointBuy}
            budget={creationSettings.abilityMethod.budget}
            hasOpenWarning={pointBuyWarnings.some(
              (warning) => !warning.accepted,
            )}
          />
        ) : null
      }
    >
      <InlineWarnings
        warnings={pointBuyWarnings}
        controller={warningController}
        className="mb-2"
      />
      <Form {...editor.form}>
        <form
          noValidate
          aria-label="Ability scores"
          className="space-y-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (maintenance.readOnly) return;
            void editor.save();
          }}
        >
          <div aria-hidden className={`${columns} ${fieldLabel} pb-0.5`}>
            <span />
            <span className="text-center">Base</span>
            <span className="text-right">Total</span>
            <span className="text-right">Mod</span>
          </div>
          {abilityKeys.map((ability) => (
            <FormField
              key={ability}
              control={editor.form.control}
              name={ability}
              render={({ field, fieldState }) => (
                <FormItem
                  className={`${columns} border-foreground/10 items-center gap-y-1 border-b py-1`}
                >
                  <FormLabel className="font-mono text-base font-normal">
                    {abilityLabels[ability]}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={maintenance.readOnly}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-10 text-center font-mono md:h-8"
                    />
                  </FormControl>
                  <span className="flex justify-end font-mono text-base">
                    <span className="sr-only">
                      {abilityLabels[ability]} total{' '}
                    </span>
                    <StatBreakdown
                      label={abilityLabels[ability]}
                      statistic={breakdowns[abilityTargets[ability]]}
                      target={abilityTargets[ability]}
                      className="text-base"
                    />
                  </span>
                  <span className="text-right font-mono text-base">
                    <span className="sr-only">
                      {abilityLabels[ability]} modifier{' '}
                    </span>
                    {formatModifier(abilities[ability].modifier)}
                  </span>
                  <FormMessage
                    role={fieldState.error ? 'alert' : undefined}
                    className="col-span-4"
                  />
                </FormItem>
              )}
            />
          ))}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
            <Button
              type="submit"
              size="sm"
              className={action}
              disabled={isSaving || maintenance.readOnly}
            >
              {isSaving ? 'Saving…' : 'Save scores'}
            </Button>
            <SaveFeedback status={editor.status} savedText="Scores saved." />
            <MaintenanceReason notice={maintenance} />
            <RemoteNotice
              isShown={editor.hasRemoteChange}
              message={
                editor.form.formState.isDirty
                  ? 'Updated by another player. Your edits are kept.'
                  : 'Updated by another player.'
              }
              subject="ability scores"
              onDismiss={editor.dismissRemoteChange}
            />
          </div>
        </form>
      </Form>
    </Block>
  );
}
