import type { JSX, ReactNode } from 'react';
import { useT } from '../i18n/t';
import { IconButton } from './IconButton';

export type PanelProps = {
  side: 'left' | 'right';
  label: string;
  collapsed: boolean;
  onToggle(): void;
  children?: ReactNode;
  className?: string;
};

function ChevronIcon({
  direction,
}: {
  direction: 'left' | 'right';
}): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d={
          direction === 'left'
            ? 'M10 3.5L5.5 8L10 12.5'
            : 'M6 3.5L10.5 8L6 12.5'
        }
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Translucent floating panel collapsible to a compact icon rail. */
export function Panel({
  side,
  label,
  collapsed,
  onToggle,
  children,
  className = '',
}: PanelProps): JSX.Element {
  const tr = useT();
  const collapseDirection = side === 'left' ? 'left' : 'right';
  const expandDirection = side === 'left' ? 'right' : 'left';

  if (collapsed) {
    return (
      <div
        className={`inline-flex flex-col items-center rounded-xl border border-white/10 bg-slate-900/60 p-1 text-slate-100 shadow-xl backdrop-blur-md ${className}`}
      >
        <IconButton
          label={tr('panel.expand')}
          aria-expanded={false}
          onClick={onToggle}
        >
          <ChevronIcon direction={expandDirection} />
        </IconButton>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-white/10 bg-slate-900/60 p-3 text-slate-100 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
          {label}
        </h2>
        <IconButton
          label={tr('panel.collapse')}
          aria-expanded={true}
          onClick={onToggle}
          className="h-7 w-7"
        >
          <ChevronIcon direction={collapseDirection} />
        </IconButton>
      </div>
      {children}
    </div>
  );
}
