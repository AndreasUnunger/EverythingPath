'use client';

import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

export type ActivityRollFieldConfig = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  helperText?: string;
};

export type ActivityRollSectionConfig = {
  key: string;
  title: string;
  fields: ActivityRollFieldConfig[];
};

export function ActivityRollsPanel({
  sections,
  className,
  showTitle = true,
}: {
  sections: ActivityRollSectionConfig[];
  className?: string;
  showTitle?: boolean;
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className={className ?? 'mt-3 space-y-2'}>
      {showTitle ? <p className="font-mono text-sm font-bold">Activity Roll Entry</p> : null}
      {sections.map((section) => (
        <div key={section.key} className="rounded border p-2">
          <p className="text-muted-foreground font-mono text-xs">{section.title}</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`activity-roll-${section.key}-${field.key}`} className="font-mono text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`activity-roll-${section.key}-${field.key}`}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  className="font-mono"
                />
                {field.helperText ? (
                  <p className="text-muted-foreground font-mono text-xs">
                    {field.helperText}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-muted-foreground font-mono text-xs">
        Roll inputs save automatically.
      </p>
    </div>
  );
}
