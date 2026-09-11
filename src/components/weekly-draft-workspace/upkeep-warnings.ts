import type { UpkeepView } from './types';
const rollNames: Record<string, string> = {
  'upkeep:attrition': 'Attrition Loyalty',
  'upkeep:attrition-training': 'Attrition training',
  'upkeep:notoriety-training': 'Maximum-notoriety training',
  'upkeep:notoriety': 'Notoriety Loyalty',
  'upkeep:shortage': 'Treasury-shortage training',
};
export function upkeepWarningMessages(view: UpkeepView) {
  return [
    ...new Set(
      view.warnings.map((code) => {
        const team = view.teams.find((team) =>
          code.startsWith(`team:${team.teamId}:`),
        );
        if (team) {
          if (code.endsWith(':recovery-funds'))
            return `${team.name} recovery costs more than the available treasury. Record a table ruling to proceed.`;
          if (code.endsWith(':recovery-cost-baseline'))
            return `${team.name} has an entered recovery cost that differs from the rules cost of ${team.costCopper} copper. Use a reasoned recovery adjustment to change the final treasury.`;
          if (code.endsWith(':upkeep-removal'))
            return `Removing ${team.name} departs from normal Upkeep. Record why the table permits this removal.`;
          if (code.endsWith(':roll-range'))
            return `${team.name}'s return die is outside the usual 1–20 range. The entered value is retained.`;
        }
        const transfer = view.transfers.find((transfer) =>
          code.startsWith(`transfer:${transfer.transferId}:`),
        );
        if (transfer) {
          const name =
            view.officers.find(
              (person) => person.characterId === transfer.characterId,
            )?.name ?? 'This character';
          if (code.endsWith(':officer'))
            return `${name} is not an assigned officer. This ${transfer.direction} needs a table ruling.`;
          if (code.endsWith(':funds'))
            return `${name}'s withdrawal of ${transfer.copper} copper exceeds the available treasury. Record a table ruling to proceed.`;
        }
        const officer = view.officers.find(
          (person) => code === `officer:${person.characterId}:archived`,
        );
        if (officer)
          return `${officer.name ?? 'An assigned officer'} is archived. Review the assignment and its check bonus.`;
        if (code === 'rank:ap-cap')
          return 'Training qualifies the militia for a rank above the adventure progression limit. Review the rank with the table.';
        if (code === 'rank:pc-cap')
          return 'The militia rank exceeds the highest player-character level. Review the rank with the table.';
        const roll = Object.entries(rollNames).find(
          ([key]) => code === `${key}:roll-range`,
        );
        if (roll)
          return `${roll[1]} dice include a value outside the usual die range. Your entered values are retained for the table.`;
        return 'An Upkeep rule needs review. Check the affected roll or decision with the table before confirming.';
      }),
    ),
  ];
}
