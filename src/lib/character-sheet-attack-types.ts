export const weaponEnds = ['primary', 'otherEnd'] as const;
export const attackHands = ['main', 'off'] as const;

export type AttackWeaponEnd = (typeof weaponEnds)[number];
export type AttackHand = (typeof attackHands)[number];
