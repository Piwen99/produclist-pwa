import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupReminder } from '../BackupReminder';
import { markBackedUp } from '../../utils/backupReminder';

describe('BackupReminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the reminder when there is no recent backup', () => {
    render(<BackupReminder onExport={vi.fn()} />);
    expect(screen.getByText(/no exportaste un respaldo/i)).toBeInTheDocument();
  });

  it('stays hidden right after a backup', () => {
    markBackedUp();
    render(<BackupReminder onExport={vi.fn()} />);
    expect(screen.queryByText(/respaldo/i)).not.toBeInTheDocument();
  });

  it('calls onExport and hides when exporting now', async () => {
    const onExport = vi.fn();
    render(<BackupReminder onExport={onExport} />);

    await userEvent.click(screen.getByRole('button', { name: /exportar ahora/i }));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/no exportaste un respaldo/i)).not.toBeInTheDocument();
  });

  it('hides when dismissed', async () => {
    render(<BackupReminder onExport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /descartar recordatorio/i }));

    expect(screen.queryByText(/no exportaste un respaldo/i)).not.toBeInTheDocument();
  });
});
