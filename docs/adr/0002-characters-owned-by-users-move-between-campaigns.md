# Characters are owned by a user and move between campaigns

A Character can exist in no campaign, so a player can build one before joining a game. Outside a campaign its creator, the Character Owner, is the only one who can see or edit it. Inside a campaign everyone in the campaign can edit it, as before. Adding it to a campaign moves that same Character, so it is in at most one campaign at a time. Leaving takes it off the militia roster through a Militia Correction and detaches campaign homebrew from its sheet. This keeps one identity per person (ADR 0001), and history is unaffected because finished weeks read only their frozen snapshots.

## Considered Options

- **Copy into the campaign**: rejected because the same person would then have two Characters whose sheets drift apart.
- **One Character shared by several campaigns at once**: rejected because levelling up or a militia week in one campaign would change the others.
- **Characters with no campaign owned by an organization**: rejected because a Character belongs to the person who plays or prepares it, not to whichever group is active. Such an organization would also be little more than a campaign without a militia.

## Consequences

`character.campaignId` becomes optional, and ownership grants access outside a campaign. Sheet entries no longer carry a `campaignId`, because their Character can move. The app gets top-level Campaigns and Characters areas.
