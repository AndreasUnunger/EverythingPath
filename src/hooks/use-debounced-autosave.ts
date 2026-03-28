'use client';

import { useEffect } from 'react';

export function useDebouncedAutosave({
  enabled = true,
  delayMs = 350,
  shouldSkip,
  run,
  onError,
  deps,
}: {
  enabled?: boolean;
  delayMs?: number;
  shouldSkip: () => boolean;
  run: () => Promise<void>;
  onError: (error: unknown) => void;
  deps: ReadonlyArray<unknown>;
}) {
  useEffect(() => {
    if (!enabled || shouldSkip()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void run().catch((error) => {
        onError(error);
      });
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [enabled, delayMs, shouldSkip, run, onError, ...deps]);
}
