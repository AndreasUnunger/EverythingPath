'use client';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';

// One page-local failure card. The shell and its section links stay usable
// around it; the retry only reloads this page's data.
export function FailedLoadCard({
  noun,
  retry,
  className,
}: {
  noun: string;
  retry: () => void;
  className?: string;
}) {
  return (
    <Card role="alert" className={cn('gap-3 p-4', className)}>
      <p>{noun} could not be loaded.</p>
      <div>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
