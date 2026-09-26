import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { useModalA11y } from '../useModalA11y';

interface HarnessProps {
  onClose?: () => void;
  useInitialRef?: boolean;
}

function Harness({ onClose = () => {}, useInitialRef = false }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const preferredRef = useRef<HTMLButtonElement>(null);
  const { containerRef } = useModalA11y<HTMLDivElement>({
    active: open,
    onClose: () => {
      onClose();
      setOpen(false);
    },
    initialFocusRef: useInitialRef ? preferredRef : undefined,
  });

  return (
    <div>
      <button onClick={() => setOpen(true)}>Open modal</button>
      {open && (
        <div ref={containerRef}>
          <button>First</button>
          {useInitialRef && <button ref={preferredRef}>Preferred</button>}
          <button>Last</button>
        </div>
      )}
    </div>
  );
}

async function openModal() {
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open modal' }));
  return user;
}

describe('useModalA11y', () => {
  it('focuses the first focusable element by default', async () => {
    await openModal();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    );
  });

  it('focuses initialFocusRef when provided', async () => {
    render(<Harness useInitialRef />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Preferred' })).toHaveFocus()
    );
  });

  it('wraps Tab from the last element back to the first', async () => {
    const user = await openModal();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    );

    screen.getByRole('button', { name: 'Last' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first element back to the last', async () => {
    const user = await openModal();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    );

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'First' })).not.toBeInTheDocument();
  });

  it('ignores keys other than Escape and Tab', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    await user.keyboard('{Enter}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
  });

  it('restores focus to the trigger when the modal closes', async () => {
    render(<Harness />);

    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Open modal' });
    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    );

    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('restores focus to the trigger when the modal unmounts', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'External trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    function MountedModal() {
      const { containerRef } = useModalA11y<HTMLDivElement>({
        active: true,
        onClose: () => {},
      });
      return (
        <div ref={containerRef}>
          <button>Inside</button>
        </div>
      );
    }

    const { unmount } = render(<MountedModal />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus()
    );

    unmount();

    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('keeps focus on the container when it has no focusable children', async () => {
    function EmptyHarness() {
      const [open, setOpen] = useState(false);
      const { containerRef } = useModalA11y<HTMLDivElement>({
        active: open,
        onClose: () => setOpen(false),
      });
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open modal</button>
          {open && (
            <div ref={containerRef} tabIndex={-1}>
              No focusable children
            </div>
          )}
        </div>
      );
    }

    render(<EmptyHarness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const panel = screen.getByText('No focusable children');
    await waitFor(() => expect(panel).toHaveFocus());

    await user.tab();
    expect(panel).toHaveFocus();
  });
});
