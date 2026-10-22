import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallPrompt } from '../InstallPrompt';

const DISMISS_KEY = 'produclist:installPromptDismissed';

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function fireInstallPrompt() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });

  act(() => {
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(false);
});

afterEach(() => {
  localStorage.clear();
});

describe('InstallPrompt', () => {
  it('renders nothing until the browser fires beforeinstallprompt', () => {
    render(<InstallPrompt />);

    expect(screen.queryByText('Instalar Produclist')).not.toBeInTheDocument();
  });

  it('shows the banner when the browser offers the install prompt', () => {
    render(<InstallPrompt />);
    fireInstallPrompt();

    expect(screen.getByText('Instalar Produclist')).toBeInTheDocument();
  });

  it('persists a dismissal so the banner does not come back (issue #97)', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);
    fireInstallPrompt();

    await user.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByText('Instalar Produclist')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('honours a previous dismissal on the next launch (issue #97)', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    render(<InstallPrompt />);

    fireInstallPrompt();

    expect(screen.queryByText('Instalar Produclist')).not.toBeInTheDocument();
  });

  it('does not offer the banner in standalone mode', () => {
    stubMatchMedia(true);
    render(<InstallPrompt />);

    fireInstallPrompt();

    expect(screen.queryByText('Instalar Produclist')).not.toBeInTheDocument();
  });

  it('does not crash when storage access is blocked (issue #97)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    try {
      expect(() => {
        render(<InstallPrompt />);
        fireInstallPrompt();
      }).not.toThrow();
      // The preference cannot be read, so the banner is offered again for this
      // session instead of the app breaking.
      expect(screen.getByText('Instalar Produclist')).toBeInTheDocument();
    } finally {
      getItem.mockRestore();
    }
  });
});
