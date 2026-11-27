import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setActiveLocale } from '../../i18n/t';
import { NutrientsBox } from './NutrientsBox';

afterEach(() => {
  cleanup();
  setActiveLocale('en');
});

describe('NutrientsBox', () => {
  it('displays macro breakdown + absorbed percentages, water, and toggles open/closed', async () => {
    const user = userEvent.setup();
    render(
      <NutrientsBox
        nutrients={{ carbs: 60, protein: 50, fat: 40, water: 10, absorbed: 15 }}
      />,
    );

    expect(screen.getByText("What's been digested")).toBeInTheDocument();
    expect(screen.getByText('60% broken down, 15% absorbed')).toBeInTheDocument();
    expect(screen.getByText('50% broken down, 15% absorbed')).toBeInTheDocument();
    expect(screen.getByText('40% broken down, 15% absorbed')).toBeInTheDocument();
    expect(screen.getByText('10% absorbed')).toBeInTheDocument();
    expect(screen.getByText('Rounded teaching values')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: "What's been digested" });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Rounded teaching values')).not.toBeInTheDocument();
  });
});
