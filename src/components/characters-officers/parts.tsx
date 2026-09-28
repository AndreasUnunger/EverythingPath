import { TriangleAlert } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import type { OfficerRole } from '~/lib/officer-board';

/** The DOM id of a role card, so a role chip can move focus to it. */
export function roleCardId(role: OfficerRole) {
  return `role-${role}`;
}

export function ArchivedBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 font-mono text-[11px] font-normal text-amber-300"
    >
      archived
    </Badge>
  );
}

/** Advisory warnings, one line each. */
export function Warnings({ warnings }: { warnings: string[] }) {
  return warnings.map((warning) => (
    <p
      key={warning}
      className="flex items-start gap-1.5 text-sm text-amber-300"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{warning}</span>
    </p>
  ));
}
