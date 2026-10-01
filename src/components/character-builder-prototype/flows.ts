'use client';
// PROTOTYPE (throwaway, #208) — page flows: the URL-driven steps behind the
// create, level-up and build-out pages, so every state is reachable by URL
// (opening `?page=levelup&character=kesh` levels Kesh up, as pressing
// Level up would). Presentation lives in variant-b/.

import { useEffect, useRef, useState } from 'react';
import { useProtoNav } from './nav';
import { resolveSheet } from './resolve';
import { useBuilderStore, useCharacter } from './store';
import type { Character, ResolvedSheet } from './types';

/**
 * `?page=create[&campaign=<id>][&from=…]`: makes a Full Character owned by
 * me, in that campaign or in none, then puts its id in `&character=`.
 * Returns it once it exists.
 */
export function useCreateFlow(): Character | undefined {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(nav.characterId);
  const started = useRef(false);
  useEffect(() => {
    if (character || started.current) return;
    started.current = true;
    const campaignId = store.state.campaigns.some(
      (c) => c.id === nav.campaignParam,
    )
      ? nav.campaignParam
      : undefined;
    const id = store.createCharacter({ campaignId });
    nav.go('create', { character: id });
  }, [character, nav, store]);
  return character;
}

/**
 * `?page=levelup&character=<id>[&as=<classKey>|unspecified]`: appends one
 * Class Level (default Rogue, the showcase; `hpGained` empty) and puts its
 * id in `&level=` so the state is addressable. `baseline` is the sheet
 * before the new level, for before → after markers.
 */
export function useLevelUpFlow(characterId: string) {
  const nav = useProtoNav();
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const levelParam = nav.param('level');
  const [baseline, setBaseline] = useState<ResolvedSheet | null>(null);
  const started = useRef(false);
  const exists = Boolean(
    levelParam && character?.entries.some((e) => e.id === levelParam),
  );

  useEffect(() => {
    if (!character || started.current || exists) return;
    started.current = true;
    const as = nav.param('as');
    const classKey = as === 'unspecified' ? null : (as ?? 'class.rogue');
    setBaseline(resolveSheet(character));
    const id = store.addClassLevel(character.id, classKey);
    nav.set({ level: id });
  }, [character, exists, nav, store]);

  return {
    character,
    /** The new level's id, once added. */
    focusLevelId: exists ? levelParam : null,
    baseline,
    dismissBaseline: () => setBaseline(null),
  };
}

/**
 * `?page=buildout&character=<id>`: the sheet right after Build out. Opening
 * it for a Militia-only Character builds it out, as the button would (one
 * way). The store's notice says what happened.
 */
export function useBuildoutFlow(characterId: string) {
  const store = useBuilderStore();
  const character = useCharacter(characterId);
  const started = useRef(false);
  useEffect(() => {
    if (!character || started.current) return;
    started.current = true;
    if (character.sheetMode === 'militiaOnly') store.buildOut(character.id);
  }, [character, store]);
  return character;
}
