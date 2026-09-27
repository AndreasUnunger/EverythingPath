import type { EventBlock } from './types';

// The rolled event's corpus rules, folded away so a block stays scannable.
// On a second occurrence the Twice clause is what matters, so it leads the
// summary; the full text sits behind the disclosure either way.

export function EventRulesText({
  rules,
}: {
  rules: NonNullable<EventBlock['rules']>;
}) {
  return (
    <details className="min-w-0">
      <summary className="text-muted-foreground min-w-0 cursor-pointer text-xs [overflow-wrap:anywhere]">
        {rules.twice === null ? (
          <>Rules: {rules.name}</>
        ) : (
          <>
            <span className="text-foreground font-medium">Twice</span>
            {' · '}
            {rules.twice}
          </>
        )}
      </summary>
      <ul className="text-muted-foreground mt-1 min-w-0 list-disc space-y-1 pl-5 text-sm [overflow-wrap:anywhere]">
        {/* An event's rule lines are distinct. */}
        {rules.text.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {rules.twice !== null && (
          <li>
            <span className="text-foreground font-medium">Twice:</span>{' '}
            {rules.twice}
          </li>
        )}
      </ul>
    </details>
  );
}
