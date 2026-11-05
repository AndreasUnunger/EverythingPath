# 05: Land the Existing-Militia Journey

**What to build:** Protect the first-class mid-campaign onboarding flow by entering representative existing militia state through the production UI, distinguishing structural errors from advisory rule warnings, saving it, and proving the campaign-scoped state survives reload.

**Blocked by:** 04: Land the Mandatory Access Journey.

**Status:** ready-for-agent

- [ ] The journey enters representative rank, training, treasury, focus, notoriety, settlement reputation, teams and conditions, officer assignments, active or persistent effects, queued effects, and week/phase context.
- [ ] Structurally invalid input is blocked with styled field-level feedback.
- [ ] Rules mismatches remain advisory and can be saved as intentional table-valid state.
- [ ] After save and reload, the same state appears in the same campaign without contaminating another campaign.
- [ ] The journey owns and resets its fixture independently from every other browser test.
- [ ] Any UI testability changes expose accessible production semantics rather than browser-only shortcuts.
- [ ] Assertions use stable domain language and contain no provider IDs, generated database IDs, CSS structure, or arbitrary sleeps.
- [ ] The completed journey joins the required aggregate in the same change.
