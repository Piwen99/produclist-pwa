import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListSendForm } from '../ListSendForm';

describe('ListSendForm', () => {
  it('disables save until a client name is typed', async () => {
    render(<ListSendForm productCount={3} clients={[]} onSave={vi.fn()} onCancel={vi.fn()} />);

    const save = screen.getByRole('button', { name: /^guardar$/i });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/cliente/i), 'Juan');
    expect(save).toBeEnabled();
  });

  it('saves the trimmed client name', async () => {
    const onSave = vi.fn();
    render(
      <ListSendForm productCount={3} clients={['Juan']} onSave={onSave} onCancel={vi.fn()} />
    );

    await userEvent.type(screen.getByLabelText(/cliente/i), '  Ana  ');
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(onSave).toHaveBeenCalledWith('Ana');
  });

  it('cannot save without products', () => {
    render(<ListSendForm productCount={0} clients={[]} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^guardar$/i })).toBeDisabled();
  });

  it('cancels', async () => {
    const onCancel = vi.fn();
    render(<ListSendForm productCount={3} clients={[]} onSave={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
