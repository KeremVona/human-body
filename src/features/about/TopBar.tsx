import type { JSX, ReactNode } from 'react';
import { APP_NAME } from '../../app/brand';
import { IconButton } from '../../ui/IconButton';
import { AboutDialog } from './AboutDialog';

/** Floating header displaying the atlas brand, reserved Phase 2 search slot, and About trigger. */
export function TopBar({
  searchSlot,
}: {
  searchSlot?: ReactNode;
}): JSX.Element {
  return (
    <header
      aria-label="Application header"
      className="pointer-events-none fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between gap-3 px-3 sm:px-4"
    >
      <div className="pointer-events-auto flex items-center rounded-xl border border-white/10 bg-slate-900/75 px-3 py-1.5 shadow-lg backdrop-blur-md">
        <span className="text-sm font-semibold tracking-tight text-white">
          {APP_NAME}
        </span>
      </div>

      <div className="min-w-0 flex-1" data-slot="search">
        {searchSlot ?? null}
      </div>

      <div className="pointer-events-auto flex items-center rounded-xl border border-white/10 bg-slate-900/75 p-0.5 shadow-lg backdrop-blur-md">
        <AboutDialog
          trigger={
            <IconButton label="About this atlas" className="h-8 w-8">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="7.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M10 9v5M10 6.2h.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          }
        />
      </div>
    </header>
  );
}
