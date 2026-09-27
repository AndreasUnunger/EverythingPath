'use client';
import { EventActivityRecalculation } from './event-activity-recalculation';
import { EventCacheTarget } from './event-cache-target';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventNote } from './event-note';
import { EventRetainedInputs } from './event-retained-inputs';
import { EventRewardList } from './event-reward-list';
import { InlineAction } from './event-steps';
import type { EventTargetCard } from './types';

// Broke the Code, Cache Discovered, Festival, Market Day, Found Fire and
// Hidden Agenda: the identified item, the town, each cache found with its
// own Secrecy check, the rewards and the recalculated Activity checks. Each
// part renders only where its facts exist. `subject` is the block label,
// which names the controls for assistive technology.
export function EventResourceInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  targetCards,
  subject,
  openActivity,
}: EventFamilyInputsProps<'resource'> & {
  subject: string;
  // Opens Activity, where the operated towns and recalculated choices live.
  openActivity?: () => void;
}) {
  return (
    <>
      {panel.item && targetCards('item', panel.item, subject)}
      {panel.settlement && targetCards('settlement', panel.settlement, subject)}
      {panel.towns && (
        <MarketDayTowns
          towns={panel.towns}
          subject={subject}
          openActivity={openActivity}
        />
      )}
      {panel.cache && targetCards('cache', panel.cache, subject)}
      {(panel.legacyMitigation !== null || panel.legacyCheckRoll) && (
        <EventNote
          action="Clear whole-event mitigation"
          actionLabel={`Clear whole-event mitigation from ${subject}`}
          disabled={disabled}
          onAction={() => showRefusal(edits.clearEventMitigation(id))}
        >
          An older entry records mitigation for the whole event. Each cache
          follows it until its own choice is made.
        </EventNote>
      )}
      {panel.caches.map((cache) => (
        <EventCacheTarget
          key={cache.cacheId}
          cache={cache}
          id={id}
          subject={subject}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
        />
      ))}
      {panel.retainedCacheChecks.map((entry) => (
        <EventNote
          key={entry.index}
          action="Remove"
          actionLabel={`Remove recorded check for ${entry.label} from ${subject}`}
          disabled={disabled}
          onAction={() => showRefusal(edits.removeTargetCheck(id, entry.index))}
        >
          {entry.label}: {entry.reason}
        </EventNote>
      ))}
      {panel.rewards && (
        <EventRewardList
          rewards={panel.rewards}
          id={id}
          subject={subject}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
        />
      )}
      {panel.activity && (
        <EventActivityRecalculation
          activity={panel.activity}
          subject={subject}
          openActivity={openActivity}
        />
      )}
      <EventRetainedInputs
        retained={panel.retained}
        subject={subject}
        disabled={disabled}
        onClear={(field) =>
          showRefusal(edits.clearRetained(id, field, panel.keep))
        }
      />
    </>
  );
}

// Market Day Twice: every operated town the discount reaches, read from
// Activity rather than chosen here.
function MarketDayTowns({
  towns,
  subject,
  openActivity,
}: {
  towns: EventTargetCard[];
  subject: string;
  openActivity?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Towns with the Market Day · ${subject}`}
      className="min-w-0 space-y-1"
    >
      <p className="text-sm font-semibold">Towns with the Market Day</p>
      {towns.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {towns.map((town) => (
            <li
              key={town.value}
              className="flex min-w-0 flex-wrap gap-x-2 [overflow-wrap:anywhere]"
            >
              <span className="min-w-0">{town.label}</span>
              {town.description && (
                <span className="text-muted-foreground min-w-0">
                  {town.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground flex min-w-0 flex-wrap gap-x-2 text-sm [overflow-wrap:anywhere]">
          <span className="min-w-0">No town counts as operated this week.</span>
          {openActivity && (
            <InlineAction
              onClick={openActivity}
              ariaLabel={`Open Activity for ${subject}`}
            >
              Open Activity
            </InlineAction>
          )}
        </p>
      )}
    </div>
  );
}
