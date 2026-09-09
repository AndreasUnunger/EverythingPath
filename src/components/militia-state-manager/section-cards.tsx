import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';

export function StateSectionCard({
  title,
  subtitle,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card role="region" aria-label={title} className="bg-card border-2 p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-primary font-sans text-xl font-bold">{title}</h3>
            {subtitle ? (
              <p className="text-muted-foreground mt-1 font-mono text-sm">{subtitle}</p>
            ) : null}
          </div>
          {actionLabel && onAdd ? (
            <Button type="button" variant="outline" onClick={onAdd}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </Card>
  );
}

export function SummaryGrid({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="border-primary/20 bg-background/40 border-2 p-3">
          <p className="text-muted-foreground font-mono text-xs">{row.label}</p>
          <p className="font-mono text-sm">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

export function StateList({
  emptyText,
  children,
}: {
  emptyText: string;
  children: React.ReactNode[];
}) {
  if (!children.length) {
    return <p className="text-muted-foreground font-mono text-sm">{emptyText}</p>;
  }

  return <div className="grid grid-cols-1 gap-3">{children}</div>;
}

export function StateListItem({
  title,
  badges,
  body,
  onEdit,
  onDelete,
  deleting = false,
}: {
  title: string;
  badges?: string[];
  body: React.ReactNode;
  onEdit: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="border-primary/20 bg-background/40 border-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-sans text-lg font-bold">{title}</h4>
            {badges?.map((badge) => (
              <Badge key={badge} variant="outline" className="font-mono text-xs">
                {badge}
              </Badge>
            ))}
          </div>
          <div className="space-y-1">{body}</div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
