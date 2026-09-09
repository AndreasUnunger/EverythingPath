import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(cleanup);
import { ActivityDeckCard } from './activity-deck-card';
import { buildActivityActionEntries } from './activity-phase-shared';

function card(disabled = false) {
  const entry = buildActivityActionEntries({
    dragState: null,
    assignedActionIds: new Set(),
    stagedActionIds: [],
    hasNonLieLowStaged: false,
    hasLieLowStaged: false,
    rank: 1,
    treasury: 100,
    maxTeams: 2,
    teams: [],
    activeTeamIds: [],
  }).find((entry) => entry.card.id === 'drill_militia')!;
  return { ...entry, isDisabled: disabled };
}
describe('visible Action Choice placement', () => {
  it('stages into the named slot without initiating pointer drag', () => {
    const onStage = vi.fn();
    const onDragStart = vi.fn();
    render(
      <ActivityDeckCard
        entry={card()}
        dragState={null}
        slotRows={[{ slotId: 'activity-1', slotNumber: 1, slotActionId: null }]}
        onStage={onStage}
        onDragStart={onDragStart}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Stage Drill Militia in Activity Slot 1',
    });
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(onStage).toHaveBeenCalledWith(0, 'drill_militia');
    expect(onDragStart).not.toHaveBeenCalled();
    expect(
      screen.getByRole('group', { name: 'Action Choice: Drill Militia' }),
    ).toHaveAttribute('tabindex', '0');
  });
  it('disables placement when the action is unavailable', () => {
    const onStage = vi.fn();
    render(
      <ActivityDeckCard
        entry={card(true)}
        dragState={null}
        slotRows={[{ slotId: 'activity-1', slotNumber: 1, slotActionId: null }]}
        onStage={onStage}
        onDragStart={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Stage Drill Militia in Activity Slot 1',
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onStage).not.toHaveBeenCalled();
  });
});
