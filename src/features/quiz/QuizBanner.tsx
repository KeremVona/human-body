import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { parseMeshId, type MeshId } from '../../data/ids';
import type { IndexEntry } from '../../data/schema';
import { selectStructureLookup } from '../content/contentSlice';
import { advanceQuiz, endQuiz, skipQuestion } from './thunks';

function formatMeshLabel(
  meshId: MeshId,
  lookup: Map<string, IndexEntry>,
): string {
  const { structureId, side } = parseMeshId(meshId);
  const entry = lookup.get(structureId);
  const common = entry?.names.common ?? structureId;
  return side ? `${common} (${side})` : common;
}

/** Floating top-centre HUD driving Find & Click quiz prompts, feedback, and progress. */
export function QuizBanner(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const quiz = useAppSelector((s) => s.quiz);
  const lookup = useAppSelector(selectStructureLookup);

  if (quiz.status === 'off' || quiz.status === 'summary') {
    return null;
  }

  const target = quiz.questions[quiz.current];
  const promptLabel = target ? formatMeshLabel(target, lookup) : '';
  const wrongLabel = quiz.lastWrong
    ? formatMeshLabel(quiz.lastWrong, lookup)
    : '';

  return (
    <section
      aria-label="Quiz banner"
      aria-live="polite"
      className="fixed top-16 left-1/2 z-20 flex max-w-[min(94vw,36rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-300">
          Question {quiz.current + 1} of {quiz.questions.length}
        </span>
        <span className="rounded-md bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-200">
          Score {quiz.score}
        </span>
      </div>

      <p className="text-sm font-semibold text-white">
        {quiz.status === 'correct'
          ? 'Correct!'
          : quiz.status === 'wrong'
            ? `That's the ${wrongLabel}.`
            : quiz.status === 'revealed'
              ? `Here it is: ${promptLabel}.`
              : `Find: ${promptLabel}`}
      </p>

      <div className="flex items-center gap-2">
        {quiz.status === 'correct' || quiz.status === 'revealed' ? (
          <button
            type="button"
            onClick={() => dispatch(advanceQuiz())}
            className="rounded-lg bg-sky-700 px-3 py-1 font-medium text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={quiz.status !== 'asking'}
            onClick={() => dispatch(skipQuestion())}
            className="rounded-lg bg-white/10 px-3 py-1 font-medium text-slate-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:pointer-events-none disabled:opacity-40"
          >
            Skip
          </button>
        )}

        <button
          type="button"
          onClick={() => dispatch(endQuiz())}
          className="rounded-lg bg-white/10 px-3 py-1 font-medium text-slate-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          End quiz
        </button>
      </div>
    </section>
  );
}
