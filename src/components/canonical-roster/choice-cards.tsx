import { Button } from '~/components/ui/button';

export function ChoiceCards<Value extends string>({
  label,
  choices,
  selected,
  onSelect,
}: {
  label: string;
  choices: readonly { value: Value; label: string }[];
  selected: readonly Value[];
  onSelect: (value: Value) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {choices.map((choice) => (
        <Button
          key={choice.value}
          type="button"
          variant={selected.includes(choice.value) ? 'default' : 'outline'}
          aria-label={`${label}: ${choice.label}`}
          aria-pressed={selected.includes(choice.value)}
          className="h-auto min-h-16 border-2 p-3 whitespace-normal transition-transform hover:-translate-y-1"
          onClick={() => onSelect(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  );
}
