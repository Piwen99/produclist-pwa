import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataProvider } from '../../data/DataProvider';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import { PDFButton } from '../PDFButton';

vi.mock('../../pdf/ProductPDFDocument', () => {
  throw new Error('boom');
});

function renderButton() {
  const repos = createInMemoryRepositories({ userId: 'user-1', isAdmin: false });
  return render(
    <DataProvider repos={repos} userId="user-1">
      <PDFButton />
    </DataProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PDFButton error recovery', () => {
  it('shows an enabled refresh button when the PDF module cannot be imported', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderButton();

    const button = await screen.findByRole('button', { name: /actualizar pdf/i });
    expect(button).toBeEnabled();
  });
});
