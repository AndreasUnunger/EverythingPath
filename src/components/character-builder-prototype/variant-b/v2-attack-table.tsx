'use client';
// PROTOTYPE (throwaway, #216) — sheet variant 2, "Attack table". Attacks are
// a table of the weapons in Gear, each with one setting: how it is held
// (`wield`, `store.setWield`; rows from `wieldSetups`). Situational bonuses
// are alternate totals worked out with stacking and shown beside the normal
// number, and a situations strip shows the whole sheet in one situation (the
// lens, `ui.situation`). Owned by the variant 2 agent. The table is in
// v2-attacks.tsx; the alternates, strip and breakdown section in
// v2-situations.tsx. Contract: CONTRACT.md, "Round 3".

import { Block, blockHeading } from './shared';
import { StatGroups, StatRow } from './sheet-default-blocks';
import type { SheetSlotProps, SheetVariantSlots } from './sheet-variants';
import { AttackTable } from './v2-attacks';
import {
  AltTotals,
  SituationsStrip,
  V2BreakdownExtra,
  V2SkillExtra,
} from './v2-situations';

/** The alternate totals of a row, right next to its main number. */
const alt = 'ml-auto pb-1.5';

function V2Defenses({ sheet }: SheetSlotProps) {
  return (
    <Block id="b-defenses" title="Defenses">
      <StatGroups
        groups={[
          {
            key: 'hp-ac',
            rows: (
              <>
                <StatRow
                  label="Hit points"
                  title="Hit points"
                  path="hp"
                  sheet={sheet}
                >
                  <AltTotals path="hp" title="Hit points" className={alt} />
                </StatRow>
                <StatRow
                  label="Armor Class"
                  title="Armor Class"
                  path="ac"
                  sheet={sheet}
                  also={[
                    { label: 'Touch', title: 'Touch AC', path: 'touchAc' },
                    {
                      label: 'Flat-footed',
                      title: 'Flat-footed AC',
                      path: 'flatFootedAc',
                    },
                  ]}
                >
                  <AltTotals path="ac" title="Armor Class" className={alt} />
                </StatRow>
              </>
            ),
          },
          {
            key: 'saves',
            rows: (
              <>
                <StatRow
                  label="Fortitude"
                  title="Fortitude save"
                  path="saves.fort"
                  sheet={sheet}
                  signed
                >
                  <AltTotals
                    path="saves.fort"
                    title="Fortitude save"
                    signed
                    className={alt}
                  />
                </StatRow>
                <StatRow
                  label="Reflex"
                  title="Reflex save"
                  path="saves.ref"
                  sheet={sheet}
                  signed
                >
                  <AltTotals
                    path="saves.ref"
                    title="Reflex save"
                    signed
                    className={alt}
                  />
                </StatRow>
                <StatRow
                  label="Will"
                  title="Will save"
                  path="saves.will"
                  sheet={sheet}
                  signed
                >
                  <AltTotals
                    path="saves.will"
                    title="Will save"
                    signed
                    className={alt}
                  />
                </StatRow>
              </>
            ),
          },
          {
            key: 'cmd',
            rows: (
              <StatRow
                label="CMD"
                title="Combat Maneuver Defense"
                path="cmd"
                sheet={sheet}
                also={[
                  {
                    label: 'Flat-footed',
                    title: 'Flat-footed CMD',
                    path: 'flatFootedCmd',
                  },
                ]}
              >
                <AltTotals
                  path="cmd"
                  title="Combat Maneuver Defense"
                  className={alt}
                />
              </StatRow>
            ),
          },
        ]}
      />
    </Block>
  );
}

function V2Offense({ character, sheet }: SheetSlotProps) {
  return (
    <Block id="b-offense" title="Offense">
      <StatGroups
        groups={[
          {
            key: 'bab',
            rows: (
              <StatRow
                label="Base attack"
                title="Base attack bonus"
                path="bab"
                sheet={sheet}
                signed
              >
                <AltTotals
                  path="bab"
                  title="Base attack bonus"
                  signed
                  className={alt}
                />
              </StatRow>
            ),
          },
          {
            key: 'cmb',
            rows: (
              <StatRow
                label="CMB"
                title="Combat Maneuver Bonus"
                path="cmb"
                sheet={sheet}
                signed
              >
                <AltTotals
                  path="cmb"
                  title="Combat Maneuver Bonus"
                  signed
                  className={alt}
                />
              </StatRow>
            ),
          },
          {
            key: 'init',
            rows: (
              <StatRow
                label="Initiative"
                title="Initiative"
                path="init"
                sheet={sheet}
                signed
              >
                <AltTotals
                  path="init"
                  title="Initiative"
                  signed
                  className={alt}
                />
              </StatRow>
            ),
          },
        ]}
      />
      <h3 className={`${blockHeading} mt-4 mb-1`}>Attacks</h3>
      <AttackTable character={character} sheet={sheet} />
    </Block>
  );
}

export const v2Slots: SheetVariantSlots = {
  Defenses: V2Defenses,
  Offense: V2Offense,
  AboveSheet: SituationsStrip,
  SkillExtra: V2SkillExtra,
  BreakdownExtra: V2BreakdownExtra,
};
