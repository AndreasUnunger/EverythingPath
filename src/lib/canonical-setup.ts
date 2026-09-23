import { z } from 'zod';
import { canonicalWeekStateSchema } from './canonical-weekly-source';
import { createWeeklyDraft } from './weekly-draft';
import { draftReferenceRequirements } from './weekly-draft-references';
import {
  getAdvancementForRank,
  getMaxTeamsForRank,
  getMinimumTreasuryForRank,
} from './militia-progression-rules';
import { rosterWarnings } from './canonical-roster';

// Setup supplies facts, never resolved outcomes or pre-confirmed choices.
export const militiaSetupSchema = z
  .strictObject({
    mode: z.enum(['new', 'existing']),
    state: canonicalWeekStateSchema,
    phase: z.enum(['upkeep', 'activity', 'event', 'persistent', 'summary']),
    notes: z.string().trim().max(2000),
  })
  .superRefine((setup, ctx) => {
    let draft;
    try {
      draft = createWeeklyDraft({
        draftId: 'setup-validation',
        week: setup.state.week,
        context: setup.state.context,
        slotIds: [],
      });
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      for (const issue of error.issues)
        ctx.addIssue({
          code: 'custom',
          path: ['state', 'context'],
          message: issue.message,
        });
      return;
    }
    const snapshot = setup.state.militiaSnapshot;
    snapshot.economy?.orders.forEach((order, index) => {
      const field =
        order.source === 'special_order' ? 'dueDay' : 'dueActivityWeek';
      if (order[field] === null)
        ctx.addIssue({
          code: 'custom',
          path: ['state', 'militiaSnapshot', 'economy', 'orders', index, field],
          message: 'Record the delivery date before starting the week.',
        });
    });
    snapshot.roster.people.forEach((person, index) => {
      if (
        person.hitDice === null &&
        snapshot.roster.officers.some(
          (officer) =>
            officer.characterId === person.characterId &&
            officer.role === 'commandant',
        )
      )
        ctx.addIssue({
          code: 'custom',
          path: [
            'state',
            'militiaSnapshot',
            'roster',
            'people',
            index,
            'hitDice',
          ],
          message: 'Commandant Hit Dice are required before starting the week.',
        });
    });

    if (draftReferenceRequirements(draft, snapshot, snapshot).length)
      ctx.addIssue({
        code: 'custom',
        path: ['state', 'context'],
        message:
          'A carried event, order or queued effect refers to an entity missing from this setup. Restore it or choose another target.',
      });
  });
export type MilitiaSetup = z.infer<typeof militiaSetupSchema>;

export function newMilitiaSetup(
  focus: 'Loyalty' | 'Security' | 'Secrecy',
): MilitiaSetup {
  return {
    mode: 'new',
    phase: 'upkeep',
    notes: '',
    state: {
      week: 1,
      militiaSnapshot: {
        rank: 1,
        training: 0,
        treasuryCopper: getMinimumTreasuryForRank(1) * 100,
        notoriety: 0,
        focus,
        roster: { people: [], teams: [], officers: [] },
        characters: [],
        settlements: [],
        bonuses: [],
        economy: { items: [], caches: [], orders: [], markets: [] },
        characterActions: { people: [] },
        eventBenefits: { skills: [], markets: [] },
      },
      context: {
        firstMilitiaWeek: true,
        startDay: 0,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    },
  };
}

export function prepareMilitiaSetup(input: MilitiaSetup, draftId: string) {
  const setup = militiaSetupSchema.parse(input);
  const { militiaSnapshot: snapshot, context, week } = setup.state;
  const draft = createWeeklyDraft({
    draftId,
    week,
    context: {
      ...context,
      firstMilitiaWeek:
        setup.mode === 'existing' ? false : context.firstMilitiaWeek,
    },
    slotIds: [],
  });
  const warnings = [
    ...rosterWarnings(
      snapshot.roster,
      snapshot.characters.map((character, index) => ({
        ...character,
        name: `Character ${index + 1}`,
      })),
      getMaxTeamsForRank(snapshot.rank),
    ),
    ...advancementWarnings(snapshot),
    ...startingValueWarnings(snapshot),
  ];
  if (setup.phase === 'persistent' && !draft.context.persistentPhaseEligible)
    warnings.push(
      'There are no carried persistent events. The week will open in Upkeep.',
    );
  return { draft, snapshot, warnings };
}

type SetupSnapshot = MilitiaSetup['state']['militiaSnapshot'];
function advancementWarnings(snapshot: SetupSnapshot) {
  const warnings: string[] = [];
  const advancement = getAdvancementForRank(snapshot.rank);
  if (!advancement)
    warnings.push('Rank is outside the standard advancement table (1–20).');
  if (advancement && snapshot.training < advancement.training)
    warnings.push(
      `Training is below the rank ${snapshot.rank} threshold of ${advancement.training}. Rank never decreases after training loss; check this against your table history.`,
    );
  const pcIds = new Set(
    snapshot.roster.people
      .filter((person) => person.kind === 'pc')
      .map((person) => person.characterId),
  );
  const pcLevels = snapshot.characters
    .filter(
      (character) => pcIds.has(character.characterId) && character.isActive,
    )
    .map((character) => character.level);
  if (pcLevels.length && snapshot.rank > Math.max(...pcLevels))
    warnings.push('Rank exceeds the highest active PC level.');
  return warnings;
}
function startingValueWarnings(snapshot: SetupSnapshot) {
  const warnings: string[] = [];
  if (snapshot.training < 0) warnings.push('Training is below zero.');
  if (snapshot.treasuryCopper < getMinimumTreasuryForRank(snapshot.rank) * 100)
    warnings.push(
      'Treasury is below the normal minimum. Upkeep may require a training loss.',
    );
  if (snapshot.notoriety < 0 || snapshot.notoriety > 100)
    warnings.push('Notoriety is outside the normal range of 0–100.');
  return warnings;
}
