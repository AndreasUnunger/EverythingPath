import { eventView } from './event-facts';
import { activityView } from './activity-facts';
import { upkeepInputFacts } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { Phase, PhaseView } from './types';
export function phaseView(
  phase: Phase,
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): PhaseView {
  if (phase === 'summary')
    return {
      phase,
      ready: preview.status === 'ready',
      baseline: preview.baseline,
      outcome: preview.outcome,
      requirements: preview.requirements,
      warnings: preview.warnings,
    };
  if (phase === 'activity') return activityView(draft, source, preview);
  if (phase === 'event') return eventView(draft, source, preview);
  if (phase === 'persistent')
    return {
      phase,
      ready: preview.phases?.persistent.ready ?? false,
      carriedCount: draft.context.carriedEvents.length,
      requirements: preview.phases?.persistent.requirements ?? [],
      warnings: preview.phases?.persistent.warnings ?? [],
    };
  const { projection, fields, minimumTreasuryCopper } = upkeepInputFacts(
    draft,
    source.snapshot,
  );
  const values = (state: WorkspaceSource['snapshot']) => ({
    rank: state.rank,
    training: state.training,
    treasuryCopper: state.treasuryCopper,
    notoriety: state.notoriety,
  });
  return {
    phase,
    skipped: projection.skipped,
    ready: projection.ready,
    before: values(source.snapshot),
    after: values(projection.outcome),
    minimumTreasuryCopper,
    rolls: fields.map((fact) => {
      const raw =
        fact.field === 'notorietyCheck'
          ? draft.upkeep.notorietyCheck
          : draft.upkeep.rolls[fact.field];
      const complete = raw?.sides === fact.sides;
      return {
        field: fact.field,
        sides: fact.sides,
        dice: Array.from({ length: fact.count }, (_, index) =>
          complete ? (raw.dice[index] ?? null) : null,
        ),
        modifier: fact.check?.modifier ?? null,
        total: fact.check?.total ?? null,
        dc: fact.dc,
        modifiers: fact.check?.modifiers ?? [],
      };
    }),
    nearestSettlement: {
      required: projection.requirements.includes(
        'upkeep:notoriety:nearest-settlement',
      ),
      selected: draft.upkeep.nearestSettlementId ?? null,
      choices: source.snapshot.settlements.map((settlement) => ({
        settlementId: settlement.settlementId,
        name: settlement.name,
      })),
    },
    officers: source.snapshot.roster.people.map((person) => ({
      characterId: person.characterId,
      name:
        source.people.find((entry) => entry.characterId === person.characterId)
          ?.name ?? null,
      roles: source.snapshot.roster.officers
        .filter((officer) => officer.characterId === person.characterId)
        .map((officer) => officer.role),
    })),
    transfers: structuredClone(draft.upkeep.treasuryTransfers),
    teams: source.snapshot.roster.teams
      .filter((team) => team.status !== 'active')
      .map((team) => {
        const decision = draft.upkeep.teamDecisions.find(
          (entry) => entry.teamId === team.teamId,
        );
        const adjustment = draft.tableAdjustments.find(
          (item) => item.adjustmentId === `upkeep-recovery:${team.teamId}`,
        );
        return {
          recoveryAdjustment:
            adjustment?.kind === 'militia_value' &&
            adjustment.field === 'treasuryCopper' &&
            adjustment.operation === 'add'
              ? { deltaCopper: adjustment.value, reason: adjustment.reason }
              : null,
          teamId: team.teamId,
          name: team.name,
          status: team.status,
          decision: decision?.decision ?? null,
          costCopper: minimumTreasuryCopper,
          roll: decision?.roll?.dice[0] ?? null,
          needsReturnRoll:
            projection.requirements.includes(
              `team:${team.teamId}:return:roll`,
            ) ||
            projection.checks.some(
              (check) => check.checkId === `team:${team.teamId}:return`,
            ),
        };
      }),
    boons: projection.plan.filter((change) => change.kind === 'boon'),
    exceptions: [
      ...source.snapshot.roster.teams.flatMap((team) => [
        {
          subjectId: team.teamId,
          ruleId: 'upkeep-team-removal',
          requirement: `team:${team.teamId}:removal-exception`,
          name: team.name,
        },
        {
          subjectId: team.teamId,
          ruleId: 'upkeep-recovery-funds',
          requirement: `team:${team.teamId}:recovery-funds-exception`,
          name: team.name,
        },
      ]),
      ...draft.upkeep.treasuryTransfers.flatMap((transfer) =>
        (['officer', 'funds'] as const).map((kind) => ({
          subjectId: transfer.transferId,
          ruleId: `upkeep-transfer-${kind}`,
          requirement: `transfer:${transfer.transferId}:${kind}-exception`,
          name:
            transfer.direction === 'deposit'
              ? 'Treasury deposit'
              : 'Treasury withdrawal',
        })),
      ),
    ].flatMap((candidate) => {
      const existing = draft.rulesExceptions.find(
        (exception) =>
          exception.subjectId === candidate.subjectId &&
          exception.ruleId === candidate.ruleId,
      );
      return projection.requirements.includes(candidate.requirement) || existing
        ? [
            {
              subjectId: candidate.subjectId,
              ruleId: candidate.ruleId,
              name: candidate.name,
              exceptionId:
                existing?.exceptionId ??
                `upkeep:${candidate.ruleId}:${candidate.subjectId}`,
              reason: existing?.reason ?? '',
            },
          ]
        : [];
    }),
    requirements: projection.requirements,
    warnings: projection.warnings,
  };
}
