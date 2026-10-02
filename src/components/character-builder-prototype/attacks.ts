// PROTOTYPE (throwaway, #216) — weapon attacks, pure. A Character's weapons
// (`weaponsOf`), three ways to get attack setups (one per variant:
// `autoSetups`, `wieldSetups`, `routineSetups`), and `resolveRoutine`, which
// turns one setup into the full attack: every attack bonus and damage bonus
// is a Stat, so the breakdown popover can show it.
//
// Rules (CRB chapter 8 and the feats): iterative attacks at −5 cumulative
// from BAB +6/+11/+16; two-weapon fighting penalties of Table 8-7; Str ×1½ in
// two hands, ×½ off hand (a penalty in full), composite bows up to their
// rating, other bows a penalty only, crossbows none; Power Attack −1/+2 per
// step (a step at BAB +1, +4, +8…), +50% two-handed, half off hand, melee
// only; haste's extra attack at the full bonus; sneak attack dice only in
// its situation.

import { resolveSheet, weaponName } from './resolve';
import { lookupCatalog } from './sheet';
import type {
  AttackSetup,
  CatalogEntry,
  Character,
  Contribution,
  LeafTarget,
  ResolvedSheet,
  SheetEntry,
  SituationKey,
  Stat,
  Weapon,
  Wield,
} from './types';
import { formatBonus } from './ui-helpers';

export type { AttackSetup, Weapon, Wield };

export type WeaponEntry = {
  entry: SheetEntry;
  catalog: CatalogEntry;
  weapon: Weapon;
};

export type AttackHand = 'twoHands' | 'oneHand' | 'primary' | 'off' | 'ranged';

export type ResolvedAttack = {
  /** Unique within the routine: `<setup id>:main-0`, `:haste`, `:off`. */
  key: string;
  /** Catalog name, e.g. "+1 greataxe". */
  label: string;
  weaponEntryId: string;
  hand: AttackHand;
  kind: 'melee' | 'ranged';
  /** 1-based order within the full attack. */
  sequence: number;
  /** "haste", "off hand". */
  note?: string;
  /** Attack bonus; `conditional` holds situational ones (hatred). */
  bonus: Stat;
  damage: {
    dice: string;
    /** Str, damage Modifiers, Power Attack; `conditional` holds situational ones. */
    bonus: Stat;
    /** "1d12+8", "1d12+8 plus 2d6" when the sneak situation is asked for. */
    text: string;
    /** Extra dice applied because their situation was asked for (sneak attack). */
    extra: { label: string; dice: string; conditionText: string }[];
  };
  /** "×3", "18–20/×2", "19–20/×2". */
  critical: { threat: number; mult: number; text: string };
  rangeIncrement?: number;
};

/**
 * Something the attack can add that isn't in its numbers: Power Attack when
 * off, sneak attack dice when their situation isn't asked for. Read it as
 * `${label}: ${text}` plus `conditionText` when present.
 */
export type Rider = {
  key: string;
  /** "Power Attack", "Sneak Attack". */
  label: string;
  /** The effect: "−2 attack, +6 damage", "+2d6". */
  text: string;
  /** Name of the sheet entry it comes from. */
  from: string;
  /** "when flanking or the target is denied its Dex bonus; ranged only within 30 ft." */
  conditionText?: string;
  /** The situation that applies it (the lens can ask for it). */
  situationKey?: SituationKey;
};

export type ResolvedRoutine = {
  setup: AttackSetup;
  /**
   * The standard-action attack: the primary (or only) weapon once, with no
   * two-weapon penalty, no iterative and no haste attack; Power Attack as
   * the routine has it. Two-weapon penalties apply only to a full attack
   * with both weapons (CRB). Key `<setup id>:single`, sequence 1. Null only
   * when the weapon is gone (then `attacks` is empty too).
   */
  single: ResolvedAttack | null;
  /** The full attack in order (full-round action). */
  attacks: ResolvedAttack[];
  /** "Two-weapon fighting, light off hand: −4 primary, −8 off hand". */
  penalties: string[];
  riders: Rider[];
  /** Setup problems, e.g. a weapon that is no longer on the sheet. Never blocking. */
  notes: string[];
};

// ------------------------------------------------------------------ weapons

/** The Character's active weapon items, in sheet order. */
export function weaponsOf(character: Character): WeaponEntry[] {
  return character.entries.flatMap((entry) => {
    if (!entry.active || entry.kind !== 'item') return [];
    const catalog = lookupCatalog(character, entry.catalogKey);
    return catalog?.detail.kind === 'item' && catalog.detail.weapon
      ? [{ entry, catalog, weapon: catalog.detail.weapon }]
      : [];
  });
}

