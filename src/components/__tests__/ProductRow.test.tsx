import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductRow } from '../ProductRow';
import type { Product } from '../../types/product';

const mockProduct: Product = {
  id: 1,
  nombre: 'Chía',
  categoria: 'Semillas/Cereal',
  formato: '11,34',
  precioNeto: 9200,
  disponible: true,
};

const mockProductNoDisponible: Product = {
  ...mockProduct,
  disponible: false,
};

function renderRow(product = mockProduct) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onStartEdit = vi.fn();

  const view = render(
    <ProductRow
      product={product}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onStartEdit={onStartEdit}
    />
  );

  return { onUpdate, onDelete, onStartEdit, view };
}

describe('ProductRow', () => {
  it('renders product name and format', () => {
    renderRow();
    expect(screen.getByText('Chía')).toBeInTheDocument();
    expect(screen.getByText('11,34 kg')).toBeInTheDocument();
  });

  it('renders net price and gross price', () => {
    renderRow();
    // Neto: $9.200 (CLP), Bruto: 9200 * 1.19 = 10948 → $10.948
    expect(screen.getByText('Neto: $9.200')).toBeInTheDocument();
    expect(screen.getByText('$10.948')).toBeInTheDocument();
  });

  it('shows "Disponible" badge when product is available', () => {
    renderRow();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('shows "No disponible" badge when product is not available', () => {
    renderRow(mockProductNoDisponible);
    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });

  it('applies opacity-50 when product is not available', () => {
    const { view } = renderRow(mockProductNoDisponible);
    const row = view.container.querySelector('.product-row');
    expect(row).toHaveClass('opacity-50');
  });

  it('does NOT apply opacity-50 when product is available', () => {
    const { view } = renderRow(mockProduct);
    const row = view.container.querySelector('.product-row');
    expect(row).not.toHaveClass('opacity-50');
  });

  it('calls onUpdate with opposite disponible when toggling availability', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Marcar como no disponible' }));
    expect(onUpdate).toHaveBeenCalledWith(1, { disponible: false });
  });

  it('calls onUpdate with disponible:true when product was not available', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderRow(mockProductNoDisponible);

    await user.click(screen.getByRole('button', { name: 'Marcar como disponible' }));
    expect(onUpdate).toHaveBeenCalledWith(1, { disponible: true });
  });

  it('calls onStartEdit when clicking edit button', async () => {
    const user = userEvent.setup();
    const { onStartEdit } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Editar producto' }));
    expect(onStartEdit).toHaveBeenCalledWith(mockProduct);
  });

  it('calls onStartEdit on double-click', async () => {
    const user = userEvent.setup();
    const { onStartEdit } = renderRow();

    const row = screen.getByText('Chía').closest('.product-row')!;
    await user.dblClick(row);
    expect(onStartEdit).toHaveBeenCalledWith(mockProduct);
  });

  it('shows ConfirmDialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole('button', { name: 'Eliminar producto' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('¿Estás seguro de eliminar')).toBeInTheDocument();
    expect(screen.getByText('"Chía"')).toBeInTheDocument();
  });

  it('calls onDelete with product id when confirming delete', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderRow();

    // Open dialog
    await user.click(screen.getByRole('button', { name: 'Eliminar producto' }));
    // Confirm
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('closes ConfirmDialog without calling onDelete when cancelling', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderRow();

    // Open dialog
    await user.click(screen.getByRole('button', { name: 'Eliminar producto' }));
    // Cancel
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes ConfirmDialog on Escape key', async () => {
    const { onDelete } = renderRow();

    // Click delete button to open the dialog
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar producto' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Fire keydown on the dialog (it handles onKeyDown for Escape)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
