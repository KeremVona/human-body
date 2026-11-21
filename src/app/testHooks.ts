import type { MeshId } from '../data/ids';
import type { MeshRegistry } from '../scene/meshRegistry';

export type AtlasTestApi = {
  meshCount(): number;
  meshIds(): MeshId[];
  readonly ready: boolean;
};

/** Exposes dev/e2e inspection hooks on `window.__atlas`; stripped from production builds. */
export function installTestHooks(api: {
  registry: MeshRegistry;
  isReady(): boolean;
}): void {
  if (!import.meta.env.DEV) return;
  const target = window as unknown as { __atlas?: AtlasTestApi };
  target.__atlas = {
    meshCount: () => api.registry.size,
    meshIds: () => api.registry.ids(),
    get ready(): boolean {
      return api.isReady();
    },
  };
}
