'use client';

import type { CharacterScope } from './character-scope';
import type { SpellsPageController } from './character-spells-page-types';
import { useCharacterSpellBrowser } from './use-character-spell-browser';
import { useCharacterSpellCollections } from './use-character-spell-collections';
import { useCharacterSpellsRoute } from './use-character-spells-route';
import { useSpellDescriptionExpansion } from './use-spell-description-expansion';

export { schoolChoice } from './spell-school-choice';

/** URL state selects the view; the sheet and bounded browser own all Spell data. */
export function useCharacterSpellsPage(
  scope: CharacterScope,
  controller: SpellsPageController,
) {
  const spellcastings = controller.sheet?.calculated.spellcastings ?? [];
  const route = useCharacterSpellsRoute(spellcastings);
  const browser = useCharacterSpellBrowser({
    scope,
    sheet: controller.sheet,
    route,
  });
  const collections = useCharacterSpellCollections({
    controller,
    selected: route.selected,
    browserRows: browser.browser.results,
  });
  const descriptions = useSpellDescriptionExpansion(
    `${scope.characterId}/${route.selected?.classEntryId ?? ''}`,
  );

  return {
    spellcastings,
    selected: route.selected,
    readOnly: route.readOnly,
    isBrowsing: route.isBrowsing,
    query: route.query,
    includeOtherLists: route.includeOtherLists,
    searching: browser.searching,
    school: browser.school,
    schools: browser.schools,
    levels: browser.levels,
    selectedLevel: browser.selectedLevel,
    isLoading: browser.isLoading,
    browserStatus: browser.browser.status,
    ...collections,
    warnings: controller.warnings,
    writes: controller.spells,
    selectSpellcasting: route.selectSpellcasting,
    enterBrowser: route.enterBrowser,
    leaveBrowser: route.leaveBrowser,
    setQuery: route.setQuery,
    setIncludeOtherLists: route.setIncludeOtherLists,
    setLevel: browser.setLevel,
    setSchool: browser.setSchool,
    loadMore: browser.loadMore,
    ...descriptions,
  };
}