/** The hand a weapon attacks with on its own: two hands for two-handed and ranged weapons. */
export function naturalHand(weapon: Weapon): AttackSetup['main']['hand'] {
  return weapon.handedness === 'twoHanded' || weapon.handedness === 'ranged'
    ? 'twoHands'
    : 'oneHand';
}

/** A variant-2 weapon's `wield` (null = not used to attack). */
export function wieldOf(entry: SheetEntry): Wield | null {
  return entry.state.kind === 'item' ? (entry.state.wield ?? null) : null;
}

/** "Two kukris", "Longsword and short sword". */
function pairName(main: WeaponEntry, off: WeaponEntry) {
  return main.catalog.key === off.catalog.key
    ? `Two ${main.catalog.name.toLowerCase()}s`
    : `${main.catalog.name} and ${off.catalog.name.toLowerCase()}`;
}

const NO_OPTIONS = { powerAttack: false };

/**
 * Variant 1: one setup per weapon in its natural hand, plus one two-weapon
 * setup when at least two light or one-handed melee weapons exist (the
 * first two; the off hand is the light one, if any).
 */
export function autoSetups(character: Character): AttackSetup[] {
  const weapons = weaponsOf(character);
  const setups: AttackSetup[] = weapons.map((w) => ({
    id: `auto-${w.entry.id}`,
    name: w.catalog.name,
    main: { entryId: w.entry.id, hand: naturalHand(w.weapon) },
    options: NO_OPTIONS,
  }));
  const pairable = weapons.filter(
    (w) =>
      w.weapon.handedness === 'light' || w.weapon.handedness === 'oneHanded',
  );
  if (pairable.length >= 2) {
    const [a, b] = pairable as [WeaponEntry, WeaponEntry];
    const [main, off] =
      b.weapon.handedness === 'light' || a.weapon.handedness !== 'light'
        ? [a, b]
        : [b, a];
    setups.push({
      id: 'auto-two-weapon',
      name: pairName(main, off),
      main: { entryId: main.entry.id, hand: 'oneHand' },
      off: { entryId: off.entry.id },
      options: NO_OPTIONS,
    });
  }
  return setups;
}

/**
 * Variant 2: from each weapon's `wield`. One setup per weapon whose wield
 * isn't null; each `primary` weapon pairs with the first unpaired `off`
 * weapon into one two-weapon setup. An unpaired primary or off weapon
 * attacks on its own in one hand.
 */
export function wieldSetups(character: Character): AttackSetup[] {
  const weapons = weaponsOf(character);
  const offs = weapons.filter((w) => wieldOf(w.entry) === 'off');
  const pairs = new Map<string, WeaponEntry>();
  const paired = new Set<string>();
  for (const w of weapons) {
    if (wieldOf(w.entry) !== 'primary') continue;
    const off = offs.find((o) => !paired.has(o.entry.id));
    if (!off) continue;
    pairs.set(w.entry.id, off);
    paired.add(off.entry.id);
  }
  return weapons.flatMap((w): AttackSetup[] => {
    const wield = wieldOf(w.entry);
    if (!wield || paired.has(w.entry.id)) return [];
    const off = pairs.get(w.entry.id);
    if (off)
      return [
        {
          id: `wield-${w.entry.id}-${off.entry.id}`,
          name: pairName(w, off),
          main: { entryId: w.entry.id, hand: 'oneHand' },
          off: { entryId: off.entry.id },
          options: NO_OPTIONS,
        },
      ];
    return [
      {
        id: `wield-${w.entry.id}`,
        name: w.catalog.name,
        main: {
          entryId: w.entry.id,
          hand: wield === 'twoHands' ? 'twoHands' : 'oneHand',
        },
        options: NO_OPTIONS,
      },
    ];
  });
}

/** Variant 3: the saved Attack Routines (`attackRoutine` entries), in sheet order. */
export function routineSetups(character: Character): AttackSetup[] {
  return character.entries.flatMap((e) =>
    e.state.kind === 'attackRoutine'
      ? [
          {
            id: e.id,
            name: e.state.name,
            main: e.state.main,
            ...(e.state.off ? { off: e.state.off } : {}),
            options: e.state.options,
          },
        ]
      : [],
  );
}

// --------------------------------------------------------------- resolving

const sum = (list: Contribution[]) => list.reduce((a, c) => a + c.value, 0);

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

/** Attacks in a full attack from BAB alone: +6, +11, +16 add one each. */
export function iterativeCount(bab: number) {
  return bab >= 16 ? 4 : bab >= 11 ? 3 : bab >= 6 ? 2 : 1;
}

