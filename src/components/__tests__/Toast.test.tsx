import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../Toast';
import type { ToastItem } from '../useToast';

describe('Toast', () => {
  const mockToast: ToastItem = {
    id: '1',
    message: 'Test message',
    type: 'success',
  };

  describe('rendering', () => {
    it('should render the message text', () => {
      render(<Toast toast={mockToast} onDismiss={vi.fn()} />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render a close button', () => {
      render(<Toast toast={mockToast} onDismiss={vi.fn()} />);
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('type styles', () => {
    it('should apply success styling (green bg)', () => {
      const { container } = render(
        <Toast toast={{ ...mockToast, type: 'success' }} onDismiss={vi.fn()} />
      );
      const toastElement = container.querySelector('[class*="bg-"]');
      expect(toastElement?.className).toMatch(/green/i);
    });

    it('should apply error styling (red bg)', () => {
      const { container } = render(
        <Toast toast={{ ...mockToast, type: 'error' }} onDismiss={vi.fn()} />
      );
      const toastElement = container.querySelector('[class*="bg-"]');
      expect(toastElement?.className).toMatch(/red/i);
    });

    it('should apply info styling (blue bg)', () => {
      const { container } = render(
        <Toast toast={{ ...mockToast, type: 'info' }} onDismiss={vi.fn()} />
      );
      const toastElement = container.querySelector('[class*="bg-"]');
      expect(toastElement?.className).toMatch(/blue/i);
    });

    it('should apply warning styling (amber bg)', () => {
      const { container } = render(
        <Toast toast={{ ...mockToast, type: 'warning' }} onDismiss={vi.fn()} />
      );
      const toastElement = container.querySelector('[class*="bg-"]');
      expect(toastElement?.className).toMatch(/amber/i);
    });
  });

  describe('close button behavior', () => {
    it('should call onDismiss with toast id when close button is clicked', () => {
      const mockDismiss = vi.fn();
      render(<Toast toast={mockToast} onDismiss={mockDismiss} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.click();

      expect(mockDismiss).toHaveBeenCalledWith('1');
    });
  });

  describe('animations', () => {
    it('should have animation classes for enter/exit', () => {
      const { container } = render(
        <Toast toast={mockToast} onDismiss={vi.fn()} />
      );
      const toastElement = container.querySelector('[class*="animate-"]');
      expect(toastElement).toBeInTheDocument();
    });
  });
});