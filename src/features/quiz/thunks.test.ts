import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore, type CameraRef } from '../../app/store';
import {
  TaxonomySchema,
  type IndexEntry,
  type IndexFile,
  type Manifest,
} from '../../data/schema';
import { hide, isolate, reveal } from '../dissection/dissectionSlice';
import { hovered } from '../selection/selectionSlice';
import { opacitySet, systemToggled } from '../systems/systemsSlice';
import { emptyPoolDismissed } from './quizSlice';
import { endQuiz, startQuiz } from './thunks';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
};

function setupTestStore(count = 4) {
  const structures: IndexEntry[] = Array.from({ length: count }, (_, i) => ({
    id: `bone-${i}`,
    system: 'skeletal',
    region: 'lower-limb',
    paired: false,
    kind: 'bone',
    tissue: 'bone',
    names: { common: `Bone ${i}`, synonyms: [] },
    featured: true,
  }));

  const manifest: Manifest = {
    version: 1,
    generatedAt: '2026-11-21T00:00:00Z',
    source: {
      name: 'Z-Anatomy',
      version: '2023-05-02',
      license: 'CC-BY-SA-4.0',
    },
    bundles: [],
    meshes: Object.fromEntries(
      structures.map((s) => [
        s.id,
        {
          bundle: 'skeletal',
          bounds,
          triangles: 10,
          sizeClass: 'large' as const,
        },
      ]),
    ),
  };

  const index: IndexFile = { locale: 'en', structures };

  const camera: CameraRef = {
    current: {
      focusMeshes: vi.fn(async () => {}),
      goToPreset: vi.fn(async () => {}),
      resetView: vi.fn(async () => {}),
      zoom: vi.fn(),
      getPose: vi.fn(() => null),
      setPose: vi.fn(async () => {}),
      lookAtPoint: vi.fn(async () => {}),
    },
  };

  return makeStore(
    {
      assets: {
        manifest,
        boot: 'ready',
        bundles: { skeletal: 'ready' },
        requested: [],
      },
      content: { taxonomy, index, structures: {} },
    },
    { camera },
  );
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('quiz thunks', () => {
  it('startQuiz returns empty-pool when nothing qualifies', () => {
    const store = setupTestStore(4);
    store.dispatch(systemToggled('skeletal'));

    const res = store.dispatch(startQuiz(1));
    expect(res).toBe('empty-pool');
    expect(store.getState().quiz.status).toBe('off');
  });

  it('startQuiz runs a shorter round for a small pool', () => {
    const store = setupTestStore(4);

    const res = store.dispatch(startQuiz(7));
    expect(res).toBe('started');
    expect(store.getState().quiz.questions).toHaveLength(4);
    expect(store.getState().quiz.status).toBe('asking');
  });

  it('endQuiz restores dissection and selection', () => {
    const store = setupTestStore(4);
    store.dispatch(hide(['bone-0']));
    const pastBefore = store.getState().dissection.past.length;

    store.dispatch(startQuiz(7));
    store.dispatch(reveal(['bone-0']));
    expect(store.getState().dissection.hidden).toEqual([]);

    store.dispatch(endQuiz());
    expect(store.getState().dissection.hidden).toEqual(['bone-0']);
    expect(store.getState().selection.selectedIds).toEqual([]);
    expect(store.getState().quiz.status).toBe('off');
    expect(store.getState().dissection.past).toHaveLength(pastBefore);
  });

  it('best score survives a throwing localStorage', () => {
    const store = setupTestStore(4);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(store.dispatch(startQuiz(3))).toBe('started');
    store.dispatch({
      type: 'quiz/answered',
      payload: store.getState().quiz.questions[0],
    });
    expect(() => store.dispatch(endQuiz())).not.toThrow();
    expect(store.getState().quiz.best).toBe(1);
  });

  it('startQuiz clears hover and excludes unready bundles, low-opacity systems, hidden/isolated meshes, and sets emptyPoolAlert', () => {
    const store = setupTestStore(4);
    store.dispatch(hovered('bone-0'));
    store.dispatch(opacitySet({ systems: ['skeletal'], opacity: 0.4 }));

    expect(store.dispatch(startQuiz(2))).toBe('empty-pool');
    expect(store.getState().quiz.emptyPoolAlert).toBe(true);
    store.dispatch(emptyPoolDismissed());
    expect(store.getState().quiz.emptyPoolAlert).toBe(false);

    store.dispatch(opacitySet({ systems: ['skeletal'], opacity: 1 }));
    store.dispatch(hide(['bone-0', 'bone-1']));
    store.dispatch(isolate(['bone-2']));

    expect(store.dispatch(startQuiz(2))).toBe('started');
    expect(store.getState().selection.hoveredId).toBeNull();
    expect(store.getState().quiz.questions).toEqual(['bone-2']);
  });

  it('endQuiz preserves full 50-entry pre-quiz history after quiz reveals', () => {
    const store = setupTestStore(4);
    for (let i = 0; i < 50; i++) {
      store.dispatch(i % 2 === 0 ? hide(['bone-0']) : reveal(['bone-0']));
    }
    expect(store.getState().dissection.past).toHaveLength(50);
    const pastSnapshotBefore = [...store.getState().dissection.past];

    store.dispatch(startQuiz(1));
    store.dispatch(reveal(['bone-0']));
    store.dispatch(endQuiz());

    expect(store.getState().dissection.past).toEqual(pastSnapshotBefore);
  });
});
