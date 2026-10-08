import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DataProvider } from '../../data/DataProvider';
import { createInMemoryRepositories } from '../../data/testing/inMemoryRepos';
import { PDFButton } from '../PDFButton';
import type { Product } from '../../types/product';

const captured = vi.hoisted(() => ({ productProps: [] as Array<{ products?: Product[] }> }));

vi.mock('../../pdf/ProductPDFDocument', () => ({
  PDFDownloadLink: ({
    children,
    document,
  }: {
    children: (state: { loading: boolean; error: Error | null }) => unknown;
    document: ReactNode;
  }) => (
    <>
      {document}
      {children({ loading: false, error: null })}
    </>
  ),
  ProductPDFDocument: (props: { products?: Product[] }) => {
    captured.productProps.push(props);
    return null;
  },
}));

const products: Product[] = [
  {
    id: 1,
    nombre: 'Almendras',
    categoria: 'Frutos Secos',
    formato: '1',
    precioNeto: 1000,
    disponible: true,
  },
];

function renderButton(seed: Product[] = products, disabled = false) {
  const repos = createInMemoryRepositories({ userId: 'user-1', isAdmin: false }, seed);
  return render(
    <DataProvider repos={repos} userId="user-1">
      <PDFButton disabled={disabled} />
    </DataProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  captured.productProps.length = 0;
});

describe('PDFButton', () => {
  it('passes the current products from useData to the PDF document', async () => {
    renderButton();

    const button = await screen.findByRole('button', { name: /generar pdf/i });
    expect(button).toBeInTheDocument();

    await waitFor(() => expect(captured.productProps.length).toBeGreaterThan(0));
    const last = captured.productProps.at(-1);
    expect(last?.products).toHaveLength(1);
    expect(last?.products?.[0].nombre).toBe('Almendras');
  });

  it('never passes an undefined products prop to the document', async () => {
    renderButton();

    await screen.findByRole('button', { name: /generar pdf/i });
    await waitFor(() => expect(captured.productProps.length).toBeGreaterThan(0));

    for (const props of captured.productProps) {
      expect(Array.isArray(props.products)).toBe(true);
    }
  });

  it('honors the disabled prop', async () => {
    renderButton(products, true);

    const button = await screen.findByRole('button', { name: /generar pdf/i });
    expect(button).toBeDisabled();
  });
});
