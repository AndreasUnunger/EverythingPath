'use client';
import { MilitiaCorrectionForm } from '~/components/militia-setup/form';
import { Button } from '~/components/ui/button';
import { useFocusOnMount } from './section-correction';
import type { FullCorrection } from './use-militia-corrections';

// The temporary full correction editor for entries without their own
// section editor yet. It keeps the existing form's own Save.
export function FullCorrectionView({
  correction,
}: {
  correction: FullCorrection;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          ref={heading}
          tabIndex={-1}
          className="min-w-0 text-xl [overflow-wrap:anywhere] outline-none"
        >
          {correction.heading}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="ml-auto min-h-11 md:min-h-9"
          onClick={correction.cancel}
        >
          Cancel correction
        </Button>
      </div>
      <MilitiaCorrectionForm
        initialValues={correction.initialValues}
        characters={correction.characters}
        stagedChoiceNotice={correction.stagedChoiceNotice}
        onSave={correction.onSave}
      />
    </section>
  );
}
