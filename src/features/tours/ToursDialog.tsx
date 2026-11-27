import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useT } from '../../i18n/t';
import type { TourId } from './schema';
import { loadTours, startTour } from './thunks';
import type { JourneyId } from '../journey/schema';
import { loadJourneys, startJourney } from '../journey/thunks';

type ToursDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour?: (id: TourId) => Promise<void> | void;
  onStartJourney?: (id: JourneyId) => Promise<void> | void;
};

/** Modal picker listing available journeys and guided anatomy tours. */
export function ToursDialog({
  open,
  onOpenChange,
  onStartTour,
  onStartJourney,
}: ToursDialogProps): JSX.Element {
  const dispatch = useAppDispatch();
  const tr = useT();
  const defs = useAppSelector((s) => s.tour.defs);
  const texts = useAppSelector((s) => s.tour.texts);
  const loadStatus = useAppSelector((s) => s.tour.loadStatus);
  const journeyDefs = useAppSelector((s) => s.journey.defs);
  const journeyTexts = useAppSelector((s) => s.journey.texts);
  const journeyLoadStatus = useAppSelector((s) => s.journey.loadStatus);
  const journeyActive = useAppSelector((s) => s.journey.activeId !== null);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');

  useEffect(() => {
    if (open && loadStatus === 'idle') {
      void dispatch(loadTours());
    }
    if (open && journeyLoadStatus === 'idle') {
      void dispatch(loadJourneys());
    }
  }, [open, loadStatus, journeyLoadStatus, dispatch]);

  const handleStart = (id: TourId): void => {
    onOpenChange(false);
    void (onStartTour ? onStartTour(id) : dispatch(startTour(id)));
  };

  const handleStartJourney = (id: JourneyId): void => {
    onOpenChange(false);
    void (onStartJourney ? onStartJourney(id) : dispatch(startJourney(id)));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-200 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-white">
              {tr('tour.dialogTitle')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={tr('about.close')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {tr('tour.dialogTitle')}
          </Dialog.Description>

          {journeyLoadStatus === 'error' ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-xs text-red-100">
              <span>{tr('journey.error')}</span>
              <button
                type="button"
                onClick={() => void dispatch(loadJourneys())}
                className="rounded-lg bg-white/10 px-2.5 py-1 font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                {tr('motion.retry')}
              </button>
            </div>
          ) : journeyDefs && journeyDefs.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold tracking-wider text-sky-300 uppercase">
                {tr('journey.section')}
              </h3>
              <ul className="mt-2 space-y-2.5">
                {journeyDefs.map((j) => {
                  const jCopy = journeyTexts?.[j.id];
                  const totalS = j.stages.reduce((acc, st) => acc + st.durationS, 0);
                  const mins = Math.round((totalS / 60) * 2) / 2;
                  return (
                    <li
                      key={j.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-sky-400/25 bg-sky-500/10 p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white">
                          {jCopy?.title ?? j.id}
                        </h4>
                        {jCopy?.summary ? (
                          <p className="mt-1 text-xs leading-relaxed text-slate-300">
                            {jCopy.summary}
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                          {tr('journey.length', { m: String(mins) })}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={quizActive}
                        title={
                          quizActive ? tr('motion.finishQuizTitle') : undefined
                        }
                        onClick={() => handleStartJourney(j.id)}
                        className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                      >
                        {tr('journey.start')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {loadStatus === 'error' ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-xs text-red-100">
              <span>{tr('tour.error')}</span>
              <button
                type="button"
                onClick={() => void dispatch(loadTours())}
                className="rounded-lg bg-white/10 px-2.5 py-1 font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                {tr('motion.retry')}
              </button>
            </div>
          ) : defs === null ? (
            <p className="mt-4 text-xs text-slate-400">{tr('loading.details')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {defs.map((tour) => {
                const copy = texts?.[tour.id];
                const title = copy?.title ?? tour.id;
                const summary = copy?.summary ?? '';
                return (
                  <li
                    key={tour.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white">{title}</h3>
                      {summary ? (
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          {summary}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                        {tr('tour.steps', { n: tour.steps.length })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={quizActive || journeyActive}
                      title={
                        quizActive
                          ? tr('motion.finishQuizTitle')
                          : journeyActive
                            ? tr('journey.finishFirst')
                            : undefined
                      }
                      onClick={() => handleStart(tour.id)}
                      className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                    >
                      {tr('tour.start')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
