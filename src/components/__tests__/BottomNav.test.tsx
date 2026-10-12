import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '../BottomNav';

function renderNav(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('renders the main navigation landmark', () => {
    renderNav();

    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
  });

  it('renders the five destinations with accessible names and hrefs', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });

    const expected = [
      { name: 'Productos', href: '/' },
      { name: 'Cotizar', href: '/cotizador' },
      { name: 'Historial', href: '/historial' },
      { name: 'Listas', href: '/listas' },
      { name: 'Clientes', href: '/clientes' },
    ];

    expect(within(nav).getAllByRole('link')).toHaveLength(expected.length);

    for (const { name, href } of expected) {
      const link = within(nav).getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
    }
  });

  it('marks the active destination with aria-current="page"', () => {
    renderNav('/cotizador');
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });

    expect(within(nav).getByRole('link', { name: 'Cotizar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Productos' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
