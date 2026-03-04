# EverythingPath

## Todo

- [x] Deploy
- [x] CI
- [x] Database
- [x] Auth
- [x] Db schema
- [ ] Role based auth
- [x] queryCacheProvider
- [ ] Posthog
- [x] overview at the top with basic name, stats, date, location
- [ ] manual add team to militia
- [ ] militia stats input
- [ ] set up main "upkeep, action, event" game loop page
- [ ] upkeep phase
- [ ] action phase
- [ ] event phase
- [ ] keep track of in game date


initiate weekly rolls button unlocks the three tabs

upkeep phase 
input result of attrition roll in MVP, auto roll in future
add penalty for low treasury to attrition
increase rank ?
adjust treasury. number field, slider

action phase
shuffle out cards for each action with text in MVP, images later
show teams on the side  
when an action card is hovered the associated team glows
when an action card is dragged into an action slot the associated team moves to that slot as well
show disabled actions at the bottom as well
hovering a team makes the associated actions glow

## Week Board Rules Gap Closure (Prioritized)

- [ ] 1. Add authoritative week-apply engine in Convex and call it when advancing from `week_closed` to next week.
- [ ] 2. Enforce first-week lifecycle semantics so week 1 starts in Activity and skips Upkeep by default.
- [ ] 3. Add Event-phase reactive `Sabotage` flow (roll entry, negate check, notoriety impact).
- [ ] 4. Implement event edge semantics in backend resolution (`Roll Twice` limits/rerolls, duplicate `Twice`, impossible rerolls, persistent order).
- [ ] 5. Execute queued and persistent event effects across week boundaries.
- [ ] 6. Complete Upkeep Step 2 branch (DC 15 Loyalty outcome + nearest-settlement reputation drop handling).
- [ ] 7. Add team-capability and once-per-team action legality handling.
- [ ] 8. Implement explicit Guarantee/Manipulate “roll two, choose one” event flow.
- [ ] 9. Add integration tests covering full-week advancement and edge cases.
