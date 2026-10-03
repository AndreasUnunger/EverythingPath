const defaultApi = {
  character: {
    updateCharacter: 'kind',
    createCharacter: 'legacyCreate',
    archiveCharacter: 'archive',
    reassignOwner: 'reassignOwner',
    listOwnerCandidates: 'listOwnerCandidates',
    listCampaignCharacters: 'listCampaignCharacters',
    listOwned: 'listOwned',
  },
  companionRelationships: {
    list: 'companions',
    link: 'linkCompanion',
    create: 'createCompanion',
    replace: 'replaceCompanion',
    addSource: 'addCompanionSource',
    setSourceEnabled: 'setCompanionSourceEnabled',
    interrupt: 'interruptCompanion',
    restore: 'restoreCompanion',
  },
  characterSheet: {
    read: 'read',
    editEquipment: 'editEquipment',
    setManualProficiency: 'setManualProficiency',
    setProficiencyChoice: 'setProficiencyChoice',
    editBaseScores: 'scores',
    editClassLevel: 'hp',
    addClassLevel: 'add',
    moveClassLevel: 'move',
    deleteClassLevel: 'delete',
    create: 'create',
    buildOut: 'buildOut',
    editCreationSettings: 'settings',
    acceptWarning: 'accept',
    reopenWarning: 'reopen',
    createPersonalAdjustment: 'createAdjustment',
    editPersonalAdjustment: 'editAdjustment',
    removePersonalAdjustment: 'removeAdjustment',
    createAbilityChange: 'createAbilityChange',
    editAbilityChange: 'editAbilityChange',
    removeAbilityChange: 'removeAbilityChange',
    createSheetEntry: 'createSheetEntry',
    editSheetEntry: 'editSheetEntry',
    removeSheetEntry: 'removeSheetEntry',
    archive: 'archive',
    deletePrivate: 'deletePrivate',
    setDormantEntryKept: 'setDormantEntryKept',
    discardDormantEntry: 'discardDormantEntry',
    editGrantState: 'editGrantState',
    editSelection: 'editSelection',
    selectRace: 'selectRace',
    chooseRacialAbilityScore: 'chooseRacialAbilityScore',
    setRacialTraitSelected: 'setRacialTraitSelected',
    setRacialTraitReplacements: 'setRacialTraitReplacements',
    editRaceStatistics: 'editRaceStatistics',
  },
};

type ApiOverrides = {
  [Namespace in keyof typeof defaultApi]?: Partial<
    (typeof defaultApi)[Namespace]
  >;
};

export function createCharacterSheetApiMock(overrides: ApiOverrides = {}) {
  return {
    api: {
      character: { ...defaultApi.character, ...overrides.character },
      companionRelationships: {
        ...defaultApi.companionRelationships,
        ...overrides.companionRelationships,
      },
      characterSheet: {
        ...defaultApi.characterSheet,
        ...overrides.characterSheet,
      },
    },
  };
}
