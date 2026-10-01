'use client';
// PROTOTYPE (throwaway, #208) — URL-driven actions. `?page=create`,
// `?page=levelup` and `?page=buildout` do what their button does, then show
// the plain sheet, so every state is reachable by URL (opening
// `?page=levelup&character=kesh` levels Kesh up, as pressing Level up
// would). Presentation lives in variant-b/.

import { useEffect, useRef } from 'react';
import { useProtoNav } from './nav';
import { useBuilderStore, useCharacter } from './store';
import type { Character } from './types';

/**
 * `?page=create[&campaign=<id>][&from=…]`: makes a Full Character owned by
 * me, in that campaign or in none, and opens its sheet.
 */
export function useCreateFlow() {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const campaignId = store.state.campaigns.some(
      (c) => c.id === nav.campaignParam,
    )
      ? nav.campaignParam
      : undefined;
    const id = store.createCharacter({ campaignId });
    nav.go('sheet', { character: id });
  }, [nav, store]);
}

/**
 * `?page=levelup&character=<id>[&as=<classKey>|unspecified]`: appends one
 * Class Level (default Rogue, the showcase; `hpGained` empty) and opens the
 * sheet scrolled to it (`&level=<id>`).
 */
export function useLevelUpRedirect(characterId: string): Character | undefined {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const started = useRef(false);
  useEffect(() => {
    if (!character || started.current) return;
    started.current = true;
    const as = nav.param('as');
    const classKey = as === 'unspecified' ? null : (as ?? 'class.rogue');
    const id = store.addClassLevel(character.id, classKey);
    nav.go('sheet', { character: character.id, params: { level: id } });
  }, [character, nav, store]);
  return character;
}

/**
 * `?page=buildout&character=<id>`: builds a Militia-only Character out, as
 * the button would (one way), and opens its sheet. The store's notice says
 * what happened.
 */
export function useBuildoutFlow(characterId: string): Character | undefined {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const started = useRef(false);
  useEffect(() => {
    if (!character || started.current) return;
    started.current = true;
    if (character.sheetMode === 'militiaOnly') store.buildOut(character.id);
    nav.go('sheet', { character: character.id });
  }, [character, nav, store]);
  return character;
}
