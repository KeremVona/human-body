import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MeshId } from '../../data/ids';
import type { DissectionSnapshot } from '../dissection/dissectionSlice';

export type QuizStatus =
  'off' | 'asking' | 'correct' | 'wrong' | 'revealed' | 'summary';

export type QuizState = {
  status: QuizStatus;
  questions: MeshId[];
  current: number;
  attempts: number;
  score: number;
  lastWrong: MeshId | null;
  savedDissection: DissectionSnapshot | null;
  savedPastCount?: number;
  best: number;
};

const initialState: QuizState = {
  status: 'off',
  questions: [],
  current: 0,
  attempts: 0,
  score: 0,
  lastWrong: null,
  savedDissection: null,
  savedPastCount: undefined,
  best: 0,
};

const quizSlice = createSlice({
  name: 'quiz',
  initialState,
  reducers: {
    quizStarted(
      state,
      action: PayloadAction<{
        questions: MeshId[];
        savedDissection: DissectionSnapshot;
        savedPastCount?: number;
        best: number;
      }>,
    ) {
      state.status = 'asking';
      state.questions = action.payload.questions;
      state.current = 0;
      state.attempts = 0;
      state.score = 0;
      state.lastWrong = null;
      state.savedDissection = action.payload.savedDissection;
      state.savedPastCount = action.payload.savedPastCount;
      state.best = action.payload.best;
    },
    answered(state, action: PayloadAction<MeshId>) {
      if (state.status !== 'asking') return;
      const target = state.questions[state.current];
      if (action.payload === target) {
        state.status = 'correct';
        state.score += 1;
        state.lastWrong = null;
        return;
      }
      state.attempts += 1;
      state.lastWrong = action.payload;
      state.status = state.attempts >= 3 ? 'revealed' : 'wrong';
    },
    retryAfterWrong(state) {
      if (state.status !== 'wrong') return;
      state.status = 'asking';
      state.lastWrong = null;
    },
    questionSkipped(state) {
      if (state.status !== 'asking') return;
      state.status = 'revealed';
      state.lastWrong = null;
    },
    nextQuestion(state) {
      if (state.status !== 'correct' && state.status !== 'revealed') return;
      if (state.current + 1 >= state.questions.length) {
        state.status = 'summary';
      } else {
        state.current += 1;
        state.attempts = 0;
        state.lastWrong = null;
        state.status = 'asking';
      }
    },
    bestRecorded(state, action: PayloadAction<number>) {
      state.best = Math.max(state.best, action.payload);
    },
    quizEnded(state) {
      state.status = 'off';
      state.questions = [];
      state.current = 0;
      state.attempts = 0;
      state.score = 0;
      state.lastWrong = null;
      state.savedDissection = null;
      state.savedPastCount = undefined;
    },
  },
});

export const quizReducer = quizSlice.reducer;
export const {
  quizStarted,
  answered,
  retryAfterWrong,
  questionSkipped,
  nextQuestion,
  bestRecorded,
  quizEnded,
} = quizSlice.actions;
