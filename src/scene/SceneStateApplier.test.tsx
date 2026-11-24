import { act, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { BufferGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../content/taxonomy.json';
import { makeStore } from '../app/store';
import { TaxonomySchema, type IndexFile } from '../data/schema';
import { qualitySet } from '../features/settings/uiSlice';
import { opacitySet, systemToggled } from '../features/systems/systemsSlice';
import { createMeshRegistry, MeshRegistryProvider } from './meshRegistry';
import { SceneStateApplier } from './SceneStateApplier';

const mockInvalidate = vi.fn();

vi.mock('@react-three/fiber', async () => {
  const actual =
    await vi.importActual<typeof import('@react-three/fiber')>(
      '@react-three/fiber',
    );
  return {
    ...actual,
    useThree: (selector: (s: { invalidate: () => void }) => unknown) =>
      selector({ invalidate: mockInvalidate }),
  };
});

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const index: IndexFile = {
  locale: 'en',
  structures: [
    {
      id: 'biceps-brachii',
      system: 'muscular',
      region: 'upper-limb',
      paired: true,
      kind: 'muscle',
      tissue: 'muscle',
      names: { common: 'Biceps brachii', synonyms: [] },
      featured: false,
    },
  ],
};

describe('SceneStateApplier', () => {
  it('re-applies quality and system opacity on the recreated library after StrictMode remount', async () => {
    const store = makeStore({
      content: { taxonomy, index, structures: {} },
    });
    store.dispatch(systemToggled('muscular'));
    store.dispatch(opacitySet({ systems: ['muscular'], opacity: 0.4 }));
    store.dispatch(qualitySet('low'));

    const registry = createMeshRegistry();
    const mesh = new Mesh(new BufferGeometry());

    render(
      <StrictMode>
        <Provider store={store}>
          <MeshRegistryProvider registry={registry}>
            <SceneStateApplier />
          </MeshRegistryProvider>
        </Provider>
      </StrictMode>,
    );

    act(() => {
      registry.register('biceps-brachii--l', mesh);
    });

    await waitFor(() => {
      const mat = mesh.material as MeshPhysicalMaterial;
      expect(mat).toBeInstanceOf(MeshPhysicalMaterial);
      expect(mat.opacity).toBe(0.4);
      expect(mat.transparent).toBe(true);
      expect(mat.sheen).toBe(0);
    });
  });
});
