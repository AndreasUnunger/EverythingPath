'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
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
import { nonnegativeIntegerField } from './numeric-form-fields';
import type { RaceStatisticsView } from './character-sheet-races-view-model';
import { InlineWarnings } from './inline-warning';
import { action, fieldLabel, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

const hitPointsField = nonnegativeIntegerField('Racial hit points', {
  optional: true,
  numberMessage: 'Racial hit points must be a whole number of 0 or more',
});
const ranksField = nonnegativeIntegerField('Ranks', {
  requiredMessage: 'Ranks are required',
  numberMessage: 'Ranks must be a whole number of 0 or more',
});
const schema = z.object({
  racialHpGained: hitPointsField,
  ranks: z
    .array(
      z.object({
        skill: z.string().refine((skill) => skill.trim() !== '', {
          message: 'Skill is required',
        }),
        ranks: ranksField,
      }),
    )
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const skill = row.skill.trim().toLowerCase();
        if (skill && seen.has(skill))
          context.addIssue({
            code: 'custom',
            path: [index, 'skill'],
            message: 'Each skill once',
          });
        seen.add(skill);
      });
    }),
});
type Values = z.infer<typeof schema>;

function valuesFrom(statistics: RaceStatisticsView): Values {
  return {
    racialHpGained:
      statistics.racialHpGained === null
        ? ''
        : String(statistics.racialHpGained),
    ranks: Object.entries(statistics.racialSkillRanks).map(
      ([skill, ranks]) => ({ skill, ranks: String(ranks) }),
    ),
  };
}

function describeHitDice(statistics: RaceStatisticsView) {
  const dice = statistics.racialHitDice === 1 ? 'Hit Die' : 'Hit Dice';
  const die = statistics.hitDie === null ? '' : ` (d${statistics.hitDie})`;
  return `${statistics.racialHitDice} racial ${dice}${die}`;
}

const inputClass = 'h-10 font-mono text-sm md:h-8';

/**
 * A race with Hit Dice of its own: the hit points they gave, as one plain
 * number that starts unknown and is never filled in, and the skill ranks
 * they bought, skill by skill. Saved together with their own button; the
 * budget and cap warnings sit under the ranks they are about.
 */
export function RacialStatisticsEditor({
  statistics,
  warnings,
  warningController,
  actions,
}: {
  statistics: RaceStatisticsView;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  // Saved values from anywhere replace the draft; the caller keys this form
  // on the race's row, so another race never inherits it.
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: valuesFrom(statistics),
  });
  const ranks = useFieldArray({ control: form.control, name: 'ranks' });
  const status = actions.statusFor(statistics.entryId);
  const isSaving = status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;

  async function save(values: Values) {
    const hitPoints = values.racialHpGained.trim();
    const isSaved = await actions.editStatistics(statistics.entryId, {
      racialHpGained: hitPoints === '' ? null : Number(hitPoints),
      racialSkillRanks: Object.fromEntries(
        values.ranks.map((row) => [row.skill.trim(), Number(row.ranks)]),
      ),
    });
    if (isSaved) form.reset(values);
  }

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label="Racial Hit Dice"
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void form.handleSubmit(save)();
        }}
      >
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={fieldLabel}>Racial Hit Dice</p>
          <p className="text-muted-foreground text-xs">
            {describeHitDice(statistics)}
          </p>
        </div>
        <FormField
          control={form.control}
          name="racialHpGained"
          render={({ field, fieldState }) => (
            <FormItem className="gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <FormLabel className="font-mono text-sm font-normal">
                  Racial hit points
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={maintenance.readOnly}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Enter racial hit points"
                    className={`${inputClass} w-56`}
                  />
                </FormControl>
              </div>
              <FormMessage
                role={fieldState.error ? 'alert' : undefined}
                className="max-w-sm"
              />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-1.5">
          <p className={fieldLabel}>Racial skill ranks</p>
          {ranks.fields.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No skill ranks recorded for the racial Hit Dice.
            </p>
          ) : null}
          {ranks.fields.map((row, index) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start gap-x-2 gap-y-1"
            >
              <FormField
                control={form.control}
                name={`ranks.${index}.skill`}
                render={({ field, fieldState }) => (
                  <FormItem className="min-w-40 flex-1 gap-1">
                    <FormLabel className="sr-only">Skill {index + 1}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={maintenance.readOnly}
                        type="text"
                        autoComplete="off"
                        placeholder="Skill"
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage
                      role={fieldState.error ? 'alert' : undefined}
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`ranks.${index}.ranks`}
                render={({ field, fieldState }) => (
                  <FormItem className="w-24 gap-1">
                    <FormLabel className="sr-only">
                      Ranks for skill {index + 1}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={maintenance.readOnly}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ranks"
                        className={`${inputClass} text-center`}
                      />
                    </FormControl>
                    <FormMessage
                      role={fieldState.error ? 'alert' : undefined}
                    />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 md:size-8"
                disabled={maintenance.readOnly}
                onClick={() => ranks.remove(index)}
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">Remove skill {index + 1}</span>
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={action}
              disabled={maintenance.readOnly}
              onClick={() => ranks.append({ skill: '', ranks: '' })}
            >
              <Plus aria-hidden className="size-4" />
              Add skill
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={reasonId}
              disabled={isDisabled}
            >
              {isSaving ? 'Saving…' : 'Save racial Hit Dice'}
            </Button>
            <SaveFeedback status={status} savedText="Racial Hit Dice saved." />
          </div>
          <InlineWarnings warnings={warnings} controller={warningController} />
        </div>
      </form>
    </Form>
  );
}
