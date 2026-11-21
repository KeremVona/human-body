import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> & {
  label: string;
  active?: boolean;
  children: ReactNode;
};

/** Accessible rounded icon button with high-contrast focus ring. */
export function IconButton({
  label,
  active = false,
  className = '',
  children,
  ...rest
}: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ? true : undefined}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:pointer-events-none disabled:opacity-40 ${active ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/40' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
