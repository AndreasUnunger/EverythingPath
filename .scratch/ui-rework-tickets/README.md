# Militia UI rework — published implementation tickets

Published and verified **41 implementation tickets** under the twelve owning specs beneath [#148](https://github.com/AndreasUnunger/EverythingPath/issues/148). All carry `ready-for-agent`, a native sub-issue relationship and the approved native blocking dependencies. Parent bodies/statuses and the existing area dependency edges remain unchanged.

Each ticket carries acceptance criteria, capability IDs, original decisions/amendments, authoring task, planning map and pinned prototypes. **T** numbers retain the approved breakdown identity; **#** numbers identify published GitHub issues. Area-level blockers name and link every underlying T ticket while retaining the area completion gate.

1. **[T1 / #149: Open campaign-scoped sections without losing existing editors](https://github.com/AndreasUnunger/EverythingPath/issues/149)** — owning spec [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135). **Blocked by:** None. **Delivers:** Players open and switch campaigns through the tablet top bar, reach every current editor, and recover safely from unavailable campaigns or failed pages.

2. **[T2 / #150: Use the campaign shell on phone and desktop](https://github.com/AndreasUnunger/EverythingPath/issues/150)** — owning spec [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135). **Blocked by:** [T1 / #149](https://github.com/AndreasUnunger/EverythingPath/issues/149). **Delivers:** Players use bottom navigation and More on phones, and the bounded week host on desktop, while every hosted form remains usable.

3. **[T3 / #151: Navigate the week using shared Phase Readiness](https://github.com/AndreasUnunger/EverythingPath/issues/151)** — owning spec [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). **Blocked by:** completion of [#135](https://github.com/AndreasUnunger/EverythingPath/issues/135), including [T1 / #149](https://github.com/AndreasUnunger/EverythingPath/issues/149), [T2 / #150](https://github.com/AndreasUnunger/EverythingPath/issues/150) and the area's completion criteria. **Delivers:** Players navigate five phase positions independently and see decisions and warnings around the working current editors.

4. **[T4 / #152: Consult the week reference panel and setup notes](https://github.com/AndreasUnunger/EverythingPath/issues/152)** — owning spec [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). **Blocked by:** [T3 / #151](https://github.com/AndreasUnunger/EverythingPath/issues/151). **Delivers:** Players inspect current and projected militia facts, phase requirements, officers, recent history and setup notes without leaving the week.

5. **[T5 / #153: Preserve shared-save feedback and the next-week handoff](https://github.com/AndreasUnunger/EverythingPath/issues/153)** — owning spec [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137). **Blocked by:** [T4 / #152](https://github.com/AndreasUnunger/EverythingPath/issues/152). **Delivers:** Every device sees truthful save feedback and moves to the successor week after Confirmation without losing the reviewed view or accepting delayed edits.

6. **[T6 / #154: Accept legacy dice arrays and dice totals throughout the week](https://github.com/AndreasUnunger/EverythingPath/issues/154)** — owning spec [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140). **Blocked by:** completion of [#137](https://github.com/AndreasUnunger/EverythingPath/issues/137), including [T3 / #151](https://github.com/AndreasUnunger/EverythingPath/issues/151), [T4 / #152](https://github.com/AndreasUnunger/EverythingPath/issues/152), [T5 / #153](https://github.com/AndreasUnunger/EverythingPath/issues/153) and the area's completion criteria. **Delivers:** The running app can read, validate, project, replay and confirm either approved roll representation before any UI starts writing totals.

7. **[T7 / #155: Enter dice totals in every existing weekly roll control](https://github.com/AndreasUnunger/EverythingPath/issues/155)** — owning spec [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140). **Blocked by:** [T6 / #154](https://github.com/AndreasUnunger/EverythingPath/issues/154). **Delivers:** Players enter one dice-only total in every current phase, including nested checks, without losing existing rolls or modifier controls.

8. **[T8 / #156: Resolve team conditions and ordered Upkeep checks](https://github.com/AndreasUnunger/EverythingPath/issues/156)** — owning spec [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140). **Blocked by:** [T7 / #155](https://github.com/AndreasUnunger/EverythingPath/issues/155). **Delivers:** Players work through first-week skipping, disabled/missing teams, attrition, notoriety and shortage in rules order.

9. **[T9 / #157: Choose and acknowledge every rank boon](https://github.com/AndreasUnunger/EverythingPath/issues/157)** — owning spec [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140). **Blocked by:** [T8 / #156](https://github.com/AndreasUnunger/EverythingPath/issues/156). **Delivers:** Players see the actual rank transition and record each eligible character’s fixed-choice or free-text boon.

10. **[T10 / #158: Stage characterless treasury transfers](https://github.com/AndreasUnunger/EverythingPath/issues/158)** — owning spec [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140). **Blocked by:** [T8 / #156](https://github.com/AndreasUnunger/EverythingPath/issues/156). **Delivers:** Players stage ordered deposits and withdrawals in gp without selecting a character or requiring an officer.

11. **[T11 / #159: Choose, move and remove shared Action Slots](https://github.com/AndreasUnunger/EverythingPath/issues/159)** — owning spec [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142). **Blocked by:** completion of [#140](https://github.com/AndreasUnunger/EverythingPath/issues/140), including [T6 / #154](https://github.com/AndreasUnunger/EverythingPath/issues/154), [T7 / #155](https://github.com/AndreasUnunger/EverythingPath/issues/155), [T8 / #156](https://github.com/AndreasUnunger/EverythingPath/issues/156), [T9 / #157](https://github.com/AndreasUnunger/EverythingPath/issues/157), [T10 / #158](https://github.com/AndreasUnunger/EverythingPath/issues/158) and the area's completion criteria. **Delivers:** Players fill shared slots from the grouped card picker, move or swap complete choices, and remove genuinely empty excess slots.

12. **[T12 / #160: Choose teams and allocate Activity check bonuses](https://github.com/AndreasUnunger/EverythingPath/issues/160)** — owning spec [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142). **Blocked by:** [T11 / #159](https://github.com/AndreasUnunger/EverythingPath/issues/159). **Delivers:** Players select teams and operating settlement, understand check totals, and move Helpful or edit reasoned modifiers.

13. **[T13 / #161: Complete people, team and mission action details](https://github.com/AndreasUnunger/EverythingPath/issues/161)** — owning spec [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142). **Blocked by:** [T12 / #160](https://github.com/AndreasUnunger/EverythingPath/issues/160). **Delivers:** Players complete every people, team, information and mission action using the selected-slot detail area.

14. **[T14 / #162: Complete market, cache and Special Order details](https://github.com/AndreasUnunger/EverythingPath/issues/162)** — owning spec [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142). **Blocked by:** [T12 / #160](https://github.com/AndreasUnunger/EverythingPath/issues/160). **Delivers:** Players prepare purchases, sales, caches and deliveries without losing any nested economy fields or receipts.

15. **[T15 / #163: Prepare Event occurrences and candidate branches safely](https://github.com/AndreasUnunger/EverythingPath/issues/163)** — owning spec [#143](https://github.com/AndreasUnunger/EverythingPath/issues/143). **Blocked by:** completion of [#142](https://github.com/AndreasUnunger/EverythingPath/issues/142), including [T11 / #159](https://github.com/AndreasUnunger/EverythingPath/issues/159), [T12 / #160](https://github.com/AndreasUnunger/EverythingPath/issues/160), [T13 / #161](https://github.com/AndreasUnunger/EverythingPath/issues/161), [T14 / #162](https://github.com/AndreasUnunger/EverythingPath/issues/162) and the area's completion criteria. **Delivers:** Players see stable blank event positions, enter chance/table rolls and choose candidates while two devices converge on the same event tree.

16. **[T16 / #164: Resolve team, person and persistent-producing events](https://github.com/AndreasUnunger/EverythingPath/issues/164)** — owning spec [#143](https://github.com/AndreasUnunger/EverythingPath/issues/143). **Blocked by:** [T15 / #163](https://github.com/AndreasUnunger/EverythingPath/issues/163). **Delivers:** Players resolve targeted events with separate checks, outcomes and retained same-week persistent decisions for each occurrence.

17. **[T17 / #165: Resolve economy, settlement and narrative event outcomes](https://github.com/AndreasUnunger/EverythingPath/issues/165)** — owning spec [#143](https://github.com/AndreasUnunger/EverythingPath/issues/143). **Blocked by:** [T15 / #163](https://github.com/AndreasUnunger/EverythingPath/issues/163). **Delivers:** Players resolve rewards, cache losses, settlement benefits and narrative/training events with all source-specific facts retained.

18. **[T18 / #166: React with Sabotage and share Overseer support](https://github.com/AndreasUnunger/EverythingPath/issues/166)** — owning spec [#143](https://github.com/AndreasUnunger/EverythingPath/issues/143). **Blocked by:** [T16 / #164](https://github.com/AndreasUnunger/EverythingPath/issues/164). **Delivers:** Players attempt Sabotage on the exact event and move one-event Overseer support between Event and the current Persistent editor.

19. **[T19 / #167: Choose carried-event endings and rules-priced buyoffs](https://github.com/AndreasUnunger/EverythingPath/issues/167)** — owning spec [#144](https://github.com/AndreasUnunger/EverythingPath/issues/144). **Blocked by:** completion of [#143](https://github.com/AndreasUnunger/EverythingPath/issues/143), including [T15 / #163](https://github.com/AndreasUnunger/EverythingPath/issues/163), [T16 / #164](https://github.com/AndreasUnunger/EverythingPath/issues/164), [T17 / #165](https://github.com/AndreasUnunger/EverythingPath/issues/165), [T18 / #166](https://github.com/AndreasUnunger/EverythingPath/issues/166) and the area's completion criteria. **Delivers:** Players review carried events in stable order, leave them, buy them off or record reasoned table endings, including events already ended elsewhere.

20. **[T20 / #168: Resolve Theft and Rivalry checks with shared support](https://github.com/AndreasUnunger/EverythingPath/issues/168)** — owning spec [#144](https://github.com/AndreasUnunger/EverythingPath/issues/144). **Blocked by:** [T19 / #167](https://github.com/AndreasUnunger/EverythingPath/issues/167). **Delivers:** Players make this-week Theft mitigation or Rivalry ending checks and move Overseer support without duplicating its benefit.

21. **[T21 / #169: Review ordered consequences and complete result comparisons](https://github.com/AndreasUnunger/EverythingPath/issues/169)** — owning spec [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145). **Blocked by:** completion of [#144](https://github.com/AndreasUnunger/EverythingPath/issues/144), including [T19 / #167](https://github.com/AndreasUnunger/EverythingPath/issues/167), [T20 / #168](https://github.com/AndreasUnunger/EverythingPath/issues/168) and the area's completion criteria. **Delivers:** Players read the complete ordered story of the week and compare Now, Rules Baseline and Final, including changes later reversed.

22. **[T22 / #170: Edit ordered Table Adjustments and exception reasons](https://github.com/AndreasUnunger/EverythingPath/issues/170)** — owning spec [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145). **Blocked by:** [T21 / #169](https://github.com/AndreasUnunger/EverythingPath/issues/169). **Delivers:** Players add, edit, reorder and remove every adjustment kind and repair exception reasons without overwriting another player’s work.

23. **[T23 / #171: Confirm exactly the saved and reviewed week](https://github.com/AndreasUnunger/EverythingPath/issues/171)** — owning spec [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145). **Blocked by:** [T22 / #170](https://github.com/AndreasUnunger/EverythingPath/issues/170). **Delivers:** Players follow Required decisions to their source, explicitly review updates and confirm only the accepted revision they reviewed.

24. **[T24 / #172: Set up a militia through nine complete guided steps](https://github.com/AndreasUnunger/EverythingPath/issues/172)** — owning spec [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138). **Blocked by:** completion of [#145](https://github.com/AndreasUnunger/EverythingPath/issues/145), including [T21 / #169](https://github.com/AndreasUnunger/EverythingPath/issues/169), [T22 / #170](https://github.com/AndreasUnunger/EverythingPath/issues/170), [T23 / #171](https://github.com/AndreasUnunger/EverythingPath/issues/171) and the area's completion criteria. **Delivers:** Players enter new or mid-campaign state through freely navigable steps while retaining every existing setup field and working initialization.

25. **[T25 / #173: Resume unfinished Setup and add characters inline](https://github.com/AndreasUnunger/EverythingPath/issues/173)** — owning spec [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138). **Blocked by:** [T24 / #172](https://github.com/AndreasUnunger/EverythingPath/issues/172). **Delivers:** Players return to their unfinished setup, including invalid input, and create shared character records without losing their local form.

26. **[T26 / #174: Start Setup safely when another player finishes first](https://github.com/AndreasUnunger/EverythingPath/issues/174)** — owning spec [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138). **Blocked by:** [T25 / #173](https://github.com/AndreasUnunger/EverythingPath/issues/173). **Delivers:** Players start once, reach the requested valid phase, or follow the already-accepted militia when another member completes setup.

27. **[T27 / #175: Correct militia Values safely and inspect carried state](https://github.com/AndreasUnunger/EverythingPath/issues/175)** — owning spec [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139). **Blocked by:** completion of [#138](https://github.com/AndreasUnunger/EverythingPath/issues/138), including [T24 / #172](https://github.com/AndreasUnunger/EverythingPath/issues/172), [T25 / #173](https://github.com/AndreasUnunger/EverythingPath/issues/173), [T26 / #174](https://github.com/AndreasUnunger/EverythingPath/issues/174) and the area's completion criteria. **Delivers:** Players browse militia sections, correct Values with a reason and inspect week/carried facts while preserving concurrent changes.

28. **[T28 / #176: Correct teams and settlements with reference restoration](https://github.com/AndreasUnunger/EverythingPath/issues/176)** — owning spec [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139). **Blocked by:** [T27 / #175](https://github.com/AndreasUnunger/EverythingPath/issues/175). **Delivers:** Players correct teams, managers and settlements, see affected weekly choices and recover missing identities after a correction.

29. **[T29 / #177: Correct assets and restore item/cache references](https://github.com/AndreasUnunger/EverythingPath/issues/177)** — owning spec [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139). **Blocked by:** [T28 / #176](https://github.com/AndreasUnunger/EverythingPath/issues/176). **Delivers:** Players correct inventory and delivery facts without replacing sibling assets, and restore missing items/caches needed to repair the week.

30. **[T30 / #178: Correct character conditions and carried benefits](https://github.com/AndreasUnunger/EverythingPath/issues/178)** — owning spec [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139). **Blocked by:** [T27 / #175](https://github.com/AndreasUnunger/EverythingPath/issues/175). **Delivers:** Players correct character circumstances and supported skill/Market Day benefits while retaining unrelated and protected source facts.

31. **[T31 / #179: Expand character-kind compatibility without changing live rules](https://github.com/AndreasUnunger/EverythingPath/issues/179)** — owning spec [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141). **Blocked by:** completion of [#139](https://github.com/AndreasUnunger/EverythingPath/issues/139), including [T27 / #175](https://github.com/AndreasUnunger/EverythingPath/issues/175), [T28 / #176](https://github.com/AndreasUnunger/EverythingPath/issues/176), [T29 / #177](https://github.com/AndreasUnunger/EverythingPath/issues/177), [T30 / #178](https://github.com/AndreasUnunger/EverythingPath/issues/178) and the area's completion criteria. **Delivers:** Existing records, forms, Weekly Drafts and immutable history remain readable when the approved NPC representation is introduced.

32. **[T32 / #180: Apply record-owned kind and shared officer mechanics everywhere](https://github.com/AndreasUnunger/EverythingPath/issues/180)** — owning spec [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141). **Blocked by:** [T31 / #179](https://github.com/AndreasUnunger/EverythingPath/issues/179). **Delivers:** Players use PC/NPC records with matching roster kind, role-aware manager limits and commandant Hit Dice fallback throughout every shipped workflow.

33. **[T33 / #181: Migrate live character rows and roster mirrors resumably](https://github.com/AndreasUnunger/EverythingPath/issues/181)** — owning spec [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141). **Blocked by:** [T32 / #180](https://github.com/AndreasUnunger/EverythingPath/issues/180). **Delivers:** Existing live campaigns reach consistent record-owned kinds through restartable internal migration while ordinary shared play remains valid.

34. **[T34 / #182: Browse officer effects and edit complete character records](https://github.com/AndreasUnunger/EverythingPath/issues/182)** — owning spec [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141). **Blocked by:** [T32 / #180](https://github.com/AndreasUnunger/EverythingPath/issues/180). **Delivers:** Players inspect all six officer roles and pending weekly changes, and create, edit, archive or restore complete character records.

35. **[T35 / #183: Correct roster and officer assignments with safe cascades](https://github.com/AndreasUnunger/EverythingPath/issues/183)** — owning spec [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141). **Blocked by:** [T34 / #182](https://github.com/AndreasUnunger/EverythingPath/issues/182). **Delivers:** Players assign or move officers and change roster membership with one reasoned save and clear warnings about affected teams and weekly choices.

36. **[T36 / #184: Browse distinct finished weeks with bounded record metadata](https://github.com/AndreasUnunger/EverythingPath/issues/184)** — owning spec [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146). **Blocked by:** completion of [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141), including [T31 / #179](https://github.com/AndreasUnunger/EverythingPath/issues/179), [T32 / #180](https://github.com/AndreasUnunger/EverythingPath/issues/180), [T33 / #181](https://github.com/AndreasUnunger/EverythingPath/issues/181), [T34 / #182](https://github.com/AndreasUnunger/EverythingPath/issues/182), [T35 / #183](https://github.com/AndreasUnunger/EverythingPath/issues/183) and the area's completion criteria. **Delivers:** Players select any recorded week from an oldest-first index with truthful effective-record dates, headlines and provenance.

37. **[T37 / #185: Read finished-week consequences only from the selected record](https://github.com/AndreasUnunger/EverythingPath/issues/185)** — owning spec [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146). **Blocked by:** completion of [#141](https://github.com/AndreasUnunger/EverythingPath/issues/141), including [T31 / #179](https://github.com/AndreasUnunger/EverythingPath/issues/179), [T32 / #180](https://github.com/AndreasUnunger/EverythingPath/issues/180), [T33 / #181](https://github.com/AndreasUnunger/EverythingPath/issues/181), [T34 / #182](https://github.com/AndreasUnunger/EverythingPath/issues/182), [T35 / #183](https://github.com/AndreasUnunger/EverythingPath/issues/183) and the area's completion criteria. **Delivers:** Players read the same six-section story in history, using only the selected immutable Resolution Record.

38. **[T38 / #186: Inspect dated audit entries without changing selected history](https://github.com/AndreasUnunger/EverythingPath/issues/186)** — owning spec [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146). **Blocked by:** [T36 / #184](https://github.com/AndreasUnunger/EverythingPath/issues/184), [T37 / #185](https://github.com/AndreasUnunger/EverythingPath/issues/185). **Delivers:** Players page through five immutable audit entries at a time, inspect each entry’s actual date/ruleset and return to the effective record.

39. **[T39 / #187: Select and create campaigns in the home pane](https://github.com/AndreasUnunger/EverythingPath/issues/187)** — owning spec [#147](https://github.com/AndreasUnunger/EverythingPath/issues/147). **Blocked by:** completion of [#146](https://github.com/AndreasUnunger/EverythingPath/issues/146), including [T36 / #184](https://github.com/AndreasUnunger/EverythingPath/issues/184), [T37 / #185](https://github.com/AndreasUnunger/EverythingPath/issues/185), [T38 / #186](https://github.com/AndreasUnunger/EverythingPath/issues/186) and the area's completion criteria. **Delivers:** Players select a campaign in place or explicitly create one and land on the home identified by its returned ID.

40. **[T40 / #188: Edit campaign description and fantasy date truthfully](https://github.com/AndreasUnunger/EverythingPath/issues/188)** — owning spec [#147](https://github.com/AndreasUnunger/EverythingPath/issues/147). **Blocked by:** [T39 / #187](https://github.com/AndreasUnunger/EverythingPath/issues/187). **Delivers:** Players edit or clear the full description and in-game date, with accurate feedback if only one field saves.

41. **[T41 / #189: Continue the week from current militia facts and recent history](https://github.com/AndreasUnunger/EverythingPath/issues/189)** — owning spec [#147](https://github.com/AndreasUnunger/EverythingPath/issues/147). **Blocked by:** [T39 / #187](https://github.com/AndreasUnunger/EverythingPath/issues/187). **Delivers:** Players open the first unready eligible phase, inspect current militia facts and open any of the latest three finished weeks.

## Capability allocation

All capability IDs owned by the twelve specs are assigned below. A repeated ID is explicitly split by the ticket’s acceptance criteria. Cross-area preservation obligations are carried in each ticket as applicable, and every slice includes its own verification. This allocation is planning evidence, not a claim of shipped coverage.

| Owning spec | Capability | Approved tickets |
| --- | --- | --- |
| #135 | NAV-01 | 01, 02 |
| #135 | NAV-02 | 01 |
| #135 | NAV-03 | 01 |
| #135 | NAV-04 | 01 |
| #135 | NAV-05 | 01, 02 |
| #135 | NAV-06 | 01, 02 |
| #135 | NAV-07 | 01, 02 |
| #135 | NAV-08 | 01, 02 |
| #135 | NAV-09 | 02 |
| #135 | NAV-10 | 01 |
| #135 | NAV-11 | 01 |
| #135 | NAV-12 | 01 |
| #135 | NAV-13 | 01 |
| #135 | NAV-14 | 01 |
| #135 | NAV-15 | 01 |
| #135 | NAV-16 | 01, 02 |
| #135 | NAV-17 | 01 |
| #135 | STATE-01 | 01, 02 |
| #135 | STATE-02 | 01, 02 |
| #135 | STATE-03 | 01, 02 |
| #135 | STATE-04 | 01 |
| #135 | STATE-05 | 01 |
| #135 | STATE-06 | 01 |
| #135 | STATE-07 | 01 |
| #137 | WEEK-01 | 03 |
| #137 | WEEK-02 | 03, 04 |
| #137 | WEEK-03 | 03 |
| #137 | WEEK-04 | 05 |
| #137 | WEEK-05 | 04, 05 |
| #137 | WEEK-06 | 05 |
| #137 | WEEK-07 | 05 |
| #137 | WEEK-08 | 05 |
| #137 | WEEK-09 | 04 |
| #137 | WEEK-10 | 05 |
| #137 | WEEK-11 | 05 |
| #137 | WEEK-12 | 03 |
| #137 | WEEK-13 | 03 |
| #137 | WEEK-14 | 03 |
| #137 | WEEK-15 | 03 |
| #137 | WEEK-16 | 03 |
| #137 | WEEK-17 | 03, 04 |
| #137 | WEEK-18 | 03 |
| #137 | WEEK-19 | 05 |
| #140 | UPK-01 | 08, 09 |
| #140 | UPK-02 | 08 |
| #140 | UPK-03 | 08 |
| #140 | UPK-04 | 08 |
| #140 | UPK-05 | 08 |
| #140 | UPK-06 | 08 |
| #140 | UPK-07 | 08 |
| #140 | UPK-08 | 09 |
| #140 | UPK-09 | 08, 10 |
| #140 | UPK-10 | 10 |
| #140 | UPK-11 | 08, 09, 10 |
| #140 | UPK-12 | 08, 09, 10 |
| #142 | ACT-01 | 11 |
| #142 | ACT-02 | 11 |
| #142 | ACT-03 | 11 |
| #142 | ACT-04 | 11 |
| #142 | ACT-05 | 11 |
| #142 | ACT-06 | 11 |
| #142 | ACT-07 | 11 |
| #142 | ACT-08 | 11 |
| #142 | ACT-09 | 11 |
| #142 | ACT-10 | 12, 13, 14 |
| #142 | ACT-11 | 12, 13, 14 |
| #142 | ACT-12 | 12, 13, 14 |
| #142 | ACT-13 | 12, 13, 14 |
| #142 | ACT-14 | 13, 14 |
| #142 | ACT-15 | 14 |
| #142 | ACT-16 | 12, 13, 14 |
| #142 | ACT-17 | 11, 12, 13, 14 |
| #142 | ACT-18 | 12 |
| #142 | ACT-19 | 11 |
| #143 | EVT-01 | 15 |
| #143 | EVT-02 | 15 |
| #143 | EVT-03 | 15 |
| #143 | EVT-04 | 15 |
| #143 | EVT-05 | 15 |
| #143 | EVT-06 | 15 |
| #143 | EVT-07 | 16, 17, 18 |
| #143 | EVT-08 | 16, 17, 18 |
| #143 | EVT-09 | 16, 17, 18 |
| #143 | EVT-10 | 16, 17, 18 |
| #143 | EVT-11 | 16, 17, 18 |
| #143 | EVT-12 | 16, 17, 18 |
| #143 | EVT-13 | 15 |
| #143 | EVT-14 | 15, 16, 17, 18 |
| #144 | PER-01 | 19 |
| #144 | PER-02 | 19 |
| #144 | PER-03 | 19, 20 |
| #144 | PER-04 | 20 |
| #144 | PER-05 | 19 |
| #144 | PER-06 | 19 |
| #144 | PER-07 | 20 |
| #144 | PER-08 | 19, 20 |
| #144 | PER-09 | 19 |
| #144 | PER-10 | 19, 20 |
| #145 | SUM-01 | 23 |
| #145 | SUM-02 | 23 |
| #145 | SUM-03 | 23 |
| #145 | SUM-04 | 23 |
| #145 | SUM-05 | 23 |
| #145 | SUM-06 | 21 |
| #145 | SUM-07 | 22 |
| #145 | SUM-08 | 22 |
| #145 | SUM-09 | 21, 22, 23 |
| #145 | SUM-10 | 21 |
| #145 | SUM-11 | 21 |
| #138 | SETUP-01 | 24 |
| #138 | SETUP-02 | 24 |
| #138 | SETUP-03 | 24 |
| #138 | SETUP-04 | 24 |
| #138 | SETUP-05 | 24, 25 |
| #138 | SETUP-06 | 24 |
| #138 | SETUP-07 | 24 |
| #138 | SETUP-08 | 24 |
| #138 | SETUP-09 | 24 |
| #138 | SETUP-10 | 24 |
| #138 | SETUP-11 | 24 |
| #138 | SETUP-12 | 24 |
| #138 | SETUP-13 | 24 |
| #138 | SETUP-14 | 24 |
| #138 | SETUP-15 | 24 |
| #138 | SETUP-16 | 24 |
| #138 | SETUP-17 | 24 |
| #138 | SETUP-18 | 24 |
| #138 | SETUP-19 | 24, 26 |
| #138 | SETUP-20 | 24, 25, 26 |
| #138 | SETUP-21 | 24, 26 |
| #138 | SETUP-22 | 24, 26 |
| #138 | SETUP-23 | 24, 26 |
| #138 | SETUP-24 | 25 |
| #138 | SETUP-25 | 24 |
| #138 | SETUP-26 | 25 |
| #138 | SETUP-27 | 26 |
| #139 | LEDG-01 | 27 |
| #139 | LEDG-02 | 27 |
| #139 | LEDG-03 | 28 |
| #139 | LEDG-04 | 28, 29, 30 |
| #139 | LEDG-05 | 27, 28, 29, 30 |
| #139 | LEDG-06 | 27, 28, 29, 30 |
| #139 | LEDG-07 | 27, 28, 29, 30 |
| #139 | LEDG-08 | 27 |
| #139 | LEDG-09 | 27 |
| #139 | LEDG-10 | 27 |
| #139 | LEDG-11 | 27 |
| #139 | LEDG-12 | 28, 29, 30 |
| #139 | LEDG-13 | 28, 29 |
| #141 | CHAR-01 | 34 |
| #141 | CHAR-02 | 34 |
| #141 | CHAR-03 | 31, 32, 34 |
| #141 | CHAR-04 | 31, 32, 34 |
| #141 | CHAR-05 | 34 |
| #141 | CHAR-06 | 34 |
| #141 | CHAR-07 | 34 |
| #141 | CHAR-08 | 31, 32, 33, 34 |
| #141 | CHAR-09 | 34 |
| #141 | CHAR-10 | 32, 34, 35 |
| #141 | CHAR-11 | 34 |
| #141 | CHAR-12 | 35 |
| #141 | CHAR-13 | 32, 34, 35 |
| #146 | HIST-01 | 36 |
| #146 | HIST-02 | 36 |
| #146 | HIST-03 | 38 |
| #146 | HIST-04 | 36, 37, 38 |
| #146 | HIST-05 | 37 |
| #146 | HIST-06 | 37 |
| #146 | HIST-07 | 36, 38 |
| #146 | HIST-08 | 36, 38 |
| #147 | CAMP-01 | 39 |
| #147 | CAMP-02 | 39 |
| #147 | CAMP-03 | 39 |
| #147 | CAMP-04 | 39 |
| #147 | CAMP-05 | 39 |
| #147 | CAMP-06 | 39, 40 |
| #147 | CAMP-07 | 40 |
| #147 | CAMP-08 | 41 |
| #147 | CAMP-09 | 41 |
| #147 | CAMP-10 | 41 |
| #147 | CAMP-11 | 39, 41 |
| #147 | CAMP-12 | 40 |

## Publication verification

Read back all 41 issues, 41 native parent relationships and 41 native blocking edges. Verified exact published bodies, titles, labels, source/prototype links and the T-number mappings. Verified all 13 existing parent bodies, titles, states and dependency sets were preserved. Capability allocation covers 182 owned IDs. No feature implementation or application test run was part of ticket publication.
