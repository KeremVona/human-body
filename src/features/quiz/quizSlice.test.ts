import { describe, expect, it } from 'vitest';
import {
  answered,
  nextQuestion,
  quizEnded,
  quizReducer,
  quizStarted,
  retryAfterWrong,
  type QuizState,
} from './quizSlice';

const baseAsking: QuizState = quizReducer(
  undefined,
  quizStarted({
    questions: ['femur--l', 'sternum'],
    savedDissection: { hidden: [], isolated: null, faded: null },
    best: 0,
  }),
);

describe('quizSlice transitions', () => {
  it('transitions from asking to correct and increments score', () => {
    const next = quizReducer(baseAsking, answered('femur--l'));
    expect(next.status).toBe('correct');
    expect(next.score).toBe(1);
  });

  it('transitions from asking to wrong with attempts and lastWrong', () => {
    const next = quizReducer(baseAsking, answered('sternum'));
    expect(next.status).toBe('wrong');
    expect(next.attempts).toBe(1);
    expect(next.lastWrong).toBe('sternum');

    const retried = quizReducer(next, retryAfterWrong());
    expect(retried.status).toBe('asking');
  });

  it('reveals on the third wrong attempt without changing score', () => {
    const at2: QuizState = { ...baseAsking, attempts: 2 };
    const next = quizReducer(at2, answered('sternum'));
    expect(next.status).toBe('revealed');
    expect(next.attempts).toBe(3);
    expect(next.score).toBe(0);
  });

  it('advances to next question or summary', () => {
    const correct0 = quizReducer(baseAsking, answered('femur--l'));
    const q1 = quizReducer(correct0, nextQuestion());
    expect(q1.status).toBe('asking');
    expect(q1.current).toBe(1);
    expect(q1.attempts).toBe(0);

    const correct1 = quizReducer(q1, answered('sternum'));
    const done = quizReducer(correct1, nextQuestion());
    expect(done.status).toBe('summary');
  });

  it('resets to off on quizEnded and preserves best', () => {
    const summary: QuizState = {
      ...baseAsking,
      status: 'summary',
      score: 2,
      best: 3,
    };
    const off = quizReducer(summary, quizEnded());
    expect(off.status).toBe('off');
    expect(off.best).toBe(3);
  });
});
