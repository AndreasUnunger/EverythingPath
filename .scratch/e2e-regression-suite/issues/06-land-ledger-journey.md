# 06: Land the Character and Officer Ledger Journey

**What to build:** Protect the Character Ledger and officer assignment workflow across two authenticated player contexts, including realtime visibility, reassignment or unassignment without record loss, and persistence after reload.

**Blocked by:** 04: Land the Mandatory Access Journey.

**Status:** ready-for-agent

- [ ] One player creates a character through the production UI and assigns that character to an officer role.
- [ ] A second authenticated player observes the character and current officer assignment without reloading.
- [ ] A player can move, replace, or clear the assignment without deleting the character record.
- [ ] Reloading shows the persisted character and final assignment state to both authorized players.
- [ ] The test waits for visible ledger and officer domain outcomes rather than fixed delays or internal subscription state.
- [ ] The journey owns and resets its fixture independently and both contexts retain useful safe evidence on failure.
- [ ] The completed journey joins the required aggregate in the same change.
