import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore } from '../../app/store';
import { TaxonomySchema, type IndexFile } from '../../data/schema';
import * as revealModule from './revealAndFocus';
import { SearchBox } from './SearchBox';

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
      names: { common: 'Femur', latin: 'Femur', synonyms: ['thigh bone'] },
      featured: true,
    },
    {
      id: 'biceps-brachii',
      system: 'muscular',
      region: 'upper-limb',
      paired: true,
      kind: 'muscle',
      tissue: 'muscle',
      names: {
        common: 'Biceps brachii',
        latin: 'Musculus biceps brachii',
        synonyms: [],
      },
      featured: true,
    },
  ],
};

function setupStore() {
  return makeStore({
    content: { taxonomy, index, structures: {} },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SearchBox', () => {
  it('filters hits and dispatches revealAndFocus on ArrowDown + Enter', async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(revealModule, 'revealAndFocus')
      .mockReturnValue((() => Promise.resolve()) as never);
    const store = setupStore();

    render(
      <Provider store={store}>
        <SearchBox />
      </Provider>,
    );

    const input = screen.getByRole('combobox', { name: 'Search structures' });
    await user.type(input, 'thi');

    expect(screen.getByRole('option', { name: /Femur/ })).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Enter}');

    expect(spy).toHaveBeenCalledWith('femur', 'both');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clears the input with Escape', async () => {
    const user = userEvent.setup();
    const store = setupStore();

    render(
      <Provider store={store}>
        <SearchBox />
      </Provider>,
    );

    const input = screen.getByRole('combobox', { name: 'Search structures' });
    await user.type(input, 'fem');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows an alert when revealAndFocus rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(revealModule, 'revealAndFocus').mockReturnValue((() =>
      Promise.reject(new Error('bundle failed: muscular'))) as never);
    const store = setupStore();

    render(
      <Provider store={store}>
        <SearchBox />
      </Provider>,
    );

    const input = screen.getByRole('combobox', { name: 'Search structures' });
    await user.type(input, 'bic');
    await user.click(screen.getByRole('option', { name: /Biceps brachii/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load Muscular.",
    );
  });

  it('shows No matches when query finds nothing', async () => {
    const user = userEvent.setup();
    const store = setupStore();

    render(
      <Provider store={store}>
        <SearchBox />
      </Provider>,
    );

    await user.type(
      screen.getByRole('combobox', { name: 'Search structures' }),
      'zzz',
    );

    expect(
      screen.getByRole('option', { name: 'No matches' }),
    ).toBeInTheDocument();
  });
});
