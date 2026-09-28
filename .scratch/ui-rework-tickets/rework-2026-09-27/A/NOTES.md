# Group A notes (#140, #142, #143)

- **Blocked-by reasons:** #157 and #166 gained reason clauses (template rule 7).
- **#163 before T15b.** #163 follows current candidate rules and needs no version bump. T15b needs #163's preparation and legacy surplus handling. Event UI no longer waits on Upkeep.
- **#165 also blocked by #156.** Found Fire rewards are entered in gp and need #156's copper-exact gp-money parser (spec #140 WEEK-14).
- **Splits:** #164 = MIA/Sickness/Turn Around/Raid; T16b = Rivalry/Turncoat/Theft/Double Agent/Low Morale. #165 = Broke the Code/Cache Discovered/Festival/Market Day/Found Fire/Hidden Agenda; T17b = calm/High Morale/Invasion/Night Ops/War Games/Pain/Serenity. Guarantee/Manipulate Events went to T13b.
- **Capability IDs** are per action/event family. Split parts list the same ID scoped "for the families above only", as #160–#166 already did. EVT-13/14 are split explicitly between #163 and T15b.
- **Shared check rows:** #164, T16b and #165 run in parallel. The first to land creates the Event check row, and the others reuse it.
- **High Morale endings:** T17b, so #167 should depend on T17b.
- **Overseer support-move service:** #166, so #168 should depend on #166.
- **Ruleset Version order:** #158 → T15b → #180 (T32). #180 must be blocked by T15b.
