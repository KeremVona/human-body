import * as Dialog from '@radix-ui/react-dialog';
import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { endQuiz, startQuiz } from './thunks';

/** End-of-round modal summary showing score, best score, Play again, and Close controls. */
export function QuizSummary(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.quiz.status);
  const score = useAppSelector((s) => s.quiz.score);
  const total = useAppSelector((s) => s.quiz.questions.length);
  const best = useAppSelector((s) => s.quiz.best);

  const open = status === 'summary';
  if (!open) return null;

  const handleClose = () => {
    dispatch(endQuiz());
  };

  const handlePlayAgain = () => {
    dispatch(endQuiz());
    dispatch(startQuiz());
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-100 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-lg font-semibold text-white">
            Quiz complete
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-slate-200">
            You found {score} of {total}.
          </Dialog.Description>
          <p className="mt-1 text-xs text-slate-400">
            Best: {Math.max(best, score)}
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePlayAgain}
              className="rounded-lg bg-sky-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Play again
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
