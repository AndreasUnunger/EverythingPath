# EverythingPath

EverythingPath is a multiplayer Pathfinder militia operations app for the Ironfang militia subsystem.

It is built to let a table run militia play week-by-week with shared realtime state, card-based action selection, and role-aware collaboration.

## Product Goal

The app supports militia management during live play by guiding users through the weekly sequence:

1. Upkeep
2. Activity
3. Event

It is designed for groups already in-progress as well as fresh starts, including mid-campaign state onboarding.

## Core Experience

- Realtime multiplayer updates
- Multi-device tabletop use (tablet landscape first)
- Card UI for team/action choices (hover, drag, slot, stage, confirm)
- Shared visibility of staged and confirmed changes
- GM moderation controls for adjudication and correction

## Rules Model

Militia rules are implemented from the Ironfang rules corpus in `docs/ai/ironfang-militia/`.

The system is rules-aware but not rules-blocking:
- Structural invalid input is blocked
- Rule mismatches are surfaced as warnings
- Homebrew and table-approved overrides are supported

## Current Data Model Highlights

- Campaign, militia, character, and team ownership tables
- Officer assignments on militia records
- Weekly phase/state tracking tables
- Team condition state tables (`active`, `disabled`, `missing`, `blocked`)
- Event and persistent-event state tracking
- Override notes for intentional rule deviations

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Convex (database + realtime backend)
- Clerk (auth/org context)
- TanStack Query

## Development

Requirements:
- Node.js
- pnpm
