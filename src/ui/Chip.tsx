import type { JSX, ReactNode } from 'react';

export type ChipProps = {
  children: ReactNode;
  swatchColor?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

/** Pill-shaped status badge or interactive filter/action chip. */
export function Chip({
  children,
  swatchColor,
  active = false,
  onClick,
  className = '',
  ariaLabel,
}: ChipProps): JSX.Element {
  const baseClass = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
    active
      ? 'bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/50'
      : 'bg-white/10 text-slate-200 ring-1 ring-white/10'
  } ${onClick ? 'cursor-pointer hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400' : ''} ${className}`;

  const content = (
    <>
      {swatchColor ? (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/30"
          style={{ backgroundColor: swatchColor }}
        />
      ) : null}
      <span>{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={baseClass}
      >
        {content}
      </button>
    );
  }

  return (
    <span aria-label={ariaLabel} className={baseClass}>
      {content}
    </span>
  );
}
