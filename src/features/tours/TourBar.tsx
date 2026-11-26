import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useT } from '../../i18n/t';
import { exitTour, nextStep, prevStep } from './thunks';
import { selectCurrentStep } from './tourSlice';

type TourBarProps = {
  onPrev?: () => Promise<void> | void;
  onNext?: () => Promise<void> | void;
  onExit?: () => Promise<void> | void;
};

/** Compact floating bottom card showing the active tour step narrative and navigation controls. */
export function TourBar({
  onPrev,
  onNext,
  onExit,
}: TourBarProps = {}): JSX.Element | null {
  const dispatch = useAppDispatch();
  const tr = useT();
  const step = useAppSelector(selectCurrentStep);

  if (!step) {
    return null;
  }

  const isFirst = step.index === 0;
  const isLast = step.index + 1 >= step.count;

  return (
    <section
      role="region"
      aria-label={step.tourTitle}
      className="pointer-events-auto w-[min(94vw,30rem)] rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-3 text-slate-100 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-300">
        <span className="truncate text-sky-300">{step.tourTitle}</span>
        <span className="shrink-0 tabular-nums">
          {tr('tour.progress', {
            i: String(step.index + 1),
            n: String(step.count),
          })}
        </span>
      </div>

      <div aria-live="polite" className="mt-1">
        <h2 className="text-sm font-semibold text-white">{step.title}</h2>
      </div>

      {step.body ? (
        <p className="mt-1.5 max-h-[26dvh] overflow-y-auto pr-1 text-xs leading-relaxed text-slate-200">
          {step.body}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
        <button
          type="button"
          onClick={() => void (onExit ? onExit() : dispatch(exitTour()))}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          {tr('tour.exit')}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => void (onPrev ? onPrev() : dispatch(prevStep()))}
            className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
          >
            {tr('tour.back')}
          </button>
          <button
            type="button"
            onClick={() => void (onNext ? onNext() : dispatch(nextStep()))}
            className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            {isLast ? tr('tour.finish') : tr('tour.next')}
          </button>
        </div>
      </div>
    </section>
  );
}
