import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductForm } from '../ProductForm';
import type { Product } from '../../types/product';

const mockProduct: Product = {
  id: 1,
  nombre: 'Chía',
  categoria: 'Semillas/Cereal',
  formato: '11,34',
  precioNeto: 9200,
  disponible: true,
};

function renderForm(product?: Product) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  const view = render(
    <ProductForm
      product={product}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  return { onSubmit, onCancel, view };
}

describe('ProductForm — create mode', () => {
  it('renders "Nuevo Producto" title', () => {
    renderForm();
    expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();
  });

  it('renders empty nombre input', () => {
    renderForm();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('');
  });

  it('renders submit button as "Crear Producto"', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Crear Producto' })).toBeInTheDocument();
  });

  it('calls onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows validation error for empty nombre on submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error for negative precioNeto', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    // Fill all fields valid first, then set negative price
    await user.type(screen.getByLabelText(/nombre/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'Legumbres');
    await user.type(screen.getByLabelText(/formato/i), '1,5');

    // Use native value setter to bypass jsdom's type=number coercion
    const precioInput = screen.getByLabelText(/precio neto/i);
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )!.set!;
    await act(() => {
      nativeSetter.call(precioInput, '-5');
      precioInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Verify the state updated (bruto should show negative price)
    expect(screen.getByText('$-6')).toBeInTheDocument();

    // Now submit and check validation
    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombre/i), 'Nuevo Producto');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'Legumbres');
    await user.type(screen.getByLabelText(/formato/i), '1,5');
    const precioInput = screen.getByLabelText(/precio neto/i);
    await user.clear(precioInput);
    await user.type(precioInput, '5000');
    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    expect(onSubmit).toHaveBeenCalledWith({
      nombre: 'Nuevo Producto',
      categoria: 'Legumbres',
      formato: '1,5',
      precioNeto: 5000,
      disponible: true,
    });
  });

  it('shows validation error for invalid formato on submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombre/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'Legumbres');
    await user.type(screen.getByLabelText(/formato/i), 'abc');
    const precioInput = screen.getByLabelText(/precio neto/i);
    await user.clear(precioInput);
    await user.type(precioInput, '5000');
    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    expect(screen.getByText('Formato inválido. Use formato chileno (ej: 11,34)')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not validate formato when campo formato is empty', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombre/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'Legumbres');
    const precioInput = screen.getByLabelText(/precio neto/i);
    await user.clear(precioInput);
    await user.type(precioInput, '5000');
    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('blocks submit with a validation error when precioNeto is cleared (empty, not 0)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    // Fill everything valid, then clear the price field completely
    await user.type(screen.getByLabelText(/nombre/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'Legumbres');
    await user.type(screen.getByLabelText(/formato/i), '1,5');
    const precioInput = screen.getByLabelText(/precio neto/i);
    await user.clear(precioInput);
    await user.click(screen.getByRole('button', { name: 'Crear Producto' }));

    // Clearing the field must NOT silently submit $0
    expect(screen.getByText('El precio es obligatorio')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ProductForm — edit mode', () => {
  it('renders "Editar Producto" title', () => {
    renderForm(mockProduct);
    expect(screen.getByText('Editar Producto')).toBeInTheDocument();
  });

  it('prefills form with product data', () => {
    renderForm(mockProduct);

    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Chía');
    expect(screen.getByLabelText(/categoría/i)).toHaveValue('Semillas/Cereal');
    expect(screen.getByLabelText(/formato/i)).toHaveValue('11,34');
    expect(screen.getByLabelText(/precio neto/i)).toHaveValue(9200);
    expect(screen.getByLabelText(/disponible/i)).toBeChecked();
  });

  it('renders submit button as "Guardar Cambios"', () => {
    renderForm(mockProduct);
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeInTheDocument();
  });

  it('calls onSubmit with updated data', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(mockProduct);

    // Modify nombre
    const nombreInput = screen.getByLabelText(/nombre/i);
    await user.clear(nombreInput);
    await user.type(nombreInput, 'Chía Orgánica');

    // Toggle disponible off
    await user.click(screen.getByLabelText(/disponible/i));

    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(onSubmit).toHaveBeenCalledWith({
      nombre: 'Chía Orgánica',
      categoria: 'Semillas/Cereal',
      formato: '11,34',
      precioNeto: 9200,
      disponible: false,
    });
  });
});

describe('ProductForm — precio bruto display', () => {
  it('shows $0 for empty precioNeto', () => {
    renderForm();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('shows calculated gross price when editing', () => {
    renderForm(mockProduct);
    // 9200 * 1.19 = 10948 → $10.948
    expect(screen.getByText('$10.948')).toBeInTheDocument();
  });

  it('updates gross price when net price changes', async () => {
    const user = userEvent.setup();
    renderForm();

    const precioInput = screen.getByLabelText(/precio neto/i);
    await user.clear(precioInput);
    await user.type(precioInput, '10000');

    // 10000 * 1.19 = 11900 → $11.900
    expect(screen.getByText('$11.900')).toBeInTheDocument();
  });
});
