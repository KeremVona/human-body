import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('AboutDialog and TopBar', () => {
  it('opens from the top bar', async () => {
    const user = userEvent.setup();
    render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));

    expect(
      screen.getByRole('dialog', { name: 'About Anatomy Atlas' }),
    ).toBeInTheDocument();
  });

  it('shows the disclaimer', async () => {
    const user = userEvent.setup();
    render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));

    const dialog = screen.getByRole('dialog', { name: 'About Anatomy Atlas' });
    expect(dialog).toHaveTextContent(
      'This atlas is for learning and curiosity. It is not medical advice.',
    );
  });

  it('credits the models and content', async () => {
    const user = userEvent.setup();
    render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));

    const dialog = screen.getByRole('dialog', { name: 'About Anatomy Atlas' });
    expect(
      within(dialog).getByRole('link', { name: 'Z-Anatomy' }),
    ).toHaveAttribute('href', 'https://github.com/LluisV/Z-Anatomy');
    expect(
      within(dialog).getByRole('link', { name: 'Wikipedia' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', { name: 'OpenStax' }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent('CC-BY-SA 4.0');
    expect(dialog).toHaveTextContent('MIT');
  });

  it('lists shortcuts', async () => {
    const user = userEvent.setup();
    render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));

    const dialog = screen.getByRole('dialog', { name: 'About Anatomy Atlas' });
    const rows = within(dialog).getAllByRole('row');
    const undoRow = rows.find(
      (row) =>
        row.textContent?.includes('Ctrl/Cmd+Z') &&
        row.textContent?.includes('Undo'),
    );
    expect(undoRow).toBeDefined();
  });

  it('hides the repo link when no URL is configured', async () => {
    const user = userEvent.setup();
    vi.stubEnv('VITE_REPO_URL', '');
    const first = render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));
    expect(
      screen.queryByRole('link', { name: 'Source code on GitHub' }),
    ).not.toBeInTheDocument();

    first.unmount();
    vi.stubEnv('VITE_REPO_URL', 'https://github.com/x/y');
    render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));
    expect(
      screen.getByRole('link', { name: 'Source code on GitHub' }),
    ).toHaveAttribute('href', 'https://github.com/x/y');
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    render(<TopBar />);

    const trigger = screen.getByRole('button', { name: 'About this atlas' });
    await user.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'About Anatomy Atlas' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'About Anatomy Atlas' }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('discloses machine-assisted translation status in Credits', async () => {
    const user = userEvent.setup();
    render(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'About this atlas' }));

    const dialog = screen.getByRole('dialog', { name: 'About Anatomy Atlas' });
    expect(dialog).toHaveTextContent(
      'Translations are machine-assisted drafts.',
    );
  });
});