/** Power Attack steps: one at BAB +1, one more at +4 and every 4 after. */
export function powerAttackSteps(bab: number) {
  return bab >= 1 ? 1 + Math.floor(bab / 4) : 0;
}

/** "×3", "19–20/×2". */
export function criticalText(weapon: Weapon) {
  return weapon.threat >= 20
    ? `×${weapon.mult}`
    : `${weapon.threat}–20/×${weapon.mult}`;
}

/** "1d12+8", "1d8", "1d4−1". */
function diceText(dice: string, bonus: number) {
  return bonus === 0 ? dice : `${dice}${formatBonus(bonus)}`;
}

const weaponSheetCache = new WeakMap<Character, Map<string, ResolvedSheet>>();

/** The sheet seen from one weapon (its weapon-scoped Modifiers apply), memoised per Character object. */
function weaponSheet(
  character: Character,
  w: WeaponEntry,
  situations: readonly SituationKey[],
) {
  const key = `${w.entry.id}|${[...situations].sort().join(',')}`;
  let byKey = weaponSheetCache.get(character);
  if (!byKey)
    weaponSheetCache.set(character, (byKey = new Map<string, ResolvedSheet>()));
  let sheet = byKey.get(key);
  if (!sheet)
    byKey.set(
      key,
      (sheet = resolveSheet(character, {
        situations,
        weapon: { entryId: w.entry.id, base: weaponName(w.weapon.base) },
      })),
    );
  return sheet;
}

const extra = (
  label: string,
  value: number,
  target: LeafTarget,
  temporary = false,
): Contribution => ({
  label,
  value,
  target,
  bonusType: 'untyped',
  builtIn: true,
  temporary,
});

/** A leaf Stat plus routine built-ins (zero-valued ones dropped). */
function withExtras(leaf: Stat, extras: (Contribution | null)[]): Stat {
  const applied = [
    ...leaf.applied,
    ...extras.filter((c): c is Contribution => c !== null && c.value !== 0),
  ];
  return {
    total: sum(applied),
    applied,
    suppressed: leaf.suppressed,
    conditional: leaf.conditional,
  };
}

/** Str on damage for one weapon in one hand (null = none). */
function strDamage(
  w: WeaponEntry,
  hand: AttackHand,
  str: Stat,
): Contribution | null {
  const mod = str.total;
  const temporary = str.applied.some((c) => c.temporary);
  const target: LeafTarget =
    w.weapon.handedness === 'ranged' ? 'damage.ranged' : 'damage.melee';
  const make = (label: string, value: number) =>
    extra(label, value, target, temporary);
  if (w.weapon.handedness !== 'ranged') {
    if (mod < 0) return make('Str modifier', mod);
    if (hand === 'twoHands' && w.weapon.handedness !== 'light')
      return make('Str modifier ×1½', Math.floor(mod * 1.5));
    if (hand === 'off') return make('Str modifier ×½', Math.floor(mod / 2));
    return make('Str modifier', mod);
  }
  if (w.weapon.group === 'bows') {
    if (mod < 0) return make('Str penalty', mod);
    return w.weapon.strRating !== undefined
      ? make(
          `Str modifier (composite, up to +${w.weapon.strRating})`,
          Math.min(mod, w.weapon.strRating),
        )
      : null;
  }
  if (w.weapon.group === 'crossbows') return null;
  return make('Str modifier', mod);
}

/**
 * One setup's full attack. `sheet` is the sheet on screen (it gives BAB);
 * `opts.situations` are the situations asked for (pass the lens:
 * `situation ? [situation] : []`). Weapon-scoped and situational Modifiers
 * are resolved here, per weapon, with the same stacking as the sheet.
 */
