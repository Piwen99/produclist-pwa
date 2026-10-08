import { describe, it, expect } from 'vitest';
import { OwnershipError } from '../../ports';
import {
  assertRowAffected,
  duplicateProductMessage,
  isUniqueViolation,
  mapPostgrestError,
  productChangesToRow,
  productInputToInsert,
  rowToProduct,
} from '../mappers';
import type { ProductRow } from '../rows';
import type { ProductInput } from '../../../types/product';

const ROW: ProductRow = {
  id: 7,
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precio_neto: 1200,
  disponible: true,
  owner_id: 'user-1',
  created_at: '2026-10-08T00:00:00.000Z',
};

const INPUT: ProductInput = {
  nombre: 'Almendras',
  categoria: 'Frutos Secos',
  formato: '1',
  precioNeto: 1200,
  disponible: true,
};

describe('rowToProduct', () => {
  it('maps snake_case columns and carries the owner id', () => {
    expect(rowToProduct(ROW)).toEqual({
      id: 7,
      nombre: 'Almendras',
      categoria: 'Frutos Secos',
      formato: '1',
      precioNeto: 1200,
      disponible: true,
      ownerId: 'user-1',
    });
  });
});

describe('productInputToInsert', () => {
  it('maps precioNeto to precio_neto and omits owner_id when not provided', () => {
    expect(productInputToInsert(INPUT)).toEqual({
      nombre: 'Almendras',
      categoria: 'Frutos Secos',
      formato: '1',
      precio_neto: 1200,
      disponible: true,
    });
  });

  it('includes owner_id when provided', () => {
    expect(productInputToInsert(INPUT, 'user-1')).toEqual({
      nombre: 'Almendras',
      categoria: 'Frutos Secos',
      formato: '1',
      precio_neto: 1200,
      disponible: true,
      owner_id: 'user-1',
    });
  });
});

describe('productChangesToRow', () => {
  it('maps only the provided fields', () => {
    expect(productChangesToRow({ precioNeto: 1500, disponible: false })).toEqual({
      precio_neto: 1500,
      disponible: false,
    });
  });

  it('returns an empty patch when nothing is provided', () => {
    expect(productChangesToRow({})).toEqual({});
  });
});

describe('unique violation helpers', () => {
  it('detects 23505 and ignores other errors', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key value' })).toBe(true);
    expect(isUniqueViolation({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('renders the exact Spanish duplicate message without a trailing period', () => {
    expect(duplicateProductMessage('Almendras')).toBe(
      'Ya existe un producto llamado "Almendras"',
    );
  });

  it('maps 23505 to the duplicate message when the name is known', () => {
    const mapped = mapPostgrestError({ code: '23505', message: 'duplicate key value' }, 'Almendras');
    expect(mapped.message).toBe('Ya existe un producto llamado "Almendras"');
  });

  it('passes other errors through by message', () => {
    expect(mapPostgrestError({ code: '42501', message: 'permission denied' }).message).toBe(
      'permission denied',
    );
  });
});

describe('assertRowAffected', () => {
  it('throws OwnershipError when no row was affected', () => {
    expect(() => {
      assertRowAffected([]);
    }).toThrow(OwnershipError);
  });

  it('also throws on a null result', () => {
    expect(() => {
      assertRowAffected(null);
    }).toThrow(OwnershipError);
  });

  it('accepts a non-empty affected result', () => {
    expect(() => {
      assertRowAffected([{ id: 1 }]);
    }).not.toThrow();
  });

  it('defaults to the Spanish ownership message', () => {
    expect(new OwnershipError().message).toBe('No se puede modificar un registro de otro usuario.');
  });
});
