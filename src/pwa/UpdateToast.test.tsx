import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateToast } from './UpdateToast';

describe('UpdateToast', () => {
  it('renders nothing when no update callback is queued', () => {
    const { container } = render(<UpdateToast onReload={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows update prompt and triggers onReload when Reload is clicked', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn(async () => {});
    render(<UpdateToast onReload={onReload} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('New version ready')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Reload' });
    await user.click(button);

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
});
