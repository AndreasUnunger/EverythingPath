export const leaveText =
  'Leaving removes this character from the militia roster and officer and manager assignments. Its sheet and homebrew stay with it.';

export const privateDepartureText =
  'Only you can see it afterwards, until you add it to a campaign.';

export function departureText(
  isMilitiaOnly: boolean,
  departureRoles?: readonly string[],
) {
  const changes = departureRoles
    ? [
        ...departureRoles.map(
          (role) =>
            `${role} assignment removed. Finished weeks keep it as it was.`,
        ),
        'Campaign homebrew is kept as its own copy; the sheet doesn’t change.',
      ].join(' ')
    : leaveText;
  return `${changes}${
    isMilitiaOnly
      ? ' As a Militia-only character it becomes a Full character, which can’t be undone.'
      : ''
  }`;
}
