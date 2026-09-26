import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

  it('exposes dialog semantics with the title as accessible name', () => {
    render(<ListSendForm productCount={3} clients={[]} onSave={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Guardar lista enviada' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'list-send-title');
  });

  it('focuses the client input and closes on Escape', async () => {
    const onCancel = vi.fn();
    render(<ListSendForm productCount={3} clients={[]} onSave={vi.fn()} onCancel={onCancel} />);

    await waitFor(() => expect(screen.getByLabelText(/cliente/i)).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('returns focus to the trigger when unmounted', async () => {
    const user = userEvent.setup();

    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          {open && (
            <ListSendForm
              productCount={3}
              clients={[]}
              onSave={vi.fn()}
              onCancel={() => setOpen(false)}
            />
          )}
        </>
      );
    }

    render(<Wrapper />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText(/cliente/i)).toHaveFocus());

    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
