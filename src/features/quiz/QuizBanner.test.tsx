import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore } from '../../app/store';
import { TaxonomySchema, type IndexFile } from '../../data/schema';
import { CameraApiProvider, type CameraApi } from '../../scene/camera';
import { Inspector } from '../inspector/Inspector';
import { HoverLabel } from '../selection/HoverLabel';
import { hovered, selected } from '../selection/selectionSlice';
import { QuizBanner } from './QuizBanner';
import { QuizSummary } from './QuizSummary';
import {
  answered,
  nextQuestion,
  quizStarted,
  retryAfterWrong,
} from './quizSlice';
import * as thunks from './thunks';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const index: IndexFile = {
  locale: 'en',
  structures: [
    {
      id: 'femur',
      system: 'skeletal',
      region: 'lower-limb',
      paired: true,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Femur', synonyms: [] },
      featured: true,
    },
    {
      id: 'sternum',
      system: 'skeletal',
      region: 'thorax',
      paired: false,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Sternum', synonyms: [] },
      featured: true,
    },
  ],
};

const fakeCamera: CameraApi = {
  focusMeshes: vi.fn(async () => {}),
  goToPreset: vi.fn(async () => {}),
  resetView: vi.fn(async () => {}),
  zoom: vi.fn(),
  getPose: vi.fn(() => null),
  setPose: vi.fn(async () => {}),
};

function setupQuizStore() {
  const store = makeStore({
    content: { taxonomy, index, structures: {} },
  });
  store.dispatch(
    quizStarted({
      questions: ['femur--l', 'sternum'],
      savedDissection: { hidden: [], isolated: null, faded: null },
      best: 2,
    }),
  );
  return store;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('QuizBanner, QuizSummary, and quiz-mode suppression', () => {
  it('shows question prompt, progress, and score while asking', () => {
    const store = setupQuizStore();
    render(
      <Provider store={store}>
        <CameraApiProvider value={fakeCamera}>
          <QuizBanner />
        </CameraApiProvider>
      </Provider>,
    );

    expect(screen.getByText('Find: Femur (left)')).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Score 0')).toBeInTheDocument();
  });

  it('shows wrong feedback with unpaired structure name', () => {
    const store = setupQuizStore();
    store.dispatch(answered('sternum'));

    render(
      <Provider store={store}>
        <CameraApiProvider value={fakeCamera}>
          <QuizBanner />
        </CameraApiProvider>
      </Provider>,
    );

    expect(screen.getByText("That's the Sternum.")).toBeInTheDocument();
  });

  it('shows summary score and best', () => {
    const store = setupQuizStore();
    store.dispatch(answered('femur--l'));
    store.dispatch(nextQuestion());
    store.dispatch(answered('femur--l'));
    store.dispatch(retryAfterWrong());
    store.dispatch(answered('femur--l'));
    store.dispatch(retryAfterWrong());
    store.dispatch(answered('femur--l'));
    store.dispatch(nextQuestion());

    render(
      <Provider store={store}>
        <CameraApiProvider value={fakeCamera}>
          <QuizSummary />
        </CameraApiProvider>
      </Provider>,
    );

    expect(screen.getByText('You found 1 of 2.')).toBeInTheDocument();
    expect(screen.getByText('Best: 2')).toBeInTheDocument();
  });

  it('clicking End quiz dispatches endQuiz', async () => {
    const user = userEvent.setup();
    const store = setupQuizStore();
    const spy = vi.spyOn(thunks, 'endQuiz');

    render(
      <Provider store={store}>
        <CameraApiProvider value={fakeCamera}>
          <QuizBanner />
        </CameraApiProvider>
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'End quiz' }));
    expect(spy).toHaveBeenCalled();
  });

  it('hides Inspector and HoverLabel while the quiz is active', () => {
    const store = setupQuizStore();
    store.dispatch(selected(['femur--l']));
    store.dispatch(hovered('femur--l'));

    render(
      <Provider store={store}>
        <CameraApiProvider value={fakeCamera}>
          <Inspector />
          <HoverLabel />
        </CameraApiProvider>
      </Provider>,
    );

    expect(
      screen.queryByRole('complementary', { name: 'Structure details' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Femur/)).not.toBeInTheDocument();
  });
});
