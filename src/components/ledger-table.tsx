import type { ComponentProps } from 'react';
import { cn } from '~/lib/utils';

export function LedgerTable({
  children,
  className,
}: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn('w-full border-collapse', className)}
        style={{ tableLayout: 'auto' }}
      >
        {children}
      </table>
    </div>
  );
}

export function LedgerTableHead({
  children,
  className,
  ...props
}: ComponentProps<'thead'>) {
  return (
    <thead className={cn(className)} {...props}>
      {children}
    </thead>
  );
}

export function LedgerTableBody({
  children,
  className,
  ...props
}: ComponentProps<'tbody'>) {
  return (
    <tbody className={cn(className)} {...props}>
      {children}
    </tbody>
  );
}

export function LedgerTableRow({
  children,
  className,
  index,
  ...props
}: ComponentProps<'tr'> & { index: number }) {
  return (
    <tr
      className={cn(getLedgerRowClassName(index), className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function LedgerTableHeaderCell({
  children,
  className,
  ...props
}: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-left font-mono text-xs font-normal tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function LedgerTableCell({
  children,
  className,
  ...props
}: ComponentProps<'td'>) {
  return (
    <td className={cn('px-3 py-3 align-top', className)} {...props}>
      {children}
    </td>
  );
}

export function LedgerTableActionCell({
  children,
  className,
  ...props
}: ComponentProps<'td'>) {
  return (
    <LedgerTableCell
      className={cn('w-[11rem] text-right', className)}
      {...props}
    >
      <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
        {children}
      </div>
    </LedgerTableCell>
  );
}

export function getLedgerRowClassName(index: number) {
  if (index === 0) {
    return 'border-b border-primary/8 bg-background/36';
  }

  return index % 2 === 0
    ? 'border-b border-primary/8 bg-background/18'
    : 'border-b border-primary/8 bg-background/8';
}
