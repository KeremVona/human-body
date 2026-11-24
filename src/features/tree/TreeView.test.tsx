import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import type {
  IndexEntry,
  IndexFile,
  Manifest,
  Taxonomy,
} from '../../data/schema';
import * as revealModule from '../search/revealAndFocus';
import { selected } from '../selection/selectionSlice';
import { TreeView } from './TreeView';

const taxonomy: Taxonomy = {
  systems: [{ id: 'skeletal', label: 'Skeletal', color: '#E8DCC4', order: 1 }],
  regions: [
    { id: 'thorax', label: 'Thorax' },
    { id: 'lower-limb', label: 'Lower limb' },
  ],
  uiGroups: [],
};

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
};

function setupSmallStore() {
  const manifest: Manifest = {
    version: 1,
    generatedAt: '2026-11-21T00:00:00Z',
    source: {
      name: 'Z-Anatomy',
      version: '2023-05-02',
      license: 'CC-BY-SA-4.0',
    },
    bundles: [],
    meshes: {
      'femur--l': {
        bundle: 'skeletal',
        bounds,
        triangles: 10,
        sizeClass: 'large',
      },
      'femur--r': {
        bundle: 'skeletal',
        bounds,
        triangles: 10,
        sizeClass: 'large',
      },
      sternum: {
        bundle: 'skeletal',
        bounds,
        triangles: 10,
        sizeClass: 'medium',
      },
    },
  };
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
        featured: false,
      },
    ],
  };

  return makeStore({
    assets: {
      manifest,
      boot: 'ready',
      bundles: { skeletal: 'ready' },
      requested: [],
    },
    content: { taxonomy, index, structures: {} },
  });
}

function mockScrollMetrics(container: HTMLElement) {
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: 320,
  });
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: 240,
  });
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    get() {
      const child = this.firstElementChild as HTMLElement | null;
      return parseFloat(child?.style?.height || '0') || 320;
    },
  });
  container.scrollTo = ((opts?: ScrollToOptions | number, y?: number) => {
    const top =
      typeof opts === 'number' ? (y ?? 0) : (opts?.top ?? container.scrollTop);
    container.scrollTop = top;
    container.dispatchEvent(new Event('scroll'));
  }) as typeof container.scrollTo;
}

const origClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientHeight',
);
const origClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth',
);

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: 320,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: 240,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (origClientHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      'clientHeight',
      origClientHeight,
    );
  }
  if (origClientWidth) {
    Object.defineProperty(
      HTMLElement.prototype,
      'clientWidth',
      origClientWidth,
    );
  }
});

