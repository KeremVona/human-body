import type { AppStore, AppThunk } from '../../app/store';
import { parseTourHash } from '../tours/tourHash';
import { tourNoticeSet } from '../tours/tourSlice';
import type { DecodeResult, KnownAtlasIds } from './codec';
import { noticeShown } from './shareSlice';
import type { ViewStateV1 } from './viewState';

export type ShareCodecLoader = () => Promise<{
  decodeViewState: (
    hash: string,
    known: KnownAtlasIds,
  ) => Promise<DecodeResult>;
}>;

export type ShareThunksLoader = () => Promise<{
  applyViewState: (view: ViewStateV1) => AppThunk<Promise<void>>;
}>;

export type ToursLoader = () => Promise<{
  loadTours: () => AppThunk<Promise<void>>;
  startTour: (
    id: string,
    stepIndex?: number,
  ) => AppThunk<Promise<'started' | 'refused' | 'not-found'>>;
}>;

/** Lazy-imports share codec or tours thunks only when URL hash matches `#v<N>.` or `#tour/`. */
export async function bootShare(
  store: AppStore,
  options?: {
    hash?: string;
    loadCodec?: ShareCodecLoader;
    loadThunks?: ShareThunksLoader;
    loadTours?: ToursLoader;
  },
): Promise<void> {
  const hash =
    options?.hash ??
    (typeof window !== 'undefined' ? window.location.hash : '');

  const state = store.getState();
  const manifest = state.assets.manifest;
  const taxonomy = state.content.taxonomy;
  if (!manifest || !taxonomy) {
    return;
  }

  if (hash.startsWith('#tour/')) {
    const parsed = parseTourHash(hash);
    if (!parsed) {
      store.dispatch(tourNoticeSet('not-found'));
      return;
    }
    const loadToursMod = options?.loadTours ?? (() => import('../tours/thunks'));
    const { loadTours, startTour } = await loadToursMod();
    await store.dispatch(loadTours());
    await store.dispatch(startTour(parsed.id, parsed.step));
    return;
  }

  if (!/^#v\d+\./.test(hash)) {
    return;
  }

  const loadCodec = options?.loadCodec ?? (() => import('./codec'));
  const { decodeViewState } = await loadCodec();
  const result = await decodeViewState(hash, {
    meshIds: new Set(Object.keys(manifest.meshes)),
    systems: new Set(taxonomy.systems.map((s) => s.id)),
  });

  if (!result.ok) {
    store.dispatch(noticeShown(result.reason));
    return;
  }

  const loadThunks = options?.loadThunks ?? (() => import('./thunks'));
  const { applyViewState } = await loadThunks();
  await store.dispatch(applyViewState(result.view));

  if (result.dropped > 0) {
    store.dispatch(noticeShown('skipped'));
  }
}
