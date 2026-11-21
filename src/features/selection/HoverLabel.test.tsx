import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { bootstrap } from '../content/contentSlice';
import { pointerPosition } from '../../scene/pointerPosition';
import { hovered } from './selectionSlice';
import { HoverLabel } from './HoverLabel';

function renderWithStore(hoveredId: string | null) {
  const store = makeStore();
  store.dispatch(
    bootstrap.fulfilled(
      {
        manifest: {
          version: 1,
          generatedAt: '2026-11-21T00:00:00Z',
          source: { name: 'Z-Anatomy', version: '1', license: 'CC-BY-SA-4.0' },
          bundles: [],
          meshes: {},
        },
        taxonomy: { systems: [], regions: [], uiGroups: [] },
        index: {
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
              featured: false,
            },
            {
              id: 'sternum',
              system: 'skeletal',
              region: 'thorax',
              paired: false,
              kind: 'bone',
              tissue: 'bone',
              names: { common: 'Sternum', synonyms: [] },
              featured: false,
            },
          ],
        },
      },
      'req-1',
      undefined,
    ),
  );
  store.dispatch(hovered(hoveredId));
  return render(
    <Provider store={store}>
      <HoverLabel />
    </Provider>,
  );
}

describe('HoverLabel', () => {
  it('shows common name and side at offset (12, 16) when hovered', () => {
    pointerPosition.set(100, 50);
    renderWithStore('femur--l');

    const label = screen.getByText('Femur (left)');
    expect(label).toBeInTheDocument();
    expect(label).toHaveStyle({ left: '112px', top: '66px' });

    act(() => {
      pointerPosition.set(200, 80);
    });
    expect(label).toHaveStyle({ left: '212px', top: '96px' });
  });

  it('omits side for unpaired center structures', () => {
    pointerPosition.set(10, 20);
    renderWithStore('sternum');
    expect(screen.getByText('Sternum')).toBeInTheDocument();
  });

  it('renders nothing when hoveredId is null', () => {
    const { container } = renderWithStore(null);
    expect(container).toBeEmptyDOMElement();
  });
});