export function resolveRoutine(
  character: Character,
  sheet: ResolvedSheet,
  setup: AttackSetup,
  opts: { situations?: readonly SituationKey[] } = {},
): ResolvedRoutine {
  const situations = opts.situations ?? [];
  const weapons = weaponsOf(character);
  const notes: string[] = [];
  const penalties: string[] = [];
  const riders: Rider[] = [];
  const find = (id: string) => weapons.find((w) => w.entry.id === id);

  const main = find(setup.main.entryId);
  if (!main)
    return {
      setup,
      single: null,
      attacks: [],
      penalties,
      riders,
      notes: ['Its weapon is no longer on the sheet, or is switched off.'],
    };
  let off = setup.off ? find(setup.off.entryId) : undefined;
  if (setup.off && !off)
    notes.push(
      'The off-hand weapon is no longer on the sheet, or is switched off: main weapon only.',
    );
  if (
    off &&
    [main, off].some(
      (w) =>
        w.weapon.handedness === 'ranged' || w.weapon.handedness === 'twoHanded',
    )
  ) {
    notes.push(
      'Two-weapon fighting needs two one-handed or light melee weapons: main weapon only.',
    );
    off = undefined;
  }

  const bab = sheet.bab.total;
  const has = (catalogKey: string) =>
    character.entries.some((e) => e.active && e.catalogKey === catalogKey);
  const powerAttackFeat = character.entries.find(
    (e) => e.active && e.catalogKey === 'feat.powerAttack',
  );
  const steps = powerAttackFeat ? powerAttackSteps(bab) : 0;
  if (setup.options.powerAttack && !powerAttackFeat)
    notes.push('Power Attack is on, but the feat isn’t on the sheet.');
  const powerAttackOn = setup.options.powerAttack && steps > 0;
  const hasted = character.entries.some(
    (e) =>
      e.active &&
      e.catalogKey &&
      lookupCatalog(character, e.catalogKey)?.sourceKey === 'haste',
  );

  // Hands.
  const mainMelee = main.weapon.handedness !== 'ranged';
  let mainHand: AttackHand;
  if (!mainMelee) mainHand = 'ranged';
  else if (off) mainHand = 'primary';
  else if (main.weapon.handedness === 'twoHanded') {
    mainHand = 'twoHands';
    if (setup.main.hand === 'oneHand')
      notes.push(
        `${main.catalog.name} is two-handed: it attacks in two hands.`,
      );
  } else mainHand = setup.main.hand;

  // Two-weapon fighting (CRB Table 8-7).
  let twf: { primary: number; off: number; label: string } | null = null;
  if (off) {
    const light = off.weapon.handedness === 'light';
    const feat = has('feat.twoWeaponFighting');
    const [primary, offPenalty] = feat
      ? light
        ? [-2, -2]
        : [-4, -4]
      : light
        ? [-4, -8]
        : [-6, -10];
    const qualifiers = [
      ...(light ? ['light off hand'] : []),
      ...(feat ? ['Two-Weapon Fighting'] : []),
    ];
    twf = {
      primary,
      off: offPenalty,
      label: `Two-weapon fighting${qualifiers.length ? ` (${qualifiers.join(', ')})` : ''}`,
    };
    penalties.push(
      `Two-weapon fighting${qualifiers.map((q) => `, ${q}`).join('')}: ${formatBonus(primary)} primary, ${formatBonus(offPenalty)} off hand`,
    );
  }

  /** Power Attack's damage for one hand: +50% two-handed, half off hand. */
  const powerDamage = (w: WeaponEntry, hand: AttackHand) =>
    hand === 'twoHands' && w.weapon.handedness !== 'light'
      ? 3 * steps
      : hand === 'off'
        ? steps
        : 2 * steps;

  const extraDice = sheet.extraDamage;

  const build = (
    w: WeaponEntry,
    hand: AttackHand,
    role: string,
    iterative: number,
    note?: string,
  ): ResolvedAttack => {
    const kind = w.weapon.handedness === 'ranged' ? 'ranged' : 'melee';
    const ws = weaponSheet(character, w, situations);
    const attackTarget: LeafTarget = `attack.${kind}`;
    const damageTarget: LeafTarget = `damage.${kind}`;
    const melee = kind === 'melee';
    const rating = w.weapon.strRating;
    const bonus = withExtras(melee ? ws.attackMelee : ws.attackRanged, [
      // Only the full attack's two hands take two-weapon penalties.
      twf && (hand === 'primary' || hand === 'off')
        ? extra(twf.label, hand === 'off' ? twf.off : twf.primary, attackTarget)
        : null,
      rating !== undefined && ws.abilityMods.str.total < rating
        ? extra(`Str below the bow’s +${rating} rating`, -2, attackTarget)
        : null,
      powerAttackOn && melee
        ? extra('Power Attack', -steps, attackTarget)
        : null,
      iterative > 0
        ? extra(`${ORDINAL[iterative]} attack`, -5 * iterative, attackTarget)
        : null,
    ]);
    const damageBonus = withExtras(melee ? ws.damageMelee : ws.damageRanged, [
      strDamage(w, hand, ws.abilityMods.str),
      powerAttackOn && melee
        ? extra('Power Attack', powerDamage(w, hand), damageTarget)
        : null,
    ]);
    // Strength first in the damage breakdown.
    damageBonus.applied.sort(
      (a, b) =>
        Number(b.label.startsWith('Str')) - Number(a.label.startsWith('Str')),
    );
    const applied = extraDice.filter((x) =>
      situations.includes(x.situationKey),
    );
    const text = [
      diceText(w.weapon.dice, damageBonus.total),
      ...applied.map((x) => x.dice),
    ].join(' plus ');
    return {
      key: `${setup.id}:${role}`,
      label: w.catalog.name,
      weaponEntryId: w.entry.id,
      hand,
      kind,
      sequence: 0,
      ...(note ? { note } : {}),
      bonus,
      damage: {
        dice: w.weapon.dice,
        bonus: damageBonus,
        text,
        extra: applied.map((x) => ({
          label: x.label,
          dice: x.dice,
          conditionText:
            !melee && x.rangedWithin
              ? `${x.conditionText}; within ${x.rangedWithin} ft.`
              : x.conditionText,
        })),
      },
      critical: {
        threat: w.weapon.threat,
        mult: w.weapon.mult,
        text: criticalText(w.weapon),
      },
      ...(w.weapon.rangeIncrement
        ? { rangeIncrement: w.weapon.rangeIncrement }
        : {}),
    };
  };

  const drafts: ResolvedAttack[] = [];
  const count = iterativeCount(bab);
  drafts.push(build(main, mainHand, 'main-0', 0));
  if (hasted) drafts.push(build(main, mainHand, 'haste', 0, 'haste'));
  for (let i = 1; i < count; i++)
    drafts.push(build(main, mainHand, `main-${i}`, i));
  if (off) drafts.push(build(off, 'off', 'off', 0, 'off hand'));
  // Highest bonus first (CRB); ties keep main, haste, off order.
  const attacks = drafts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.bonus.total - x.a.bonus.total || x.i - y.i)
    .map(({ a }, i) => ({ ...a, sequence: i + 1 }));

  // The standard-action attack: the primary weapon alone, in one hand.
  const single = {
    ...build(main, mainHand === 'primary' ? 'oneHand' : mainHand, 'single', 0),
    sequence: 1,
  };

  // Riders: what the attack can add that isn't in its numbers.
  if (powerAttackFeat && steps > 0 && !powerAttackOn && mainMelee) {
    const mainDamage = powerDamage(main, mainHand);
    riders.push({
      key: 'powerAttack',
      label: 'Power Attack',
      text: `−${steps} attack, +${mainDamage} damage${off ? ` (+${powerDamage(off, 'off')} off hand)` : ''}`,
      from:
        lookupCatalog(character, 'feat.powerAttack')?.name ?? 'Power Attack',
    });
  }
  for (const x of extraDice)
    if (!situations.includes(x.situationKey))
      riders.push({
        key: x.catalogKey,
        label: x.label,
        text: `+${x.dice}`,
        from: x.label,
        conditionText:
          !mainMelee && x.rangedWithin
            ? `${x.conditionText}; ranged only within ${x.rangedWithin} ft.`
            : x.conditionText,
        situationKey: x.situationKey,
      });

  return { setup, single, attacks, penalties, riders, notes };
}

