import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstRunHint } from './FirstRunHint';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('FirstRunHint', () => {
  it('shows the hint and dismisses with Got it writing localStorage', async () => {
    const user = userEvent.setup();
    render(<FirstRunHint />);

    expect(
      screen.getByText('Drag to rotate · Scroll to zoom · Click any part'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(
      screen.queryByText('Drag to rotate · Scroll to zoom · Click any part'),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem('atlas.hintDismissed')).toBe('1');
  });

  it('stays hidden when atlas.hintDismissed is already 1', () => {
    localStorage.setItem('atlas.hintDismissed', '1');
    const { container } = render(<FirstRunHint />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still renders when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    render(<FirstRunHint />);
    expect(
      screen.getByText('Drag to rotate · Scroll to zoom · Click any part'),
    ).toBeInTheDocument();
  });
});
