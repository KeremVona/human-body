import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { __resetI18nForTests } from '../../i18n/t';
import { SettingsMenu } from './SettingsMenu';
import { localeSet } from './uiSlice';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.lang = 'en';
  __resetI18nForTests();
});

describe('SettingsMenu language selector', () => {
  it('switches locale between English and Türkçe, updates html[lang], and persists to localStorage', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(
      <Provider store={store}>
        <SettingsMenu />
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const languageGroup = screen.getByRole('radiogroup', { name: 'Language' });
    expect(languageGroup).toBeInTheDocument();

    const trOption = screen.getByRole('radio', { name: 'Türkçe' });
    await user.click(trOption);

    expect(store.getState().ui.locale).toBe('tr');
    expect(document.documentElement.lang).toBe('tr');
    expect(localStorage.getItem('atlas.locale')).toBe('tr');
    expect(await screen.findByText('Dil')).toBeInTheDocument();
    expect(screen.getByText('Grafik kalitesi')).toBeInTheDocument();

    store.dispatch(localeSet('en'));
  });
});
