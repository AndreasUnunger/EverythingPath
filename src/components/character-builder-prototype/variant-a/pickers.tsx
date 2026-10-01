'use client';
// PROTOTYPE (throwaway, #208) — Variant A: a select that adds a catalog entry.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export function AddFromCatalog({
  label,
  options,
  onAdd,
}: {
  label: string;
  options: { key: string; name: string; summary?: string }[];
  onAdd: (key: string) => void;
}) {
  return (
    <Select value="" onValueChange={(v) => v && onAdd(v)}>
      <SelectTrigger
        className="min-h-11 w-full max-w-sm md:min-h-9"
        aria-label={label}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key} className="min-h-11">
            {o.name}
            {o.summary && (
              <span className="text-muted-foreground text-xs">
                {' '}
                · {o.summary}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