/**
 * The routine as a CRB stat-block line: "+1 greataxe +13/+8 (1d12+8/×3)",
 * "kukri +7/+2 (1d4+5/18–20), kukri +3 (1d4+2/18–20)". The critical part
 * leaves out 20/×2, as stat blocks do.
 */
export function statBlockText(routine: ResolvedRoutine): string {
  const groups: { label: string; attacks: ResolvedAttack[] }[] = [];
  for (const a of routine.attacks) {
    const hand = a.hand === 'off' ? 'off' : 'main';
    const key = `${a.weaponEntryId}|${hand}`;
    const group = groups.find(
      (g) =>
        `${g.attacks[0]!.weaponEntryId}|${g.attacks[0]!.hand === 'off' ? 'off' : 'main'}` ===
        key,
    );
    if (group) group.attacks.push(a);
    else groups.push({ label: a.label, attacks: [a] });
  }
  return groups
    .map(({ label, attacks }) => {
      const first = attacks[0]!;
      const crit =
        first.critical.threat >= 20 && first.critical.mult === 2
          ? ''
          : first.critical.threat >= 20
            ? `/×${first.critical.mult}`
            : first.critical.mult === 2
              ? `/${first.critical.threat}–20`
              : `/${first.critical.threat}–20/×${first.critical.mult}`;
      const name = label.charAt(0).toLowerCase() + label.slice(1);
      return `${name} ${attacks.map((a) => formatBonus(a.bonus.total)).join('/')} (${first.damage.text}${crit})`;
    })
    .join(', ');
}
