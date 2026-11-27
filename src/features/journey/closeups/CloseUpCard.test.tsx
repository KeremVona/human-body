import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setActiveLocale } from '../../../i18n/t';
import { CloseUpCard } from './CloseUpCard';

afterEach(() => {
  cleanup();
  setActiveLocale('en');
});

describe('CloseUpCard', () => {
  it.each([
    [
      'capillary',
      'Diagram of a capillary: red blood cells give oxygen to body cells and take up carbon dioxide.',
      'Oxygen out, carbon dioxide in',
    ],
    [
      'lung-capillary',
      'Diagram of a lung capillary against an air sac: oxygen enters the blood and carbon dioxide leaves it.',
      'Oxygen in, carbon dioxide out',
    ],
    [
      'alveolus',
      'Diagram of a cluster of air sacs wrapped in capillaries, with oxygen crossing into the blood and carbon dioxide crossing into the air.',
      'Gas swap across a wall thinner than a cell',
    ],
  ] as const)(
    'renders %s close-up with label, accessible SVG, and caption',
    (id, ariaLabel, caption) => {
      render(<CloseUpCard id={id} />);

      expect(screen.getByText('Close-up (not to scale)')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: ariaLabel })).toBeInTheDocument();
      expect(screen.getByText(caption)).toBeInTheDocument();
    },
  );

  it('starts collapsed on mobile (<640px) and toggles details on click', async () => {
    const prevWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
    const user = userEvent.setup();

    render(<CloseUpCard id="capillary" />);

    try {
      const toggle = screen.getByRole('button', { name: 'More details' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('img')).not.toBeInTheDocument();

      await user.click(toggle);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByText('Oxygen out, carbon dioxide in')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: prevWidth,
      });
    }
  });
});
