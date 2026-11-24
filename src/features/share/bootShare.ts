import type { AppStore, AppThunk } from '../../app/store';
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

/** Lazy-imports codec and thunks only when URL hash starts with `#v<N>.`. */
export async function bootShare(
  store: AppStore,
  options?: {
    hash?: string;
    loadCodec?: ShareCodecLoader;
    loadThunks?: ShareThunksLoader;
  },
): Promise<void> {
  const hash =
    options?.hash ??
    (typeof window !== 'undefined' ? window.location.hash : '');
  if (!/^#v\d+\./.test(hash)) {
    return;
  }

  const state = store.getState();
  const manifest = state.assets.manifest;
  const taxonomy = state.content.taxonomy;
  if (!manifest || !taxonomy) {
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
