import type { AppThunk } from '../../app/store';
import type { MeshId } from '../../data/ids';
import { selectBundlesForSystem } from '../assets/assetsSlice';
import {
  dissectionPastRestored,
  dissectionPastTruncated,
  dissectionRestored,
  reveal,
  type DissectionSnapshot,
} from '../dissection/dissectionSlice';
import {
  hovered,
  selected,
  selectionCleared,
} from '../selection/selectionSlice';
import { buildQuizPool } from './pool';
import {
  answered,
  bestRecorded,
  emptyPoolReported,
  nextQuestion,
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

/** Starts a Find & Click quiz round from featured visible/pickable medium+large meshes in ready enabled systems. */
export function startQuiz(
  seed = Date.now(),
): AppThunk<'started' | 'empty-pool' | 'refused'> {
  return (dispatch, getState) => {
    if (getState().tour?.activeId != null || getState().journey?.activeId != null) {
      return 'refused';
    }
    clearWrongFlashTimer();
    const state = getState();
    const index = state.content.index;
    const manifest = state.assets.manifest;
    if (!index || !manifest) {
      dispatch(emptyPoolReported());
      return 'empty-pool';
    }

    const pool = buildQuizPool(
      index,
      manifest,
      (sys) =>
        state.systems[sys].enabled &&
        state.systems[sys].opacity >= 0.5 &&
        selectBundlesForSystem(state, sys).every(
          (b) => state.assets.bundles[b] === 'ready',
        ),
    );
    const hiddenSet = new Set(state.dissection.hidden);
    const isolatedSet = state.dissection.isolated
      ? new Set(state.dissection.isolated)
      : null;
    const visiblePool = pool.filter(
      (id) =>
        !hiddenSet.has(id) && (isolatedSet === null || isolatedSet.has(id)),
    );
    if (visiblePool.length === 0) {
      dispatch(emptyPoolReported());
      return 'empty-pool';
    }

    const savedDissection: DissectionSnapshot = {
      hidden: [...state.dissection.hidden],
      isolated: state.dissection.isolated
        ? [...state.dissection.isolated]
        : null,
      faded: state.dissection.faded ? [...state.dissection.faded] : null,
    };
    const savedPast: DissectionSnapshot[] = state.dissection.past.map((s) => ({
      hidden: [...s.hidden],
      isolated: s.isolated ? [...s.isolated] : null,
      faded: s.faded ? [...s.faded] : null,
    }));

    const questions = pickQuestions(visiblePool, ROUND_SIZE, createRng(seed));
    const best = readBestScore();

    dispatch(hovered(null));
    dispatch(selectionCleared());
    dispatch(
      quizStarted({
        questions,
        savedDissection,
        savedPast,
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

/** Advances to the next quiz question and persists best score once summary is reached. */
export function advanceQuiz(): AppThunk {
  return (dispatch, getState) => {
    clearWrongFlashTimer();
    dispatch(nextQuestion());
    const state = getState().quiz;
    if (state.status === 'summary') {
      const nextBest = Math.max(state.best, state.score);
      writeBestScore(nextBest);
      dispatch(bestRecorded(nextBest));
    }
  };
}

/** Ends the quiz, records the best score safely, and restores pre-quiz dissection state. */
export function endQuiz(): AppThunk {
  return (dispatch, getState) => {
    clearWrongFlashTimer();
    const state = getState();
    const { savedDissection, savedPast, savedPastCount, best, score } =
      state.quiz;
    const nextBest = Math.max(best, score);
    writeBestScore(nextBest);
    dispatch(bestRecorded(nextBest));

    if (savedDissection) {
      dispatch(dissectionRestored(savedDissection));
    }
    if (savedPast) {
      dispatch(dissectionPastRestored(savedPast));
    } else if (typeof savedPastCount === 'number') {
      dispatch(dissectionPastTruncated(savedPastCount));
    }
    dispatch(selectionCleared());
    dispatch(quizEnded());
  };
}
