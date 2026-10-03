'use client';
import type { CompanionRelationshipView } from './character-companions-view-model';
import type {
  CompanionOpenerProps,
  CompanionsController,
} from './companion-props';
import { CompanionRelationshipRow } from './companion-relationship-row';

export function CompanionRelationshipList({
  rows,
  controller,
  rememberOpener,
}: CompanionOpenerProps & {
  rows: CompanionRelationshipView[];
  controller: CompanionsController;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-foreground/10 divide-y">
      {rows.map((row) => (
        <li
          key={row.relationshipId}
          aria-label={`${row.roleLabel} ${row.name}`}
        >
          <CompanionRelationshipRow
            row={row}
            controller={controller}
            rememberOpener={rememberOpener}
          />
        </li>
      ))}
    </ul>
  );
}
