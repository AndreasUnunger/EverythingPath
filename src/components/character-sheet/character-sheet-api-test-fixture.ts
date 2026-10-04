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
  characterSheetSpells: {
    record: 'recordSpell',
    remove: 'removeRecordedSpell',
    browse: 'browseSpells',
    browserInfo: 'spellBrowserInfo',
  },
  characterSheetLinkedInputs: {
    read: 'readLinkedInput',
    list: 'listLinkedInputs',
    saveFallback: 'saveLinkedInputFallback',
    clearFallback: 'clearLinkedInputFallback',
    saveInterpretation: 'saveLinkedInputInterpretation',
    clearInterpretation: 'clearLinkedInputInterpretation',
  },
  characterSheet: {
    read: 'read',
    selectEntry: 'selectEntry',
    editEquipment: 'editEquipment',
    createAttackRoutine: 'createAttackRoutine',
    editAttackRoutine: 'editAttackRoutine',
    deleteAttackRoutine: 'deleteAttackRoutine',
    restoreAttackRoutine: 'restoreAttackRoutine',
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
    fillSelectionSlot: 'fillSelectionSlot',
    clearSelectionSlot: 'clearSelectionSlot',
    selectRace: 'selectRace',
    chooseRacialAbilityScore: 'chooseRacialAbilityScore',
    setRacialTraitSelected: 'setRacialTraitSelected',
    setRacialTraitReplacements: 'setRacialTraitReplacements',
    editRaceStatistics: 'editRaceStatistics',
    setArchetypeSelected: 'setArchetypeSelected',
    setArchetypePartChoices: 'setArchetypePartChoices',
  },
  catalogCopies: {
    list: 'catalogList',
    advisories: 'catalogAdvisories',
    createOneOff: 'createOneOff',
    editDefinition: 'editDefinition',
    saveToCatalog: 'saveToCatalog',
    customizeForCampaign: 'customizeForCampaign',
    detach: 'detach',
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
      characterSheetSpells: {
        ...defaultApi.characterSheetSpells,
        ...overrides.characterSheetSpells,
      },
      characterSheetLinkedInputs: {
        ...defaultApi.characterSheetLinkedInputs,
        ...overrides.characterSheetLinkedInputs,
      },
      characterSheet: {
        ...defaultApi.characterSheet,
        ...overrides.characterSheet,
      },
      catalogCopies: {
        ...defaultApi.catalogCopies,
        ...overrides.catalogCopies,
      },
    },
  };
}
