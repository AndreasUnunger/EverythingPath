'use client';

import type { NavigationLink } from '~/lib/app-navigation';
import { StripLink } from './strip-link';

export function AppPageStrip({ links }: { links: NavigationLink[] }) {
  if (!links.length) return null;
  return (
    <nav
      aria-label="Pages"
      className="flex gap-1 overflow-x-auto px-2 pb-1.5 [scrollbar-width:none] md:hidden"
    >
      {links.map((item) => (
        <StripLink key={item.key} item={item} />
      ))}
    </nav>
  );
}
