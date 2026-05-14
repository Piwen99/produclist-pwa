import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

const defaultProps = {
  isOpen: true,
  title: 'Eliminar producto',
  message: '¿Estás seguro de eliminar',
  itemName: 'Chía',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function renderDialog(props = {}) {
  return render(<ConfirmDialog {...defaultProps} {...props} />);
}

describe('ConfirmDialog', () => {
  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, message, and item name', () => {
    renderDialog();
    expect(screen.getByText('Eliminar producto')).toBeInTheDocument();
    expect(screen.getByText('¿Estás seguro de eliminar')).toBeInTheDocument();
    expect(screen.getByText('"Chía"')).toBeInTheDocument();
  });

  it('renders "acción irreversible" warning', () => {
    renderDialog();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
  });

  it('renders confirm and cancel buttons with default labels', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    renderDialog({ confirmLabel: 'Sí, borrar', cancelLabel: 'Volver' });
    expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when clicking the overlay backdrop', async () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    // Click the overlay (the outermost div with role="dialog")
    await userEvent.click(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does NOT call onCancel when clicking inside the modal', async () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    // Click the title text which is inside the modal card
    await userEvent.click(screen.getByText('Eliminar producto'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does NOT call onCancel on other keys', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter', code: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('auto-focuses the cancel button when opened', () => {
    vi.useFakeTimers();
    renderDialog();
    // The component uses requestAnimationFrame to delay focus
    vi.advanceTimersToNextTimer();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    vi.useRealTimers();
  });
});
