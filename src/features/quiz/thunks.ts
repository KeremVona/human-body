import type { AppThunk } from '../../app/store';
import type { MeshId } from '../../data/ids';
import {
  dissectionPastTruncated,
  dissectionRestored,
  reveal,
  type DissectionSnapshot,
} from '../dissection/dissectionSlice';
import { selected, selectionCleared } from '../selection/selectionSlice';
import { buildQuizPool } from './pool';
import {
  answered,
  bestRecorded,
  questionSkipped,
  quizEnded,
  quizStarted,
  retryAfterWrong,
} from './quizSlice';
import { createRng, pickQuestions } from './rng';

const BEST_STORAGE_KEY = 'atlas.quiz.best';
const ROUND_SIZE = 10;
const WRONG_FLASH_MS = 800;

let wrongFlashTimer: ReturnType<typeof setTimeout> | null = null;

function clearWrongFlashTimer() {
  if (wrongFlashTimer !== null) {
    clearTimeout(wrongFlashTimer);
    wrongFlashTimer = null;
  }
}

function readBestScore(): number {
  try {
    const raw = localStorage.getItem(BEST_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(best: number): void {
  try {
    localStorage.setItem(BEST_STORAGE_KEY, String(best));
  } catch {
    // Ignore storage denial or private browsing errors
  }
}

/** Starts a Find & Click quiz round from featured medium/large meshes in enabled systems. */
export function startQuiz(
  seed = Date.now(),
): AppThunk<'started' | 'empty-pool'> {
  return (dispatch, getState) => {
    clearWrongFlashTimer();
    const state = getState();
    const index = state.content.index;
    const manifest = state.assets.manifest;
    if (!index || !manifest) return 'empty-pool';

    const pool = buildQuizPool(
      index,
      manifest,
      (sys) => state.systems[sys].enabled,
    );
    if (pool.length === 0) return 'empty-pool';

    const savedDissection: DissectionSnapshot = {
      hidden: [...state.dissection.hidden],
      isolated: state.dissection.isolated
        ? [...state.dissection.isolated]
        : null,
      faded: state.dissection.faded ? [...state.dissection.faded] : null,
    };

    const questions = pickQuestions(pool, ROUND_SIZE, createRng(seed));
    const best = readBestScore();

    dispatch(selectionCleared());
    dispatch(
      quizStarted({
        questions,
        savedDissection,
        savedPastCount: state.dissection.past.length,
        best,
      }),
    );
    return 'started';
  };
}

/** Handles a 3D mesh pick during an active quiz question. */
export function answerQuiz(meshId: MeshId): AppThunk {
  return (dispatch, getState, extra) => {
    clearWrongFlashTimer();
    if (getState().quiz.status !== 'asking') return;

    dispatch(answered(meshId));
    const next = getState().quiz;
    const target = next.questions[next.current];

    if (next.status === 'correct' && target) {
      dispatch(selected([target]));
      return;
    }

    if (next.status === 'revealed' && target) {
      dispatch(reveal([target]));
      dispatch(selected([target]));
      void extra?.camera?.current?.focusMeshes([target]);
      return;
    }

    if (next.status === 'wrong') {
      dispatch(selected([meshId]));
      wrongFlashTimer = setTimeout(() => {
        wrongFlashTimer = null;
        if (getState().quiz.status === 'wrong') {
          dispatch(retryAfterWrong());
          dispatch(selectionCleared());
        }
      }, WRONG_FLASH_MS);
    }
  };
}

/** Skips the current question and reveals the target structure with 0 points. */
export function skipQuestion(): AppThunk {
  return (dispatch, getState, extra) => {
    clearWrongFlashTimer();
    const state = getState();
    if (state.quiz.status !== 'asking') return;
    const target = state.quiz.questions[state.quiz.current];
    dispatch(questionSkipped());
    if (target) {
      dispatch(reveal([target]));
      dispatch(selected([target]));
      void extra?.camera?.current?.focusMeshes([target]);
    }
  };
}

/** Ends the quiz, records the best score safely, and restores pre-quiz dissection state. */
export function endQuiz(): AppThunk {
  return (dispatch, getState) => {
    clearWrongFlashTimer();
    const state = getState();
    const { savedDissection, savedPastCount, best, score } = state.quiz;
    const nextBest = Math.max(best, score);
    writeBestScore(nextBest);
    dispatch(bestRecorded(nextBest));

    if (savedDissection) {
      dispatch(dissectionRestored(savedDissection));
    }
    if (typeof savedPastCount === 'number') {
      dispatch(dissectionPastTruncated(savedPastCount));
    }
    dispatch(selectionCleared());
    dispatch(quizEnded());
  };
}
