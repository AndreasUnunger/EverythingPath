'use client';
import { Block } from './sheet-parts';
import { StatGroups } from './stat-row';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Derived = NonNullable<
  Controller['sheet']
>['calculated']['derivedStatistics'];

/**
 * Defenses (approved prototype): Armor Class with its touch and flat-footed
 * variants, the three saves, and CMD with its flat-footed variant. HP is in
 * the pinned summary and is not repeated here.
 */
export function DefensesBlock({ statistics }: { statistics: Derived }) {
  return (
    <Block title="Defenses">
      <StatGroups
        groups={[
          {
            key: 'ac',
            rows: [
              {
                figure: {
                  label: 'Armor Class',
                  title: 'Armor Class',
                  target: 'derived:ac',
                  statistic: statistics.ac,
                },
                variants: [
                  {
                    label: 'Touch',
                    title: 'Touch AC',
                    target: 'derived:touchAc',
                    statistic: statistics.touchAc,
                  },
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed AC',
                    target: 'derived:flatFootedAc',
                    statistic: statistics.flatFootedAc,
                  },
                ],
              },
            ],
          },
          {
            key: 'saves',
            rows: [
              {
                figure: {
                  label: 'Fortitude',
                  title: 'Fortitude save',
                  target: 'derived:fortitude',
                  statistic: statistics.fortitude,
                  isSigned: true,
                },
              },
              {
                figure: {
                  label: 'Reflex',
                  title: 'Reflex save',
                  target: 'derived:reflex',
                  statistic: statistics.reflex,
                  isSigned: true,
                },
              },
              {
                figure: {
                  label: 'Will',
                  title: 'Will save',
                  target: 'derived:will',
                  statistic: statistics.will,
                  isSigned: true,
                },
              },
            ],
          },
          {
            key: 'cmd',
            rows: [
              {
                figure: {
                  label: 'CMD',
                  title: 'Combat Maneuver Defense',
                  target: 'derived:cmd',
                  statistic: statistics.cmd,
                },
                variants: [
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed CMD',
                    target: 'derived:flatFootedCmd',
                    statistic: statistics.flatFootedCmd,
                  },
                ],
              },
            ],
          },
        ]}
      />
    </Block>
  );
}
