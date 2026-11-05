import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Testing Library only unmounts automatically when a global afterEach exists,
// and Vitest globals are off. Files that opt into the node or edge-runtime
// environment have no document, so they skip React entirely.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