describe('TreeView', () => {
  it('keyboard navigation moves through and expands/collapses nodes', async () => {
    const user = userEvent.setup();
    const store = setupSmallStore();

    render(
      <Provider store={store}>
        <TreeView />
      </Provider>,
    );

    const skeletalItem = screen.getByRole('treeitem', { name: /Skeletal/ });
    skeletalItem.focus();

    await user.keyboard('{ArrowRight}');
    expect(skeletalItem).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowDown}');
    const thoraxItem = screen.getByRole('treeitem', { name: /Thorax/ });
    expect(thoraxItem).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('treeitem', { name: /Skeletal/ })).toHaveFocus();
  });

  it('Enter on a structure reveals it', async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(revealModule, 'revealAndFocus')
      .mockReturnValue((() => Promise.resolve()) as never);
    const store = setupSmallStore();

    render(
      <Provider store={store}>
        <TreeView />
      </Provider>,
    );

    const skeletal = screen.getByRole('treeitem', { name: /Skeletal/ });
    skeletal.focus();
    // Expand Skeletal -> Down to Thorax -> Down to Lower limb -> Right to expand Lower limb -> Down to Femur
    await user.keyboard(
      '{ArrowRight}{ArrowDown}{ArrowDown}{ArrowRight}{ArrowDown}',
    );
    const femurItem = screen.getByRole('treeitem', { name: /^Femur/ });
    expect(femurItem).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(spy).toHaveBeenCalledWith('femur', 'both');

    // Expand Femur -> Down to Left -> Enter
    await user.keyboard('{ArrowRight}{ArrowDown}');
    const leftItem = screen.getByRole('treeitem', { name: /^Left/ });
    expect(leftItem).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(spy).toHaveBeenCalledWith('femur', 'left');
  });

  it('eye button hides and shows', async () => {
    const user = userEvent.setup();
    const store = setupSmallStore();

    render(
      <Provider store={store}>
        <TreeView />
      </Provider>,
    );

    const skeletal = screen.getByRole('treeitem', { name: /Skeletal/ });
    skeletal.focus();
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowDown}{ArrowRight}');

    await user.click(screen.getByRole('button', { name: 'Hide Femur' }));
    expect(store.getState().dissection.hidden).toEqual([
      'femur--l',
      'femur--r',
    ]);

    await user.click(screen.getByRole('button', { name: 'Show Femur' }));
    expect(store.getState().dissection.hidden).toEqual([]);
  });

  it('auto-expands to the selection', () => {
    const store = setupSmallStore();
    store.dispatch(selected(['femur--l']));

    render(
      <Provider store={store}>
        <TreeView />
      </Provider>,
    );

    const leftRow = screen.getByRole('treeitem', { name: /^Left/ });
    expect(leftRow).toHaveAttribute('aria-selected', 'true');
  });

  it('End focuses the last row in a 500-row tree', async () => {
    const user = userEvent.setup();
    const structures: IndexEntry[] = Array.from({ length: 500 }, (_, i) => ({
      id: `item-${String(i).padStart(3, '0')}`,
      system: 'skeletal',
      region: 'lower-limb',
      paired: false,
      kind: 'bone',
      tissue: 'bone',
      names: {
        common: `Structure ${String(i).padStart(3, '0')}`,
        synonyms: [],
      },
      featured: false,
    }));
    const meshes = Object.fromEntries(
      structures.map((s) => [
        s.id,
        {
          bundle: 'skeletal',
          bounds,
          triangles: 10,
          sizeClass: 'small' as const,
        },
      ]),
    );
    const store = makeStore({
      assets: {
        manifest: {
          version: 1,
          generatedAt: '2026-11-21T00:00:00Z',
          source: {
            name: 'Z-Anatomy',
            version: '2023-05-02',
            license: 'CC-BY-SA-4.0',
          },
          bundles: [],
          meshes,
        },
        boot: 'ready',
        bundles: { skeletal: 'ready' },
        requested: [],
      },
      content: {
        taxonomy,
        index: { locale: 'en', structures },
        structures: {},
      },
    });

    render(
      <Provider store={store}>
        <TreeView
          initialExpanded={['sys:skeletal', 'reg:skeletal/lower-limb']}
        />
      </Provider>,
    );

    const scrollContainer =
      screen.getByRole('tree').parentElement!.parentElement!;
    mockScrollMetrics(scrollContainer);

    const first = screen.getByRole('treeitem', { name: /Skeletal/ });
    first.focus();
    await user.keyboard('{End}');

    await waitFor(() => {
      const last = screen.getByRole('treeitem', { name: /Structure 499/ });
      expect(last).toHaveFocus();
    });
  });

  it('places eye toggle outside role="treeitem" and makes it keyboard-focusable', async () => {
    const store = setupSmallStore();
    render(
      <Provider store={store}>
        <TreeView
          initialExpanded={['sys:skeletal', 'reg:skeletal/lower-limb']}
        />
      </Provider>,
    );

    const hideFemurBtn = screen.getByRole('button', { name: 'Hide Femur' });
    expect(hideFemurBtn.closest('[role="treeitem"]')).toBeNull();
    expect(hideFemurBtn).not.toHaveAttribute('tabindex', '-1');
  });

  it('allows collapsing an ancestor of the active selection', async () => {
    const user = userEvent.setup();
    const store = setupSmallStore();
    store.dispatch(selected(['femur--l']));

    render(
      <Provider store={store}>
        <TreeView />
      </Provider>,
    );

    const skeletalItem = screen.getByRole('treeitem', { name: /Skeletal/ });
    expect(skeletalItem).toHaveAttribute('aria-expanded', 'true');

    skeletalItem.focus();
    await user.keyboard('{ArrowLeft}');
    expect(skeletalItem).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: /^Left/ })).toBeNull();
  });

  it('surfaces an inline alert if revealAndFocus rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(revealModule, 'revealAndFocus').mockReturnValue((() =>
      Promise.reject(new Error('bundle failed: skeletal'))) as never);
    const store = setupSmallStore();

    render(
      <Provider store={store}>
        <TreeView
          initialExpanded={['sys:skeletal', 'reg:skeletal/lower-limb']}
        />
      </Provider>,
    );

    await user.click(screen.getByRole('treeitem', { name: /^Femur/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load the Skeletal model.",
    );
  });

  it('recomputes localized system labels when Turkish catalogue finishes loading after first render', async () => {
    const { setActiveLocale, loadMessages, __resetI18nForTests } =
      await import('../../i18n/t');
    const store = setupSmallStore();
    setActiveLocale('tr');

    render(
      <Provider store={store}>
        <TreeView />
      </Provider>,
    );

    expect(
      screen.getByRole('treeitem', { name: /Skeletal/ }),
    ).toBeInTheDocument();
    await loadMessages('tr');
    expect(
      await screen.findByRole('treeitem', { name: /İskelet/ }),
    ).toBeInTheDocument();

    __resetI18nForTests();
  });
});
